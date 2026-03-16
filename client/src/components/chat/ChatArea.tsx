import { useRef, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  PanelLeft,
  AlertCircle,
  LogIn,
  Sparkles,
  Code2,
  FileSearch,
  Lightbulb,
  PenLine,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useChatStore } from "@/stores/chatStore";
import { useAuthStore } from "@/stores/authStore";
import { useChat } from "@/hooks/useChat";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";

export function ChatArea() {
  const { messages, sidebarOpen, toggleSidebar, error, setError, isLoading, isStreaming } =
    useChatStore();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const { sendMessage } = useChat();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <main className="flex-1 flex flex-col min-w-0 bg-evo-bg">
      {/* Top Bar */}
      <header className="h-14 flex items-center px-5 shrink-0">
        <div className="flex items-center gap-3 flex-1">
          {!sidebarOpen && (
            <button
              onClick={toggleSidebar}
              className="p-2 rounded-xl hover:bg-evo-card text-evo-muted hover:text-evo-text transition-colors"
            >
              <PanelLeft size={18} />
            </button>
          )}
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-evo-accent flex items-center justify-center">
              <Sparkles size={12} className="text-white" />
            </div>
            <span className="text-sm font-semibold text-evo-text">Evo</span>
          </div>
        </div>

        {!isAuthenticated ? (
          <button
            onClick={() => navigate("/login")}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-evo-accent text-white text-xs font-medium hover:bg-evo-accent-hover transition-colors"
          >
            <LogIn size={14} />
            Sign in
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-evo-card flex items-center justify-center text-sm font-medium text-evo-text">
              {(user?.name || user?.email || "U")[0].toUpperCase()}
            </div>
            <button
              onClick={() => { logout(); navigate("/login"); }}
              className="text-xs text-evo-muted hover:text-evo-text transition-colors"
            >
              Logout
            </button>
          </div>
        )}
      </header>

      {/* Error Banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mx-5 mt-2 flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm"
          >
            <AlertCircle size={16} className="shrink-0" />
            <span className="flex-1">{error}</span>
            <button
              onClick={() => setError(null)}
              className="text-red-400 hover:text-red-600 text-xs font-medium"
            >
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <WelcomeScreen onSuggestionClick={sendMessage} />
        ) : (
          <div className="max-w-2xl mx-auto py-8 px-5">
            <div className="space-y-1">
              {messages.map((msg) => (
                <ChatMessage key={msg._id} message={msg} />
              ))}
            </div>

            {/* Streaming/loading indicator */}
            {(isLoading || isStreaming) && !messages.some(m => m.role === 'assistant' && m.content === '') && (
              <div className="flex items-start gap-3 py-5">
                <div className="w-7 h-7 rounded-lg bg-evo-card flex items-center justify-center">
                  <Sparkles size={14} className="text-evo-highlight-text" />
                </div>
                <div className="pt-1">
                  <div className="flex gap-1.5">
                    <span className="w-1.5 h-1.5 bg-evo-muted rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 bg-evo-muted rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 bg-evo-muted rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="pb-5 px-5">
        <div className="max-w-2xl mx-auto">
          <ChatInput />
          <p className="text-[11px] text-evo-muted text-center mt-2.5 tracking-wide">
            Evo can make mistakes. Consider checking important information.
          </p>
        </div>
      </div>
    </main>
  );
}

function WelcomeScreen({
  onSuggestionClick,
}: {
  onSuggestionClick: (text: string) => void;
}) {
  const suggestions = [
    { icon: Code2, label: "Write code", prompt: "Write a Python REST API with FastAPI" },
    { icon: Lightbulb, label: "Brainstorm", prompt: "Give me 5 creative project ideas using AI" },
    { icon: FileSearch, label: "Analyze", prompt: "Help me debug my code" },
    { icon: PenLine, label: "Write", prompt: "Write a professional email for a project update" },
  ];

  const [greeting, setGreeting] = useState("Hello");
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good morning");
    else if (hour < 17) setGreeting("Good afternoon");
    else setGreeting("Good evening");
  }, []);

  return (
    <div className="h-full flex flex-col items-center justify-center px-5">
      <motion.div
        className="text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="w-14 h-14 rounded-2xl bg-evo-accent flex items-center justify-center mx-auto mb-6">
          <Sparkles size={24} className="text-white" />
        </div>
        <h1 className="text-4xl font-bold text-evo-text mb-2 tracking-tight">{greeting}</h1>
        <p className="text-evo-muted text-base max-w-md mx-auto leading-relaxed">
          I'm Evo, your AI assistant. How can I help you today?
        </p>
      </motion.div>

      <motion.div
        className="grid grid-cols-2 gap-3 mt-10 max-w-lg w-full"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
      >
        {suggestions.map(({ icon: Icon, label, prompt }) => (
          <button
            key={label}
            onClick={() => onSuggestionClick(prompt)}
            className="flex items-center gap-3 px-4 py-4 rounded-2xl bg-white border border-evo-border hover:border-evo-muted hover:shadow-sm text-left transition-all group"
          >
            <div className="w-9 h-9 rounded-xl bg-evo-card flex items-center justify-center group-hover:bg-evo-border transition-colors">
              <Icon size={18} className="text-evo-muted group-hover:text-evo-text transition-colors" />
            </div>
            <div>
              <p className="text-sm font-medium text-evo-text">{label}</p>
              <p className="text-xs text-evo-muted mt-0.5 line-clamp-1">{prompt}</p>
            </div>
          </button>
        ))}
      </motion.div>
    </div>
  );
}
