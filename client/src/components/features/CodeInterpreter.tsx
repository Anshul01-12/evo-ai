import { useState } from "react";
import { motion } from "framer-motion";
import { Code2, Loader2, Sparkles, Copy, Check } from "lucide-react";
import { sendChatHTTP } from "@/services/api";
import { useChatStore } from "@/stores/chatStore";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

const ACTIONS = [
  { id: "explain", label: "Explain", prompt: "Explain this code in detail, line by line:" },
  { id: "fix", label: "Fix Bugs", prompt: "Find and fix all bugs in this code. Show the corrected code with explanations:" },
  { id: "refactor", label: "Refactor", prompt: "Refactor this code to make it cleaner, more efficient, and follow best practices:" },
  { id: "convert", label: "Convert", prompt: "" },
  { id: "test", label: "Write Tests", prompt: "Write comprehensive unit tests for this code:" },
  { id: "document", label: "Document", prompt: "Add clear documentation, comments, and docstrings to this code:" },
];

const LANGUAGES = ["Python", "JavaScript", "TypeScript", "Java", "C++", "Go", "Rust", "C#"];

export function CodeInterpreter() {
  const [code, setCode] = useState("");
  const [action, setAction] = useState("explain");
  const [convertTo, setConvertTo] = useState("Python");
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const model = useChatStore((s) => s.model);

  const handleSubmit = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    let prompt: string;
    if (action === "convert") {
      prompt = `Convert this code to ${convertTo}. Show only the converted code with brief explanations:\n\n\`\`\`\n${code}\n\`\`\``;
    } else {
      const act = ACTIONS.find((a) => a.id === action)!;
      prompt = `${act.prompt}\n\n\`\`\`\n${code}\n\`\`\``;
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

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-evo-bg">
      <header className="h-14 flex items-center px-5 border-b border-evo-border shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
            <Code2 size={14} className="text-amber-600" />
          </div>
          <span className="text-sm font-semibold text-evo-text">Code Interpreter</span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto py-8 px-5">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-2xl font-bold text-evo-text mb-1">Code Interpreter</h1>
            <p className="text-sm text-evo-muted mb-6">
              Paste your code and choose an action. Explain, fix, refactor, convert, test, or document.
            </p>

            {/* Action selector */}
            <div className="flex flex-wrap gap-2 mb-4">
              {ACTIONS.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setAction(a.id)}
                  className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
                    action === a.id
                      ? "bg-evo-accent text-white"
                      : "bg-white border border-evo-border text-evo-muted hover:text-evo-text hover:border-evo-muted"
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </div>

            {/* Convert language picker */}
            {action === "convert" && (
              <div className="flex items-center gap-2 mb-4">
                <span className="text-sm text-evo-muted">Convert to:</span>
                <div className="flex flex-wrap gap-1.5">
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang}
                      onClick={() => setConvertTo(lang)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                        convertTo === lang
                          ? "bg-amber-100 text-amber-700"
                          : "bg-evo-card text-evo-muted hover:text-evo-text"
                      }`}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Code input */}
            <div className="bg-white rounded-2xl border border-evo-border overflow-hidden mb-4">
              <div className="px-4 py-2.5 border-b border-evo-border bg-evo-card flex items-center justify-between">
                <span className="text-xs font-medium text-evo-muted">Paste your code</span>
              </div>
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Paste or type your code here..."
                rows={12}
                className="w-full bg-transparent resize-none outline-none text-sm p-4 font-mono placeholder:text-evo-muted"
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={!code.trim() || loading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-evo-accent text-white text-sm font-medium hover:bg-evo-accent-hover transition-colors disabled:opacity-40"
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Sparkles size={16} />
              )}
              {loading ? "Processing..." : `${ACTIONS.find((a) => a.id === action)?.label} Code`}
            </button>

            {/* Error */}
            {error && (
              <div className="mt-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            {/* Result */}
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 bg-white rounded-2xl border border-evo-border overflow-hidden"
              >
                <div className="px-4 py-3 border-b border-evo-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles size={14} className="text-amber-500" />
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
                <div className="p-5 text-sm text-evo-text leading-relaxed markdown-content">
                  <ReactMarkdown
                    components={{
                      code({ className, children, ...props }) {
                        const match = /language-(\w+)/.exec(className || "");
                        const codeStr = String(children).replace(/\n$/, "");
                        if (match) {
                          return (
                            <SyntaxHighlighter
                              language={match[1]}
                              style={oneDark}
                              customStyle={{ margin: 0, borderRadius: "12px", fontSize: "13px" }}
                            >
                              {codeStr}
                            </SyntaxHighlighter>
                          );
                        }
                        return <code className={className} {...props}>{children}</code>;
                      },
                    }}
                  >
                    {result}
                  </ReactMarkdown>
                </div>
              </motion.div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
