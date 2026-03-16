import { io, type Socket } from "socket.io-client";

const API = import.meta.env.VITE_API_URL || "/api";

// ────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────

function getToken(): string | null {
  return localStorage.getItem("evo_token");
}

function getHeaders(): HeadersInit {
  const headers: HeadersInit = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { ...getHeaders(), ...options?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

// ────────────────────────────────────────────────────
// WebSocket (Socket.IO)
// ────────────────────────────────────────────────────

let socket: Socket | null = null;

export function initSocket(): Socket {
  if (socket?.connected) return socket;

  const token = getToken();
  socket = io(import.meta.env.VITE_API_WS_URL || window.location.origin, {
    autoConnect: false,
    auth: { token },
    transports: ["websocket"],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  socket.connect();

  socket.on("connect_error", (err) => {
    console.error("[Socket] connect error:", err.message);
  });

  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

export function isSocketConnected(): boolean {
  return socket?.connected ?? false;
}

/**
 * Send a chat message via WebSocket for real-time streaming.
 * Returns a cleanup function to unsubscribe listeners.
 */
export function sendSocketMessage(params: {
  message: string;
  sessionId?: string;
  model?: string;
  onToken: (token: string) => void;
  onDone: (conversationId: string) => void;
  onError: (error: string) => void;
}): () => void {
  const s = initSocket();

  if (!s.connected) {
    // Socket not ready — caller should fall back to HTTP
    params.onError("WebSocket not connected");
    return () => {};
  }

  let conversationId = params.sessionId || "";

  const onStreamStart = (data: { sessionId?: string }) => {
    conversationId = data?.sessionId || conversationId;
  };

  const onStream = (data: { text?: string }) => {
    if (typeof data?.text === "string") params.onToken(data.text);
  };

  const onStreamEnd = (data: { sessionId?: string }) => {
    params.onDone(data?.sessionId || conversationId);
    cleanup();
  };

  const onError = (data: { error?: string }) => {
    params.onError(data?.error || "Unknown error");
    cleanup();
  };

  const cleanup = () => {
    s.off("chat:stream-start", onStreamStart);
    s.off("chat:stream", onStream);
    s.off("chat:stream-end", onStreamEnd);
    s.off("chat:error", onError);
  };

  s.on("chat:stream-start", onStreamStart);
  s.on("chat:stream", onStream);
  s.on("chat:stream-end", onStreamEnd);
  s.on("chat:error", onError);

  s.emit("chat:message", {
    message: params.message,
    sessionId: params.sessionId,
    model: params.model || "llama3",
  });

  return cleanup;
}

// ────────────────────────────────────────────────────
// Auth
// ────────────────────────────────────────────────────

export function login(email: string, password: string) {
  return request<{ token: string; user: { id: string; email: string; name: string } }>(
    `${API}/auth/login`,
    { method: "POST", body: JSON.stringify({ email, password }) }
  );
}

export function register(email: string, password: string, name: string) {
  return request<{ token: string; user: { id: string; email: string; name: string } }>(
    `${API}/auth/register`,
    { method: "POST", body: JSON.stringify({ email, password, name }) }
  );
}

export function getMe() {
  return request<{ id: string; email: string; name: string }>(
    `${API}/auth/me`
  );
}

// ────────────────────────────────────────────────────
// Chat — HTTP endpoints
// ────────────────────────────────────────────────────

export async function fetchHistory(page = 1, limit = 50) {
  return request<{
    conversations: Array<{ _id: string; title: string; model: string; updatedAt: string; createdAt: string }>;
    pagination: { page: number; limit: number; total: number; pages: number };
  }>(`${API}/chat/history?page=${page}&limit=${limit}`);
}

export function fetchConversation(id: string) {
  return request<{
    _id: string;
    title: string;
    model: string;
    messages: Array<{ _id: string; role: string; content: string; timestamp: string }>;
  }>(`${API}/chat/conversations/${id}`);
}

export async function processVoiceAudio(params: {
  file: File;
  sessionId?: string;
  model?: string;
  useRag?: boolean;
  collectionName?: string;
}) {
  const formData = new FormData();
  formData.append("file", params.file);
  if (params.sessionId) formData.append("sessionId", params.sessionId);
  if (params.model) formData.append("model", params.model);
  formData.append("useRag", params.useRag ? "true" : "false");
  formData.append("collectionName", params.collectionName || "default");

  const token = getToken();
  const res = await fetch(`${API}/voice/process`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || "Voice API failed");
  }

  return res.json();
}

export function deleteConversation(id: string) {
  return request<{ success: boolean; deletedId: string }>(
    `${API}/chat/conversations/${id}`,
    { method: "DELETE" }
  );
}

/**
 * Send a chat message via HTTP POST.
 * The backend collects the full AI response and returns JSON.
 * Used as fallback when WebSocket is unavailable.
 */
export async function sendChatHTTP(params: {
  message: string;
  sessionId?: string;
  model?: string;
}): Promise<{
  sessionId: string;
  model: string;
  message: { role: string; content: string; timestamp: string };
}> {
  return request(`${API}/chat`, {
    method: "POST",
    body: JSON.stringify(params),
  });
}

// ────────────────────────────────────────────────────
// Documents
// ────────────────────────────────────────────────────

export async function uploadDocument(file: File, collectionName = "default") {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("collectionName", collectionName);

  const token = getToken();
  const res = await fetch(`${API}/documents/upload`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  if (!res.ok) throw new Error("Upload failed");
  return res.json();
}

export async function analyzeImage(params: {
  file: File;
  question: string;
  sessionId?: string;
  model?: string;
}) {
  const formData = new FormData();
  formData.append("file", params.file);
  formData.append("question", params.question);
  if (params.sessionId) formData.append("sessionId", params.sessionId);
  if (params.model) formData.append("model", params.model);

  const token = getToken();
  const res = await fetch(`${API}/chat/analyze-image`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || "Image analysis failed");
  }

  return res.json() as Promise<{
    sessionId: string;
    model: string;
    image: {
      filename: string;
      storedAs: string;
      mimetype: string;
      size: number;
      url: string;
    };
    message: { role: string; content: string; timestamp: string };
  }>;
}

export async function generateImageFromPrompt(params: {
  prompt: string;
  sessionId?: string;
  width?: number;
  height?: number;
  steps?: number;
  guidanceScale?: number;
}) {
  return request<{
    sessionId: string;
    model: string;
    image: {
      prompt: string;
      mimeType: string;
      dataUrl: string;
      width: number;
      height: number;
    };
    message: { role: string; content: string; timestamp: string };
  }>(`${API}/chat/generate-image`, {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export function fetchDocuments() {
  return request<Array<{
    _id: string;
    originalName: string;
    fileSize: number;
    chunkCount: number;
    collectionName: string;
    status: string;
    createdAt: string;
  }>>(`${API}/documents/`);
}

export function deleteDocument(id: string) {
  return request<{ success: boolean }>(
    `${API}/documents/${id}`,
    { method: "DELETE" }
  );
}

export function queryDocument(params: {
  question: string;
  collectionName: string;
  model?: string;
  topK?: number;
}) {
  return request<{
    question: string;
    answer: string;
    citations: Array<{
      source: string;
      chunk_index: number;
      text: string;
      score: number;
    }>;
    collection_name: string;
  }>(`${API}/documents/qa`, {
    method: "POST",
    body: JSON.stringify({
      question: params.question,
      collectionName: params.collectionName,
      model: params.model || "llama3",
      topK: params.topK || 5,
    }),
  });
}
