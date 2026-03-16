import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { Conversation } from "../models/Conversation";
import { streamChat, generateTitle, ingestDocument, voiceChat } from "../services/aiService";
import { getMemoryItems, saveMemoryItem, summarizeConversation } from "../services/memoryService";

export async function processSpeech(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    if (!req.file) {
      res.status(400).json({ error: "No audio file uploaded" });
      return;
    }

    const model = (req.body.model as string) || "llama3";
    const sessionId = req.body.sessionId as string | undefined;
    const useRag = (req.body.useRag as string | undefined) === "true";
    const collectionName = (req.body.collectionName as string) || userId;

    const result = await voiceChat({
      filePath: req.file.path,
      sessionId,
      model,
      useRag,
      collectionName,
    });

    // Maintain session and conversation immediate update in DB
    if (result.sessionId) {
      const conversation = await Conversation.findOne({ _id: result.sessionId, userId });
      if (conversation) {
        conversation.messages.push({ role: "user", content: result.transcription, timestamp: new Date() });
        conversation.messages.push({ role: "assistant", content: result.answer, timestamp: new Date() });

        // Summarize conversation for long-term memory
        const summary = await summarizeConversation(conversation, model);
        if (summary) {
          conversation.memorySummary = summary;
          await saveMemoryItem(userId, summary);
        }

        // Auto-title
        if (!conversation.title || conversation.title === "New Chat") {
          try {
            conversation.title = await generateTitle(result.transcription, model);
          } catch {
            conversation.title = result.transcription.slice(0, 60);
          }
        }

        await conversation.save();
      }
    }

    res.json(result);
  } catch (error) {
    console.error("[Voice] processing failed", error);
    res.status(500).json({ error: "Voice processing failed" });
  }
}
