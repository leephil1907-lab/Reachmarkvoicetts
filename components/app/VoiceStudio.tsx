"use client";

import { useEffect, useRef, useState } from "react";
import { AudioLines, Check, ChevronDown, CirclePlay, Clock3, Download, FileAudio, Gauge, Layers3, Mic2, Pause, Play, Plus, SlidersHorizontal, Sparkles, Upload, Wand2, Waves } from "lucide-react";
import { Button } from "@/components/ui/Button";

const voices = [
  { id: "nova", name: "Nova", type: "Reachmark", language: "EN", tone: "Warm", color: "from-violet-500/40 to-blue-500/10" },
  { id: "atlas", name: "Atlas", type: "Reachmark", language: "EN", tone: "Confident", color: "from-blue-500/40 to-cyan-400/10" },
  { id: "mira", name: "Mira", type: "Custom clone", language: "EN", tone: "Conversational", color: "from-fuchsia-500/35 to-violet-500/10" },
];

const history = [
  ["Nova", "Welcome to Reachmark Voice", "00:12", "2m ago"],
  ["Mira", "Your appointment is confirmed", "00:08", "18m ago"],
  ["Atlas", "Thanks for calling Reachmark", "00:16", "41m ago"],
];

function Waveform({ active = false }: { active?: boolean }) {
  const bars = Array.from({ length: 72 }, (_, i) => 14 + Math.abs(Math.sin(i * 0.72)) * 38 + (i % 7) * 2);
  return <div className="flex h-20 items-center gap-[3px] overflow-hidden">{bars.map((height, i) => <span key={i} className={`w-[2px] shrink-0 rounded-full bg-gradient-to-t from-violet-500/30 via-violet-300 to-cyan-300 ${active ? "animate-pulse" : ""}`} style={{ height: `${height}%`, animationDelay: `${i * 18}ms` }} />)}</div>;
}

export function VoiceStudio() {
  const [selected, setSelected] = useState("nova");
  const [text, setText] = useState("Welcome to Reachmark Voice. Your AI receptionist is ready to help.");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [message, setMessage] = useState("Ready to generate");
  const [speed, setSpeed] = useState("1.0x");
  const [inputOpen, setInputOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl); }, [audioUrl]);

  async function generate() {
    if (!text.trim() || loading) return;
    setLoading(true); setMessage("Synthesizing voice…"); setPlaying(false);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    try {
      const response = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: text.trim(), voice_id: selected, language: "en", model_id: "xtts-v2" }) });
      if (!response.ok) throw new Error((await response.json().catch(() => ({})))?.error || `Generation failed (${response.status})`);
      setAudioUrl(URL.createObjectURL(await response.blob())); setMessage("Generation complete");
    } catch (error) { setMessage(error instanceof Error ? error.message : "TTS backend unavailable."); }
    finally { setLoading(false); }
  }

  async function togglePlay() {
    if (!audioRef.current || !audioUrl) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); } else { await audioRef.current.play(); setPlaying(true); }
  }

  return (
    <div className="space-y-5">
      <input ref={inputRef} type="file" accept="audio/wav,audio/mpeg,audio/mp4,audio/x-m4a" className="hidden" onChange={(e) => setMessage(e.target.files?.[0] ? `Reference selected: ${e.target.files[0].name}` : "Ready to generate")} />

      <div className="grid gap-5 xl:grid-cols-[290px_minmax(0,1fr)]">
        <aside className="glass rounded-3xl p-4">
          <div className="flex items-center justify-between px-2 pb-3"><div><p className="text-xs uppercase tracking-[.14em] text-white/35">Voice library</p><p className="mt-1 text-sm text-white/50">3 production voices</p></div><button onClick={() => inputRef.current?.click()} className="grid h-8 w-8 place-items-center rounded-xl border border-white/10 bg-white/[.04] hover:bg-white/[.08]" title="Add reference"><Plus size={15}/></button></div>
          <div className="space-y-2">
            {voices.map((voice) => <button key={voice.id} onClick={() => setSelected(voice.id)} className={`group w-full rounded-2xl border p-3 text-left transition ${selected === voice.id ? "border-violet-400/40 bg-violet-400/[.08]" : "border-white/[.06] bg-white/[.015] hover:border-white/15"}`}>
              <div className="flex items-center gap-3"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${voice.color} border border-white/10`}><AudioLines size={17}/></span><span className="min-w-0 flex-1"><span className="block text-sm font-medium">{voice.name}</span><span className="mt-1 block text-[11px] text-white/35">{voice.type} · {voice.tone}</span></span>{selected === voice.id ? <span className="grid h-5 w-5 place-items-center rounded-full bg-white text-black"><Check size={12}/></span> : <span className="text-[10px] text-white/25">{voice.language}</span>}</div>
              <div className="mt-3"><Waveform /></div>
            </button>)}
          </div>
          <button onClick={() => inputRef.current?.click()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 px-3 py-3 text-xs text-white/50 transition hover:border-violet-400/40 hover:text-white"><Wand2 size={14}/> Clone a new voice</button>
        </aside>

        <main className="min-w-0 space-y-5">
          <section className="glass overflow-hidden rounded-[28px]">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[.07] px-5 py-4 sm:px-7">
              <div><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_12px_#56d9ff]"/><span className="text-xs uppercase tracking-[.15em] text-white/40">Voice canvas</span></div><h2 className="mt-2 text-xl font-medium tracking-tight">Turn words into sound.</h2></div>
              <div className="flex items-center gap-2 rounded-full border border-white/[.07] bg-white/[.025] px-3 py-1.5 text-[11px] text-white/45"><Layers3 size={13}/> XTTS v2 <ChevronDown size={13}/></div>
            </div>
            <div className="p-5 sm:p-7">
              <div className="relative rounded-2xl border border-white/[.07] bg-black/30 p-4 focus-within:border-violet-400/30 sm:p-5">
                <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} maxLength={5000} className="w-full resize-none bg-transparent text-base leading-7 text-white outline-none placeholder:text-white/20 sm:text-lg" placeholder="Write what you want your voice to say…" />
                <div className="flex items-center justify-between border-t border-white/[.06] pt-3"><span className="text-[11px] text-white/25">{text.length.toLocaleString()} / 5,000</span><div className="flex items-center gap-2"><button className="rounded-lg p-2 text-white/35 hover:bg-white/[.05] hover:text-white" title="Voice settings"><SlidersHorizontal size={15}/></button><button onClick={() => setText("")} className="rounded-lg px-2 py-1 text-[11px] text-white/35 hover:text-white">Clear</button></div></div>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-white/35"><Mic2 size={14}/><span>{voices.find(v => v.id === selected)?.name}</span><span>·</span><span>English</span><span>·</span><span>{speed}</span></div>
                <div className="flex items-center gap-2"><button onClick={() => setSpeed(speed === "1.0x" ? "1.15x" : speed === "1.15x" ? "0.85x" : "1.0x")} className="rounded-full border border-white/10 px-3 py-2 text-xs text-white/45 hover:text-white"><Gauge size={13} className="mr-1 inline"/> {speed}</button><Button onClick={generate} disabled={loading || !text.trim()}><Sparkles size={15} className="mr-2"/>{loading ? "Synthesizing…" : "Generate speech"}</Button></div>
              </div>
            </div>
          </section>

          <section className="glass overflow-hidden rounded-[28px]">
            <div className="flex items-center justify-between border-b border-white/[.07] px-5 py-4 sm:px-7"><div><p className="text-xs uppercase tracking-[.14em] text-white/35">Generation monitor</p><p className="mt-1 text-sm text-white/55">{message}</p></div><div className="text-xs text-white/25">44.1 kHz · WAV</div></div>
            <div className="px-5 py-5 sm:px-7">
              <div className="rounded-2xl border border-white/[.06] bg-black/25 px-4 py-2"><Waveform active={loading || playing}/></div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button onClick={togglePlay} disabled={!audioUrl} className="grid h-11 w-11 place-items-center rounded-full bg-white text-black disabled:cursor-not-allowed disabled:opacity-30 hover:bg-white/90">{playing ? <Pause size={16} fill="currentColor"/> : <Play size={16} fill="currentColor"/>}</button>
                <div className="h-1.5 min-w-[180px] flex-1 overflow-hidden rounded-full bg-white/[.07]"><div className={`h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-300 ${audioUrl ? "w-[38%]" : "w-0"} transition-all`}/></div>
                <span className="text-xs tabular-nums text-white/35">{audioUrl ? "00:00 / 00:12" : "00:00 / --:--"}</span>
                {audioUrl && <a href={audioUrl} download="reachmark-generation.wav" className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 text-white/45 hover:text-white" title="Download WAV"><Download size={15}/></a>}
              </div>
              <audio ref={audioRef} src={audioUrl ?? undefined} onEnded={() => setPlaying(false)} className="hidden" />
            </div>
          </section>
        </main>
      </div>

      <section className="grid gap-5 lg:grid-cols-[1fr_330px]">
        <div className="glass overflow-hidden rounded-[28px]">
          <div className="border-b border-white/[.07] px-5 py-4 sm:px-7"><p className="text-xs uppercase tracking-[.14em] text-white/35">Generation timeline</p><p className="mt-1 text-sm text-white/45">Recent voice work from this workspace</p></div>
          <div className="divide-y divide-white/[.06]">{history.map(([voice, title, duration, time]) => <div key={title} className="flex items-center gap-4 px-5 py-4 sm:px-7"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/[.07] bg-white/[.025]"><FileAudio size={16} className="text-violet-300"/></div><div className="min-w-0 flex-1"><p className="truncate text-sm">{title}</p><p className="mt-1 text-[11px] text-white/35">{voice} · {duration}</p></div><span className="hidden text-[11px] text-white/25 sm:block">{time}</span><button className="text-white/30 hover:text-white" title="Play generation"><CirclePlay size={17}/></button></div>)}</div>
        </div>
        <div className="glass rounded-[28px] p-5 sm:p-6">
          <div className="flex items-center gap-2"><Clock3 size={16} className="text-cyan-300"/><p className="text-sm font-medium">Clone a voice</p></div>
          <p className="mt-2 text-xs leading-5 text-white/40">Upload a clean reference recording. The production cloning pipeline will attach it to a private voice profile.</p>
          <button onClick={() => inputRef.current?.click()} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 bg-white/[.02] px-4 py-5 text-xs text-white/50 hover:border-violet-400/40 hover:text-white"><Upload size={15}/> Upload reference audio</button>
          <div className="mt-4 flex items-center gap-2 text-[10px] text-white/25"><FileAudio size={12}/> WAV / MP3 / M4A · clean speech recommended</div>
        </div>
      </section>
    </div>
  );
}