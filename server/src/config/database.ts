import mongoose from "mongoose";
import { config } from "./index";

export async function connectDB(): Promise<void> {
  try {
    await mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log("[DB] MongoDB connected");
  } catch (error: any) {
    console.error("[DB] MongoDB connection failed:", error.message);
    console.error("[DB] Server will continue — DB operations will fail until connected");

    // Retry in background
    setTimeout(async () => {
      try {
        await mongoose.connect(config.mongoUri);
        console.log("[DB] MongoDB reconnected successfully");
      } catch {
        console.error("[DB] MongoDB retry also failed");
      }
    }, 5000);
  }
}
