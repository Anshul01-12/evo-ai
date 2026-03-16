import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  User,
  Palette,
  Bell,
  Shield,
  HelpCircle,
  LogOut,
  ChevronRight,
  Moon,
  Sun,
  Volume2,
  VolumeX,
  Trash2,
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useChatStore } from "@/stores/chatStore";
import { useNavigate } from "react-router-dom";

type Tab = "profile" | "appearance" | "notifications" | "privacy" | "help";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SettingsPanel({ open, onClose }: Props) {
  const [tab, setTab] = useState<Tab>("profile");
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const { conversations, newChat } = useChatStore();

  const tabs: { id: Tab; label: string; icon: typeof User }[] = [
    { id: "profile", label: "Profile", icon: User },
    { id: "appearance", label: "Appearance", icon: Palette },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "privacy", label: "Privacy & Data", icon: Shield },
    { id: "help", label: "Help & About", icon: HelpCircle },
  ];

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/20 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white z-50 shadow-2xl flex flex-col"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-evo-border">
              <h2 className="text-lg font-bold text-evo-text">Settings</h2>
              <button
                onClick={onClose}
                className="p-2 rounded-xl hover:bg-evo-card text-evo-muted hover:text-evo-text transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-1 overflow-hidden">
              {/* Tab nav */}
              <div className="w-48 border-r border-evo-border py-4 px-3 space-y-0.5 shrink-0">
                {tabs.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setTab(id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                      tab === id
                        ? "bg-evo-card text-evo-text font-medium"
                        : "text-evo-muted hover:bg-evo-card hover:text-evo-text"
                    }`}
                  >
                    <Icon size={16} />
                    {label}
                  </button>
                ))}

                {isAuthenticated && (
                  <button
                    onClick={() => {
                      logout();
                      onClose();
                      navigate("/login");
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-red-500 hover:bg-red-50 transition-colors mt-4"
                  >
                    <LogOut size={16} />
                    Logout
                  </button>
                )}
              </div>

              {/* Tab content */}
              <div className="flex-1 overflow-y-auto p-6">
                {tab === "profile" && (
                  <ProfileTab user={user} isAuthenticated={isAuthenticated} />
                )}
                {tab === "appearance" && <AppearanceTab />}
                {tab === "notifications" && <NotificationsTab />}
                {tab === "privacy" && (
                  <PrivacyTab
                    conversationCount={conversations.length}
                    onClearHistory={() => {
                      newChat();
                    }}
                  />
                )}
                {tab === "help" && <HelpTab />}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function ProfileTab({
  user,
  isAuthenticated,
}: {
  user: any;
  isAuthenticated: boolean;
}) {
  if (!isAuthenticated) {
    return (
      <div className="text-center py-10">
        <div className="w-16 h-16 rounded-full bg-evo-card flex items-center justify-center mx-auto mb-4">
          <User size={28} className="text-evo-muted" />
        </div>
        <h3 className="font-semibold text-evo-text mb-1">Not signed in</h3>
        <p className="text-sm text-evo-muted mb-4">
          Sign in to sync your conversations and preferences
        </p>
        <a
          href="/login"
          className="inline-flex px-5 py-2.5 rounded-xl bg-evo-accent text-white text-sm font-medium hover:bg-evo-accent-hover transition-colors"
        >
          Sign in
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-evo-card flex items-center justify-center text-2xl font-bold text-evo-text">
          {(user?.name || user?.email || "U")[0].toUpperCase()}
        </div>
        <div>
          <h3 className="font-semibold text-evo-text text-lg">
            {user?.name || "User"}
          </h3>
          <p className="text-sm text-evo-muted">{user?.email || ""}</p>
        </div>
      </div>

      <div className="space-y-3">
        <SettingRow label="Display name" value={user?.name || "Not set"} />
        <SettingRow label="Email" value={user?.email || "Not set"} />
        <SettingRow label="Account type" value="Free" />
      </div>
    </div>
  );
}

function AppearanceTab() {
  const [theme, setTheme] = useState("light");
  const [fontSize, setFontSize] = useState("medium");

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-evo-text mb-3">Theme</h3>
        <div className="flex gap-3">
          {[
            { id: "light", label: "Light", icon: Sun },
            { id: "dark", label: "Dark", icon: Moon },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTheme(id)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
                theme === id
                  ? "border-evo-accent bg-evo-highlight text-evo-text"
                  : "border-evo-border text-evo-muted hover:border-evo-muted"
              }`}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-semibold text-evo-text mb-3">Font Size</h3>
        <div className="flex gap-2">
          {["small", "medium", "large"].map((size) => (
            <button
              key={size}
              onClick={() => setFontSize(size)}
              className={`flex-1 py-2.5 rounded-xl border-2 text-sm capitalize transition-all ${
                fontSize === size
                  ? "border-evo-accent bg-evo-highlight text-evo-text font-medium"
                  : "border-evo-border text-evo-muted hover:border-evo-muted"
              }`}
            >
              {size}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function NotificationsTab() {
  const [sounds, setSounds] = useState(true);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between py-3">
        <div className="flex items-center gap-3">
          {sounds ? (
            <Volume2 size={18} className="text-evo-muted" />
          ) : (
            <VolumeX size={18} className="text-evo-muted" />
          )}
          <div>
            <p className="text-sm font-medium text-evo-text">Sound effects</p>
            <p className="text-xs text-evo-muted">Play sounds for messages</p>
          </div>
        </div>
        <button
          onClick={() => setSounds(!sounds)}
          className={`w-11 h-6 rounded-full transition-colors ${
            sounds ? "bg-evo-accent" : "bg-evo-border"
          }`}
        >
          <div
            className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
              sounds ? "translate-x-5.5 ml-[22px]" : "translate-x-0.5 ml-[2px]"
            }`}
          />
        </button>
      </div>
    </div>
  );
}

function PrivacyTab({
  conversationCount,
  onClearHistory,
}: {
  conversationCount: number;
  onClearHistory: () => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-evo-text mb-1">Chat History</h3>
        <p className="text-sm text-evo-muted mb-3">
          You have {conversationCount} conversation{conversationCount !== 1 ? "s" : ""} stored
        </p>
        <button
          onClick={onClearHistory}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm text-red-500 border border-red-200 hover:bg-red-50 transition-colors"
        >
          <Trash2 size={14} />
          Clear all conversations
        </button>
      </div>

      <div>
        <h3 className="font-semibold text-evo-text mb-1">Data Usage</h3>
        <p className="text-sm text-evo-muted">
          Your conversations are stored on the server and can be deleted at any time.
          We do not share your data with third parties.
        </p>
      </div>
    </div>
  );
}

function HelpTab() {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-evo-text mb-1">About Evo</h3>
        <p className="text-sm text-evo-muted">
          Evo is an AI assistant that supports multiple language models including
          Groq, Google Gemini, and local models via Ollama.
        </p>
      </div>

      <div className="space-y-2">
        <SettingRow label="Version" value="1.0.0" />
        <SettingRow label="Models supported" value="13" />
        <SettingRow label="Features" value="Chat, Voice, Documents" />
      </div>

      <div>
        <h3 className="font-semibold text-evo-text mb-2 mt-4">Keyboard Shortcuts</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between py-1.5">
            <span className="text-evo-muted">Send message</span>
            <kbd className="px-2 py-0.5 rounded bg-evo-card text-evo-text text-xs font-mono">Enter</kbd>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-evo-muted">New line</span>
            <kbd className="px-2 py-0.5 rounded bg-evo-card text-evo-text text-xs font-mono">Shift+Enter</kbd>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-evo-muted">New chat</span>
            <kbd className="px-2 py-0.5 rounded bg-evo-card text-evo-text text-xs font-mono">Ctrl+N</kbd>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-evo-border last:border-0">
      <span className="text-sm text-evo-muted">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className="text-sm text-evo-text">{value}</span>
        <ChevronRight size={14} className="text-evo-muted" />
      </div>
    </div>
  );
}
