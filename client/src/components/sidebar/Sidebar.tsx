import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  MessageSquare,
  Settings,
  Trash2,
  PanelLeftClose,
  Loader2,
  Sparkles,
  Mic,
  Image as ImageIcon,
  Code2,
  PenLine,
  Wand2,
  BookOpen,
  Terminal,
  Phone,
  History,
  X,
} from "lucide-react";
import { useChatStore } from "@/stores/chatStore";
import { fetchHistory, fetchConversation, deleteConversation } from "@/services/api";
import type { Conversation } from "@/types/chat";
import { SettingsPanel } from "./SettingsPanel";

const MODELS = [
  { id: "groq-llama3-70b", name: "Llama 3.3 70B", badge: "Groq" },
  { id: "groq-llama3-8b", name: "Llama 3.1 8B", badge: "Groq" },
  { id: "groq-llama4-scout", name: "Llama 4 Scout", badge: "Groq" },
  { id: "groq-qwen3-32b", name: "Qwen3 32B", badge: "Groq" },
  { id: "groq-kimi-k2", name: "Kimi K2", badge: "Groq" },
  { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", badge: "Google" },
  { id: "gemini-2.0-flash-lite", name: "Gemini Flash Lite", badge: "Google" },
  { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", badge: "Google" },
  { id: "llama3", name: "Llama 3", badge: "Local" },
  { id: "mistral", name: "Mistral 7B", badge: "Local" },
  { id: "gemma", name: "Gemma", badge: "Local" },
  { id: "deepseek-llm", name: "DeepSeek LLM", badge: "Local" },
  { id: "llava", name: "LLaVA (Vision)", badge: "Local" },
];

const BADGE_COLORS: Record<string, string> = {
  Groq: "bg-orange-100 text-orange-600",
  Google: "bg-blue-100 text-blue-600",
  Local: "bg-emerald-100 text-emerald-600",
};

export function Sidebar() {
  const {
    conversations,
    setConversations,
    removeConversation,
    activeConversationId,
    setActiveConversation,
    setMessages,
    model,
    setModel,
    newChat,
    toggleSidebar,
  } = useChatStore();

  const navigate = useNavigate();
  const location = useLocation();
  const [modelOpen, setModelOpen] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    setHistoryLoading(true);
    fetchHistory()
      .then((data) => setConversations(data.conversations as any))
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
  }, [setConversations]);

  const handleSelectConversation = async (conv: Conversation) => {
    if (loadingId || activeConversationId === conv._id) return;
    setLoadingId(conv._id);
    try {
      const full = await fetchConversation(conv._id);
      setActiveConversation(full._id);
      setMessages((full.messages || []) as import("@/types/chat").Message[]);
      navigate("/");
      setHistoryOpen(false);
    } catch {
      // ignore
    } finally {
      setLoadingId(null);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteConversation(id);
      removeConversation(id);
    } catch {
      // ignore
    }
  };

  const selectedModel = MODELS.find((m) => m.id === model) || MODELS[0];

  const navItems = [
    { icon: MessageSquare, label: "Chat", path: "/" },
    { icon: ImageIcon, label: "Image Analyzer", path: "/image-analyzer" },
    { icon: Mic, label: "Voice Assistant", path: "/voice" },
    { icon: Code2, label: "Code Interpreter", path: "/code" },
    { icon: PenLine, label: "Text Tools", path: "/text-tools" },
    { icon: Wand2, label: "Image Generator", path: "/image-generator" },
    { icon: BookOpen, label: "PDF Q&A", path: "/documents" },
    { icon: Terminal, label: "Voice Command", path: "/voice-command" },
    { icon: Phone, label: "Phone Agent", path: "/phone" },
  ];

  return (
    <>
      <aside className="w-72 bg-evo-sidebar flex flex-col border-r border-evo-border h-full shrink-0">
        {/* Header */}
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-evo-accent flex items-center justify-center">
              <Sparkles size={16} className="text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight">Evo</span>
          </div>
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-xl hover:bg-evo-card text-evo-muted hover:text-evo-text transition-colors"
          >
            <PanelLeftClose size={18} />
          </button>
        </div>

        {/* New Chat */}
        <div className="px-3 mb-2">
          <button
            onClick={() => { newChat(); navigate("/"); }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-evo-accent text-white text-sm font-medium hover:bg-evo-accent-hover transition-colors"
          >
            <Plus size={16} />
            New Chat
          </button>
        </div>

        {/* Navigation */}
        <div className="px-3 space-y-0.5 flex-1 overflow-y-auto">
          <p className="text-[11px] uppercase tracking-wider text-evo-muted font-medium px-1 mb-1.5 mt-2">Features</p>
          {navItems.map(({ icon: Icon, label, path }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors ${
                location.pathname === path
                  ? "bg-evo-card text-evo-text font-medium"
                  : "text-evo-muted hover:bg-evo-card hover:text-evo-text"
              }`}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>

        {/* Model Selector */}
        <div className="px-3 mt-2 mb-2 relative">
          <p className="text-[11px] uppercase tracking-wider text-evo-muted font-medium px-1 mb-1.5">Model</p>
          <button
            onClick={() => setModelOpen(!modelOpen)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-evo-card text-sm transition-colors hover:bg-evo-border"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="truncate text-evo-text text-xs">{selectedModel.name}</span>
              <span className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${BADGE_COLORS[selectedModel.badge] || ""}`}>
                {selectedModel.badge}
              </span>
            </div>
          </button>
          {modelOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setModelOpen(false)} />
              <div className="absolute left-3 right-3 top-full mt-1 z-20 max-h-72 overflow-y-auto rounded-xl border border-evo-border bg-white shadow-lg">
                <div className="p-1.5">
                  {MODELS.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => { setModel(m.id); setModelOpen(false); }}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                        model === m.id
                          ? "bg-evo-card text-evo-text font-medium"
                          : "text-evo-muted hover:bg-evo-card hover:text-evo-text"
                      }`}
                    >
                      <span className="truncate">{m.name}</span>
                      <span className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${BADGE_COLORS[m.badge] || ""}`}>
                        {m.badge}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Bottom: History + Settings */}
        <div className="p-3 border-t border-evo-border space-y-1">
          <button
            onClick={() => setHistoryOpen(true)}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm text-evo-muted hover:bg-evo-card hover:text-evo-text transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <History size={16} />
              History
            </div>
            {conversations.length > 0 && (
              <span className="text-[10px] font-semibold bg-evo-accent/10 text-evo-accent px-1.5 py-0.5 rounded-full">
                {conversations.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-evo-muted hover:bg-evo-card hover:text-evo-text transition-colors"
          >
            <Settings size={16} />
            Settings
          </button>
        </div>
      </aside>

      {/* History Panel — full left side overlay */}
      <AnimatePresence>
        {historyOpen && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setHistoryOpen(false)}
            />
            <motion.div
              className="fixed left-0 top-0 bottom-0 w-80 bg-white z-50 shadow-2xl flex flex-col"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              {/* History Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-evo-border">
                <div className="flex items-center gap-2.5">
                  <History size={18} className="text-evo-accent" />
                  <h2 className="text-lg font-bold text-evo-text">History</h2>
                </div>
                <button
                  onClick={() => setHistoryOpen(false)}
                  className="p-2 rounded-xl hover:bg-evo-card text-evo-muted hover:text-evo-text transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* History List */}
              <div className="flex-1 overflow-y-auto px-3 py-3">
                {historyLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 size={24} className="animate-spin text-evo-muted" />
                  </div>
                ) : conversations.length === 0 ? (
                  <div className="text-center py-12">
                    <MessageSquare size={32} className="text-evo-border mx-auto mb-3" />
                    <p className="text-sm text-evo-muted">No conversations yet</p>
                    <p className="text-xs text-evo-muted mt-1">Start a new chat to see it here</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {conversations.map((conv) => (
                      <button
                        key={conv._id}
                        onClick={() => handleSelectConversation(conv)}
                        onMouseEnter={() => setHoveredId(conv._id)}
                        onMouseLeave={() => setHoveredId(null)}
                        className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm transition-colors ${
                          activeConversationId === conv._id
                            ? "bg-evo-accent/10 text-evo-accent font-medium border border-evo-accent/20"
                            : "text-evo-text hover:bg-evo-card"
                        }`}
                      >
                        {loadingId === conv._id ? (
                          <Loader2 size={16} className="animate-spin shrink-0 text-evo-accent" />
                        ) : (
                          <MessageSquare size={16} className="shrink-0 opacity-40" />
                        )}
                        <div className="flex-1 min-w-0 text-left">
                          <p className="truncate">{conv.title}</p>
                          <p className="text-[10px] text-evo-muted mt-0.5">
                            {new Date(conv.updatedAt || conv.createdAt).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                        {hoveredId === conv._id && (
                          <button
                            onClick={(e) => handleDelete(conv._id, e)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* History Footer */}
              <div className="px-4 py-3 border-t border-evo-border">
                <p className="text-[10px] text-evo-muted text-center">
                  {conversations.length} conversation{conversations.length !== 1 ? "s" : ""}
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
