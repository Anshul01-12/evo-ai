import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  User,
  Palette,
  Bell,
  Shield,
  HelpCircle,
  LogOut,
  Moon,
  Sun,
  Monitor,
  Volume2,
  VolumeX,
  Trash2,
  Check,
  Pencil,
  Download,
  ExternalLink,
  Keyboard,
  Info,
  MessageSquare,
  Database,
  Globe,
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useChatStore } from "@/stores/chatStore";
import { useNavigate } from "react-router-dom";
import { deleteConversation } from "@/services/api";

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
  const { conversations, newChat, setConversations } = useChatStore();

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
          <motion.div
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            className="fixed right-0 top-0 bottom-0 w-full max-w-lg bg-white z-50 shadow-2xl flex flex-col"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-evo-border">
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
              <div className="w-48 border-r border-evo-border py-3 px-2.5 space-y-0.5 shrink-0 bg-evo-sidebar">
                {tabs.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setTab(id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                      tab === id
                        ? "bg-white text-evo-text font-medium shadow-sm"
                        : "text-evo-muted hover:bg-white/60 hover:text-evo-text"
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
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-red-500 hover:bg-red-50 transition-colors mt-6"
                  >
                    <LogOut size={16} />
                    Log out
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
                    conversations={conversations}
                    onClearHistory={async () => {
                      for (const c of conversations) {
                        try { await deleteConversation(c._id); } catch { /* skip */ }
                      }
                      newChat();
                      setConversations([]);
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

// ─── Profile Tab ─────────────────────────────────────────────────

function ProfileTab({ user, isAuthenticated }: { user: any; isAuthenticated: boolean }) {
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(user?.name || "");
  const [saved, setSaved] = useState(false);

  useEffect(() => { setNameValue(user?.name || ""); }, [user]);

  if (!isAuthenticated) {
    return (
      <div className="text-center py-12">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-evo-accent to-indigo-500 flex items-center justify-center mx-auto mb-4">
          <User size={32} className="text-white" />
        </div>
        <h3 className="font-semibold text-evo-text text-lg mb-1">Not signed in</h3>
        <p className="text-sm text-evo-muted mb-5">
          Sign in to sync your conversations and preferences
        </p>
        <a
          href="/login"
          className="inline-flex px-6 py-2.5 rounded-xl bg-evo-accent text-white text-sm font-medium hover:bg-evo-accent-hover transition-colors"
        >
          Sign in
        </a>
      </div>
    );
  }

  const handleSaveName = () => {
    // Save to localStorage for now (would be API call in production)
    localStorage.setItem("evo_display_name", nameValue);
    setEditingName(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Avatar + Name */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-evo-accent to-indigo-500 flex items-center justify-center text-2xl font-bold text-white shadow-md">
          {(user?.name || user?.email || "U")[0].toUpperCase()}
        </div>
        <div>
          <h3 className="font-semibold text-evo-text text-lg">
            {user?.name || "User"}
          </h3>
          <p className="text-sm text-evo-muted">{user?.email || ""}</p>
        </div>
      </div>

      {/* Editable fields */}
      <div className="space-y-1">
        <SectionTitle>Account Details</SectionTitle>

        {/* Display Name - editable */}
        <div className="flex items-center justify-between py-3 border-b border-evo-border">
          <span className="text-sm text-evo-muted">Display name</span>
          {editingName ? (
            <div className="flex items-center gap-2">
              <input
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                className="text-sm text-evo-text bg-evo-card rounded-lg px-3 py-1.5 border border-evo-border outline-none focus:border-evo-accent w-40"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
              />
              <button onClick={handleSaveName} className="p-1.5 rounded-lg bg-evo-accent text-white hover:bg-evo-accent-hover">
                <Check size={14} />
              </button>
              <button onClick={() => setEditingName(false)} className="p-1.5 rounded-lg hover:bg-evo-card text-evo-muted">
                <X size={14} />
              </button>
            </div>
          ) : (
            <button onClick={() => setEditingName(true)} className="flex items-center gap-2 text-sm text-evo-text hover:text-evo-accent transition-colors">
              {user?.name || "Not set"}
              <Pencil size={12} className="text-evo-muted" />
            </button>
          )}
        </div>

        <SettingRow label="Email" value={user?.email || "Not set"} />
        <SettingRow label="Account type" value="Free" badge="Free" />
        <SettingRow label="Member since" value={new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })} />
      </div>

      {saved && (
        <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 rounded-xl px-4 py-2.5">
          <Check size={14} />
          Changes saved
        </div>
      )}
    </div>
  );
}

// ─── Appearance Tab ──────────────────────────────────────────────

function AppearanceTab() {
  const [theme, setTheme] = useState(() => localStorage.getItem("evo_theme") || "light");
  const [fontSize, setFontSize] = useState(() => localStorage.getItem("evo_font_size") || "medium");
  const [codeTheme, setCodeTheme] = useState(() => localStorage.getItem("evo_code_theme") || "dark");

  const applyTheme = (t: string) => {
    setTheme(t);
    localStorage.setItem("evo_theme", t);
    if (t === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  };

  const applyFontSize = (s: string) => {
    setFontSize(s);
    localStorage.setItem("evo_font_size", s);
    const sizes: Record<string, string> = { small: "14px", medium: "15px", large: "17px" };
    document.documentElement.style.fontSize = sizes[s] || "15px";
  };

  const applyCodeTheme = (t: string) => {
    setCodeTheme(t);
    localStorage.setItem("evo_code_theme", t);
  };

  return (
    <div className="space-y-6">
      {/* Theme */}
      <div>
        <SectionTitle>Theme</SectionTitle>
        <div className="flex gap-3 mt-2">
          {[
            { id: "light", label: "Light", icon: Sun },
            { id: "dark", label: "Dark", icon: Moon },
            { id: "system", label: "System", icon: Monitor },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => applyTheme(id)}
              className={`flex-1 flex flex-col items-center gap-2 py-4 rounded-xl border-2 text-sm font-medium transition-all ${
                theme === id
                  ? "border-evo-accent bg-evo-highlight text-evo-text shadow-sm"
                  : "border-evo-border text-evo-muted hover:border-evo-muted"
              }`}
            >
              <Icon size={20} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Font Size */}
      <div>
        <SectionTitle>Message Font Size</SectionTitle>
        <div className="flex gap-2 mt-2">
          {[
            { id: "small", label: "Small", sample: "Aa" },
            { id: "medium", label: "Medium", sample: "Aa" },
            { id: "large", label: "Large", sample: "Aa" },
          ].map(({ id, label, sample }) => (
            <button
              key={id}
              onClick={() => applyFontSize(id)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-xl border-2 transition-all ${
                fontSize === id
                  ? "border-evo-accent bg-evo-highlight text-evo-text font-medium shadow-sm"
                  : "border-evo-border text-evo-muted hover:border-evo-muted"
              }`}
            >
              <span className={id === "small" ? "text-xs" : id === "large" ? "text-lg" : "text-sm"}>{sample}</span>
              <span className="text-xs">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Code Block Theme */}
      <div>
        <SectionTitle>Code Block Theme</SectionTitle>
        <div className="flex gap-2 mt-2">
          {["dark", "light"].map((t) => (
            <button
              key={t}
              onClick={() => applyCodeTheme(t)}
              className={`flex-1 py-3 rounded-xl border-2 text-sm capitalize transition-all ${
                codeTheme === t
                  ? "border-evo-accent bg-evo-highlight text-evo-text font-medium shadow-sm"
                  : "border-evo-border text-evo-muted hover:border-evo-muted"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Notifications Tab ───────────────────────────────────────────

function NotificationsTab() {
  const [sounds, setSounds] = useState(() => localStorage.getItem("evo_sounds") !== "false");
  const [desktopNotifs, setDesktopNotifs] = useState(() => Notification.permission === "granted");
  const [streamIndicator, setStreamIndicator] = useState(() => localStorage.getItem("evo_stream_indicator") !== "false");

  const toggleSounds = () => {
    const next = !sounds;
    setSounds(next);
    localStorage.setItem("evo_sounds", String(next));
  };

  const toggleDesktopNotifs = async () => {
    if (!desktopNotifs) {
      const perm = await Notification.requestPermission();
      setDesktopNotifs(perm === "granted");
      if (perm === "granted") {
        new Notification("Evo Notifications Enabled", { body: "You'll receive notifications from Evo." });
      }
    } else {
      setDesktopNotifs(false);
    }
  };

  const toggleStreamIndicator = () => {
    const next = !streamIndicator;
    setStreamIndicator(next);
    localStorage.setItem("evo_stream_indicator", String(next));
  };

  return (
    <div className="space-y-1">
      <SectionTitle>Notification Preferences</SectionTitle>

      <ToggleRow
        icon={sounds ? Volume2 : VolumeX}
        title="Sound effects"
        description="Play sounds for new messages"
        enabled={sounds}
        onToggle={toggleSounds}
      />

      <ToggleRow
        icon={Bell}
        title="Desktop notifications"
        description="Show browser notifications for reminders"
        enabled={desktopNotifs}
        onToggle={toggleDesktopNotifs}
      />

      <ToggleRow
        icon={MessageSquare}
        title="Streaming indicator"
        description="Show typing animation while AI responds"
        enabled={streamIndicator}
        onToggle={toggleStreamIndicator}
      />
    </div>
  );
}

// ─── Privacy Tab ─────────────────────────────────────────────────

function PrivacyTab({
  conversations,
  onClearHistory,
}: {
  conversations: any[];
  onClearHistory: () => void;
}) {
  const [clearing, setClearing] = useState(false);
  const [cleared, setCleared] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const handleClear = async () => {
    setClearing(true);
    await onClearHistory();
    setClearing(false);
    setCleared(true);
    setConfirmClear(false);
    setTimeout(() => setCleared(false), 3000);
  };

  const handleExport = () => {
    const data = JSON.stringify(conversations, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `evo-conversations-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Chat History */}
      <div>
        <SectionTitle>Chat History</SectionTitle>
        <div className="bg-evo-card rounded-xl p-4 mt-2">
          <div className="flex items-center gap-3 mb-3">
            <Database size={18} className="text-evo-muted" />
            <div>
              <p className="text-sm font-medium text-evo-text">
                {conversations.length} conversation{conversations.length !== 1 ? "s" : ""} stored
              </p>
              <p className="text-xs text-evo-muted">Stored on server, synced across sessions</p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleExport}
              disabled={conversations.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-evo-text border border-evo-border hover:bg-white transition-colors disabled:opacity-30"
            >
              <Download size={14} />
              Export
            </button>

            {!confirmClear ? (
              <button
                onClick={() => setConfirmClear(true)}
                disabled={conversations.length === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-red-500 border border-red-200 hover:bg-red-50 transition-colors disabled:opacity-30"
              >
                <Trash2 size={14} />
                Clear all
              </button>
            ) : (
              <button
                onClick={handleClear}
                disabled={clearing}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {clearing ? "Clearing..." : "Confirm delete all"}
              </button>
            )}
          </div>
        </div>

        {cleared && (
          <div className="flex items-center gap-2 mt-2 text-sm text-emerald-600 bg-emerald-50 rounded-xl px-4 py-2.5">
            <Check size={14} />
            All conversations cleared
          </div>
        )}
      </div>

      {/* Data info */}
      <div>
        <SectionTitle>Data & Privacy</SectionTitle>
        <div className="space-y-3 mt-2">
          <div className="flex items-start gap-3 text-sm">
            <Shield size={16} className="text-evo-muted mt-0.5 shrink-0" />
            <p className="text-evo-muted">Your conversations are stored on the server and can be deleted at any time.</p>
          </div>
          <div className="flex items-start gap-3 text-sm">
            <Globe size={16} className="text-evo-muted mt-0.5 shrink-0" />
            <p className="text-evo-muted">When using cloud models (Groq, Gemini), your messages are sent to their APIs. Local models process everything on your machine.</p>
          </div>
        </div>
      </div>

      {/* Clear browser data */}
      <div>
        <SectionTitle>Browser Data</SectionTitle>
        <button
          onClick={() => {
            localStorage.removeItem("evo_contacts");
            localStorage.removeItem("evo_theme");
            localStorage.removeItem("evo_font_size");
            localStorage.removeItem("evo_sounds");
            localStorage.removeItem("evo_display_name");
            window.location.reload();
          }}
          className="flex items-center gap-2 px-4 py-2 mt-2 rounded-lg text-sm text-evo-muted border border-evo-border hover:bg-evo-card transition-colors"
        >
          <Trash2 size={14} />
          Clear local settings
        </button>
      </div>
    </div>
  );
}

// ─── Help Tab ────────────────────────────────────────────────────

function HelpTab() {
  return (
    <div className="space-y-6">
      {/* About */}
      <div>
        <SectionTitle>About Evo</SectionTitle>
        <div className="bg-evo-card rounded-xl p-4 mt-2">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-evo-accent to-indigo-500 flex items-center justify-center">
              <Info size={18} className="text-white" />
            </div>
            <div>
              <p className="font-semibold text-evo-text">Evo AI Assistant</p>
              <p className="text-xs text-evo-muted">Built by Anshul</p>
            </div>
          </div>
          <p className="text-sm text-evo-muted leading-relaxed">
            A multimodal AI platform supporting chat, voice, image analysis, document Q&A, and more. Powered by Groq, Google Gemini, and local Ollama models.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div>
        <SectionTitle>Platform Info</SectionTitle>
        <div className="space-y-0 mt-2">
          <SettingRow label="Version" value="1.0.0" />
          <SettingRow label="Models" value="13 available" />
          <SettingRow label="Features" value="Chat, Voice, Documents, Image, Code" />
          <SettingRow label="Backend" value="Node.js + FastAPI" />
          <SettingRow label="AI Providers" value="Groq, Gemini, Ollama" />
        </div>
      </div>

      {/* Shortcuts */}
      <div>
        <SectionTitle icon={Keyboard}>Keyboard Shortcuts</SectionTitle>
        <div className="space-y-0 mt-2 text-sm">
          <ShortcutRow label="Send message" keys="Enter" />
          <ShortcutRow label="New line" keys="Shift + Enter" />
          <ShortcutRow label="Paste image" keys="Ctrl + V" />
        </div>
      </div>

      {/* Links */}
      <div>
        <SectionTitle icon={ExternalLink}>Resources</SectionTitle>
        <div className="space-y-1 mt-2">
          <a href="https://github.com" target="_blank" rel="noopener"
            className="flex items-center justify-between py-2.5 text-sm text-evo-muted hover:text-evo-accent transition-colors">
            Source Code <ExternalLink size={13} />
          </a>
          <a href="https://ollama.com" target="_blank" rel="noopener"
            className="flex items-center justify-between py-2.5 text-sm text-evo-muted hover:text-evo-accent transition-colors">
            Ollama (Local Models) <ExternalLink size={13} />
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── Shared Components ───────────────────────────────────────────

function SectionTitle({ children, icon: Icon }: { children: React.ReactNode; icon?: typeof User }) {
  return (
    <div className="flex items-center gap-2 mb-1">
      {Icon && <Icon size={14} className="text-evo-muted" />}
      <h3 className="text-xs font-semibold text-evo-muted uppercase tracking-wider">{children}</h3>
    </div>
  );
}

function SettingRow({ label, value, badge }: { label: string; value: string; badge?: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-evo-border/50 last:border-0">
      <span className="text-sm text-evo-muted">{label}</span>
      <div className="flex items-center gap-2">
        {badge && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-evo-accent/10 text-evo-accent">
            {badge}
          </span>
        )}
        <span className="text-sm text-evo-text">{value}</span>
      </div>
    </div>
  );
}

function ToggleRow({
  icon: Icon,
  title,
  description,
  enabled,
  onToggle,
}: {
  icon: typeof Volume2;
  title: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between py-3.5 border-b border-evo-border/50">
      <div className="flex items-center gap-3">
        <Icon size={18} className="text-evo-muted" />
        <div>
          <p className="text-sm font-medium text-evo-text">{title}</p>
          <p className="text-xs text-evo-muted">{description}</p>
        </div>
      </div>
      <button
        onClick={onToggle}
        className={`w-11 h-6 rounded-full transition-colors relative ${
          enabled ? "bg-evo-accent" : "bg-evo-border"
        }`}
      >
        <div
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all ${
            enabled ? "left-[22px]" : "left-[2px]"
          }`}
        />
      </button>
    </div>
  );
}

function ShortcutRow({ label, keys }: { label: string; keys: string }) {
  return (
    <div className="flex justify-between py-2 border-b border-evo-border/50 last:border-0">
      <span className="text-evo-muted">{label}</span>
      <kbd className="px-2 py-0.5 rounded-md bg-evo-card text-evo-text text-xs font-mono border border-evo-border">
        {keys}
      </kbd>
    </div>
  );
}
