import { useState, useRef } from "react";
import {
  ArrowUp,
  Paperclip,
  Square,
  Loader2,
  ChevronDown,
  Mic,
  MicOff,
} from "lucide-react";
import { useChatStore } from "@/stores/chatStore";
import { useChat } from "@/hooks/useChat";
import { uploadDocument } from "@/services/api";

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

export function ChatInput() {
  const [input, setInput] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { isStreaming, isLoading, model, setModel } = useChatStore();
  const { sendMessage, stopStreaming, processVoice } = useChat();

  const selectedModel = MODELS.find((m) => m.id === model) || MODELS[0];

  const handleSubmit = () => {
    if (!input.trim() || isStreaming || isLoading) return;
    sendMessage(input);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  };

  const handleFileClick = () => fileRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      await uploadDocument(file);
      setInput((prev) => prev + `\n[Uploaded: ${file.name}]`);
    } catch {
      // ignore
    } finally {
      setIsUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("Microphone not supported");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        setIsRecording(false);
        const blob = new Blob(chunks, { type: "audio/webm" });
        await processRecordedAudio(blob);
      };

      recorder.start();
      setIsRecording(true);
      mediaRecorderRef.current = recorder;
    } catch (error) {
      console.error("Microphone error", error);
      alert("Unable to access microphone");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const processRecordedAudio = async (blob: Blob) => {
    setIsUploading(true);
    try {
      const file = new File([blob], `voice-${Date.now()}.webm`, { type: blob.type });
      await processVoice(file);
    } catch (err: any) {
      console.error("Voice process failed", err);
    } finally {
      setIsUploading(false);
    }
  };

  const isBusy = isStreaming || isLoading;

  // Voice call mode
  if (voiceMode) {
    return (
      <div className="flex flex-col items-center gap-6 py-8">
        <div className="relative">
          <div className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${
            isRecording
              ? "bg-red-100 border-4 border-red-300"
              : "bg-evo-card border-4 border-evo-border"
          }`}>
            {isRecording ? (
              <>
                <div className="absolute inset-0 rounded-full bg-red-200 animate-ping opacity-30" />
                <MicOff size={32} className="text-red-500 relative z-10" />
              </>
            ) : (
              <Mic size={32} className="text-evo-muted" />
            )}
          </div>
        </div>

        <p className="text-sm text-evo-muted">
          {isRecording ? "Listening..." : "Tap to speak"}
        </p>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (isRecording) stopRecording();
              else startRecording();
            }}
            className={`px-6 py-3 rounded-2xl text-sm font-medium transition-all ${
              isRecording
                ? "bg-red-500 text-white hover:bg-red-600"
                : "bg-evo-accent text-white hover:bg-evo-accent-hover"
            }`}
          >
            {isRecording ? "Stop" : "Start talking"}
          </button>
          <button
            onClick={() => { setVoiceMode(false); if (isRecording) stopRecording(); }}
            className="px-4 py-3 rounded-2xl text-sm text-evo-muted border border-evo-border hover:bg-evo-card transition-colors"
          >
            Back to chat
          </button>
        </div>

        {isUploading && (
          <div className="flex items-center gap-2 text-sm text-evo-muted">
            <Loader2 size={14} className="animate-spin" />
            Processing voice...
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Model Picker Dropdown */}
      {showModelPicker && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setShowModelPicker(false)} />
          <div className="absolute bottom-full left-0 mb-2 z-20 w-72 max-h-80 overflow-y-auto rounded-2xl border border-evo-border bg-white shadow-xl">
            <div className="p-2">
              {MODELS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => { setModel(m.id); setShowModelPicker(false); }}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-left text-sm transition-colors ${
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

      <div className="bg-white rounded-2xl border border-evo-border shadow-sm">
        {/* Textarea */}
        <div className="px-4 pt-3 pb-1">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask Evo anything..."
            rows={1}
            className="w-full bg-transparent resize-none outline-none text-[15px] py-1 max-h-[200px] overflow-y-auto placeholder:text-evo-muted text-evo-text"
          />
        </div>

        {/* Bottom bar */}
        <div className="flex items-center justify-between px-3 pb-3 pt-1">
          <div className="flex items-center gap-1">
            {/* File Upload */}
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              onClick={handleFileClick}
              disabled={isUploading}
              className="p-2 rounded-xl text-evo-muted hover:text-evo-text hover:bg-evo-card transition-colors disabled:opacity-50"
              title="Upload file"
            >
              {isUploading ? <Loader2 size={18} className="animate-spin" /> : <Paperclip size={18} />}
            </button>

            {/* Model Selector */}
            <button
              onClick={() => setShowModelPicker(!showModelPicker)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium text-evo-muted hover:text-evo-text hover:bg-evo-card transition-colors"
              title="Change model"
            >
              <span className="max-w-[90px] truncate">{selectedModel.name}</span>
              <ChevronDown size={12} className={`transition-transform ${showModelPicker ? "rotate-180" : ""}`} />
            </button>

          </div>

          {/* Send / Stop */}
          <div className="flex items-center gap-1">
            {isBusy ? (
              <button
                onClick={stopStreaming}
                className="p-2 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                title="Stop generating"
              >
                {isStreaming ? <Square size={16} /> : <Loader2 size={16} className="animate-spin" />}
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!input.trim()}
                className="p-2 rounded-xl bg-evo-accent text-white disabled:opacity-20 hover:bg-evo-accent-hover transition-colors"
                title="Send message"
              >
                <ArrowUp size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
