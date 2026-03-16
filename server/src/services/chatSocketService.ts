import { Socket } from "socket.io";
import { Conversation } from "../models/Conversation";
import { streamChat, generateTitle } from "./aiService";
import { buildMemoryPrompt, saveMemoryItem, summarizeConversation } from "./memoryService";

interface ChatPayload {
  userId: string;
  message: string;
  sessionId?: string;
  model?: string;
}

function extractSseTokens(raw: string): string[] {
  const tokens: string[] = [];
  for (const line of raw.split("\n")) {
    if (!line.startsWith("data: ")) continue;
    const payload = line.slice(6).trim();
    if (!payload) continue;

    try {
      const json = JSON.parse(payload);
      if (typeof json.token === "string") {
        tokens.push(json.token);
      }
    } catch {
      tokens.push(payload);
    }
  }
  return tokens;
}

/**
 * Handle a real-time chat message over WebSocket.
 *
 * Events emitted:
 *   chat:stream-start  → { sessionId }
 *   chat:stream        → { sessionId, text }
 *   chat:stream-end    → { sessionId, message, conversation }
 *   chat:error         → { error }
 */
export async function handleChatMessage(socket: Socket, payload: ChatPayload) {
  const { userId, message, sessionId, model } = payload;

  if (!message.trim()) {
    socket.emit("chat:error", { error: "Message is empty" });
    return;
  }

  // Resolve or create conversation
  let conversation = sessionId
    ? await Conversation.findOne({ _id: sessionId, userId })
    : null;

  const isNew = !conversation;

  if (!conversation) {
    conversation = await Conversation.create({
      userId,
      model: model || "llama3",
      title: "New Chat",
      messages: [],
    });
  }

  // Save user message
  conversation.messages.push({ role: "user", content: message, timestamp: new Date() });
  await conversation.save();

  // Build context window
  const history = conversation.messages
    .slice(-25)
    .map((m) => ({ role: m.role, content: m.content }));

  // Inject long-term memory into system prompt
  const memoryPrompt = await buildMemoryPrompt(userId);

  // Stream from Python AI service
  let aiResponse;
  try {
    aiResponse = await streamChat({
      messages: history,
      model: model || conversation.model,
      systemPrompt: memoryPrompt || undefined,
      userId,
      sessionId: String(conversation._id),
    });
  } catch (err) {
    console.error("[WS Chat] AI service stream failed:", err);
    socket.emit("chat:error", { error: "AI service unavailable" });
    return;
  }

  if (!aiResponse.body) {
    socket.emit("chat:error", { error: "AI response body missing" });
    return;
  }

  socket.emit("chat:stream-start", { sessionId: conversation._id });

  const reader = aiResponse.body.getReader();
  const decoder = new TextDecoder();
  let assistantText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const segment = decoder.decode(value, { stream: true });
    const tokens = extractSseTokens(segment);
    for (const token of tokens) {
      assistantText += token;
      socket.emit("chat:stream", { sessionId: conversation._id, text: token });
    }
  }

  // Save assistant message
  const assistantMessage = { role: "assistant", content: assistantText, timestamp: new Date() };
  conversation.messages.push(assistantMessage);

  // Auto-title for new conversations
  if (isNew && conversation.messages.length <= 4) {
    try {
      conversation.title = await generateTitle(message, model || conversation.model);
    } catch {
      conversation.title = message.slice(0, 50);
    }
  }

  await conversation.save();

  // Fire-and-forget: summarize for long-term memory every 4 messages
  if (conversation.messages.length >= 4 && conversation.messages.length % 4 === 0) {
    summarizeConversation(conversation, model || conversation.model)
      .then((summary) => {
        if (summary) {
          conversation!.memorySummary = summary;
          conversation!.save().catch(() => {});
          saveMemoryItem(userId, summary).catch((e) =>
            console.error("[Memory] save failed:", e)
          );
        }
      })
      .catch((err) => console.error("[Memory] summarize failed:", err));
  }

  socket.emit("chat:stream-end", {
    sessionId: conversation._id,
    message: assistantMessage,
    conversation,
  });
}
