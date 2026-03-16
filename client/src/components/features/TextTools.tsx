import { useState } from "react";
import { motion } from "framer-motion";
import { PenLine, Loader2, Sparkles, Copy, Check, Languages, FileText, Wand2, SpellCheck } from "lucide-react";
import { sendChatHTTP } from "@/services/api";
import { useChatStore } from "@/stores/chatStore";

const TOOLS = [
  { id: "summarize", label: "Summarize", icon: FileText, color: "bg-blue-100 text-blue-600", prompt: "Summarize the following text concisely, capturing all key points:\n\n" },
  { id: "translate", label: "Translate", icon: Languages, color: "bg-green-100 text-green-600", prompt: "" },
  { id: "rewrite", label: "Rewrite", icon: Wand2, color: "bg-purple-100 text-purple-600", prompt: "Rewrite the following text to be clearer, more professional, and better structured:\n\n" },
  { id: "grammar", label: "Grammar Fix", icon: SpellCheck, color: "bg-orange-100 text-orange-600", prompt: "Fix all grammar, spelling, and punctuation errors in the following text. Show the corrected version:\n\n" },
];

const TARGET_LANGUAGES = [
  "Hindi", "Spanish", "French", "German", "Chinese", "Japanese",
  "Korean", "Arabic", "Portuguese", "Russian", "Italian",
];

export function TextTools() {
  const [text, setText] = useState("");
  const [tool, setTool] = useState("summarize");
  const [targetLang, setTargetLang] = useState("Hindi");
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const model = useChatStore((s) => s.model);

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    let prompt: string;
    if (tool === "translate") {
      prompt = `Translate the following text to ${targetLang}. Provide only the translation:\n\n${text}`;
    } else {
      const t = TOOLS.find((t) => t.id === tool)!;
      prompt = `${t.prompt}${text}`;
    }

    try {
      const res = await sendChatHTTP({ message: prompt, model });
      setResult(res.message.content);
    } catch (err: any) {
      setError(err.message || "Failed");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const activeTool = TOOLS.find((t) => t.id === tool)!;

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-evo-bg">
      <header className="h-14 flex items-center px-5 border-b border-evo-border shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center">
            <PenLine size={14} className="text-indigo-600" />
          </div>
          <span className="text-sm font-semibold text-evo-text">Text Tools</span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto py-8 px-5">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-2xl font-bold text-evo-text mb-1">Text Tools</h1>
            <p className="text-sm text-evo-muted mb-6">
              Summarize, translate, rewrite, or fix grammar — powered by AI.
            </p>

            {/* Tool cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              {TOOLS.map(({ id, label, icon: Icon, color }) => (
                <button
                  key={id}
                  onClick={() => setTool(id)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                    tool === id
                      ? "border-evo-accent bg-evo-highlight shadow-sm"
                      : "border-transparent bg-white hover:border-evo-border"
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
                    <Icon size={18} />
                  </div>
                  <span className="text-xs font-medium text-evo-text">{label}</span>
                </button>
              ))}
            </div>

            {/* Translate language picker */}
            {tool === "translate" && (
              <div className="mb-4">
                <p className="text-sm text-evo-muted mb-2">Translate to:</p>
                <div className="flex flex-wrap gap-1.5">
                  {TARGET_LANGUAGES.map((lang) => (
                    <button
                      key={lang}
                      onClick={() => setTargetLang(lang)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                        targetLang === lang
                          ? "bg-green-100 text-green-700"
                          : "bg-white border border-evo-border text-evo-muted hover:text-evo-text"
                      }`}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Text input */}
            <div className="bg-white rounded-2xl border border-evo-border overflow-hidden mb-4">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste or type your text here..."
                rows={8}
                className="w-full bg-transparent resize-none outline-none text-sm p-4 placeholder:text-evo-muted"
              />
              <div className="px-4 py-2 border-t border-evo-border flex items-center justify-between">
                <span className="text-[11px] text-evo-muted">
                  {text.length} characters | ~{text.split(/\s+/).filter(Boolean).length} words
                </span>
                <button
                  onClick={handleSubmit}
                  disabled={!text.trim() || loading}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-evo-accent text-white text-sm font-medium hover:bg-evo-accent-hover transition-colors disabled:opacity-40"
                >
                  {loading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <activeTool.icon size={14} />
                  )}
                  {loading ? "Processing..." : activeTool.label}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600 mb-4">
                {error}
              </div>
            )}

            {/* Result */}
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl border border-evo-border"
              >
                <div className="px-4 py-3 border-b border-evo-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles size={14} className="text-indigo-500" />
                    <span className="text-xs font-semibold text-evo-muted">Result</span>
                  </div>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 text-xs text-evo-muted hover:text-evo-text transition-colors"
                  >
                    {copied ? <Check size={12} /> : <Copy size={12} />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <div className="p-5">
                  <p className="text-sm text-evo-text leading-relaxed whitespace-pre-wrap">
                    {result}
                  </p>
                </div>
              </motion.div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
