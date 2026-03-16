import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { upload } from "../middleware/upload";
import {
  chat,
  history,
  uploadFile,
  analyzeUploadedImage,
  generateChatImage,
  getConversation,
  deleteConversation,
} from "../controllers/chatController";

const router = Router();

// All chat routes require authentication
router.use(authenticate);

// Core endpoints
router.post("/", chat);                                    // POST /api/chat
router.get("/history", history);                           // GET  /api/chat/history
router.post("/upload", upload.single("file"), uploadFile); // POST /api/chat/upload
router.post("/analyze-image", upload.single("file"), analyzeUploadedImage);
router.post("/generate-image", generateChatImage);

// Conversation management
router.get("/conversations/:id", getConversation);         // GET    /api/chat/conversations/:id
router.delete("/conversations/:id", deleteConversation);   // DELETE /api/chat/conversations/:id

export default router;
