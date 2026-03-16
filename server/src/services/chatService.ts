import { Conversation } from "../models/Conversation";
import { streamChat, generateTitle } from "./aiService";
import { getMemoryItems, saveMemoryItem, summarizeConversation } from "./memoryService";

function parseSseTokens(raw: string): string {
  let result = "";
  for (const line of raw.split("\n")) {
    if (!line.startsWith("data: ")) continue;
    const payload = line.slice(6).trim();
    if (!payload) continue;

    try {
      const json = JSON.parse(payload);
      if (typeof json.token === "string") {
        result += json.token;
      }
    } catch {
      result += payload;
    }
  }
  return result;
}

export interface SendChatArgs {
  userId: string;
  message: string;
  sessionId?: string;
  model?: string;
  useRag?: boolean;
  collectionName?: string;
}

export async function sendChatMessage(args: SendChatArgs) {
  const { userId, message, sessionId, model, useRag, collectionName } = args;

  let conversation = null;
  if (sessionId) {
    conversation = await Conversation.findOne({ _id: sessionId, userId });
  }

  let isNew = false;
  if (!conversation) {
    conversation = await Conversation.create({
      userId,
      model: model || "llama3",
      title: "New Chat",
      messages: [],
    });
    isNew = true;
  }

  conversation.messages.push({ role: "user", content: message, timestamp: new Date() });
  await conversation.save();

  const history = conversation.messages
    .slice(-25)
    .map((msg) => ({ role: msg.role, content: msg.content }));

  const memoryItems = await getMemoryItems(userId, 5);
  let systemPrompt = "";
  if (memoryItems.length) {
    systemPrompt =
      "Long-term memory:\n" +
      memoryItems.map((chunk, idx) => `${idx + 1}. ${chunk}`).join("\n") +
      "\n\nUse this information if relevant to answer the user.";
  }

  const aiResponse = await streamChat({
    messages: history,
    model: model || conversation.model,
    useRag,
    collectionName,
    systemPrompt: systemPrompt || undefined,
    userId,
    sessionId: String(conversation._id),
  });

  if (!aiResponse.body) {
    throw new Error("No response body from AI service");
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
    content: assistantText || "",
    timestamp: new Date(),
  };

  conversation.messages.push(assistantMessage);

  if (isNew && conversation.messages.length <= 4) {
    try {
      conversation.title = await generateTitle(message, model || conversation.model);
    } catch {
      conversation.title = message.slice(0, 120);
    }
  }

  const summary = await summarizeConversation(conversation, model || conversation.model);
  if (summary) {
    conversation.memorySummary = summary;
    await saveMemoryItem(userId, summary);
  }

  await conversation.save();

  return {
    conversation,
    assistantText,
    sessionId: conversation._id,
  };
}
