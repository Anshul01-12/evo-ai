import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Phone,
  PhoneCall,
  PhoneOff,
  Loader2,
  AlertCircle,
  ArrowUpRight,
  ArrowDownLeft,
  Settings2,
  Mic,
} from "lucide-react";

const API = import.meta.env.VITE_API_URL || "/api";

function getHeaders(): HeadersInit {
  const headers: HeadersInit = { "Content-Type": "application/json" };
  const token = localStorage.getItem("evo_token");
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

interface CallLog {
  id: string;
  callSid: string;
  direction: "inbound" | "outbound";
  from: string;
  to: string;
  status: string;
  startedAt: string;
  duration?: number;
}

interface PhoneConfig {
  phoneNumber: string;
  configured: boolean;
  model: string;
  systemPrompt: string;
}

export function PhoneCallPage() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [calling, setCalling] = useState(false);
  const [activeCallSid, setActiveCallSid] = useState<string | null>(null);
  const [callStatus, setCallStatus] = useState<string | null>(null);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [config, setConfig] = useState<PhoneConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  // Load config and logs
  useEffect(() => {
    fetch(`${API}/call/config`, { headers: getHeaders() })
      .then((r) => r.json())
      .then(setConfig)
      .catch(() => {});

    loadLogs();
  }, []);

  const loadLogs = () => {
    fetch(`${API}/call/logs`, { headers: getHeaders() })
      .then((r) => r.json())
      .then(setCallLogs)
      .catch(() => {});
  };

  // Call timer
  useEffect(() => {
    if (!activeCallSid) { setElapsed(0); return; }
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(interval);
  }, [activeCallSid]);

  // Poll call status
  useEffect(() => {
    if (!activeCallSid) return;
    const interval = setInterval(() => {
      fetch(`${API}/call/logs`, { headers: getHeaders() })
        .then((r) => r.json())
        .then((logs: CallLog[]) => {
          const active = logs.find((l) => l.callSid === activeCallSid);
          if (active) {
            setCallStatus(active.status);
            if (active.status === "completed" || active.status === "failed" || active.status === "canceled" || active.status === "no-answer" || active.status === "busy") {
              setActiveCallSid(null);
              setCalling(false);
              loadLogs();
            }
          }
        })
        .catch(() => {});
    }, 3000);
    return () => clearInterval(interval);
  }, [activeCallSid]);

  const makeCall = useCallback(async () => {
    if (!phoneNumber.trim()) return;
    setCalling(true);
    setError(null);
    setCallStatus("initiating");

    try {
      const res = await fetch(`${API}/call/make`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ to: phoneNumber }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Call failed");
      setActiveCallSid(data.callSid);
      setCallStatus(data.status);
    } catch (err: any) {
      setError(err.message);
      setCalling(false);
      setCallStatus(null);
    }
  }, [phoneNumber]);

  const endCall = useCallback(async () => {
    if (!activeCallSid) return;
    try {
      await fetch(`${API}/call/end/${activeCallSid}`, {
        method: "POST",
        headers: getHeaders(),
      });
      setActiveCallSid(null);
      setCalling(false);
      setCallStatus(null);
      loadLogs();
    } catch {
      // ignore
    }
  }, [activeCallSid]);

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const dialPad = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "+", "0", "#"];

  const isActive = !!activeCallSid;

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-evo-bg">
      {/* Header */}
      <header className="h-14 flex items-center justify-between px-5 border-b border-evo-border shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
            <Phone size={14} className="text-emerald-600" />
          </div>
          <span className="text-sm font-semibold text-evo-text">Phone AI Agent</span>
        </div>
        {config?.configured ? (
          <span className="text-xs text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
            {config.phoneNumber}
          </span>
        ) : (
          <span className="text-xs text-red-500 bg-red-50 px-2.5 py-1 rounded-full">
            Not configured
          </span>
        )}
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-md mx-auto py-8 px-5 space-y-6">

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm"
              >
                <AlertCircle size={16} />
                <span className="flex-1">{error}</span>
                <button onClick={() => setError(null)} className="text-xs font-medium">Dismiss</button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Active Call */}
          {isActive && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-6 text-white text-center"
            >
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-white/30 animate-pulse" />
                <span className="text-sm font-medium capitalize">{callStatus || "connecting"}</span>
              </div>
              <p className="text-2xl font-bold mb-1">{phoneNumber}</p>
              <p className="text-lg font-mono text-white/80">{formatDuration(elapsed)}</p>

              <div className="flex items-center justify-center gap-4 mt-6">
                <button className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors">
                  <Mic size={20} />
                </button>
                <button
                  onClick={endCall}
                  className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg"
                >
                  <PhoneOff size={24} />
                </button>
                <button className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors">
                  <Settings2 size={20} />
                </button>
              </div>
            </motion.div>
          )}

          {/* Dialer */}
          {!isActive && (
            <>
              {/* Phone number input */}
              <div>
                <input
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+1 (555) 123-4567"
                  className="w-full text-center text-2xl font-mono bg-transparent outline-none text-evo-text placeholder:text-evo-muted py-4 border-b-2 border-evo-border focus:border-evo-accent transition-colors"
                  onKeyDown={(e) => e.key === "Enter" && makeCall()}
                />
              </div>

              {/* Dial pad */}
              <div className="grid grid-cols-3 gap-2">
                {dialPad.map((key) => (
                  <button
                    key={key}
                    onClick={() => setPhoneNumber((p) => p + key)}
                    className="py-4 rounded-xl text-xl font-semibold text-evo-text bg-evo-card hover:bg-evo-border transition-colors"
                  >
                    {key}
                  </button>
                ))}
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={() => setPhoneNumber((p) => p.slice(0, -1))}
                  disabled={!phoneNumber}
                  className="px-4 py-2 rounded-xl text-sm text-evo-muted hover:text-evo-text hover:bg-evo-card transition-colors disabled:opacity-30"
                >
                  Delete
                </button>

                <button
                  onClick={makeCall}
                  disabled={calling || !phoneNumber.trim() || !config?.configured}
                  className="w-16 h-16 rounded-full bg-emerald-500 text-white flex items-center justify-center hover:bg-emerald-600 transition-colors shadow-lg disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {calling ? (
                    <Loader2 size={24} className="animate-spin" />
                  ) : (
                    <PhoneCall size={24} />
                  )}
                </button>

                <button
                  onClick={() => setPhoneNumber("")}
                  disabled={!phoneNumber}
                  className="px-4 py-2 rounded-xl text-sm text-evo-muted hover:text-evo-text hover:bg-evo-card transition-colors disabled:opacity-30"
                >
                  Clear
                </button>
              </div>

              {!config?.configured && (
                <p className="text-xs text-center text-red-400">
                  Twilio is not configured. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER to your server .env file.
                </p>
              )}

              {/* Info */}
              <div className="bg-evo-card rounded-xl border border-evo-border p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Settings2 size={14} className="text-evo-muted" />
                  <p className="text-xs font-semibold text-evo-muted uppercase tracking-wider">AI Phone Agent</p>
                </div>
                <p className="text-xs text-evo-muted leading-relaxed">
                  When you call, Evo's AI agent answers and converses using speech-to-text and text-to-speech.
                  It uses the <strong>{config?.model || "llama3"}</strong> model for responses.
                  Incoming calls to <strong>{config?.phoneNumber || "your Twilio number"}</strong> are also handled automatically.
                </p>
              </div>
            </>
          )}

          {/* Call History */}
          {callLogs.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-evo-muted uppercase tracking-wider">Recent Calls</p>
                <button
                  onClick={() => setCallLogs([])}
                  className="text-[10px] text-evo-muted hover:text-red-400 transition-colors"
                >
                  Clear
                </button>
              </div>
              <div className="space-y-1.5">
                {callLogs.slice(0, 20).map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-evo-border"
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      log.direction === "outbound" ? "bg-blue-50" : "bg-emerald-50"
                    }`}>
                      {log.direction === "outbound" ? (
                        <ArrowUpRight size={14} className="text-blue-500" />
                      ) : (
                        <ArrowDownLeft size={14} className="text-emerald-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-evo-text truncate">
                        {log.direction === "outbound" ? log.to : log.from}
                      </p>
                      <p className="text-[10px] text-evo-muted">
                        {formatTime(log.startedAt)} · {log.status}
                        {log.duration ? ` · ${formatDuration(log.duration)}` : ""}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setPhoneNumber(log.direction === "outbound" ? log.to : log.from);
                      }}
                      className="p-1.5 rounded-lg hover:bg-evo-card text-evo-muted hover:text-emerald-500 transition-colors"
                    >
                      <Phone size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
