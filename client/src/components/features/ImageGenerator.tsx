import { useState } from "react";
import { motion } from "framer-motion";
import { Wand2, Loader2, Download, Sparkles, RefreshCw } from "lucide-react";
import { generateImageFromPrompt } from "@/services/api";

const PRESETS = [
  "A futuristic city at sunset, cyberpunk style",
  "A cute cat astronaut floating in space",
  "Mountain landscape with northern lights",
  "Abstract digital art, colorful geometric shapes",
  "Underwater world with bioluminescent creatures",
  "Cozy coffee shop on a rainy day, anime style",
];

export function ImageGenerator() {
  const [prompt, setPrompt] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    setImageUrl(null);

    try {
      const res = await generateImageFromPrompt({ prompt });
      setImageUrl(res.image.dataUrl);
    } catch (err: any) {
      setError(err.message || "Image generation failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!imageUrl) return;
    const a = document.createElement("a");
    a.href = imageUrl;
    a.download = `evo-image-${Date.now()}.png`;
    a.click();
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-evo-bg">
      <header className="h-14 flex items-center px-5 border-b border-evo-border shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-pink-100 flex items-center justify-center">
            <Wand2 size={14} className="text-pink-600" />
          </div>
          <span className="text-sm font-semibold text-evo-text">Image Generator</span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto py-8 px-5">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-2xl font-bold text-evo-text mb-1">Generate Images</h1>
            <p className="text-sm text-evo-muted mb-6">
              Describe what you want to see and let AI create it for you.
            </p>

            {/* Prompt input */}
            <div className="bg-white rounded-2xl border border-evo-border overflow-hidden mb-4">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe the image you want to generate..."
                rows={3}
                className="w-full bg-transparent resize-none outline-none text-sm p-4 placeholder:text-evo-muted"
              />
              <div className="px-4 py-2.5 border-t border-evo-border flex items-center justify-between">
                <span className="text-[11px] text-evo-muted">
                  Be descriptive for best results
                </span>
                <button
                  onClick={handleGenerate}
                  disabled={!prompt.trim() || loading}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-evo-accent text-white text-sm font-medium hover:bg-evo-accent-hover transition-colors disabled:opacity-40"
                >
                  {loading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Wand2 size={14} />
                  )}
                  {loading ? "Generating..." : "Generate"}
                </button>
              </div>
            </div>

            {/* Preset prompts */}
            {!imageUrl && !loading && (
              <div>
                <p className="text-xs font-medium text-evo-muted mb-2.5 uppercase tracking-wider">Try a prompt</p>
                <div className="flex flex-wrap gap-2">
                  {PRESETS.map((p) => (
                    <button
                      key={p}
                      onClick={() => setPrompt(p)}
                      className="px-3 py-1.5 rounded-xl text-xs bg-white border border-evo-border text-evo-muted hover:text-evo-text hover:border-evo-muted transition-all"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Loading state */}
            {loading && (
              <div className="flex flex-col items-center justify-center py-16">
                <motion.div
                  className="w-16 h-16 rounded-2xl bg-pink-100 flex items-center justify-center mb-4"
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                >
                  <Sparkles size={24} className="text-pink-500" />
                </motion.div>
                <p className="text-sm text-evo-muted">Creating your image...</p>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mt-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            {/* Result */}
            {imageUrl && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-6"
              >
                <div className="bg-white rounded-2xl border border-evo-border overflow-hidden">
                  <img
                    src={imageUrl}
                    alt={prompt}
                    className="w-full"
                  />
                  <div className="px-4 py-3 flex items-center justify-between border-t border-evo-border">
                    <p className="text-xs text-evo-muted truncate flex-1 mr-4">
                      "{prompt}"
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { setImageUrl(null); handleGenerate(); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-evo-muted hover:text-evo-text hover:bg-evo-card transition-colors"
                      >
                        <RefreshCw size={12} />
                        Regenerate
                      </button>
                      <button
                        onClick={handleDownload}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-evo-accent text-white hover:bg-evo-accent-hover transition-colors"
                      >
                        <Download size={12} />
                        Download
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
