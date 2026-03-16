import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { runAgentController } from "../controllers/agentController";

const router = Router();

router.use(authenticate);
router.post("/run", runAgentController);

export default router;
