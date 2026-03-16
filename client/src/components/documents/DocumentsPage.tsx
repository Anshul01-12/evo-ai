import { useState, useEffect, useRef, useCallback } from "react";
import {
  FileText,
  Upload,
  Trash2,
  Search,
  Loader2,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Bot,
  UploadCloud,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import {
  fetchDocuments,
  uploadDocument,
  deleteDocument,
  queryDocument,
} from "@/services/api";
import type { DocumentInfo, QAResponse } from "@/types/chat";

export function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [questioning, setQuestioning] = useState(false);
  const [question, setQuestion] = useState("");
  const [selectedCollection, setSelectedCollection] = useState("default");
  const [qaResult, setQaResult] = useState<QAResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const docs = await fetchDocuments();
      setDocuments(docs as unknown as DocumentInfo[]);
    } catch {
      setError("Failed to load documents");
    } finally {
      setLoading(false);
    }
  };

  const processFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Only PDF files are supported");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      await uploadDocument(file, selectedCollection);
      await loadDocuments();
    } catch {
      setError("Upload failed");
    } finally {
      setUploading(false);
    }
  }, [selectedCollection]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await processFile(file);
  }, [processFile]);

  const handleDelete = async (id: string) => {
    try {
      await deleteDocument(id);
      setDocuments((prev) => prev.filter((d) => d._id !== id));
    } catch {
      setError("Delete failed");
    }
  };

  const handleAsk = async () => {
    if (!question.trim() || questioning) return;
    setQuestioning(true);
    setError(null);
    setQaResult(null);
    try {
      const result = await queryDocument({
        question: question.trim(),
        collectionName: selectedCollection,
      });
      setQaResult(result);
    } catch (err: any) {
      setError(err.message || "Q&A failed");
    } finally {
      setQuestioning(false);
    }
  };

  const collections = [...new Set(documents.map((d) => d.collectionName))];
  if (!collections.includes("default")) collections.unshift("default");

  const readyDocs = documents.filter(
    (d) => d.collectionName === selectedCollection && d.status === "ready"
  );

  return (
    <div
      className="flex-1 overflow-y-auto relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-white/80 backdrop-blur-sm flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 p-8 rounded-2xl border-2 border-dashed border-evo-accent bg-evo-accent/5">
            <UploadCloud size={48} className="text-evo-accent" />
            <p className="text-lg font-medium text-evo-accent">Drop your PDF here</p>
            <p className="text-sm text-evo-muted">It will be added to "{selectedCollection}"</p>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto py-8 px-4 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold mb-1">Document Q&A</h1>
          <p className="text-evo-muted text-sm">
            Upload PDFs, ask questions, and get answers with citations.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <AlertCircle size={16} />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)} className="text-xs">Dismiss</button>
          </div>
        )}

        {/* Upload + Collection */}
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-evo-muted block mb-1">Collection</label>
            <select
              value={selectedCollection}
              onChange={(e) => setSelectedCollection(e.target.value)}
              className="w-full bg-evo-card border border-evo-border rounded-lg px-3 py-2 text-sm outline-none"
            >
              {collections.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={handleUpload}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-evo-accent text-white text-sm hover:bg-evo-accent-hover disabled:opacity-50 transition-colors"
            >
              {uploading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Upload size={16} />
              )}
              {uploading ? "Processing..." : "Upload PDF"}
            </button>
          </div>
        </div>

        {/* Document List */}
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-evo-muted">
            Documents in "{selectedCollection}" ({readyDocs.length})
          </h2>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 size={24} className="animate-spin text-evo-muted" />
            </div>
          ) : readyDocs.length === 0 ? (
            <div
              onClick={() => fileRef.current?.click()}
              className="flex flex-col items-center gap-2 py-10 border-2 border-dashed border-evo-border rounded-xl text-evo-muted cursor-pointer hover:border-evo-accent hover:text-evo-accent transition-colors"
            >
              <UploadCloud size={32} />
              <p className="text-sm">No documents yet. Drop a PDF here or click to upload.</p>
            </div>
          ) : (
            <div className="grid gap-2">
              {readyDocs.map((doc) => (
                <div
                  key={doc._id}
                  className="flex items-center gap-3 px-4 py-3 bg-evo-card rounded-lg border border-evo-border"
                >
                  <FileText size={18} className="text-evo-accent shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{doc.originalName}</p>
                    <p className="text-xs text-evo-muted">
                      {doc.chunkCount} chunks &middot;{" "}
                      {(doc.fileSize / 1024).toFixed(0)} KB
                    </p>
                  </div>
                  <StatusBadge status={doc.status} />
                  <button
                    onClick={() => handleDelete(doc._id)}
                    className="p-1.5 rounded hover:bg-red-500/20 text-evo-muted hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Question Input */}
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-evo-muted">Ask a Question</h2>
          <div className="flex gap-2">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAsk()}
              placeholder="What does the document say about..."
              className="flex-1 bg-evo-card border border-evo-border rounded-lg px-4 py-2.5 text-sm outline-none placeholder:text-evo-muted focus:border-evo-accent transition-colors"
            />
            <button
              onClick={handleAsk}
              disabled={questioning || !question.trim() || readyDocs.length === 0}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-evo-accent text-white text-sm hover:bg-evo-accent-hover disabled:opacity-30 transition-colors"
            >
              {questioning ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Search size={16} />
              )}
              Ask
            </button>
          </div>
        </div>

        {/* Answer */}
        {qaResult && <QAAnswer result={qaResult} />}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "ready") {
    return (
      <span className="flex items-center gap-1 text-xs text-green-400">
        <CheckCircle size={12} /> Ready
      </span>
    );
  }
  if (status === "processing") {
    return (
      <span className="flex items-center gap-1 text-xs text-yellow-400">
        <Loader2 size={12} className="animate-spin" /> Processing
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs text-red-400">
      <AlertCircle size={12} /> Error
    </span>
  );
}

function QAAnswer({ result }: { result: QAResponse }) {
  const [showCitations, setShowCitations] = useState(false);

  return (
    <div className="space-y-3">
      {/* Answer */}
      <div className="bg-evo-card border border-evo-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-evo-accent/10 flex items-center justify-center">
            <Bot size={14} className="text-evo-accent" />
          </div>
          <span className="text-sm font-medium">Evo's Answer</span>
        </div>
        <div className="markdown-content text-sm leading-relaxed">
          <ReactMarkdown>{result.answer}</ReactMarkdown>
        </div>
      </div>

      {/* Citations */}
      {result.citations.length > 0 && (
        <div className="bg-evo-card border border-evo-border rounded-xl overflow-hidden">
          <button
            onClick={() => setShowCitations(!showCitations)}
            className="w-full flex items-center justify-between px-5 py-3 text-sm text-evo-muted hover:text-evo-text transition-colors"
          >
            <span>
              {result.citations.length} citation{result.citations.length > 1 ? "s" : ""} from{" "}
              {result.collection_name}
            </span>
            {showCitations ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showCitations && (
            <div className="border-t border-evo-border divide-y divide-evo-border">
              {result.citations.map((cite, i) => (
                <div key={i} className="px-5 py-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-evo-accent">
                      [{cite.source}#{cite.chunk_index}]
                    </span>
                    <span className="text-xs text-evo-muted">
                      relevance: {(cite.score * 100).toFixed(1)}%
                    </span>
                  </div>
                  <p className="text-xs text-evo-muted leading-relaxed">{cite.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
