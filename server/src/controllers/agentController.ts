import type { Request, Response } from "express";
import { runAgent } from "../services/aiService";

export async function runAgentController(req: Request, res: Response): Promise<void> {
  try {
    const { messages, model, sessionId, systemPrompt, useRag, collectionName } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: "messages array is required" });
      return;
    }

    const result = await runAgent({
      messages,
      model,
      sessionId,
      systemPrompt,
      useRag,
      collectionName,
    });
    res.json(result);
  } catch (error) {
    console.error("[Agent] run failed", error);
    res.status(500).json({ error: "Agent run failed" });
  }
}
