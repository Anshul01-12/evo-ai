import { useState } from "react";
import { Copy, Check, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import type { Message } from "@/types/chat";

interface Props {
  message: Message;
}

export function ChatMessage({ message }: Props) {
  const isUser = message.role === "user";

  return (
    <div className={`py-5 ${isUser ? "" : ""}`}>
      <div className="flex items-start gap-3">
        {/* Avatar */}
        {isUser ? (
          <div className="w-7 h-7 rounded-full bg-evo-card flex items-center justify-center shrink-0 mt-0.5 text-xs font-semibold text-evo-text">
            Y
          </div>
        ) : (
          <div className="w-7 h-7 rounded-lg bg-evo-card flex items-center justify-center shrink-0 mt-0.5">
            <Sparkles size={14} className="text-evo-highlight-text" />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-evo-muted mb-1.5">
            {isUser ? "You" : "Evo"}
          </p>

          {isUser ? (
            <p className="text-[15px] text-evo-text leading-relaxed whitespace-pre-wrap">
              {message.content}
            </p>
          ) : (
            <div className="text-[15px] text-evo-text leading-relaxed">
              <div className="markdown-content">
                <ReactMarkdown
                  components={{
                    code({ className, children, ...props }) {
                      const match = /language-(\w+)/.exec(className || "");
                      const codeString = String(children).replace(/\n$/, "");
                      if (match) {
                        return <CodeBlock language={match[1]} code={codeString} />;
                      }
                      return (
                        <code className={className} {...props}>
                          {children}
                        </code>
                      );
                    },
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              </div>

              {message.content && (
                <div className="mt-3 flex items-center gap-1">
                  <CopyButton text={message.content} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative my-4 rounded-2xl overflow-hidden border border-evo-border">
      <div className="flex items-center justify-between px-4 py-2.5 bg-evo-card text-xs">
        <span className="text-evo-muted font-medium">{language}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-evo-muted hover:text-evo-text transition-colors"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <SyntaxHighlighter
        language={language}
        style={oneDark}
        customStyle={{
          margin: 0,
          borderRadius: 0,
          fontSize: "13px",
          background: "#f0f2fa",
          padding: "16px",
          color: "#2d3a6e",
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-evo-muted hover:text-evo-text hover:bg-evo-card transition-colors"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
