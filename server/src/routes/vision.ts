import { Router } from "express";
import { analyzeImageController, generateImageController } from "../controllers/visionController";
import { authenticate } from "../middleware/auth";

const router = Router();

router.post("/analyze", authenticate, analyzeImageController);
router.post("/generate", authenticate, generateImageController);

export default router;
