import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";

export interface AuthRequest extends Request {
  userId?: string;
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  const token = req.headers.authorization?.replace("Bearer ", "");

  if (!token) {
    // Allow unauthenticated access — userId will be undefined
    next();
    return;
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as { userId: string };
    req.userId = decoded.userId;
    next();
  } catch {
    // Invalid token — still allow access but without userId
    next();
  }
}
