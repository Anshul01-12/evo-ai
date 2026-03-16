import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { upload } from "../middleware/upload";
import { processSpeech } from "../controllers/voiceController";

const router = Router();

router.use(authenticate);
router.post("/process", upload.single("file"), processSpeech);

export default router;
