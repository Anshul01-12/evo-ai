import fs from "fs";
import path from "path";
import crypto from "crypto";
import { WebSocket, WebSocketServer } from "ws";
import twilio from "twilio";

import { config } from "../config";
import { sendChatMessage } from "./chatService";
import { synthesizeSpeech, transcribeAudio } from "./aiService";

const PHONE_AUDIO_DIR = path.join(process.cwd(), "uploads", "phone");
const SAMPLE_RATE = 8000;
const FRAME_DURATION_MS = 20;
const SAMPLES_PER_FRAME = (SAMPLE_RATE / 1000) * FRAME_DURATION_MS;
const BYTES_PER_SAMPLE = 2;
const FRAME_SAMPLES = SAMPLES_PER_FRAME;

fs.mkdirSync(PHONE_AUDIO_DIR, { recursive: true });

type TwilioStartPayload = {
  accountSid?: string;
  callSid?: string;
  streamSid?: string;
  tracks?: string[];
  customParameters?: Record<string, string>;
};

type StreamSession = {
  ws: WebSocket;
  streamSid?: string;
  callSid?: string;
  from?: string;
  to?: string;
  userId: string;
  sessionId?: string;
  model: string;
  systemPrompt?: string;
  inboundPcmChunks: Buffer[];
  speechFrames: number;
  silenceFrames: number;
  isSpeaking: boolean;
  processingTurn: boolean;
};

const sessions = new Map<string, StreamSession>();

function makeSessionKey(callSid?: string, streamSid?: string) {
  return callSid || streamSid || crypto.randomUUID();
}

function parseWavPcm16Mono(input: Buffer): Buffer {
  if (input.length < 44 || input.toString("ascii", 0, 4) !== "RIFF") {
    return input;
  }

  const fmtOffset = input.indexOf(Buffer.from("fmt "));
  const dataOffset = input.indexOf(Buffer.from("data"));
  if (fmtOffset === -1 || dataOffset === -1) {
    return input;
  }

  const audioFormat = input.readUInt16LE(fmtOffset + 8);
  const channelCount = input.readUInt16LE(fmtOffset + 10);
  const bitsPerSample = input.readUInt16LE(fmtOffset + 22);
  const dataSize = input.readUInt32LE(dataOffset + 4);
  const pcm = input.subarray(dataOffset + 8, dataOffset + 8 + dataSize);

  if (audioFormat !== 1 || channelCount !== 1 || bitsPerSample !== 16) {
    throw new Error("Only PCM16 mono WAV output is supported for Twilio playback");
  }

  return pcm;
}

function encodeWavFromPcm16(pcmData: Buffer): Buffer {
  const header = Buffer.alloc(44);
  const byteRate = SAMPLE_RATE * BYTES_PER_SAMPLE;
  const blockAlign = BYTES_PER_SAMPLE;

  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + pcmData.length, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(pcmData.length, 40);

  return Buffer.concat([header, pcmData]);
}

function muLawDecodeSample(muLawValue: number): number {
  const MULAW_BIAS = 0x84;
  muLawValue = ~muLawValue & 0xff;
  const sign = muLawValue & 0x80;
  const exponent = (muLawValue >> 4) & 0x07;
  const mantissa = muLawValue & 0x0f;
  let sample = ((mantissa << 3) + MULAW_BIAS) << exponent;
  sample -= MULAW_BIAS;
  return sign ? -sample : sample;
}

function linearToMuLawSample(sample: number): number {
  const MULAW_MAX = 0x1fff;
  const MULAW_BIAS = 33;
  let pcm = Math.max(-32768, Math.min(32767, sample));
  let mask = 0xff;

  if (pcm < 0) {
    pcm = -pcm;
    mask = 0x7f;
  }

  pcm = Math.min(MULAW_MAX, pcm + MULAW_BIAS);

  let exponent = 7;
  for (let expMask = 0x4000; (pcm & expMask) === 0 && exponent > 0; exponent -= 1) {
    expMask >>= 1;
  }

  const mantissa = (pcm >> (exponent + 3)) & 0x0f;
  return ~(mask & ((exponent << 4) | mantissa)) & 0xff;
}

function decodeMulawBase64ToPcm(base64Payload: string): Buffer {
  const ulaw = Buffer.from(base64Payload, "base64");
  const pcm = Buffer.alloc(ulaw.length * 2);
  for (let i = 0; i < ulaw.length; i += 1) {
    pcm.writeInt16LE(muLawDecodeSample(ulaw[i]), i * 2);
  }
  return pcm;
}

function encodePcmToMulaw(pcm: Buffer): Buffer {
  const ulaw = Buffer.alloc(Math.floor(pcm.length / 2));
  for (let offset = 0; offset < pcm.length; offset += 2) {
    ulaw[offset / 2] = linearToMuLawSample(pcm.readInt16LE(offset));
  }
  return ulaw;
}

function averageAmplitude(pcm: Buffer): number {
  const sampleCount = Math.floor(pcm.length / 2);
  if (!sampleCount) {
    return 0;
  }

  let total = 0;
  for (let offset = 0; offset < pcm.length; offset += 2) {
    total += Math.abs(pcm.readInt16LE(offset));
  }

  return total / sampleCount;
}

function buildTurnWav(session: StreamSession): Buffer {
  const pcm = Buffer.concat(session.inboundPcmChunks);
  return encodeWavFromPcm16(pcm);
}

function getAudioFilePath(prefix: string) {
  return path.join(PHONE_AUDIO_DIR, `${prefix}-${Date.now()}.wav`);
}

async function streamTtsToCall(session: StreamSession, text: string) {
  const ttsResult = await synthesizeSpeech(text, "alloy");
  const pcm16 = parseWavPcm16Mono(Buffer.from(ttsResult.audio_base64, "base64"));
  const ulaw = encodePcmToMulaw(pcm16);

  for (let offset = 0; offset < ulaw.length; offset += FRAME_SAMPLES) {
    const frame = ulaw.subarray(offset, offset + FRAME_SAMPLES);
    session.ws.send(
      JSON.stringify({
        event: "media",
        streamSid: session.streamSid,
        media: { payload: frame.toString("base64") },
      })
    );
  }

  session.ws.send(
    JSON.stringify({
      event: "mark",
      streamSid: session.streamSid,
      mark: { name: `assistant-response-${Date.now()}` },
    })
  );
}

async function processSpeechTurn(session: StreamSession) {
  if (session.processingTurn || session.inboundPcmChunks.length === 0) {
    return;
  }

  session.processingTurn = true;

  try {
    const turnWav = buildTurnWav(session);
    const utterancePath = getAudioFilePath(session.callSid || "call");
    fs.writeFileSync(utterancePath, turnWav);

    const transcriptionResult = (await transcribeAudio(utterancePath)) as { text?: string };
    const text = transcriptionResult.text?.trim();

    session.inboundPcmChunks = [];
    session.speechFrames = 0;
    session.silenceFrames = 0;
    session.isSpeaking = false;

    if (!text) {
      return;
    }

    const userId = session.userId || "000000000000000000000000";
    const enrichedMessage = session.systemPrompt
      ? `${text}\n\n[Phone agent guidance: ${session.systemPrompt}]`
      : text;

    const reply = await sendChatMessage({
      userId,
      message: enrichedMessage,
      sessionId: session.sessionId,
      model: session.model,
    });

    session.sessionId = String(reply.sessionId);
    await streamTtsToCall(session, reply.assistantText);
  } catch (error) {
    console.error("[Phone] turn processing failed", error);
    await streamTtsToCall(
      session,
      "Sorry, I had trouble processing that. Please try saying it one more time."
    );
  } finally {
    session.processingTurn = false;
  }
}

function resetTurnState(session: StreamSession) {
  session.inboundPcmChunks = [];
  session.speechFrames = 0;
  session.silenceFrames = 0;
  session.isSpeaking = false;
}

function handleMediaFrame(session: StreamSession, payload: string) {
  const pcmChunk = decodeMulawBase64ToPcm(payload);
  const amplitude = averageAmplitude(pcmChunk);
  const isSpeechFrame = amplitude >= config.phoneSilenceThreshold;

  if (isSpeechFrame) {
    session.isSpeaking = true;
    session.silenceFrames = 0;
    session.speechFrames += 1;
    session.inboundPcmChunks.push(pcmChunk);
    return;
  }

  if (!session.isSpeaking) {
    return;
  }

  session.silenceFrames += 1;
  session.inboundPcmChunks.push(pcmChunk);

  const silenceMs = session.silenceFrames * FRAME_DURATION_MS;
  const utteranceMs = session.speechFrames * FRAME_DURATION_MS;
  if (silenceMs >= config.phoneMaxSilenceMs && utteranceMs >= config.phoneMinUtteranceMs) {
    void processSpeechTurn(session);
  }
}

function validateTwilioSignature(requestUrl: string, params: Record<string, unknown>, signature?: string) {
  if (!config.twilioWebhookSecret || !signature) {
    return true;
  }

  return twilio.validateRequest(config.twilioWebhookSecret, signature, requestUrl, params);
}

export function buildIncomingCallTwiml(params?: {
  userId?: string;
  sessionId?: string;
  model?: string;
}) {
  const streamUrl = new URL(`${config.publicWsBaseUrl.replace(/^http/i, "ws")}/api/call/media-stream`);
  if (params?.userId) {
    streamUrl.searchParams.set("userId", params.userId);
  }
  if (params?.sessionId) {
    streamUrl.searchParams.set("sessionId", params.sessionId);
  }
  if (params?.model) {
    streamUrl.searchParams.set("model", params.model);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Hello. You are connected to the Evo AI phone agent. Please speak after the beep.</Say>
  <Pause length="1"/>
  <Connect>
    <Stream url="${streamUrl.toString()}" track="inbound_track">
      <Parameter name="userId" value="${params?.userId || ""}" />
      <Parameter name="sessionId" value="${params?.sessionId || ""}" />
      <Parameter name="model" value="${params?.model || config.phoneAgentModel}" />
    </Stream>
  </Connect>
</Response>`;
}

export function verifyTwilioRequest(requestUrl: string, params: Record<string, unknown>, signature?: string) {
  return validateTwilioSignature(requestUrl, params, signature);
}

export function registerPhoneMediaStream(server: import("http").Server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    const requestUrl = new URL(request.url || "", `http://${request.headers.host}`);
    if (requestUrl.pathname !== "/api/call/media-stream") {
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  });

  wss.on("connection", (ws, request) => {
    const requestUrl = new URL(request.url || "", `http://${request.headers.host}`);
    const fallbackKey = makeSessionKey();

    const session: StreamSession = {
      ws,
      userId: requestUrl.searchParams.get("userId") || "000000000000000000000000",
      sessionId: requestUrl.searchParams.get("sessionId") || undefined,
      model: requestUrl.searchParams.get("model") || config.phoneAgentModel,
      systemPrompt: config.phoneAgentSystemPrompt,
      inboundPcmChunks: [],
      speechFrames: 0,
      silenceFrames: 0,
      isSpeaking: false,
      processingTurn: false,
    };

    sessions.set(fallbackKey, session);

    ws.on("message", (raw) => {
      try {
        const message = JSON.parse(raw.toString()) as {
          event: string;
          start?: TwilioStartPayload;
          media?: { payload?: string };
          streamSid?: string;
        };

        if (message.event === "start") {
          const customParameters = message.start?.customParameters || {};
          session.streamSid = message.start?.streamSid || message.streamSid;
          session.callSid = message.start?.callSid;
          session.userId = customParameters.userId || session.userId;
          session.sessionId = customParameters.sessionId || session.sessionId;
          session.model = customParameters.model || session.model;

          sessions.delete(fallbackKey);
          sessions.set(makeSessionKey(session.callSid, session.streamSid), session);
          return;
        }

        if (message.event === "media" && message.media?.payload) {
          handleMediaFrame(session, message.media.payload);
          return;
        }

        if (message.event === "stop") {
          if (session.inboundPcmChunks.length > 0) {
            void processSpeechTurn(session);
          }
          resetTurnState(session);
        }
      } catch (error) {
        console.error("[Phone] media stream message error", error);
      }
    });

    ws.on("close", () => {
      resetTurnState(session);
      for (const [key, value] of sessions.entries()) {
        if (value === session) {
          sessions.delete(key);
        }
      }
    });
  });
}
