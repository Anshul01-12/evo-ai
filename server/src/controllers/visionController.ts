import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { analyzeImage, generateImage } from "../services/aiService";

export async function analyzeImageController(req: AuthRequest, res: Response) {
  try {
    const body = req.body as any;
    const prompt = (body.prompt as string) || "Describe this image.";
    const model = (body.model as string) || "llava";
    const imageBase64 = body.imageBase64 as string;

    if (!imageBase64) {
      return res.status(400).json({ message: "imageBase64 is required" });
    }

    const result = await analyzeImage({ imageBase64, prompt, model });
    res.json(result);
  } catch (error) {
    console.error("[Vision] analyze failed", error);
    res.status(500).json({ error: "Image analysis failed" });
  }
}

export async function generateImageController(req: AuthRequest, res: Response) {
  try {
    const body = req.body as any;
    const { prompt, width = 512, height = 512, steps = 30, guidanceScale = 7.5 } = body;

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ message: "prompt is required" });
    }

    const result = await generateImage({ prompt, width, height, steps, guidanceScale });
    res.json(result);
  } catch (error) {
    console.error("[Vision] generate failed", error);
    res.status(500).json({ error: "Image generation failed" });
  }
}
