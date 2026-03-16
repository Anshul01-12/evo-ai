import { useCallback, useRef } from "react";
import { useChatStore } from "@/stores/chatStore";
import {
  sendSocketMessage,
  sendChatHTTP,
  isSocketConnected,
  initSocket,
  fetchHistory,
  processVoiceAudio,
} from "@/services/api";

/**
 * Custom hook encapsulating all chat logic:
 * - WebSocket streaming with HTTP fallback
 * - Session management
 * - Loading / error states
 * - Conversation list refresh
 */
export function useChat() {
  const {
    activeConversationId,
    model,
    isStreaming,
    addMessage,
    appendToLastMessage,
    setStreaming,
    setActiveConversation,
    setError,
    setLoading,
    setConversations,
  } = useChatStore();

  const cleanupRef = useRef<(() => void) | null>(null);

  const refreshHistory = useCallback(async () => {
    try {
      const data = await fetchHistory();
      setConversations(data.conversations as any);
    } catch {
      // silent
    }
  }, [setConversations]);

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isStreaming) return;

      setError(null);

      // Optimistically add user message
      addMessage({
        _id: crypto.randomUUID(),
        role: "user",
        content: trimmed,
        timestamp: new Date().toISOString(),
      });

      // Try WebSocket first for real-time streaming
      try {
        initSocket();
      } catch {
        // socket init failed — will use HTTP fallback
      }

      if (isSocketConnected()) {
        // ── WebSocket path ──
        addMessage({
          _id: crypto.randomUUID(),
          role: "assistant",
          content: "",
          timestamp: new Date().toISOString(),
        });

        setStreaming(true);

        cleanupRef.current = sendSocketMessage({
          message: trimmed,
          sessionId: activeConversationId || undefined,
          model,
          onToken: (token) => appendToLastMessage(token),
          onDone: (conversationId) => {
            setActiveConversation(conversationId);
            setStreaming(false);
            refreshHistory();
          },
          onError: (error) => {
            setStreaming(false);
            setError(error);
          },
        });
      } else {
        // ── HTTP fallback ──
        setLoading(true);

        sendChatHTTP({
          message: trimmed,
          sessionId: activeConversationId || undefined,
          model,
        })
          .then((data) => {
            addMessage({
              _id: crypto.randomUUID(),
              role: "assistant",
              content: data.message.content,
              timestamp: data.message.timestamp,
            });
            setActiveConversation(data.sessionId);
            refreshHistory();
          })
          .catch((err) => {
            setError(err.message || "Failed to get response");
          })
          .finally(() => {
            setLoading(false);
          });
      }
    },
    [
      isStreaming,
      activeConversationId,
      model,
      addMessage,
      appendToLastMessage,
      setStreaming,
      setActiveConversation,
      setError,
      setLoading,
      refreshHistory,
    ]
  );

  const processVoice = useCallback(
    async (file: File) => {
      setError(null);
      setStreaming(true);
      setLoading(true);

      addMessage({
        _id: crypto.randomUUID(),
        role: "user",
        content: "[voice message] transcribing...",
        timestamp: new Date().toISOString(),
      });

      try {
        const res = await processVoiceAudio({
          file,
          sessionId: activeConversationId || undefined,
          model,
          useRag: false,
          collectionName: "default",
        });

        addMessage({
          _id: crypto.randomUUID(),
          role: "user",
          content: res.transcription,
          timestamp: new Date().toISOString(),
        });

        addMessage({
          _id: crypto.randomUUID(),
          role: "assistant",
          content: res.answer,
          timestamp: new Date().toISOString(),
        });

        if (res.audio_base64) {
          const audio = new Audio(`data:audio/wav;base64,${res.audio_base64}`);
          audio.play().catch((err) => {
            console.error("TTS playback failed", err);
          });
        }

        if (res.sessionId) {
          setActiveConversation(res.sessionId);
        }

        refreshHistory();
      } catch (err: any) {
        setError(err?.message || "Voice processing failed");
      } finally {
        setStreaming(false);
        setLoading(false);
      }
    },
    [activeConversationId, model, addMessage, setActiveConversation, setError, setLoading, setStreaming, refreshHistory]
  );

  const stopStreaming = useCallback(() => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    setStreaming(false);
  }, [setStreaming]);

  return { sendMessage, stopStreaming, processVoice, refreshHistory };
}

