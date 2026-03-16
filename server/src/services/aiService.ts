import fs from "fs";

import { config } from "../config";

const AI_URL = config.aiServiceUrl;

export async function streamChat(params: {
  messages: { role: string; content: string }[];
  model?: string;
  useRag?: boolean;
  collectionName?: string;
  systemPrompt?: string;
  userId?: string;
  sessionId?: string;
}): Promise<Response> {
  const bodyPayload: Record<string, unknown> = {
    messages: params.messages,
    model: params.model || "llama3",
    use_rag: params.useRag || false,
    collection_name: params.collectionName,
    user_id: params.userId || "server-chat",
    session_id: params.sessionId,
  };

  if (params.systemPrompt) {
    bodyPayload.system_prompt = params.systemPrompt;
  }

  const response = await fetch(`${AI_URL}/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bodyPayload),
  });

  if (!response.ok) {
    throw new Error(`AI service error: ${response.status}`);
  }

  return response;
}

export async function ingestDocument(params: {
  filePath: string;
  filename: string;
  collectionName: string;
}): Promise<{ chunkCount: number }> {
  const response = await fetch(`${AI_URL}/documents/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      file_path: params.filePath,
      filename: params.filename,
      collection_name: params.collectionName,
    }),
  });

  if (!response.ok) {
    throw new Error(`AI ingest error: ${response.status}`);
  }

  return response.json() as Promise<{ chunkCount: number }>;
}

export async function generateTitle(message: string, model?: string): Promise<string> {
  const response = await fetch(`${AI_URL}/chat/title`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, model: model || "llama3" }),
  });

  if (!response.ok) {
    return "New Chat";
  }

  const data = (await response.json()) as { title: string };
  return data.title;
}

export async function queryDocument(params: {
  question: string;
  collectionName: string;
  model?: string;
  topK?: number;
}) {
  const response = await fetch(`${AI_URL}/documents/qa`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question: params.question,
      collection_name: params.collectionName,
      model: params.model || "llama3",
      top_k: params.topK || 5,
    }),
  });

  if (!response.ok) {
    throw new Error(`Document QA failed: ${response.status}`);
  }

  return response.json();
}

export async function transcribeAudio(filePath: string) {
  const response = await fetch(`${AI_URL}/voice/transcribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_path: filePath }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Transcription failed: ${response.status} - ${body}`);
  }

  return response.json();
}

export async function synthesizeSpeech(text: string, voice = "alloy") {
  const response = await fetch(`${AI_URL}/voice/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voice }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`TTS failed: ${response.status} - ${body}`);
  }

  return response.json();
}

export async function voiceChat(params: {
  filePath: string;
  sessionId?: string;
  model?: string;
  useRag?: boolean;
  collectionName?: string;
}) {
  const formData = new FormData();
  const fileBuffer = await fs.promises.readFile(params.filePath);
  const fileName = params.filePath.split(/[\\/]/).pop() || "voice-input.webm";

  formData.append(
    "file",
    new Blob([fileBuffer], { type: "application/octet-stream" }),
    fileName
  );
  formData.append("model", params.model || "llama3");
  formData.append("use_rag", params.useRag ? "true" : "false");
  if (params.sessionId) {
    formData.append("session_id", params.sessionId);
  }
  if (params.collectionName) {
    formData.append("collection_name", params.collectionName);
  }

  const response = await fetch(`${AI_URL}/voice/process-upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Voice chat failed: ${response.status} - ${body}`);
  }

  return response.json();
}

export async function generateImage(params: {
  prompt: string;
  width?: number;
  height?: number;
  steps?: number;
  guidanceScale?: number;
}) {
  const response = await fetch(`${AI_URL}/image/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: params.prompt,
      width: params.width || 512,
      height: params.height || 512,
      steps: params.steps || 30,
      guidance_scale: params.guidanceScale || 7.5,
    }),
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(`Image generation failed: ${response.status} - ${bodyText}`);
  }

  return response.json();
}

export async function runAgent(params: {
  messages: { role: string; content: string }[];
  model?: string;
  userId?: string;
  sessionId?: string;
  systemPrompt?: string;
  useRag?: boolean;
  collectionName?: string;
}) {
  const response = await fetch(`${AI_URL}/agent/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: params.messages,
      model: params.model || "llama3",
      user_id: params.userId || "server-agent",
      session_id: params.sessionId,
      system_prompt: params.systemPrompt,
      use_rag: params.useRag || false,
      collection_name: params.collectionName,
    }),
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(`Agent run failed: ${response.status} - ${bodyText}`);
  }

  return response.json();
}

export async function analyzeImage(params: {
  filePath?: string;
  imageBase64?: string;
  prompt: string;
  model?: string;
}) {
  let base64 = params.imageBase64;

  if (!base64 && params.filePath) {
    const fileBuffer = await fs.promises.readFile(params.filePath);
    base64 = fileBuffer.toString("base64");
  }

  if (!base64) {
    throw new Error("imageBase64 or filePath must be provided");
  }

  const response = await fetch(`${AI_URL}/image/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image_base64: base64,
      prompt: params.prompt,
      model: params.model || "llava",
    }),
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(`Image analysis failed: ${response.status} - ${bodyText}`);
  }

  return response.json();
}
