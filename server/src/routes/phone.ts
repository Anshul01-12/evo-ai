import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { webhook, statusCallback, audioFile, makeCall, endCall, getCallLogs, getPhoneConfig } from "../controllers/phoneController";

const router = Router();

// Twilio webhooks (no auth — Twilio calls these directly)
router.post("/webhook", webhook);
router.post("/status", statusCallback);
router.get("/audio/:fileName", audioFile);

// Client-facing endpoints (authenticated)
router.post("/make", authenticate, makeCall);
router.post("/end/:callSid", authenticate, endCall);
router.get("/logs", authenticate, getCallLogs);
router.get("/config", authenticate, getPhoneConfig);

export default router;
