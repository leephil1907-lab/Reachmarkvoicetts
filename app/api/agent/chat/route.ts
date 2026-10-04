import { NextRequest, NextResponse } from "next/server";
import { callAgent, type ChatMessage } from "@/lib/server/backend";

export const runtime = "nodejs";

function normalizeMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (item): item is { role: ChatMessage["role"]; content: string } =>
        Boolean(item) &&
        typeof item === "object" &&
        ["system", "user", "assistant"].includes(
          (item as { role?: string }).role || "",
        ) &&
        typeof (item as { content?: unknown }).content === "string",
    )
    .map(({ role, content }) => ({ role, content: content.slice(0, 20000) }))
    .slice(-50);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const messages = normalizeMessages(body?.messages);

    if (!messages.length) {
      return NextResponse.json({ error: "At least one message is required." }, { status: 400 });
    }

    const result = await callAgent(messages, typeof body?.system_prompt === "string" ? body.system_prompt : undefined);
    return NextResponse.json({
      content: typeof result.content === "string" ? result.content : "",
      model: result.model,
      usage: result.usage,
    });
  } catch (error) {
    console.error("Reachmark agent proxy error", error);
    const message = error instanceof Error ? error.message : "Agent backend unavailable.";
    const status = message.includes("not configured") ? 503 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
