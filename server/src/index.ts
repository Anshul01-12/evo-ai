import express from "express";
import http from "http";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { Server as SocketIOServer } from "socket.io";

import { config } from "./config";
import { connectDB } from "./config/database";
import { connectRedis } from "./config/redis";
import routes from "./routes";
import { handleChatMessage } from "./services/chatSocketService";
import { registerPhoneMediaStream } from "./services/phoneService";

const app = express();
const server = http.createServer(app);

// Middleware
app.use(helmet());
app.use(cors({ origin: config.clientUrl, credentials: true }));
app.use(morgan("dev"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api", routes);

const io = new SocketIOServer(server, {
  cors: {
    origin: config.clientUrl,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

registerPhoneMediaStream(server);

io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.headers.authorization?.toString().replace("Bearer ", "");
  if (!token) {
    return next(new Error("Authentication token required in handshake"));
  }
  // Optionally decode JWT and attach userId to socket.data<br> // (reuse verify from auth middleware)
  try {
    const jwt = require("jsonwebtoken");
    const payload = jwt.verify(token, config.jwtSecret) as { userId: string };
    socket.data.userId = payload.userId;
    next();
  } catch (err) {
    next(new Error("Invalid token"));
  }
});

io.on("connection", (socket) => {
  console.log("[WS] connected", socket.id, socket.data.userId);

  socket.on("chat:message", async (payload: { message: string; sessionId?: string; model?: string }) => {
    const userId = socket.data.userId;
    if (!userId) {
      socket.emit("chat:error", { error: "User not authenticated" });
      return;
    }

    await handleChatMessage(socket, { ...payload, userId });
  });

  socket.on("disconnect", (reason) => {
    console.log("[WS] disconnected", socket.id, reason);
  });
});

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "healthy", service: "Evo Server" });
});

// Start
async function start() {
  await connectDB();
  await connectRedis();

  server.listen(config.port, () => {
    console.log(`\n  🚀 Evo Server running on http://localhost:${config.port}`);
    console.log(`  📚 API base: http://localhost:${config.port}/api\n`);
    console.log(`  🔌 WebSocket ready on ws://localhost:${config.port}`);
  });
}

start();
