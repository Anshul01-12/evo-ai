import mongoose, { Schema, Document } from "mongoose";

export interface IQuestionResult {
  question: string;
  userAnswer: string;
  score: number;
  feedback: string;
  technicalAccuracy: number;
  clarity: number;
  communication: number;
  timeSpent: number; // seconds
}

export interface IEmotionSnapshot {
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

export interface IInterviewSession extends Document {
  userId: mongoose.Types.ObjectId;
  language: string;
  topic: string;
  difficulty: "easy" | "medium" | "hard";
  questionCount: number;
  interviewType: "technical" | "hr" | "resume";
  resumeText?: string;
  questions: IQuestionResult[];
  emotionSnapshots: IEmotionSnapshot[];
  overallScore: number;
  behavioralAnalysis: {
    confidence: number;
    eyeContact: number;
    composure: number;
    hesitation: number;
  };
  finalReport?: string;
  status: "setup" | "active" | "completed";
  model: string; // eslint-disable-line -- same pattern as Conversation model
  createdAt: Date;
  updatedAt: Date;
}

const questionResultSchema = new Schema<IQuestionResult>(
  {
    question: { type: String, required: true },
    userAnswer: { type: String, default: "" },
    score: { type: Number, default: 0 },
    feedback: { type: String, default: "" },
    technicalAccuracy: { type: Number, default: 0 },
    clarity: { type: Number, default: 0 },
    communication: { type: Number, default: 0 },
    timeSpent: { type: Number, default: 0 },
  },
  { _id: true }
);

const emotionSnapshotSchema = new Schema<IEmotionSnapshot>(
  {
    timestamp: { type: Number, required: true },
    confidence: { type: Number, default: 0 },
    happy: { type: Number, default: 0 },
    neutral: { type: Number, default: 0 },
    sad: { type: Number, default: 0 },
    angry: { type: Number, default: 0 },
    surprised: { type: Number, default: 0 },
    fearful: { type: Number, default: 0 },
    disgusted: { type: Number, default: 0 },
  },
  { _id: false }
);

const interviewSessionSchema = new Schema<IInterviewSession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    language: { type: String, required: true },
    topic: { type: String, required: true },
    difficulty: { type: String, enum: ["easy", "medium", "hard"], required: true },
    questionCount: { type: Number, required: true, min: 1, max: 20 },
    interviewType: { type: String, enum: ["technical", "hr", "resume"], default: "technical" },
    resumeText: { type: String },
    questions: [questionResultSchema],
    emotionSnapshots: [emotionSnapshotSchema],
    overallScore: { type: Number, default: 0 },
    behavioralAnalysis: {
      confidence: { type: Number, default: 0 },
      eyeContact: { type: Number, default: 0 },
      composure: { type: Number, default: 0 },
      hesitation: { type: Number, default: 0 },
    },
    finalReport: { type: String },
    status: { type: String, enum: ["setup", "active", "completed"], default: "setup" },
    model: { type: String, default: "groq-llama3-70b" },
  },
  { timestamps: true }
);

interviewSessionSchema.index({ userId: 1, createdAt: -1 });

export const InterviewSession = mongoose.model<IInterviewSession>(
  "InterviewSession",
  interviewSessionSchema
);
