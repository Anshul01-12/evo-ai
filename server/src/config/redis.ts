import { createClient } from "redis";
import { config } from "./index";

export const redisClient = createClient({ url: config.redisUrl });

redisClient.on("error", (err) => console.error("[Redis] Error:", err.message));

export async function connectRedis(): Promise<void> {
  try {
    await redisClient.connect();
    console.log("[Redis] Connected");
  } catch (error: any) {
    console.error("[Redis] Connection failed:", error.message);
    console.error("[Redis] Memory features will be unavailable until Redis is running");
  }
}
