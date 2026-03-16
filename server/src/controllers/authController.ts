import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/User";
import { config } from "../config";

function signToken(userId: string): string {
  return jwt.sign({ userId }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { email, password, name } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      res.status(400).json({ error: "Email already registered" });
      return;
    }

    const user = await User.create({ email, password, name });
    const token = signToken(user._id as string);

    res.status(201).json({
      token,
      user: { id: user._id, email: user.email, name: user.name },
    });
  } catch (error) {
    res.status(500).json({ error: "Registration failed" });
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select("+password");
    if (!user || !(await user.comparePassword(password))) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const token = signToken(user._id as string);

    res.json({
      token,
      user: { id: user._id, email: user.email, name: user.name },
    });
  } catch (error) {
    res.status(500).json({ error: "Login failed" });
  }
}

export async function getMe(req: Request, res: Response): Promise<void> {
  try {
    const user = await User.findById((req as any).userId);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({ id: user._id, email: user.email, name: user.name, settings: user.settings });
  } catch (error) {
    res.status(500).json({ error: "Failed to get user" });
  }
}
