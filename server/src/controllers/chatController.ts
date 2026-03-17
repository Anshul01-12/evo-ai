import { Response } from "express";
import fs from "fs";
import path from "path";
import os from "os";
import { Conversation } from "../models/Conversation";
import { AuthRequest } from "../middleware/auth";
import {
  streamChat,
  generateTitle,
  ingestDocument,
  analyzeImage,
  generateImage,
} from "../services/aiService";
import {
  saveMemoryItem,
  summarizeConversation,
  buildMemoryPrompt,
  extractUserFacts,
  saveUserProfile,
} from "../services/memoryService";

// ────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────

function parseSseTokens(raw: string): string {
  let result = "";
  for (const line of raw.split("\n")) {
    if (!line.startsWith("data: ")) continue;
    const payload = line.slice(6).trim();
    if (!payload || payload === "[DONE]") continue;
    try {
      const json = JSON.parse(payload);
      if (typeof json.token === "string") result += json.token;
      else if (typeof json.content === "string") result += json.content;
    } catch {
      result += payload;
    }
  }
  return result;
}

async function resolveConversation(userId: string, sessionId?: string, model?: string) {
  if (sessionId) {
    const existing = await Conversation.findOne({ _id: sessionId, userId });
    if (existing) return { conversation: existing, isNew: false };
  }
  const conversation = await Conversation.create({
    userId,
    model: model || "llama3",
    title: "New Chat",
    messages: [],
  });
  return { conversation, isNew: true };
}

function isImageMimeType(mimetype: string): boolean {
  return ["image/png", "image/jpeg", "image/webp"].includes(mimetype);
}

// ────────────────────────────────────────────────────
// POST /api/chat
// ────────────────────────────────────────────────────

export async function chat(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId;
    const { message, sessionId, model } = req.body;

    if (!message || typeof message !== "string" || !message.trim()) {
      res.status(400).json({ error: "Message is required" });
      return;
    }

    // If no auth / no DB, just call AI service directly
    if (!userId) {
      const messages = [{ role: "user", content: message }];
      const aiResponse = await streamChat({ messages, model: model || "llama3" });

      if (!aiResponse.body) {
        res.status(502).json({ error: "No response from AI service" });
        return;
      }

      const reader = aiResponse.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistantText += parseSseTokens(decoder.decode(value, { stream: true }));
      }

      res.json({
        sessionId: null,
        model: model || "llama3",
        message: { role: "assistant", content: assistantText || "(empty response)", timestamp: new Date() },
      });
      return;
    }

    const { conversation, isNew } = await resolveConversation(userId, sessionId, model);

    conversation.messages.push({ role: "user", content: message, timestamp: new Date() });
    await conversation.save();

    const history = conversation.messages
      .slice(-25)
      .map((m) => ({ role: m.role, content: m.content }));

    const memoryPrompt = await buildMemoryPrompt(userId);

    const aiResponse = await streamChat({
      messages: history,
      model: model || conversation.model,
      systemPrompt: memoryPrompt || undefined,
      userId,
      sessionId: String(conversation._id),
    });

    if (!aiResponse.body) {
      res.status(502).json({ error: "No response from AI service" });
      return;
    }

    const reader = aiResponse.body.getReader();
    const decoder = new TextDecoder();
    let assistantText = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      assistantText += parseSseTokens(decoder.decode(value, { stream: true }));
    }

    const assistantMessage = {
      role: "assistant" as const,
      content: assistantText || "(empty response)",
      timestamp: new Date(),
    };
    conversation.messages.push(assistantMessage);

    if (isNew && conversation.messages.length <= 4) {
      try {
        conversation.title = await generateTitle(message, model || conversation.model);
      } catch {
        conversation.title = message.slice(0, 50);
      }
    }

    await conversation.save();

    if (conversation.messages.length >= 4 && conversation.messages.length % 4 === 0) {
      summarizeConversation(conversation, model || conversation.model)
        .then((summary) => {
          if (summary) {
            conversation.memorySummary = summary;
            conversation.save().catch(() => {});
            saveMemoryItem(userId, summary).catch((e) =>
              console.error("[Memory] save failed:", e)
            );
          }
        })
        .catch((err) => console.error("[Memory] summarize failed:", err));
    }

    if (conversation.messages.length >= 2) {
      const recentMsgs = conversation.messages.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      }));
      extractUserFacts(recentMsgs, model || conversation.model)
        .then((facts) => {
          if (Object.keys(facts).length > 0) {
            saveUserProfile(userId, facts).catch((e) =>
              console.error("[Memory] profile save failed:", e)
            );
          }
        })
        .catch((err) => console.error("[Memory] profile extraction failed:", err));
    }

    res.json({
      sessionId: conversation._id,
      model: conversation.model,
      message: assistantMessage,
      conversation,
    });
  } catch (error) {
    console.error("[POST /chat] Error:", error);
    res.status(500).json({ error: "Chat processing failed" });
  }
}

// ────────────────────────────────────────────────────
// GET /api/chat/history
// ────────────────────────────────────────────────────

export async function history(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId;

    if (!userId) {
      res.json({ conversations: [], pagination: { page: 1, limit: 50, total: 0, pages: 0 } });
      return;
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const skip = (page - 1) * limit;

    const [conversations, total] = await Promise.all([
      Conversation.find({ userId, isArchived: false })
        .select("title model updatedAt createdAt")
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit),
      Conversation.countDocuments({ userId, isArchived: false }),
    ]);

    res.json({
      conversations,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("[GET /chat/history] Error:", error);
    res.status(500).json({ error: "Failed to fetch history" });
  }
}

// ────────────────────────────────────────────────────
// POST /api/chat/upload
// ────────────────────────────────────────────────────

export async function uploadFile(req: AuthRequest, res: Response): Promise<void> {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const userId = req.userId || "anonymous";
    const collectionName = (req.body.collectionName as string) || userId;

    let ingestionResult = null;
    if (file.mimetype === "application/pdf") {
      // Write buffer to temp file for AI service ingestion
      const tmpPath = path.join(os.tmpdir(), `evo-${Date.now()}-${file.originalname}`);
      try {
        fs.writeFileSync(tmpPath, file.buffer);
        ingestionResult = await ingestDocument({
          filePath: tmpPath,
          filename: file.originalname,
          collectionName,
        });
      } catch (err) {
        console.error("[Upload] AI ingest failed:", err);
      } finally {
        try { fs.unlinkSync(tmpPath); } catch {}
      }
    }

    res.status(201).json({
      message: "File uploaded successfully",
      file: {
        filename: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
      },
      ingestion: ingestionResult
        ? { status: "ready", chunkCount: ingestionResult.chunkCount, collectionName }
        : { status: file.mimetype === "application/pdf" ? "failed" : "skipped" },
    });
  } catch (error) {
    console.error("[POST /chat/upload] Error:", error);
    res.status(500).json({ error: "Upload failed" });
  }
}

export async function analyzeUploadedImage(req: AuthRequest, res: Response): Promise<void> {
  try {
    const file = req.file;
    const question = typeof req.body.question === "string" ? req.body.question.trim() : "";
    const model = typeof req.body.model === "string" ? req.body.model : "llava";

    if (!file) {
      res.status(400).json({ error: "No image uploaded" });
      return;
    }

    if (!isImageMimeType(file.mimetype)) {
      res.status(400).json({ error: "Only PNG, JPEG, and WEBP images are supported" });
      return;
    }

    if (!question) {
      res.status(400).json({ error: "Question is required" });
      return;
    }

    const imageBase64 = file.buffer.toString("base64");

    const visionResult: any = await analyzeImage({
      imageBase64,
      prompt: question,
      model,
    });

    const answerText = visionResult.description || visionResult.answer || "(empty response)";
    const assistantMessage = {
      role: "assistant" as const,
      content: answerText,
      timestamp: new Date(),
    };

    // If user is authenticated, save to conversation with image in DB
    const userId = req.userId;
    const sessionId = typeof req.body.sessionId === "string" ? req.body.sessionId : undefined;
    let conversationId = null;

    if (userId) {
      try {
        const { conversation } = await resolveConversation(userId, sessionId, model);
        conversation.messages.push({
          role: "user",
          content: `Question about image "${file.originalname}": ${question}`,
          imageData: imageBase64,
          imageMime: file.mimetype,
          timestamp: new Date(),
        });
        conversation.messages.push(assistantMessage);
        conversation.title = `Image: ${file.originalname.slice(0, 40)}`;
        await conversation.save();
        conversationId = conversation._id;
      } catch (e) {
        console.error("[analyzeImage] conversation save failed:", e);
      }
    }

    res.status(201).json({
      sessionId: conversationId,
      model: visionResult.model || model,
      image: {
        filename: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        dataUrl: `data:${file.mimetype};base64,${imageBase64}`,
      },
      message: assistantMessage,
      metadata: visionResult.metadata || {},
    });
  } catch (error) {
    console.error("[POST /chat/analyze-image] Error:", error);
    res.status(500).json({ error: "Image analysis failed" });
  }
}

export async function generateChatImage(req: AuthRequest, res: Response): Promise<void> {
  try {
    const prompt = typeof req.body.prompt === "string" ? req.body.prompt.trim() : "";
    const width = Number(req.body.width) || 512;
    const height = Number(req.body.height) || 512;
    const steps = Number(req.body.steps) || 30;
    const guidanceScale = Number(req.body.guidanceScale) || 7.5;

    if (!prompt) {
      res.status(400).json({ error: "Prompt is required" });
      return;
    }

    const generationResult: any = await generateImage({ prompt, width, height, steps, guidanceScale });

    const imageBase64 =
      typeof generationResult.image_base64 === "string"
        ? generationResult.image_base64
        : typeof generationResult.image === "string"
          ? generationResult.image
          : "";

    if (!imageBase64) {
      res.status(502).json({ error: "Image generation returned no image" });
      return;
    }

    const mimeType =
      typeof generationResult.mime_type === "string" ? generationResult.mime_type : "image/png";
    const dataUrl = `data:${mimeType};base64,${imageBase64}`;

    const assistantMessage = {
      role: "assistant" as const,
      content: `Generated image for prompt: ${prompt}`,
      timestamp: new Date(),
    };

    // If user is authenticated, save to conversation
    const userId = req.userId;
    const sessionId = typeof req.body.sessionId === "string" ? req.body.sessionId : undefined;
    let conversationId = null;

    if (userId) {
      try {
        const { conversation, isNew } = await resolveConversation(userId, sessionId, "stable-diffusion");
        conversation.messages.push({ role: "user", content: `Generate an image: ${prompt}`, timestamp: new Date() });
        conversation.messages.push(assistantMessage);
        if (isNew) conversation.title = `Image Gen: ${prompt.slice(0, 40)}`;
        await conversation.save();
        conversationId = conversation._id;
      } catch (e) {
        console.error("[generateImage] conversation save failed:", e);
      }
    }

    res.status(201).json({
      sessionId: conversationId,
      model: "stable-diffusion",
      image: { prompt, mimeType, dataUrl, width, height },
      message: assistantMessage,
      metadata: generationResult.metadata || {},
    });
  } catch (error) {
    console.error("[POST /chat/generate-image] Error:", error);
    res.status(500).json({ error: "Image generation failed" });
  }
}

// ────────────────────────────────────────────────────
// GET /api/chat/conversations/:id
// ────────────────────────────────────────────────────

export async function getConversation(req: AuthRequest, res: Response): Promise<void> {
  try {
    const conversation = await Conversation.findOne({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    res.json(conversation);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch conversation" });
  }
}

// ────────────────────────────────────────────────────
// DELETE /api/chat/conversations/:id
// ────────────────────────────────────────────────────

export async function deleteConversation(req: AuthRequest, res: Response): Promise<void> {
  try {
    const result = await Conversation.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!result) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    res.json({ success: true, deletedId: req.params.id });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete conversation" });
  }
}
