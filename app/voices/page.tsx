"use client";

import { PageTransition } from "@/components/app/PageTransition";
import { VoiceStudio } from "@/components/app/VoiceStudio";

export default function Voices() {
  return (
    <PageTransition>
      <div className="space-y-7">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-xs uppercase tracking-[.18em] text-violet-300/70">Reachmark Voice</p><h1 className="mt-2 text-4xl font-semibold tracking-[-.045em] sm:text-5xl">Voice Studio</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-white/45">A focused workspace for synthesis, private voices and generation history. Built around the Reachmark TTS runtime.</p></div>
          <div className="hidden items-center gap-2 rounded-full border border-white/[.07] bg-white/[.025] px-3 py-2 text-xs text-white/40 sm:flex"><Waves size={14} className="text-cyan-300"/> Audio runtime ready</div>
        </header>
        <VoiceStudio />
      </div>
    </PageTransition>
  );
}