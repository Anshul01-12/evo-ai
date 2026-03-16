import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { ChatArea } from "@/components/chat/ChatArea";
import { DocumentsPage } from "@/components/documents/DocumentsPage";
import { AuthPage } from "@/components/auth/AuthPage";
import { ImageAnalyzer } from "@/components/features/ImageAnalyzer";
import { VoiceAssistant } from "@/components/features/VoiceAssistant";
import { CodeInterpreter } from "@/components/features/CodeInterpreter";
import { TextTools } from "@/components/features/TextTools";
import { ImageGenerator } from "@/components/features/ImageGenerator";
import { VoiceCommand } from "@/components/features/VoiceCommand";
import { useChatStore } from "@/stores/chatStore";
import { useAuthStore } from "@/stores/authStore";

function AppLayout() {
  const sidebarOpen = useChatStore((s) => s.sidebarOpen);

  return (
    <div className="flex h-screen overflow-hidden">
      {sidebarOpen && <Sidebar />}
      <Routes>
        <Route path="/" element={<ChatArea />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/image-analyzer" element={<ImageAnalyzer />} />
        <Route path="/voice" element={<VoiceAssistant />} />
        <Route path="/code" element={<CodeInterpreter />} />
        <Route path="/text-tools" element={<TextTools />} />
        <Route path="/image-generator" element={<ImageGenerator />} />
        <Route path="/voice-command" element={<VoiceCommand />} />
      </Routes>
    </div>
  );
}

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  const loadFromStorage = useAuthStore((s) => s.loadFromStorage);

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<AuthPage />} />
        <Route path="/*" element={<AppLayout />} />
      </Routes>
    </BrowserRouter>
  );
}
