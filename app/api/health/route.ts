import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const configured = {
    tts: Boolean(process.env.REACHMARK_TTS_URL),
    agent: Boolean(process.env.REACHMARK_AGENT_URL),
  };

  return NextResponse.json({
    ok: true,
    service: "reachmark-voice",
    timestamp: new Date().toISOString(),
    backends: configured,
  });
}
