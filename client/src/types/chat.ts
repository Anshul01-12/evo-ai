export interface Message {
  _id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  imageUrl?: string;
}

export interface Conversation {
  _id: string;
  title: string;
  model: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

export interface ChatRequest {
  message: string;
  conversationId?: string;
  model?: string;
  useRag?: boolean;
  collectionName?: string;
}

export interface DocumentInfo {
  _id: string;
  originalName: string;
  fileSize: number;
  chunkCount: number;
  collectionName: string;
  status: "processing" | "ready" | "error";
  createdAt: string;
}

export interface Citation {
  source: string;
  chunk_index: number;
  text: string;
  score: number;
}

export interface QAResponse {
  question: string;
  answer: string;
  citations: Citation[];
  collection_name: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  settings?: {
    defaultModel: string;
    theme: string;
  };
}
