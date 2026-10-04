"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

export function VoiceTester() {
  const [text, setText] = useState("Welcome to Reachmark Voice.");
  const [voiceId, setVoiceId] = useState("default");
  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  async function generate() {
    if (!text.trim() || loading) return;

    setLoading(true);
    setError(null);

    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }

    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim(),
          voice_id: voiceId.trim() || "default",
          model_id: "xtts-v2",
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          data?.error || `TTS generation failed (${response.status})`,
        );
      }

      const blob = await response.blob();
      setAudioUrl(URL.createObjectURL(blob));
    } catch (requestError) {
      console.error("Reachmark TTS request failed", requestError);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "TTS generation failed.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-3xl border border-border bg-surface p-4 sm:p-6">
      <div className="mb-5">
        <h2 className="font-semibold">Test voice</h2>
        <p className="mt-1 text-sm text-muted">
          Generate speech through the Reachmark TTS API.
        </p>
      </div>

      <textarea
        className="mb-3 w-full resize-y rounded-2xl border border-border bg-bg px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-accent"
        rows={4}
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Enter text to synthesize…"
      />

      <div className="mb-3 flex items-center gap-2">
        <label htmlFor="voice-id" className="text-sm text-muted">
          Voice ID
        </label>
        <input
          id="voice-id"
          className="min-w-0 flex-1 rounded-xl border border-border bg-bg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
          value={voiceId}
          onChange={(event) => setVoiceId(event.target.value)}
          placeholder="default"
        />
      </div>

      <Button onClick={generate} disabled={loading || !text.trim()}>
        {loading ? "Generating…" : "Generate speech"}
      </Button>

      {error && (
        <p className="mt-3 rounded-xl border border-border bg-bg p-3 text-sm text-muted">
          {error}
        </p>
      )}

      {audioUrl && (
        <div className="mt-4">
          <audio controls src={audioUrl} className="w-full" />
        </div>
      )}
    </section>
  );
}
