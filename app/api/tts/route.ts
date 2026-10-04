import { NextRequest } from "next/server";
import { synthesizeSpeech } from "@/lib/server/backend";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (typeof body?.text !== "string" || !body.text.trim()) {
      return new Response(JSON.stringify({ error: "Text is required." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const upstream = await synthesizeSpeech({
      ...body,
      text: body.text.trim().slice(0, 10000),
      model_id: body.model_id || "xtts-v2",
    });

    const headers = new Headers();
    headers.set("Content-Type", upstream.headers.get("content-type") || "audio/wav");
    const length = upstream.headers.get("content-length");
    if (length) headers.set("Content-Length", length);
    const disposition = upstream.headers.get("content-disposition");
    if (disposition) headers.set("Content-Disposition", disposition);
    headers.set("Cache-Control", "no-store");

    return new Response(upstream.body, { status: 200, headers });
  } catch (error) {
    console.error("Reachmark TTS proxy error", error);
    const message = error instanceof Error ? error.message : "TTS backend unavailable.";
    return new Response(JSON.stringify({ error: message }), {
      status: message.includes("not configured") ? 503 : 502,
      headers: { "Content-Type": "application/json" },
    });
  }
}
