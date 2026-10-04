import { backendHeaders, serverConfig } from "./config";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AgentResponse = {
  content: string;
  model?: string;
  usage?: Record<string, number>;
};

export async function callAgent(messages: ChatMessage[], systemPrompt?: string) {
  const effectiveMessages: ChatMessage[] = systemPrompt
    ? [{ role: "system", content: systemPrompt }, ...messages.filter((message) => message.role !== "system")]
    : messages;

  const payload = {
    model: serverConfig.agentModel,
    messages: effectiveMessages,
    temperature: 0.7,
    stream: false,
  };

  const response = await fetch(serverConfig.agentUrl(), {
    method: "POST",
    headers: backendHeaders(),
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || data?.error || `Agent backend returned ${response.status}`);
  }

  const content =
    typeof data?.content === "string"
      ? data.content
      : typeof data?.choices?.[0]?.message?.content === "string"
        ? data.choices[0].message.content
        : "";

  return {
    content,
    model: data?.model,
    usage: data?.usage,
  } satisfies AgentResponse;
}

export async function synthesizeSpeech(input: Record<string, unknown>) {
  const response = await fetch(serverConfig.ttsUrl(), {
    method: "POST",
    headers: backendHeaders(),
    body: JSON.stringify(input),
    cache: "no-store",
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.error || `TTS backend returned ${response.status}`);
  }

  return response;
}
