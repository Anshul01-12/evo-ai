import { redisClient } from "../config/redis";
import { config } from "../config";
import type { IConversation } from "../models/Conversation";

const MEMORY_KEY_PREFIX = "evo:memory:";
const PROFILE_KEY_PREFIX = "evo:profile:";
const MAX_MEMORY_ITEMS = 50;

// ────────────────────────────────────────────────────
// Redis sorted-set storage (scored by timestamp)
// ────────────────────────────────────────────────────

export async function saveMemoryItem(userId: string, summary: string): Promise<void> {
  const key = `${MEMORY_KEY_PREFIX}${userId}`;
  const member = JSON.stringify({
    text: summary,
    createdAt: new Date().toISOString(),
  });
  await redisClient.zAdd(key, { score: Date.now(), value: member });

  // Evict oldest entries beyond limit
  const count = await redisClient.zCard(key);
  if (count > MAX_MEMORY_ITEMS) {
    await redisClient.zRemRangeByRank(key, 0, count - MAX_MEMORY_ITEMS - 1);
  }
}

export async function getMemoryItems(userId: string, limit = 5): Promise<string[]> {
  const key = `${MEMORY_KEY_PREFIX}${userId}`;
  const items = await redisClient.zRange(key, -limit, -1);
  return items.map((item) => {
    try {
      return JSON.parse(item).text || item;
    } catch {
      return item;
    }
  });
}

export async function clearMemory(userId: string): Promise<void> {
  await redisClient.del(`${MEMORY_KEY_PREFIX}${userId}`);
}

// ────────────────────────────────────────────────────
// Summarization via Python AI service
// ────────────────────────────────────────────────────

export async function summarizeConversation(
  conversation: IConversation,
  model?: string
): Promise<string> {
  // Only summarize if there are enough messages
  if (conversation.messages.length < 4) return "";

  const messages = conversation.messages.slice(-20).map((m) => ({
    role: m.role,
    content: m.content,
  }));

  try {
    const response = await fetch(`${config.aiServiceUrl}/chat/summarize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, model: model || "llama3" }),
    });

    if (!response.ok) return "";

    const data = (await response.json()) as { summary: string };
    return data.summary || "";
  } catch (err) {
    console.error("[Memory] Summarization failed:", err);
    return "";
  }
}

// ────────────────────────────────────────────────────
// User Profile (persistent facts about the user)
// ────────────────────────────────────────────────────

export async function getUserProfile(userId: string): Promise<Record<string, string>> {
  const key = `${PROFILE_KEY_PREFIX}${userId}`;
  const data = await redisClient.hGetAll(key);
  return data || {};
}

export async function saveUserProfileField(userId: string, field: string, value: string): Promise<void> {
  const key = `${PROFILE_KEY_PREFIX}${userId}`;
  await redisClient.hSet(key, field, value);
}

export async function saveUserProfile(userId: string, profile: Record<string, string>): Promise<void> {
  const key = `${PROFILE_KEY_PREFIX}${userId}`;
  for (const [field, value] of Object.entries(profile)) {
    if (value && value.trim()) {
      await redisClient.hSet(key, field, value.trim());
    }
  }
}

// ────────────────────────────────────────────────────
// Extract user facts from conversation via AI
// ────────────────────────────────────────────────────

export async function extractUserFacts(
  messages: { role: string; content: string }[],
  model?: string
): Promise<Record<string, string>> {
  try {
    const response = await fetch(`${config.aiServiceUrl}/chat/extract-profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, model: model || "groq-llama3-8b" }),
    });

    if (!response.ok) return {};

    const data = (await response.json()) as { profile: Record<string, string> };
    return data.profile || {};
  } catch (err) {
    console.error("[Memory] Profile extraction failed:", err);
    return {};
  }
}

// ────────────────────────────────────────────────────
// Build system prompt with memory context
// ────────────────────────────────────────────────────

export async function buildMemoryPrompt(userId: string): Promise<string> {
  const [items, profile] = await Promise.all([
    getMemoryItems(userId, 5),
    getUserProfile(userId),
  ]);

  const sections: string[] = [];

  // User profile section
  const profileEntries = Object.entries(profile).filter(([, v]) => v && v.trim());
  if (profileEntries.length > 0) {
    sections.push(
      "Known facts about this user (use naturally, don't repeat back unless asked):\n" +
      profileEntries.map(([k, v]) => `- ${k}: ${v}`).join("\n")
    );
  }

  // Conversation memory section
  if (items.length > 0) {
    sections.push(
      "Summaries from previous conversations:\n" +
      items.map((item, i) => `${i + 1}. ${item}`).join("\n")
    );
  }

  if (sections.length === 0) return "";

  return (
    "You have long-term memory about this user from previous interactions. " +
    "Use this context naturally when relevant. If the user asks you to remember something, acknowledge it.\n\n" +
    sections.join("\n\n") +
    "\n"
  );
}
