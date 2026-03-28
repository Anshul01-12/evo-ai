import { Router } from "express";
import { authenticate } from "../middleware/auth";
import {
  startInterview,
  evaluateAnswer,
  completeInterview,
  getSessions,
  getSession,
  deleteSession,
} from "../controllers/interviewController";

const router = Router();

router.use(authenticate);

router.post("/start", startInterview);
router.post("/evaluate", evaluateAnswer);
router.post("/complete", completeInterview);
router.get("/sessions", getSessions);
router.get("/sessions/:id", getSession);
router.delete("/sessions/:id", deleteSession);

export default router;
