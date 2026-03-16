import { create } from "zustand";
import type { Message, Conversation } from "@/types/chat";

interface ChatState {
  // Data
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: Message[];
  model: string;

  // UI state
  isStreaming: boolean;
  isLoading: boolean;
  error: string | null;
  sidebarOpen: boolean;

  // Actions
  setConversations: (c: Conversation[]) => void;
  addConversationToTop: (c: Conversation) => void;
  removeConversation: (id: string) => void;
  setActiveConversation: (id: string | null) => void;
  setMessages: (m: Message[]) => void;
  addMessage: (m: Message) => void;
  appendToLastMessage: (token: string) => void;
  setStreaming: (v: boolean) => void;
  setLoading: (v: boolean) => void;
  setError: (err: string | null) => void;
  setModel: (m: string) => void;
  toggleSidebar: () => void;
  newChat: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  conversations: [],
  activeConversationId: null,
  messages: [],
  model: "groq-llama3-8b",
  isStreaming: false,
  isLoading: false,
  error: null,
  sidebarOpen: true,

  setConversations: (conversations) => set({ conversations }),

  addConversationToTop: (conv) =>
    set((s) => ({
      conversations: [conv, ...s.conversations.filter((c) => c._id !== conv._id)],
    })),

  removeConversation: (id) =>
    set((s) => ({
      conversations: s.conversations.filter((c) => c._id !== id),
      ...(s.activeConversationId === id
        ? { activeConversationId: null, messages: [] }
        : {}),
    })),

  setActiveConversation: (id) => set({ activeConversationId: id, error: null }),
  setMessages: (messages) => set({ messages }),
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),

  appendToLastMessage: (token) =>
    set((s) => {
      const msgs = [...s.messages];
      const last = msgs[msgs.length - 1];
      if (last?.role === "assistant") {
        msgs[msgs.length - 1] = { ...last, content: last.content + token };
      }
      return { messages: msgs };
    }),

  setStreaming: (isStreaming) => set({ isStreaming }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  setModel: (model) => set({ model }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  newChat: () => set({ activeConversationId: null, messages: [], error: null }),
}));
