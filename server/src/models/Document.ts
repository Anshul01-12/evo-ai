import mongoose, { Schema, Document as MongoDoc } from "mongoose";

export interface IDocument extends MongoDoc {
  userId: mongoose.Types.ObjectId;
  filename: string;
  originalName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  collectionName: string;
  chunkCount: number;
  status: "processing" | "ready" | "error";
  createdAt: Date;
}

const documentSchema = new Schema<IDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    filename: { type: String, required: true },
    originalName: { type: String, required: true },
    filePath: { type: String, required: true },
    fileSize: { type: Number, required: true },
    mimeType: { type: String, required: true },
    collectionName: { type: String, default: "default" },
    chunkCount: { type: Number, default: 0 },
    status: { type: String, enum: ["processing", "ready", "error"], default: "processing" },
  },
  { timestamps: true }
);

export const DocumentModel = mongoose.model<IDocument>("Document", documentSchema);
