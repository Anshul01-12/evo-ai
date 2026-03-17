import multer from "multer";
import { config } from "../config";

const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: { fileSize: config.maxFileSizeMB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/pdf",
      "image/png",
      "image/jpeg",
      "image/webp",
      "audio/wav",
      "audio/webm",
      "audio/mpeg",
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`));
    }
  },
});
