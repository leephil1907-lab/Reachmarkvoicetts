"use client";

import { useEffect, useRef, useState } from "react";
import { AudioLines, CheckCircle2, FileAudio, Play, Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";

const voices = [
  { id: "nova", name: "Nova", type: "Reachmark voice", language: "English", tone: "Warm" },
  { id: "atlas", name: "Atlas", type: "Reachmark voice", language: "English", tone: "Confident" },
  { id: "mira", name: "Mira", type: "Custom clone", language: "English", tone: "Conversational" },
];

export function VoiceStudio() {
  const [selected, setSelected] = useState(voices[0].id);
  const [text, setText] = useState("Welcome to Reachmark Voice. Your AI receptionist is ready.");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl); }, [audioUrl]);

  async function generate() {
    if (!text.trim() || loading) return;
    setLoading(true); setMessage(null);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim(), voice_id: selected, language: "en", model_id: "xtts-v2" }),
      });
      if (!response.ok) throw new Error((await response.json().catch(() => ({})))?.error || `Generation failed (${response.status})`);
      setAudioUrl(URL.createObjectURL(await response.blob()));
      setMessage("Generation complete");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "TTS backend unavailable.");
    } finally { setLoading(false); }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="rounded-3xl border border-border bg-surface p-4">
        <div className="mb-4 flex items-center justify-between"><div><p className="text-sm font-semibold">Voice library</p><p className="text-xs text-muted">3 voices ready</p></div><AudioLines size={18} className="text-accent" /></div>
        <div className="space-y-2">{voices.map((voice) => (
          <button key={voice.id} onClick={() => setSelected(voice.id)} className={`w-full rounded-2xl border p-3 text-left transition ${selected === voice.id ? "border-accent bg-accent/10" : "border-border hover:border-accent/40"}`}>
            <div className="flex items-center justify-between"><span className="font-medium">{voice.name}</span><CheckCircle2 size={15} className="text-accent" /></div>
            <p className="mt-1 text-xs text-muted">{voice.type} · {voice.tone}</p>
          </button>
        ))}</div>
        <Button variant="outline" className="mt-4 w-full" onClick={() => inputRef.current?.click()}><Upload size={16} className="mr-2" />Clone a voice</Button>
        <input ref={inputRef} type="file" accept="audio/wav,audio/mpeg,audio/mp4,audio/x-m4a" className="hidden" onChange={(e) => setMessage(e.target.files?.[0] ? `Selected ${e.target.files[0].name}. Upload storage will be connected next.` : null)} />
      </aside>

      <section className="rounded-3xl border border-border bg-surface p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm text-accent">Voice studio</p><h2 className="mt-1 text-2xl font-semibold">Generate natural speech</h2><p className="mt-1 text-sm text-muted">Preview your selected voice through the Reachmark TTS runtime.</p></div><div className="rounded-full border border-border px-3 py-1 text-xs text-muted">XTTS v2 adapter</div></div>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={7} className="mt-6 w-full resize-none rounded-2xl border border-border bg-bg p-4 text-sm outline-none focus:border-accent" />
        <div className="mt-4 flex flex-wrap items-center gap-3"><Button onClick={generate} disabled={loading || !text.trim()}><Sparkles size={16} className="mr-2" />{loading ? "Generating…" : "Generate speech"}</Button>{audioUrl && <audio controls src={audioUrl} className="min-w-[240px] flex-1" />} {message && <span className="text-xs text-muted">{message}</span>}</div>
      </section>
    </div>
  );
}
