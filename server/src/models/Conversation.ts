import mongoose, { Schema, Document } from "mongoose";

export interface IMessage {
  role: "user" | "assistant" | "system";
  content: string;
  imageData?: string; // base64-encoded image stored in DB
  imageMime?: string; // e.g. "image/png"
  timestamp: Date;
}

export interface IConversation extends Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  model: string;
  messages: IMessage[];
  memorySummary?: string;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<IMessage>(
  {
    role: { type: String, enum: ["user", "assistant", "system"], required: true },
    content: { type: String, required: true },
    imageData: { type: String },
    imageMime: { type: String },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: true }
);

const conversationSchema = new Schema<IConversation>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, default: "New Chat" },
    model: { type: String, default: "llama3" },
    messages: [messageSchema],
    memorySummary: { type: String, default: "" },
    isArchived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

conversationSchema.index({ userId: 1, updatedAt: -1 });

export const Conversation = mongoose.model<IConversation>("Conversation", conversationSchema);
