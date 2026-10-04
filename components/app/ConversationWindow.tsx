"use client";

import { FormEvent, useState } from "react";
import { motion } from "framer-motion";
import { Mic, Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { MessageBubble } from "./MessageBubble";

type Role = "user" | "assistant" | "system";
type Message = { id: string; role: Role; content: string };

export function ConversationWindow() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "init",
      role: "assistant",
      content: "Hi — I’m Reachmark Voice. What would you like to build today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function send(event?: FormEvent) {
    event?.preventDefault();
    if (!input.trim() || loading) return;

    const userText = input.trim();
    setInput("");
    setLoading(true);

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: userText,
    };
    const history = [...messages, userMessage];

    setMessages(history);

    try {
      const response = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map(({ role, content }) => ({ role, content })),
          system_prompt:
            "You are Reachmark Receptionist. Be helpful, concise, friendly, and action-oriented.",
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || `Agent error: ${response.status}`);
      }

      const content =
        typeof data.content === "string" ? data.content.trim() : "";

      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: content || "The agent returned an empty response.",
        },
      ]);
    } catch (error) {
      console.error("Reachmark agent request failed", error);
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content:
            "I couldn’t reach the Reachmark agent right now. Check the backend connection and try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-3xl border border-border bg-surface p-4 sm:p-6">
      <div className="mb-5">
        <h2 className="font-semibold">Conversation</h2>
        <p className="mt-1 text-sm text-muted">
          Connected to the Reachmark agent API.
        </p>
      </div>

      <div
        className="min-h-56 space-y-3 overflow-y-auto rounded-2xl bg-bg p-4"
        aria-live="polite"
      >
        {messages.map((message, index) => (
          <motion.div
            key={message.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(index * 0.03, 0.18), duration: 0.2 }}
          >
            <MessageBubble
              role={message.role}
              text={message.content}
            />
          </motion.div>
        ))}

        {loading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <MessageBubble role="assistant" text="Thinking…" />
          </motion.div>
        )}
      </div>

      <form
        onSubmit={send}
        className="mt-4 flex items-center gap-2 rounded-2xl border border-border bg-bg p-2"
      >
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Type a message…"
          disabled={loading}
          className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted disabled:opacity-60"
          aria-label="Message"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Voice input"
          title="Voice input — coming next"
          disabled
        >
          <Mic size={18} />
        </Button>
        <Button type="submit" size="icon" aria-label="Send" disabled={loading}>
          <Send size={17} />
        </Button>
      </form>
    </section>
  );
}
