import { Router } from "express";
import authRoutes from "./auth";
import chatRoutes from "./chat";
import documentRoutes from "./documents";
import voiceRoutes from "./voice";
import phoneRoutes from "./phone";
import visionRoutes from "./vision";
import agentRoutes from "./agent";
import interviewRoutes from "./interview";

const router = Router();

router.use("/auth", authRoutes);
router.use("/chat", chatRoutes);
router.use("/documents", documentRoutes);
router.use("/voice", voiceRoutes);
router.use("/call", phoneRoutes);
router.use("/vision", visionRoutes);
router.use("/agent", agentRoutes);
router.use("/interview", interviewRoutes);

export default router;
