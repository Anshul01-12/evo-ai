import { useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Upload, Image as ImageIcon, Loader2, Sparkles, X, Send } from "lucide-react";
import { analyzeImage } from "@/services/api";
import { useChatStore } from "@/stores/chatStore";

export function ImageAnalyzer() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const model = useChatStore((s) => s.model);

  const handleFile = useCallback((f: File) => {
    if (!f.type.startsWith("image/")) return;
    setFile(f);
    setResult(null);
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(f);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );

  const handleAnalyze = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await analyzeImage({
        file,
        question: question || "Describe this image in detail. What do you see?",
        model,
      });
      setResult(res.message.content);
    } catch (err: any) {
      setError(err.message || "Analysis failed");
    } finally {
      setLoading(false);
    }
  };

  const clearImage = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setQuestion("");
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-evo-bg">
      <header className="h-14 flex items-center px-5 border-b border-evo-border shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center">
            <ImageIcon size={14} className="text-violet-600" />
          </div>
          <span className="text-sm font-semibold text-evo-text">Image Analyzer</span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto py-8 px-5">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h1 className="text-2xl font-bold text-evo-text mb-1">Analyze Images</h1>
            <p className="text-sm text-evo-muted mb-6">
              Upload an image and ask questions about it. Powered by vision AI models.
            </p>

            {/* Drop zone */}
            {!preview ? (
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
                  dragOver
                    ? "border-violet-400 bg-violet-50"
                    : "border-evo-border hover:border-evo-muted hover:bg-evo-card"
                }`}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                />
                <Upload size={32} className="mx-auto mb-3 text-evo-muted" />
                <p className="text-sm font-medium text-evo-text mb-1">
                  Drop an image here or click to upload
                </p>
                <p className="text-xs text-evo-muted">
                  Supports PNG, JPG, JPEG, WebP
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Preview */}
                <div className="relative rounded-2xl overflow-hidden border border-evo-border bg-white">
                  <img
                    src={preview}
                    alt="Preview"
                    className="w-full max-h-[400px] object-contain"
                  />
                  <button
                    onClick={clearImage}
                    className="absolute top-3 right-3 p-2 rounded-xl bg-white/80 backdrop-blur-sm hover:bg-white text-evo-muted hover:text-evo-text transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Question input */}
                <div className="bg-white rounded-2xl border border-evo-border p-3">
                  <div className="flex items-end gap-2">
                    <textarea
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      placeholder="Ask something about this image... (or leave blank for general analysis)"
                      rows={2}
                      className="flex-1 bg-transparent resize-none outline-none text-sm py-1 placeholder:text-evo-muted"
                    />
                    <button
                      onClick={handleAnalyze}
                      disabled={loading}
                      className="p-2.5 rounded-xl bg-evo-accent text-white disabled:opacity-50 hover:bg-evo-accent-hover transition-colors shrink-0"
                    >
                      {loading ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Send size={16} />
                      )}
                    </button>
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
                    {error}
                  </div>
                )}

                {/* Result */}
                {result && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-2xl border border-evo-border p-5"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles size={14} className="text-violet-500" />
                      <span className="text-xs font-semibold text-evo-muted">Evo Analysis</span>
                    </div>
                    <p className="text-sm text-evo-text leading-relaxed whitespace-pre-wrap">
                      {result}
                    </p>
                  </motion.div>
                )}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
