import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic,
  MicOff,
  Camera,
  CameraOff,
  Play,
  ChevronRight,
  ChevronLeft,
  Clock,
  Brain,
  Target,
  BarChart3,
  CheckCircle2,
  Volume2,
  VolumeX,
  Loader2,
  RotateCcw,
  FileText,
  Users,
  Briefcase,
  Trophy,
  Eye,
  Smile,
  Frown,
  Zap,
  TrendingUp,
  BookOpen,
  X,
  History,
} from "lucide-react";
import { useChatStore } from "@/stores/chatStore";
import {
  startMockInterview,
  evaluateInterviewAnswer,
  completeInterviewSession,
  fetchInterviewSessions,
  fetchInterviewSession,
} from "@/services/api";
import ReactMarkdown from "react-markdown";

// ─── Types ────────────────────────────────────────
interface Question {
  index: number;
  question: string;
}

interface Evaluation {
  score: number;
  technicalAccuracy: number;
  clarity: number;
  communication: number;
  feedback: string;
}

interface QuestionResult {
  question: string;
  userAnswer: string;
  score: number;
  feedback: string;
  technicalAccuracy: number;
  clarity: number;
  communication: number;
  timeSpent: number;
}

interface EmotionSnapshot {
  timestamp: number;
  confidence: number;
  happy: number;
  neutral: number;
  sad: number;
  angry: number;
  surprised: number;
  fearful: number;
  disgusted: number;
}

interface SessionSummary {
  _id: string;
  language: string;
  topic: string;
  difficulty: string;
  questionCount: number;
  overallScore: number;
  status: string;
  interviewType: string;
  createdAt: string;
}

type Phase = "setup" | "interview" | "report";

// ─── Constants ────────────────────────────────────
const LANGUAGES = [
  "JavaScript",
  "Python",
  "Java",
  "C++",
  "TypeScript",
  "Go",
  "Rust",
  "C#",
  "Ruby",
  "PHP",
  "Swift",
  "Kotlin",
  "DSA",
  "DBMS",
  "Operating Systems",
  "Computer Networks",
  "System Design",
  "OOP",
];

const TOPICS: Record<string, string[]> = {
  JavaScript: ["Closures & Scope", "Promises & Async/Await", "Prototypes & Inheritance", "Event Loop", "ES6+ Features", "DOM Manipulation", "Design Patterns", "Memory Management"],
  Python: ["Data Structures", "Decorators & Generators", "OOP in Python", "Concurrency & Threading", "List Comprehensions", "Context Managers", "Type Hints", "Metaclasses"],
  Java: ["Collections Framework", "Multithreading", "JVM Internals", "Spring Framework", "Generics", "Design Patterns", "Memory Management", "Streams API"],
  "C++": ["Pointers & Memory", "STL Containers", "Templates", "RAII", "Move Semantics", "Virtual Functions", "Smart Pointers", "Concurrency"],
  TypeScript: ["Type System", "Generics", "Utility Types", "Decorators", "Module System", "Type Guards", "Mapped Types", "Declaration Files"],
  Go: ["Goroutines & Channels", "Interfaces", "Error Handling", "Concurrency Patterns", "Structs & Methods", "Testing", "Context Package", "Generics"],
  Rust: ["Ownership & Borrowing", "Lifetimes", "Traits", "Enums & Pattern Matching", "Error Handling", "Concurrency", "Smart Pointers", "Async/Await"],
  "C#": [".NET Framework", "LINQ", "Async/Await", "Generics", "Delegates & Events", "Dependency Injection", "Entity Framework", "Memory Management"],
  Ruby: ["Blocks & Procs", "Metaprogramming", "Rails MVC", "ActiveRecord", "Modules & Mixins", "Testing (RSpec)", "Concurrency", "Design Patterns"],
  PHP: ["OOP in PHP", "Laravel Framework", "Security", "Database Operations", "Composer", "Testing", "API Development", "Design Patterns"],
  Swift: ["Optionals", "Protocols", "Closures", "Memory Management (ARC)", "Concurrency", "SwiftUI", "Generics", "Error Handling"],
  Kotlin: ["Coroutines", "Null Safety", "Extension Functions", "Data Classes", "Sealed Classes", "Flow", "Android Architecture", "Testing"],
  DSA: ["Arrays & Strings", "Linked Lists", "Trees & Graphs", "Dynamic Programming", "Sorting & Searching", "Stacks & Queues", "Hashing", "Greedy Algorithms", "Backtracking", "Bit Manipulation"],
  DBMS: ["SQL Queries", "Normalization", "Transactions & ACID", "Indexing", "Joins", "Stored Procedures", "NoSQL vs SQL", "Database Design", "Concurrency Control"],
  "Operating Systems": ["Process Management", "Memory Management", "File Systems", "CPU Scheduling", "Deadlocks", "Virtual Memory", "Synchronization", "I/O Systems"],
  "Computer Networks": ["TCP/IP", "HTTP/HTTPS", "DNS", "OSI Model", "Routing", "Sockets", "Network Security", "REST APIs"],
  "System Design": ["Scalability", "Load Balancing", "Caching", "Database Sharding", "Microservices", "Message Queues", "API Design", "CDN", "Rate Limiting"],
  OOP: ["Encapsulation", "Inheritance", "Polymorphism", "Abstraction", "SOLID Principles", "Design Patterns", "Composition vs Inheritance", "Dependency Injection"],
};

const DEFAULT_TOPICS = ["Fundamentals", "Advanced Concepts", "Problem Solving", "Best Practices", "Real-world Applications"];

// ─── Emotion Detection Hook (uses face-api.js via CDN) ────
function useEmotionDetection(videoRef: React.RefObject<HTMLVideoElement | null>, enabled: boolean) {
  const [emotions, setEmotions] = useState<EmotionSnapshot | null>(null);
  const [faceApiLoaded, setFaceApiLoaded] = useState(false);
  const snapshotsRef = useRef<EmotionSnapshot[]>([]);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

    // Load face-api.js from CDN
    const loadFaceApi = async () => {
      if ((window as any).faceapi) {
        setFaceApiLoaded(true);
        return;
      }

      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js";
      script.async = true;
      script.onload = async () => {
        const faceapi = (window as any).faceapi;
        if (!faceapi) return;

        const MODEL_URL = "https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights";
        try {
          await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
          ]);
          setFaceApiLoaded(true);
        } catch (err) {
          console.warn("Face-api model loading failed:", err);
        }
      };
      document.head.appendChild(script);
    };

    loadFaceApi();
  }, [enabled]);

  useEffect(() => {
    if (!faceApiLoaded || !enabled || !videoRef.current) return;

    const faceapi = (window as any).faceapi;
    if (!faceapi) return;

    const detect = async () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) return;

      try {
        const detection = await faceapi
          .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 }))
          .withFaceExpressions();

        if (detection) {
          const expr = detection.expressions;
          const snapshot: EmotionSnapshot = {
            timestamp: Date.now(),
            confidence: detection.detection.score,
            happy: expr.happy || 0,
            neutral: expr.neutral || 0,
            sad: expr.sad || 0,
            angry: expr.angry || 0,
            surprised: expr.surprised || 0,
            fearful: expr.fearful || 0,
            disgusted: expr.disgusted || 0,
          };
          setEmotions(snapshot);
          snapshotsRef.current.push(snapshot);
        }
      } catch {
        // Silently continue
      }
    };

    intervalRef.current = window.setInterval(detect, 2000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [faceApiLoaded, enabled, videoRef]);

  const getSnapshots = useCallback(() => {
    const result = [...snapshotsRef.current];
    snapshotsRef.current = [];
    return result;
  }, []);

  return { emotions, faceApiLoaded, getSnapshots };
}

// ─── Speech Hook ──────────────────────────────────
function useSpeech() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef(window.speechSynthesis);

  const startListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    let finalTranscript = "";

    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + " ";
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setTranscript(finalTranscript + interim);
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
    setTranscript("");
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const speak = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      synthRef.current.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      utterance.pitch = 1;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => {
        setIsSpeaking(false);
        resolve();
      };
      utterance.onerror = () => {
        setIsSpeaking(false);
        resolve();
      };
      synthRef.current.speak(utterance);
    });
  }, []);

  const stopSpeaking = useCallback(() => {
    synthRef.current.cancel();
    setIsSpeaking(false);
  }, []);

  return { isListening, transcript, setTranscript, isSpeaking, startListening, stopListening, speak, stopSpeaking };
}

// ─── Main Component ──────────────────────────────
export function MockInterview() {
  const model = useChatStore((s) => s.model);

  // Phase
  const [phase, setPhase] = useState<Phase>("setup");

  // Setup state
  const [language, setLanguage] = useState("JavaScript");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [questionCount, setQuestionCount] = useState(5);
  const [interviewType, setInterviewType] = useState<"technical" | "hr" | "resume">("technical");
  const [resumeText, setResumeText] = useState("");
  const [starting, setStarting] = useState(false);

  // Interview state
  const [sessionId, setSessionId] = useState<string>("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [evaluations, setEvaluations] = useState<Record<number, Evaluation>>({});
  const [evaluating, setEvaluating] = useState(false);
  const [timer, setTimer] = useState(0);
  const [questionStartTime, setQuestionStartTime] = useState(0);
  const timerRef = useRef<number | null>(null);

  // Camera
  const [cameraOn, setCameraOn] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Report state
  const [report, setReport] = useState<{
    overallScore: number;
    questions: QuestionResult[];
    behavioralAnalysis: { confidence: number; eyeContact: number; composure: number; hesitation: number };
    finalReport: string;
  } | null>(null);
  const [completing, setCompleting] = useState(false);

  // History
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  // Text input fallback
  const [textInput, setTextInput] = useState("");
  const [useTextInput, setUseTextInput] = useState(false);

  // Speech & Emotion
  const { isListening, transcript, setTranscript, isSpeaking, startListening, stopListening, speak, stopSpeaking } = useSpeech();
  const { emotions, faceApiLoaded, getSnapshots } = useEmotionDetection(videoRef, cameraOn && phase === "interview");

  // Available topics based on language
  const availableTopics = TOPICS[language] || DEFAULT_TOPICS;

  // Reset topic when language changes
  useEffect(() => {
    setTopic(availableTopics[0]);
  }, [language]);

  // Timer
  useEffect(() => {
    if (phase === "interview") {
      timerRef.current = window.setInterval(() => setTimer((t) => t + 1), 1000);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [phase]);

  // Camera controls
  const toggleCamera = async () => {
    if (cameraOn) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setCameraOn(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 320, height: 240 } });
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setCameraOn(true);
      } catch {
        alert("Camera access denied");
      }
    }
  };

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Start interview
  const handleStart = async () => {
    setStarting(true);
    try {
      const data = await startMockInterview({
        language,
        topic,
        difficulty,
        questionCount,
        interviewType,
        resumeText: interviewType === "resume" ? resumeText : undefined,
        model,
      });
      setSessionId(data.sessionId);
      setQuestions(data.questions);
      setCurrentIndex(0);
      setAnswers({});
      setEvaluations({});
      setTimer(0);
      setQuestionStartTime(Date.now());
      setPhase("interview");

      // Speak first question
      if (ttsEnabled && data.questions.length > 0) {
        setTimeout(() => speak(data.questions[0].question), 500);
      }
    } catch (err: any) {
      alert(err.message || "Failed to start interview");
    } finally {
      setStarting(false);
    }
  };

  // Submit answer
  const handleSubmitAnswer = async () => {
    const answer = useTextInput ? textInput : transcript;
    if (!answer.trim() && !confirm("Submit empty answer?")) return;

    setEvaluating(true);
    const timeSpent = Math.round((Date.now() - questionStartTime) / 1000);
    const emotionData = getSnapshots();

    // Store answer
    setAnswers((prev) => ({ ...prev, [currentIndex]: answer }));

    try {
      const data = await evaluateInterviewAnswer({
        sessionId,
        questionIndex: currentIndex,
        userAnswer: answer,
        timeSpent,
        emotionSnapshots: emotionData,
      });
      setEvaluations((prev) => ({ ...prev, [currentIndex]: data.evaluation }));
    } catch {
      // Continue even if evaluation fails
    } finally {
      setEvaluating(false);
      setTranscript("");
      setTextInput("");
    }
  };

  // Next question
  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      setQuestionStartTime(Date.now());
      setTranscript("");
      setTextInput("");
      if (ttsEnabled) {
        stopSpeaking();
        setTimeout(() => speak(questions[nextIdx].question), 300);
      }
    }
  };

  // Previous question
  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  // Complete interview
  const handleComplete = async () => {
    setCompleting(true);
    stopSpeaking();
    stopListening();

    const emotionData = getSnapshots();

    try {
      const data = await completeInterviewSession({
        sessionId,
        emotionSnapshots: emotionData,
      });
      setReport(data);
      setPhase("report");
    } catch (err: any) {
      alert(err.message || "Failed to generate report");
    } finally {
      setCompleting(false);
    }

    // Stop camera
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  };

  // Restart
  const handleRestart = () => {
    setPhase("setup");
    setSessionId("");
    setQuestions([]);
    setCurrentIndex(0);
    setAnswers({});
    setEvaluations({});
    setTimer(0);
    setReport(null);
    setTranscript("");
    setTextInput("");
  };

  // Format time
  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  // Load past sessions
  const loadSessions = async () => {
    setLoadingSessions(true);
    try {
      const data = await fetchInterviewSessions();
      setSessions(data.sessions);
    } catch {
      // ignore
    } finally {
      setLoadingSessions(false);
    }
  };

  const loadPastSession = async (id: string) => {
    try {
      const data = await fetchInterviewSession(id);
      if (data.status === "completed" && data.finalReport) {
        setReport({
          overallScore: data.overallScore,
          questions: data.questions,
          behavioralAnalysis: data.behavioralAnalysis,
          finalReport: data.finalReport,
        });
        setPhase("report");
        setHistoryOpen(false);
      }
    } catch {
      // ignore
    }
  };

  // Difficulty badge color
  const diffColor = (d: string) =>
    d === "easy" ? "text-green-600 bg-green-50" : d === "medium" ? "text-amber-600 bg-amber-50" : "text-red-600 bg-red-50";

  // Score color
  const scoreColor = (s: number) =>
    s >= 8 ? "text-green-600" : s >= 5 ? "text-amber-600" : "text-red-500";

  // ─── SETUP PHASE ────────────────────────────────
  if (phase === "setup") {
    return (
      <main className="flex-1 flex flex-col min-w-0 bg-evo-bg">
        <header className="h-14 flex items-center justify-between px-5 shrink-0 border-b border-evo-border">
          <div className="flex items-center gap-2.5">
            <Brain size={20} className="text-evo-accent" />
            <h1 className="text-lg font-bold text-evo-text">Mock Interview</h1>
          </div>
          <button
            onClick={() => {
              setHistoryOpen(true);
              loadSessions();
            }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-evo-muted hover:bg-evo-card hover:text-evo-text transition-colors"
          >
            <History size={16} />
            Past Sessions
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto p-6 space-y-6">
            {/* Interview Type Selector */}
            <div>
              <label className="text-sm font-medium text-evo-text block mb-2">Interview Type</label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: "technical" as const, icon: Target, label: "Technical", desc: "DSA, Languages, CS" },
                  { id: "hr" as const, icon: Users, label: "HR Round", desc: "Behavioral, Soft Skills" },
                  { id: "resume" as const, icon: Briefcase, label: "Resume-Based", desc: "Based on your resume" },
                ].map(({ id, icon: Icon, label, desc }) => (
                  <button
                    key={id}
                    onClick={() => setInterviewType(id)}
                    className={`p-4 rounded-xl border-2 transition-all text-left ${
                      interviewType === id
                        ? "border-evo-accent bg-evo-accent/5"
                        : "border-evo-border hover:border-evo-accent/30"
                    }`}
                  >
                    <Icon size={20} className={interviewType === id ? "text-evo-accent" : "text-evo-muted"} />
                    <p className="font-medium text-sm mt-2 text-evo-text">{label}</p>
                    <p className="text-xs text-evo-muted mt-0.5">{desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Resume input for resume-based */}
            {interviewType === "resume" && (
              <div>
                <label className="text-sm font-medium text-evo-text block mb-2">
                  <FileText size={14} className="inline mr-1.5" />
                  Paste Your Resume
                </label>
                <textarea
                  value={resumeText}
                  onChange={(e) => setResumeText(e.target.value)}
                  placeholder="Paste your resume text here..."
                  rows={6}
                  className="w-full px-4 py-3 rounded-xl border border-evo-border bg-white text-sm text-evo-text placeholder:text-evo-muted focus:outline-none focus:border-evo-accent resize-none"
                />
              </div>
            )}

            {/* Language / Subject */}
            {interviewType !== "hr" && (
              <div>
                <label className="text-sm font-medium text-evo-text block mb-2">Subject / Language</label>
                <div className="flex flex-wrap gap-2">
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang}
                      onClick={() => setLanguage(lang)}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                        language === lang
                          ? "bg-evo-accent text-white font-medium"
                          : "bg-evo-card text-evo-muted hover:text-evo-text"
                      }`}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Topic */}
            {interviewType === "technical" && (
              <div>
                <label className="text-sm font-medium text-evo-text block mb-2">Topic</label>
                <div className="flex flex-wrap gap-2">
                  {availableTopics.map((t) => (
                    <button
                      key={t}
                      onClick={() => setTopic(t)}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                        topic === t
                          ? "bg-evo-accent text-white font-medium"
                          : "bg-evo-card text-evo-muted hover:text-evo-text"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Difficulty */}
            <div>
              <label className="text-sm font-medium text-evo-text block mb-2">Difficulty</label>
              <div className="grid grid-cols-3 gap-3">
                {(["easy", "medium", "hard"] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    className={`py-2.5 rounded-xl border-2 text-sm font-medium capitalize transition-all ${
                      difficulty === d
                        ? "border-evo-accent bg-evo-accent/5 text-evo-accent"
                        : "border-evo-border text-evo-muted hover:border-evo-accent/30"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* Question Count */}
            <div>
              <label className="text-sm font-medium text-evo-text block mb-2">
                Number of Questions: <span className="text-evo-accent">{questionCount}</span>
              </label>
              <input
                type="range"
                min={1}
                max={15}
                value={questionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
                className="w-full accent-evo-accent"
              />
              <div className="flex justify-between text-xs text-evo-muted mt-1">
                <span>1</span>
                <span>15</span>
              </div>
            </div>

            {/* Start Button */}
            <button
              onClick={handleStart}
              disabled={starting || (interviewType === "resume" && !resumeText.trim())}
              className="w-full py-3.5 rounded-xl bg-evo-accent text-white font-semibold text-sm hover:bg-evo-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {starting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Generating Questions...
                </>
              ) : (
                <>
                  <Play size={18} />
                  Start Interview
                </>
              )}
            </button>

            {/* Info card */}
            <div className="rounded-xl bg-evo-card/50 border border-evo-border p-4 space-y-2">
              <p className="text-xs font-medium text-evo-text flex items-center gap-1.5">
                <Zap size={13} className="text-evo-accent" />
                How it works
              </p>
              <ul className="text-xs text-evo-muted space-y-1 ml-5 list-disc">
                <li>AI generates realistic interview questions based on your selection</li>
                <li>Answer using voice (Web Speech API) or type your response</li>
                <li>Enable webcam for real-time emotion & confidence analysis (face-api.js - free)</li>
                <li>Each answer is evaluated for technical accuracy, clarity & communication</li>
                <li>Get a comprehensive report with scores, feedback & improvement tips</li>
              </ul>
            </div>
          </div>
        </div>

        {/* History Panel */}
        <AnimatePresence>
          {historyOpen && (
            <>
              <motion.div
                className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setHistoryOpen(false)}
              />
              <motion.div
                className="fixed right-0 top-0 bottom-0 w-96 bg-white z-50 shadow-2xl flex flex-col"
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              >
                <div className="flex items-center justify-between px-5 py-4 border-b border-evo-border">
                  <h2 className="text-lg font-bold text-evo-text">Past Interviews</h2>
                  <button onClick={() => setHistoryOpen(false)} className="p-2 rounded-xl hover:bg-evo-card text-evo-muted">
                    <X size={18} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {loadingSessions ? (
                    <div className="flex justify-center py-12">
                      <Loader2 size={24} className="animate-spin text-evo-muted" />
                    </div>
                  ) : sessions.length === 0 ? (
                    <p className="text-sm text-evo-muted text-center py-12">No past interviews</p>
                  ) : (
                    sessions.map((s) => (
                      <button
                        key={s._id}
                        onClick={() => loadPastSession(s._id)}
                        className="w-full text-left p-3 rounded-xl hover:bg-evo-card transition-colors border border-evo-border"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-evo-text">{s.language} — {s.topic}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${diffColor(s.difficulty)}`}>
                            {s.difficulty}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-evo-muted">
                          <span>{s.questionCount} questions</span>
                          <span className={scoreColor(s.overallScore)}>{s.overallScore}/10</span>
                          <span>{new Date(s.createdAt).toLocaleDateString()}</span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </main>
    );
  }

  // ─── INTERVIEW PHASE ───────────────────────────
  if (phase === "interview") {
    const currentQ = questions[currentIndex];
    const currentEval = evaluations[currentIndex];
    const answered = currentIndex in answers;
    const allAnswered = questions.every((_, i) => i in answers);
    const currentAnswer = useTextInput ? textInput : transcript;

    return (
      <main className="flex-1 flex flex-col min-w-0 bg-evo-bg">
        {/* Top bar */}
        <header className="h-14 flex items-center justify-between px-5 shrink-0 border-b border-evo-border">
          <div className="flex items-center gap-4">
            <Brain size={20} className="text-evo-accent" />
            <span className="text-sm font-medium text-evo-text">
              Q{currentIndex + 1} / {questions.length}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${diffColor(difficulty)}`}>
              {difficulty}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {/* Timer */}
            <div className="flex items-center gap-1.5 text-sm text-evo-muted">
              <Clock size={15} />
              {formatTime(timer)}
            </div>
            {/* Recording indicator */}
            {isListening && (
              <div className="flex items-center gap-1.5 text-red-500 text-xs font-medium">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                REC
              </div>
            )}
            {/* TTS toggle */}
            <button onClick={() => setTtsEnabled(!ttsEnabled)} className="p-1.5 rounded-lg hover:bg-evo-card text-evo-muted">
              {ttsEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          {/* Main content */}
          <div className="flex-1 flex flex-col overflow-y-auto p-5 space-y-4">
            {/* Question Card */}
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-5 rounded-xl bg-evo-card border border-evo-border"
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-evo-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-sm font-bold text-evo-accent">{currentIndex + 1}</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-evo-text leading-relaxed">{currentQ?.question}</p>
                  <div className="flex items-center gap-3 mt-2">
                    {isSpeaking && (
                      <span className="text-xs text-evo-accent flex items-center gap-1">
                        <Volume2 size={12} className="animate-pulse" /> Speaking...
                      </span>
                    )}
                    <button
                      onClick={() => speak(currentQ?.question || "")}
                      className="text-xs text-evo-muted hover:text-evo-accent transition-colors"
                    >
                      Replay question
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Answer Area */}
            <div className="space-y-3">
              {/* Input mode toggle */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setUseTextInput(false)}
                  className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                    !useTextInput ? "bg-evo-accent text-white" : "bg-evo-card text-evo-muted"
                  }`}
                >
                  <Mic size={12} className="inline mr-1" /> Voice
                </button>
                <button
                  onClick={() => setUseTextInput(true)}
                  className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                    useTextInput ? "bg-evo-accent text-white" : "bg-evo-card text-evo-muted"
                  }`}
                >
                  <FileText size={12} className="inline mr-1" /> Text
                </button>
              </div>

              {useTextInput ? (
                <textarea
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Type your answer here..."
                  rows={5}
                  className="w-full px-4 py-3 rounded-xl border border-evo-border bg-white text-sm text-evo-text placeholder:text-evo-muted focus:outline-none focus:border-evo-accent resize-none"
                />
              ) : (
                <div className="relative">
                  <div className="w-full min-h-[120px] px-4 py-3 rounded-xl border border-evo-border bg-white text-sm text-evo-text">
                    {transcript || (
                      <span className="text-evo-muted">
                        {isListening ? "Listening... speak now" : "Click the mic button to start recording"}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={isListening ? stopListening : startListening}
                      disabled={answered}
                      className={`p-3 rounded-full transition-all ${
                        isListening
                          ? "bg-red-500 text-white animate-pulse"
                          : "bg-evo-accent text-white hover:bg-evo-accent-hover"
                      } disabled:opacity-50`}
                    >
                      {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                    </button>
                    {isListening && (
                      <span className="text-xs text-red-500 font-medium">Recording...</span>
                    )}
                  </div>
                </div>
              )}

              {/* Submit / Navigation */}
              <div className="flex items-center gap-3">
                {!answered ? (
                  <button
                    onClick={handleSubmitAnswer}
                    disabled={evaluating || (!currentAnswer.trim() && !confirm)}
                    className="px-5 py-2.5 rounded-xl bg-evo-accent text-white text-sm font-medium hover:bg-evo-accent-hover transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {evaluating ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Evaluating...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={16} />
                        Submit Answer
                      </>
                    )}
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handlePrev}
                      disabled={currentIndex === 0}
                      className="p-2.5 rounded-xl bg-evo-card text-evo-muted hover:text-evo-text transition-colors disabled:opacity-30"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    {currentIndex < questions.length - 1 ? (
                      <button
                        onClick={handleNext}
                        className="px-5 py-2.5 rounded-xl bg-evo-accent text-white text-sm font-medium hover:bg-evo-accent-hover transition-colors flex items-center gap-2"
                      >
                        Next Question
                        <ChevronRight size={16} />
                      </button>
                    ) : (
                      <button
                        onClick={handleComplete}
                        disabled={completing}
                        className="px-5 py-2.5 rounded-xl bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                      >
                        {completing ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                            Generating Report...
                          </>
                        ) : (
                          <>
                            <Trophy size={16} />
                            Finish Interview
                          </>
                        )}
                      </button>
                    )}
                  </div>
                )}

                {/* Skip to finish if not all answered */}
                {!allAnswered && Object.keys(answers).length > 0 && currentIndex < questions.length - 1 && (
                  <button
                    onClick={handleComplete}
                    disabled={completing}
                    className="px-4 py-2 rounded-xl text-xs text-evo-muted hover:text-evo-text hover:bg-evo-card transition-colors"
                  >
                    End Early
                  </button>
                )}
              </div>
            </div>

            {/* Evaluation Feedback */}
            <AnimatePresence>
              {currentEval && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="p-4 rounded-xl border border-evo-border bg-white space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-evo-text">Evaluation</p>
                    <span className={`text-lg font-bold ${scoreColor(currentEval.score)}`}>
                      {currentEval.score}/10
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Technical", value: currentEval.technicalAccuracy, icon: Target },
                      { label: "Clarity", value: currentEval.clarity, icon: Eye },
                      { label: "Communication", value: currentEval.communication, icon: Users },
                    ].map(({ label, value, icon: Icon }) => (
                      <div key={label} className="text-center p-2 rounded-lg bg-evo-card/50">
                        <Icon size={14} className="mx-auto text-evo-muted mb-1" />
                        <p className={`text-sm font-bold ${scoreColor(value)}`}>{value}/10</p>
                        <p className="text-[10px] text-evo-muted">{label}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-evo-muted leading-relaxed">{currentEval.feedback}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Progress dots */}
            <div className="flex items-center gap-1.5 justify-center pt-2">
              {questions.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentIndex(i)}
                  className={`w-2.5 h-2.5 rounded-full transition-all ${
                    i === currentIndex
                      ? "bg-evo-accent scale-125"
                      : i in answers
                        ? evaluations[i]?.score >= 7
                          ? "bg-green-400"
                          : evaluations[i]?.score >= 4
                            ? "bg-amber-400"
                            : "bg-red-400"
                        : "bg-evo-border"
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Right panel: Camera + Emotions */}
          <div className="w-72 border-l border-evo-border p-4 flex flex-col gap-4 shrink-0 overflow-y-auto">
            {/* Camera */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-evo-text">Camera</p>
                <button
                  onClick={toggleCamera}
                  className={`p-1.5 rounded-lg transition-colors ${
                    cameraOn ? "bg-green-50 text-green-600" : "bg-evo-card text-evo-muted"
                  }`}
                >
                  {cameraOn ? <Camera size={14} /> : <CameraOff size={14} />}
                </button>
              </div>
              <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-evo-card">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${cameraOn ? "" : "hidden"}`}
                />
                {!cameraOn && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-evo-muted">
                    <CameraOff size={24} />
                    <p className="text-[10px] mt-1">Camera off</p>
                  </div>
                )}
                {cameraOn && !faceApiLoaded && (
                  <div className="absolute bottom-2 left-2 right-2 bg-black/60 rounded-lg px-2 py-1 text-[10px] text-white text-center">
                    Loading emotion detection...
                  </div>
                )}
              </div>
            </div>

            {/* Emotion Analysis */}
            {cameraOn && emotions && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-2"
              >
                <p className="text-xs font-medium text-evo-text flex items-center gap-1.5">
                  <Smile size={13} className="text-evo-accent" />
                  Live Emotions
                </p>
                <div className="space-y-1.5">
                  {[
                    { label: "Confident", value: emotions.confidence, icon: "💪" },
                    { label: "Happy", value: emotions.happy, icon: "😊" },
                    { label: "Neutral", value: emotions.neutral, icon: "😐" },
                    { label: "Surprised", value: emotions.surprised, icon: "😮" },
                    { label: "Fearful", value: emotions.fearful, icon: "😰" },
                    { label: "Sad", value: emotions.sad, icon: "😞" },
                  ].map(({ label, value, icon }) => (
                    <div key={label} className="flex items-center gap-2">
                      <span className="text-xs w-4">{icon}</span>
                      <span className="text-[10px] text-evo-muted w-16">{label}</span>
                      <div className="flex-1 h-1.5 bg-evo-card rounded-full overflow-hidden">
                        <div
                          className="h-full bg-evo-accent rounded-full transition-all duration-500"
                          style={{ width: `${Math.round(value * 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-evo-muted w-8 text-right">
                        {Math.round(value * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Quick stats */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-evo-text">Progress</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 rounded-lg bg-evo-card text-center">
                  <p className="text-lg font-bold text-evo-accent">{Object.keys(answers).length}</p>
                  <p className="text-[10px] text-evo-muted">Answered</p>
                </div>
                <div className="p-2.5 rounded-lg bg-evo-card text-center">
                  <p className="text-lg font-bold text-evo-text">{questions.length - Object.keys(answers).length}</p>
                  <p className="text-[10px] text-evo-muted">Remaining</p>
                </div>
              </div>
              {Object.keys(evaluations).length > 0 && (
                <div className="p-2.5 rounded-lg bg-evo-card text-center">
                  <p className={`text-lg font-bold ${scoreColor(
                    Object.values(evaluations).reduce((s, e) => s + e.score, 0) /
                    Object.values(evaluations).length
                  )}`}>
                    {(
                      Object.values(evaluations).reduce((s, e) => s + e.score, 0) /
                      Object.values(evaluations).length
                    ).toFixed(1)}
                    /10
                  </p>
                  <p className="text-[10px] text-evo-muted">Avg Score</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    );
  }

  // ─── REPORT PHASE ──────────────────────────────
  if (phase === "report" && report) {
    return (
      <main className="flex-1 flex flex-col min-w-0 bg-evo-bg">
        <header className="h-14 flex items-center justify-between px-5 shrink-0 border-b border-evo-border">
          <div className="flex items-center gap-2.5">
            <Trophy size={20} className="text-amber-500" />
            <h1 className="text-lg font-bold text-evo-text">Interview Report</h1>
          </div>
          <button
            onClick={handleRestart}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-evo-accent text-white text-sm font-medium hover:bg-evo-accent-hover transition-colors"
          >
            <RotateCcw size={15} />
            New Interview
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto p-6 space-y-6">
            {/* Score Hero */}
            <div className="text-center p-8 rounded-2xl bg-gradient-to-br from-evo-accent/5 to-evo-accent/10 border border-evo-accent/20">
              <p className="text-sm text-evo-muted mb-2">Overall Score</p>
              <p className={`text-6xl font-black ${scoreColor(report.overallScore)}`}>
                {report.overallScore}
                <span className="text-2xl text-evo-muted font-normal">/10</span>
              </p>
              <p className="text-sm text-evo-muted mt-3">
                {report.overallScore >= 8
                  ? "Excellent performance! You're interview-ready."
                  : report.overallScore >= 6
                    ? "Good performance with room for improvement."
                    : report.overallScore >= 4
                      ? "Average performance. Focus on weak areas."
                      : "Needs significant improvement. Keep practicing!"}
              </p>
            </div>

            {/* Behavioral Analysis */}
            <div className="p-5 rounded-xl border border-evo-border bg-white">
              <h3 className="text-sm font-semibold text-evo-text mb-4 flex items-center gap-2">
                <BarChart3 size={16} className="text-evo-accent" />
                Behavioral Analysis
              </h3>
              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: "Confidence", value: report.behavioralAnalysis.confidence, icon: Zap, color: "text-blue-600" },
                  { label: "Eye Contact", value: report.behavioralAnalysis.eyeContact, icon: Eye, color: "text-green-600" },
                  { label: "Composure", value: report.behavioralAnalysis.composure, icon: Smile, color: "text-purple-600" },
                  { label: "Hesitation", value: report.behavioralAnalysis.hesitation, icon: Frown, color: "text-red-500" },
                ].map(({ label, value, icon: Icon, color }) => (
                  <div key={label} className="text-center p-3 rounded-xl bg-evo-card/50">
                    <Icon size={18} className={`mx-auto mb-1.5 ${color}`} />
                    <p className={`text-xl font-bold ${color}`}>{value || "—"}</p>
                    <p className="text-[10px] text-evo-muted mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
              {!report.behavioralAnalysis.confidence && (
                <p className="text-xs text-evo-muted mt-3 text-center italic">
                  Enable webcam during interview for behavioral analysis
                </p>
              )}
            </div>

            {/* Question-by-Question Breakdown */}
            <div className="p-5 rounded-xl border border-evo-border bg-white">
              <h3 className="text-sm font-semibold text-evo-text mb-4 flex items-center gap-2">
                <BookOpen size={16} className="text-evo-accent" />
                Question Breakdown
              </h3>
              <div className="space-y-3">
                {report.questions.map((q, i) => (
                  <details key={i} className="group rounded-xl border border-evo-border overflow-hidden">
                    <summary className="flex items-center justify-between p-3 cursor-pointer hover:bg-evo-card/50 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`text-sm font-bold w-6 text-center ${scoreColor(q.score)}`}>{q.score}</span>
                        <span className="text-sm text-evo-text truncate">{q.question}</span>
                      </div>
                      <ChevronRight size={14} className="text-evo-muted group-open:rotate-90 transition-transform shrink-0" />
                    </summary>
                    <div className="px-4 pb-3 space-y-2 border-t border-evo-border pt-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-evo-muted font-medium">Your Answer</p>
                        <p className="text-xs text-evo-text mt-1">{q.userAnswer || "(Skipped)"}</p>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { label: "Technical", value: q.technicalAccuracy },
                          { label: "Clarity", value: q.clarity },
                          { label: "Communication", value: q.communication },
                        ].map(({ label, value }) => (
                          <div key={label} className="text-center p-1.5 rounded-lg bg-evo-card/50">
                            <p className={`text-sm font-bold ${scoreColor(value)}`}>{value}</p>
                            <p className="text-[9px] text-evo-muted">{label}</p>
                          </div>
                        ))}
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-evo-muted font-medium">Feedback</p>
                        <p className="text-xs text-evo-muted mt-1">{q.feedback}</p>
                      </div>
                      <p className="text-[10px] text-evo-muted">Time: {q.timeSpent}s</p>
                    </div>
                  </details>
                ))}
              </div>
            </div>

            {/* AI Report */}
            <div className="p-5 rounded-xl border border-evo-border bg-white">
              <h3 className="text-sm font-semibold text-evo-text mb-4 flex items-center gap-2">
                <TrendingUp size={16} className="text-evo-accent" />
                Detailed Report & Suggestions
              </h3>
              <div className="prose prose-sm max-w-none text-evo-text [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_p]:text-xs [&_li]:text-xs [&_ul]:space-y-0.5 [&_ol]:space-y-0.5">
                <ReactMarkdown>{report.finalReport}</ReactMarkdown>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return null;
}
