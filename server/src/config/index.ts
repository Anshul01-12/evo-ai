import dotenv from "dotenv";
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || "5000"),
  nodeEnv: process.env.NODE_ENV || "development",
  mongoUri: process.env.MONGO_URI || "mongodb://localhost:27017/evo_platform",
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  aiServiceUrl: process.env.AI_SERVICE_URL || "http://localhost:8000",
  serverUrl: process.env.SERVER_URL || `http://localhost:${process.env.PORT || 5000}`,
  publicWsBaseUrl: process.env.PUBLIC_WS_BASE_URL || `ws://localhost:${process.env.PORT || 5000}`,
  uploadDir: process.env.UPLOAD_DIR || "./uploads",
  maxFileSizeMB: parseInt(process.env.MAX_FILE_SIZE_MB || "50"),
  clientUrl: process.env.CLIENT_URL || "http://localhost:3000",
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || "",
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || "",
  twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER || "",
  twilioWebhookSecret: process.env.TWILIO_WEBHOOK_SECRET || "",
  phoneAgentModel: process.env.PHONE_AGENT_MODEL || "llama3",
  phoneAgentSystemPrompt:
    process.env.PHONE_AGENT_SYSTEM_PROMPT ||
    "You are a calm, concise phone support agent. Keep answers brief and easy to hear over a call.",
  phoneSilenceThreshold: parseInt(process.env.PHONE_SILENCE_THRESHOLD || "350"),
  phoneMaxSilenceMs: parseInt(process.env.PHONE_MAX_SILENCE_MS || "1200"),
  phoneMinUtteranceMs: parseInt(process.env.PHONE_MIN_UTTERANCE_MS || "800"),
} as const;
