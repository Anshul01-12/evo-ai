import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { DocumentModel } from "../models/Document";
import { ingestDocument, queryDocument as queryDocumentService } from "../services/aiService";

export async function uploadDocument(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const collectionName = (req.body.collectionName as string) || "default";

    const doc = await DocumentModel.create({
      userId: req.userId,
      filename: req.file.filename,
      originalName: req.file.originalname,
      filePath: req.file.path,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      collectionName,
      status: "processing",
    });

    // Ingest asynchronously
    ingestDocument({
      filePath: req.file.path,
      filename: req.file.originalname,
      collectionName,
    })
      .then(async (result) => {
        doc.chunkCount = result.chunkCount;
        doc.status = "ready";
        await doc.save();
      })
      .catch(async (err) => {
        console.error("[Document] Ingest error:", err);
        doc.status = "error";
        await doc.save();
      });

    res.status(201).json(doc);
  } catch (error) {
    res.status(500).json({ error: "Upload failed" });
  }
}

export async function getDocuments(req: AuthRequest, res: Response): Promise<void> {
  try {
    const docs = await DocumentModel.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json(docs);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch documents" });
  }
}

export async function deleteDocument(req: AuthRequest, res: Response): Promise<void> {
  try {
    await DocumentModel.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete document" });
  }
}

export async function queryDocument(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { question, collectionName, model, topK } = req.body;
    if (!question || !collectionName) {
      res.status(400).json({ error: "question and collectionName are required" });
      return;
    }

    const result = await queryDocumentService({
      question,
      collectionName,
      model: model ?? "llama3",
      topK: topK ?? 5,
    });

    res.json(result);
  } catch (error) {
    console.error("[Document QA] Error:", error);
    res.status(500).json({ error: "Document QA failed" });
  }
}
