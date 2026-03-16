import fs from "fs";
import path from "path";
import type { Request, Response } from "express";

import { config } from "../config";
import { buildIncomingCallTwiml, verifyTwilioRequest } from "../services/phoneService";

function getRequestUrl(req: Request) {
  return `${config.serverUrl}${req.originalUrl}`;
}

function isAuthorizedWebhook(req: Request) {
  const signature = req.header("x-twilio-signature");
  return verifyTwilioRequest(getRequestUrl(req), req.body as Record<string, unknown>, signature);
}

export function webhook(req: Request, res: Response): void {
  if (!isAuthorizedWebhook(req)) {
    res.status(403).send("Invalid Twilio signature");
    return;
  }

  const twiml = buildIncomingCallTwiml({
    userId: typeof req.body.userId === "string" ? req.body.userId : undefined,
    sessionId: typeof req.body.sessionId === "string" ? req.body.sessionId : undefined,
    model: typeof req.body.model === "string" ? req.body.model : undefined,
  });

  res.header("Content-Type", "text/xml");
  res.send(twiml);
}

export function statusCallback(req: Request, res: Response): void {
  if (!isAuthorizedWebhook(req)) {
    res.status(403).send("Invalid Twilio signature");
    return;
  }

  console.log("[Phone] status update", {
    callSid: req.body.CallSid,
    callStatus: req.body.CallStatus,
    from: req.body.From,
    to: req.body.To,
  });

  res.status(204).send();
}

export function audioFile(req: Request, res: Response): void {
  const { fileName } = req.params;
  const filePath = path.join(process.cwd(), "uploads", "phone", fileName);

  if (!fs.existsSync(filePath)) {
    res.status(404).send("Audio not found");
    return;
  }

  res.sendFile(filePath);
}
