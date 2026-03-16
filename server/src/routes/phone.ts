import { Router } from "express";
import { webhook, statusCallback, audioFile } from "../controllers/phoneController";

const router = Router();

// Twilio voice webhook and status callbacks
router.post("/webhook", webhook);
router.post("/status", statusCallback);
router.get("/audio/:fileName", audioFile);

export default router;
