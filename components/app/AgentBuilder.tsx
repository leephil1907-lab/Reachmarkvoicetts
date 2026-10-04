"use client";

import { useState } from "react";
import { Bot, BrainCircuit, ChevronRight, ShieldCheck, Sparkles, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/Button";

const presets = [
  { id: "receptionist", name: "AI Receptionist", description: "Answers callers, qualifies requests and routes conversations.", icon: Bot },
  { id: "sales", name: "Sales Agent", description: "Engages prospects, discovers needs and moves leads forward.", icon: Sparkles },
  { id: "support", name: "Support Agent", description: "Handles common support questions with a calm, consistent voice.", icon: ShieldCheck },
];

export function AgentBuilder() {
  const [preset, setPreset] = useState("receptionist");
  const [name, setName] = useState("Reachmark Receptionist");
  const [instructions, setInstructions] = useState("Be helpful, concise and friendly. Identify the visitor's intent, answer clearly, and ask one useful follow-up question when needed.");
  const [saved, setSaved] = useState(false);

  return (
    <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="rounded-3xl border border-border bg-surface p-4"><div className="mb-4 flex items-center gap-2"><BrainCircuit size={18} className="text-accent" /><div><p className="text-sm font-semibold">Agent templates</p><p className="text-xs text-muted">Start with a proven role</p></div></div><div className="space-y-2">{presets.map((item) => { const Icon = item.icon; return <button key={item.id} onClick={() => setPreset(item.id)} className={`w-full rounded-2xl border p-3 text-left transition ${preset === item.id ? "border-accent bg-accent/10" : "border-border hover:border-accent/40"}`}><div className="flex items-center gap-2"><Icon size={16} className="text-accent" /><span className="font-medium">{item.name}</span><ChevronRight size={15} className="ml-auto" /></div><p className="mt-1 text-xs leading-5 text-muted">{item.description}</p></button>; })}</div></aside>
      <section className="rounded-3xl border border-border bg-surface p-5 sm:p-7"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm text-accent">Agent builder</p><h2 className="mt-1 text-2xl font-semibold">Configure your AI voice agent</h2></div><span className="rounded-full border border-border px-3 py-1 text-xs text-muted">{preset}</span></div>
        <div className="mt-6 grid gap-5 md:grid-cols-2"><label className="text-sm">Agent name<input value={name} onChange={(e) => setName(e.target.value)} className="mt-2 w-full rounded-xl border border-border bg-bg px-3 py-2.5 outline-none focus:border-accent" /></label><label className="text-sm">Voice<select className="mt-2 w-full rounded-xl border border-border bg-bg px-3 py-2.5 outline-none"><option>Nova — Warm</option><option>Atlas — Confident</option><option>Mira — Conversational</option></select></label></div>
        <label className="mt-5 block text-sm">System instructions<textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={8} className="mt-2 w-full resize-none rounded-2xl border border-border bg-bg p-4 outline-none focus:border-accent" /></label>
        <div className="mt-5 flex flex-wrap items-center gap-3"><Button onClick={() => setSaved(true)}><Sparkles size={16} className="mr-2" />Save agent</Button><Button variant="outline"><Volume2 size={16} className="mr-2" />Test voice</Button>{saved && <span className="text-xs text-accent">Configuration saved locally for this prototype.</span>}</div>
      </section>
    </div>
  );
}
