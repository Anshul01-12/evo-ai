import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { analyzeImage, generateImageFromPrompt } from "@/services/api";

type Role = "user" | "assistant" | "system";

type Message = {
  id: string;
  role: Role;
  text: string;
  createdAt: number;
  isStreaming?: boolean;
  imageUrl?: string;
  generatedImageUrl?: string;
};

type ChatSession = {
  id: string;
  title: string;
  messages: Message[];
};

const DEFAULT_MODELS = [
  "llama3", "mistral", "gemma", "deepseek-llm",
  "groq-llama3-70b", "groq-llama3-8b", "groq-mixtral",
  "gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-1.5-pro",
  "llava",
];

const initialChat: ChatSession = {
  id: "chat-1",
  title: "New Chat",
  messages: [
    {
      id: "m-1",
      role: "assistant",
      text: "Hello! I\'m your AI assistant. Type a message to begin.",
      createdAt: Date.now(),
    },
  ],
};

const fakeResponses = [
  "Sure! I can help explain that.\n\n- item 1\n- item 2\n\n```ts\nconst hello = 'world';\nconsole.log(hello);\n```",
  "Great question. Here is a short guide:\n\n1. Step one\n2. Step two\n\nLet me know what you want next.",
  "I am streaming a very long answer in chunks to mimic a real model streaming endpoint.",
];

export default function ChatGPTUI() {
  const [chatHistory, setChatHistory] = useState<ChatSession[]>([initialChat]);
  const [activeChatId, setActiveChatId] = useState(initialChat.id);
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODELS[0]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [pendingImagePreview, setPendingImagePreview] = useState<string | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | undefined>(undefined);
  const [generationMode, setGenerationMode] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const activeChat = useMemo(
    () => chatHistory.find((chat) => chat.id === activeChatId) ?? chatHistory[0],
    [chatHistory, activeChatId]
  );

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeChat?.messages.length, isStreaming]);

  const updateHistory = useCallback(
    (updated: ChatSession) => {
      setChatHistory((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    },
    [setChatHistory]
  );

  const generateId = () => `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  useEffect(() => {
    return () => {
      if (pendingImagePreview) {
        URL.revokeObjectURL(pendingImagePreview);
      }
    };
  }, [pendingImagePreview]);

  const startStreamingResponse = async (fullText: string) => {
    if (!activeChat) return;
    setIsStreaming(true);

    const streamingId = generateId();
    const initialMessage: Message = {
      id: streamingId,
      role: "assistant",
      text: "",
      createdAt: Date.now(),
      isStreaming: true,
    };

    const sessionBase = { ...activeChat, messages: [...activeChat.messages, initialMessage] };
    updateHistory(sessionBase);

    let index = 0;
    const chunkSize = 8;

    return new Promise<void>((resolve) => {
      const interval = window.setInterval(() => {
        if (index >= fullText.length) {
          clearInterval(interval);
          setIsStreaming(false);
          updateHistory({
            ...sessionBase,
            messages: sessionBase.messages.map((msg) =>
              msg.id === streamingId ? { ...msg, isStreaming: false } : msg
            ),
          });
          return resolve();
        }

        const part = fullText.slice(index, Math.min(fullText.length, index + chunkSize));
        index += chunkSize;

        updateHistory({
          ...sessionBase,
          messages: sessionBase.messages.map((msg) =>
            msg.id === streamingId ? { ...msg, text: msg.text + part, isStreaming: true } : msg
          ),
        });
      }, 50);
    });
  };

  const sendMessage = async () => {
    const trimmed = inputValue.trim();
    if (!trimmed || !activeChat) return;

    const userMessage: Message = {
      id: generateId(),
      role: "user",
      text: pendingImage
        ? `Image question: ${trimmed}`
        : generationMode
          ? `Generate image: ${trimmed}`
          : trimmed,
      createdAt: Date.now(),
      imageUrl: pendingImagePreview || undefined,
    };
    const nextHistory: ChatSession = { ...activeChat, messages: [...activeChat.messages, userMessage] };
    updateHistory(nextHistory);
    setInputValue("");

    if (pendingImage) {
      setIsUploading(true);
      setIsStreaming(true);
      try {
        const result = await analyzeImage({
          file: pendingImage,
          question: trimmed,
          sessionId: activeSessionId,
          model: selectedModel === "local-13b" ? "llava" : selectedModel,
        });

        setActiveSessionId(result.sessionId);
        await startStreamingResponse(result.message.content);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Image analysis failed";
        await startStreamingResponse(`I couldn't analyze that image.\n\n${message}`);
      } finally {
        setIsUploading(false);
        setPendingImage(null);
        if (pendingImagePreview) {
          URL.revokeObjectURL(pendingImagePreview);
        }
        setPendingImagePreview(null);
      }
      return;
    }

    if (generationMode) {
      setIsStreaming(true);
      try {
        const result = await generateImageFromPrompt({
          prompt: trimmed,
          sessionId: activeSessionId,
          width: 768,
          height: 768,
          steps: 30,
          guidanceScale: 7.5,
        });

        setActiveSessionId(result.sessionId);
        const assistantMessage: Message = {
          id: generateId(),
          role: "assistant",
          text: result.message.content,
          createdAt: Date.now(),
          generatedImageUrl: result.image.dataUrl,
        };

        updateHistory({
          ...nextHistory,
          messages: [...nextHistory.messages, assistantMessage],
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Image generation failed";
        await startStreamingResponse(`I couldn't generate that image.\n\n${message}`);
      } finally {
        setIsStreaming(false);
        setGenerationMode(false);
      }
      return;
    }

    const responseText = fakeResponses[Math.floor(Math.random() * fakeResponses.length)];
    await startStreamingResponse(responseText);
  };

  const createNewChat = () => {
    const id = `chat-${Date.now()}`;
    const newChat: ChatSession = {
      id,
      title: "New Chat",
      messages: [
        {
          id: generateId(),
          role: "assistant",
          text: "New chat started. Ask anything!",
          createdAt: Date.now(),
        },
      ],
    };
    setChatHistory((prev) => [newChat, ...prev]);
    setActiveChatId(id);
  };

  const handleUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    const file = files[0];

    if (file.type.startsWith("image/")) {
      if (pendingImagePreview) {
        URL.revokeObjectURL(pendingImagePreview);
      }
      setPendingImage(file);
      setPendingImagePreview(URL.createObjectURL(file));
      setInputValue((prev) => prev || "What is in this image?");
      setIsUploading(false);
      return;
    }

    setTimeout(() => {
      setIsUploading(false);
      setInputValue((prev) => `${prev}\n[Uploaded file: ${file.name}]`);
    }, 700);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // Optionally show toast, etc
    } catch {
      console.error("Clipboard copy failed");
    }
  };

  return (
    <div className="h-screen w-screen bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto flex h-full max-w-[1400px] flex-col lg:flex-row">
        <aside className="w-full border-b border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:w-80 lg:border-r lg:border-b-0">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">AI Assistant</h2>
            <button
              onClick={createNewChat}
              className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              New Chat
            </button>
          </div>

          <div className="mb-4">
            <h3 className="mb-2 text-xs uppercase tracking-wider text-slate-500">Model</h3>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full rounded border border-slate-300 px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              {DEFAULT_MODELS.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setSettingsOpen((prev) => !prev)}
            className="mb-4 w-full rounded border border-slate-200 px-3 py-2 text-left text-sm font-medium dark:border-slate-700"
          >
            Settings {settingsOpen ? "▲" : "▼"}
          </button>

          {settingsOpen && (
            <div className="mb-4 rounded border border-slate-200 bg-slate-50 p-2 text-sm dark:border-slate-800 dark:bg-slate-800">
              <p className="mb-2 font-semibold">App Settings</p>
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="h-4 w-4" />
                  Auto-scroll to latest message
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="h-4 w-4" />
                  Enable dark mode
                </label>
              </div>
            </div>
          )}

          <div className="h-[calc(100vh-290px)] overflow-y-auto pr-1">
            <h3 className="mb-2 text-xs uppercase tracking-wider text-slate-500">History</h3>
            <div className="space-y-2">
              {chatHistory.map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => setActiveChatId(chat.id)}
                  className={`w-full rounded border px-2 py-2 text-left text-sm transition ${
                    chat.id === activeChatId
                      ? "border-blue-400 bg-blue-50 text-blue-700 dark:bg-blue-900/40"
                      : "border-slate-200 bg-white text-slate-700 hover:border-blue-300 dark:border-slate-700 dark:bg-slate-900"
                  }`}
                >
                  <strong>{chat.title}</strong>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {chat.messages[chat.messages.length - 1]?.text.slice(0, 40)}...
                  </p>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <main className="flex h-full flex-1 flex-col">
          <div className="flex-1 overflow-y-auto p-4 lg:p-6">
            <div className="mx-auto w-full max-w-4xl space-y-4">
              {activeChat?.messages.map((message) => (
                <div
                  key={message.id}
                  className={`rounded-xl p-4 shadow-sm ${
                    message.role === "user"
                      ? "ml-auto max-w-[85%] bg-blue-100 text-blue-900 dark:bg-blue-900/50 dark:text-blue-100"
                      : "max-w-[85%] bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs text-slate-500 dark:text-slate-400">{message.role}</p>
                    <button
                      onClick={() => copyToClipboard(message.text)}
                      className="rounded border px-2 py-0.5 text-[10px] hover:border-slate-400"
                    >
                      Copy
                    </button>
                  </div>
                  <div className="mt-2 text-sm leading-relaxed">
                    {message.imageUrl && (
                      <img
                        src={message.imageUrl}
                        alt="Uploaded content"
                        className="mb-3 max-h-64 rounded-lg border border-slate-200 object-cover dark:border-slate-700"
                      />
                    )}
                    {message.generatedImageUrl && (
                      <img
                        src={message.generatedImageUrl}
                        alt="Generated output"
                        className="mb-3 max-h-80 rounded-lg border border-slate-200 object-cover dark:border-slate-700"
                      />
                    )}
                    <ReactMarkdown
                      children={message.text || "..."}
                      components={{
                        code({ className, children }) {
                          const isInline = !className;
                          return isInline ? (
                            <code className="rounded bg-slate-200 px-1 py-0.5 text-xs text-slate-700 dark:bg-slate-700/70 dark:text-slate-100">
                              {children}
                            </code>
                          ) : (
                            <pre className="rounded bg-slate-900 p-3 text-xs text-slate-100 overflow-x-auto">
                              <code className={className}>{children}</code>
                            </pre>
                          );
                        },
                        blockquote({ children }) {
                          return <blockquote className="border-l-4 border-slate-300 pl-3 italic text-slate-600 dark:border-slate-600 dark:text-slate-300">{children}</blockquote>;
                        },
                      }}
                    />
                  </div>
                  {message.isStreaming && <p className="mt-2 text-xs text-slate-500">Streaming...</p>}
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
          </div>

          <div className="border-t border-slate-300 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
            <div className="flex flex-wrap items-center gap-2 md:gap-3">
              <label className="flex h-10 items-center rounded border border-slate-300 bg-white p-2 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                <span className="mr-2 text-sm">Attach</span>
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => handleUpload(e.target.files)}
                />
              </label>

              <button
                onClick={() => setGenerationMode((prev) => !prev)}
                className={`h-10 rounded border px-3 text-sm transition ${
                  generationMode
                    ? "border-amber-500 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                    : "border-slate-300 bg-white text-slate-600 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                }`}
              >
                {generationMode ? "Image Mode On" : "Generate Image"}
              </button>

              <button
                onClick={() => setIsVoiceActive((prev) => !prev)}
                className={`h-10 rounded border px-3 text-sm transition ${
                  isVoiceActive
                    ? "border-green-500 bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200"
                    : "border-slate-300 bg-white text-slate-600 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                }`}
              >
                {isVoiceActive ? "Stop Voice" : "Voice"}
              </button>

              <input
                type="text"
                placeholder={
                  pendingImage
                    ? "Ask a question about the image..."
                    : generationMode
                      ? "Describe the image you want to generate..."
                      : "Type your message..."
                }
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                className="flex-1 min-w-[180px] rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />

              <button
                disabled={isStreaming || !inputValue.trim()}
                onClick={sendMessage}
                className="h-10 rounded bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                {isStreaming ? "Waiting..." : "Send"}
              </button>

              {isUploading && <span className="text-xs text-slate-500">Uploading file...</span>}
              {pendingImage && (
                <span className="text-xs text-slate-500">
                  Image ready: {pendingImage.name}
                </span>
              )}
              {generationMode && !pendingImage && (
                <span className="text-xs text-slate-500">Stable Diffusion prompt mode</span>
              )}
            </div>
            {pendingImagePreview && (
              <div className="mt-3 flex items-center gap-3">
                <img
                  src={pendingImagePreview}
                  alt="Pending upload preview"
                  className="h-16 w-16 rounded-lg border border-slate-200 object-cover dark:border-slate-700"
                />
                <button
                  onClick={() => {
                    if (pendingImagePreview) {
                      URL.revokeObjectURL(pendingImagePreview);
                    }
                    setPendingImage(null);
                    setPendingImagePreview(null);
                  }}
                  className="rounded border border-slate-300 px-3 py-1 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300"
                >
                  Remove image
                </button>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
