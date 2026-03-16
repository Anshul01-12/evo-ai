import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { Request, Response } from "express";
import twilio from "twilio";

import { config } from "../config";
import { buildIncomingCallTwiml, verifyTwilioRequest } from "../services/phoneService";

// In-memory call logs (would be DB in production)
const callLogs: Array<{
  id: string;
  callSid: string;
  direction: "inbound" | "outbound";
  from: string;
  to: string;
  status: string;
  startedAt: string;
  duration?: number;
}> = [];

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
  // Log status update
  const callSid = req.body.CallSid as string;
  const status = req.body.CallStatus as string;
  console.log("[Phone] status update", { callSid, callStatus: status, from: req.body.From, to: req.body.To });

  // Update call log
  const log = callLogs.find((l) => l.callSid === callSid);
  if (log) {
    log.status = status;
    if (req.body.CallDuration) log.duration = parseInt(req.body.CallDuration);
  }

  res.status(204).send();
}

export async function makeCall(req: Request, res: Response): Promise<void> {
  try {
    const { to, model } = req.body;
    if (!to) {
      res.status(400).json({ error: "Phone number (to) is required" });
      return;
    }

    // Ensure E.164 format
    let phoneNum = to.replace(/[\s\-()]/g, "");
    if (!phoneNum.startsWith("+")) {
      phoneNum = `+${phoneNum}`;
    }

    const client = twilio(config.twilioAccountSid, config.twilioAuthToken);

    // Use TwiML directly instead of URL to avoid query param issues
    const twiml = buildIncomingCallTwiml({ model: model || config.phoneAgentModel });

    const call = await client.calls.create({
      to: phoneNum,
      from: config.twilioPhoneNumber,
      twiml,
      statusCallback: `${config.serverUrl}/api/call/status`,
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
    });

    callLogs.push({
      id: crypto.randomUUID(),
      callSid: call.sid,
      direction: "outbound",
      from: config.twilioPhoneNumber,
      to: phoneNum,
      status: call.status || "initiated",
      startedAt: new Date().toISOString(),
    });

    res.json({ callSid: call.sid, status: call.status, from: config.twilioPhoneNumber, to });
  } catch (error: any) {
    console.error("[Phone] Make call failed:", error.message);
    res.status(500).json({ error: error.message || "Failed to make call" });
  }
}

export async function endCall(req: Request, res: Response): Promise<void> {
  try {
    const { callSid } = req.params;
    const client = twilio(config.twilioAccountSid, config.twilioAuthToken);
    await client.calls(callSid).update({ status: "completed" });

    const log = callLogs.find((l) => l.callSid === callSid);
    if (log) log.status = "completed";

    res.json({ callSid, status: "completed" });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to end call" });
  }
}

export function getCallLogs(_req: Request, res: Response): void {
  res.json(callLogs.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()));
}

export function getPhoneConfig(_req: Request, res: Response): void {
  res.json({
    phoneNumber: config.twilioPhoneNumber,
    configured: !!(config.twilioAccountSid && config.twilioAuthToken && config.twilioPhoneNumber),
    model: config.phoneAgentModel,
    systemPrompt: config.phoneAgentSystemPrompt,
  });
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
