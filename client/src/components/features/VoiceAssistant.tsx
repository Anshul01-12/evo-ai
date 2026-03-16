import { useState, useRef, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { Mic, MicOff, Volume2, Loader2 } from "lucide-react";
import { sendChatHTTP } from "@/services/api";
import { useChatStore } from "@/stores/chatStore";

interface VoiceMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export function VoiceAssistant() {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef(window.speechSynthesis);
  const model = useChatStore((s) => s.model);

  // Check browser support
  const SpeechRecognition =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const supported = !!SpeechRecognition;

  const speak = useCallback((text: string) => {
    if (!synthRef.current) return;
    synthRef.current.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    synthRef.current.speak(utterance);
  }, []);

  const stopSpeaking = useCallback(() => {
    synthRef.current?.cancel();
    setIsSpeaking(false);
  }, []);

  const processMessage = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      setIsProcessing(true);
      setError(null);

      const userMsg: VoiceMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: text,
      };
      setMessages((prev) => [...prev, userMsg]);

      try {
        const res = await sendChatHTTP({
          message: text,
          sessionId,
          model,
        });
        setSessionId(res.sessionId);

        const assistantMsg: VoiceMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: res.message.content,
        };
        setMessages((prev) => [...prev, assistantMsg]);

        // Speak the response
        speak(res.message.content);
      } catch (err: any) {
        setError(err.message || "Failed to process");
      } finally {
        setIsProcessing(false);
      }
    },
    [sessionId, model, speak]
  );

  const startListening = useCallback(() => {
    if (!SpeechRecognition) {
      setError("Speech recognition not supported in this browser. Try Chrome.");
      return;
    }

    stopSpeaking();
    setError(null);
    setTranscript("");

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      let finalText = "";
      let interimText = "";
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalText += event.results[i][0].transcript;
        } else {
          interimText += event.results[i][0].transcript;
        }
      }
      setTranscript(finalText || interimText);
    };

    recognition.onend = () => {
      setIsListening(false);
      // Process the final transcript
      if (recognitionRef.current?._finalTranscript) {
        processMessage(recognitionRef.current._finalTranscript);
      }
    };

    recognition.onerror = (event: any) => {
      setIsListening(false);
      if (event.error !== "no-speech") {
        setError(`Speech error: ${event.error}`);
      }
    };

    recognition.onresult = (event: any) => {
      let finalText = "";
      let interimText = "";
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalText += event.results[i][0].transcript;
        } else {
          interimText += event.results[i][0].transcript;
        }
      }
      setTranscript(finalText || interimText);
      if (finalText) {
        recognitionRef.current._finalTranscript = finalText;
      }
    };

    recognitionRef.current = recognition;
    recognitionRef.current._finalTranscript = "";
    recognition.start();
    setIsListening(true);
  }, [SpeechRecognition, processMessage, stopSpeaking]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      synthRef.current?.cancel();
    };
  }, []);

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-evo-bg">
      <header className="h-14 flex items-center px-5 border-b border-evo-border shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
            <Mic size={14} className="text-emerald-600" />
          </div>
          <span className="text-sm font-semibold text-evo-text">Voice Assistant</span>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-5">
        {!supported ? (
          <div className="text-center">
            <p className="text-evo-text font-medium mb-2">Browser Not Supported</p>
            <p className="text-sm text-evo-muted">
              Speech recognition requires Chrome, Edge, or Safari.
            </p>
          </div>
        ) : (
          <motion.div
            className="w-full max-w-md text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {/* Mic button */}
            <div className="relative inline-flex items-center justify-center mb-6">
              {isListening && (
                <>
                  <motion.div
                    className="absolute w-36 h-36 rounded-full bg-emerald-200"
                    animate={{ scale: [1, 1.3, 1] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                  />
                  <motion.div
                    className="absolute w-28 h-28 rounded-full bg-emerald-300"
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ repeat: Infinity, duration: 1.5, delay: 0.2 }}
                  />
                </>
              )}
              {isSpeaking && (
                <>
                  <motion.div
                    className="absolute w-36 h-36 rounded-full bg-blue-200"
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ repeat: Infinity, duration: 1 }}
                  />
                </>
              )}
              <button
                onClick={() => {
                  if (isListening) stopListening();
                  else if (isSpeaking) stopSpeaking();
                  else startListening();
                }}
                disabled={isProcessing}
                className={`relative z-10 w-24 h-24 rounded-full flex items-center justify-center transition-all shadow-lg ${
                  isListening
                    ? "bg-emerald-500 text-white scale-110"
                    : isSpeaking
                      ? "bg-blue-500 text-white"
                      : "bg-white border-2 border-evo-border text-evo-muted hover:border-evo-muted hover:text-evo-text"
                } disabled:opacity-50`}
              >
                {isProcessing ? (
                  <Loader2 size={32} className="animate-spin" />
                ) : isListening ? (
                  <MicOff size={32} />
                ) : isSpeaking ? (
                  <Volume2 size={32} />
                ) : (
                  <Mic size={32} />
                )}
              </button>
            </div>

            {/* Status */}
            <p className="text-sm text-evo-muted mb-2">
              {isListening
                ? "Listening..."
                : isSpeaking
                  ? "Speaking..."
                  : isProcessing
                    ? "Thinking..."
                    : "Tap the mic to start talking"}
            </p>

            {/* Live transcript */}
            {transcript && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-sm text-evo-text bg-white rounded-xl px-4 py-3 border border-evo-border mb-4 inline-block"
              >
                "{transcript}"
              </motion.p>
            )}

            {/* Error */}
            {error && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600 mb-4">
                {error}
              </div>
            )}

            {/* Message history */}
            {messages.length > 0 && (
              <div className="mt-6 w-full max-h-[300px] overflow-y-auto space-y-3 text-left">
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`rounded-xl px-4 py-3 text-sm ${
                      msg.role === "user"
                        ? "bg-evo-card text-evo-text ml-8"
                        : "bg-white border border-evo-border text-evo-text mr-8"
                    }`}
                  >
                    <p className="text-[10px] font-semibold text-evo-muted mb-1 uppercase">
                      {msg.role === "user" ? "You" : "Evo"}
                    </p>
                    <p className="leading-relaxed">{msg.content}</p>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
