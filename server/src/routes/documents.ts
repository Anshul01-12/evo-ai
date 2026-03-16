import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { upload } from "../middleware/upload";
import { uploadDocument, getDocuments, deleteDocument, queryDocument } from "../controllers/documentController";

const router = Router();

router.use(authenticate);

router.post("/upload", upload.single("file"), uploadDocument);
router.post("/qa", queryDocument);
router.get("/", getDocuments);
router.delete("/:id", deleteDocument);

export default router;
