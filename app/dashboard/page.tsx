"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, Bot, Headphones, Mic2, Play, Plus, Radio, Sparkles, Wand2 } from "lucide-react";
import { ConversationWindow } from "@/components/app/ConversationWindow";
import { PageTransition } from "@/components/app/PageTransition";
import { VoiceTester } from "@/components/app/VoiceTester";

const metrics = [
  { label: "Voice generations", value: "1,284", change: "+18.4%", icon: Headphones },
  { label: "Active agents", value: "08", change: "+2 this week", icon: Bot },
  { label: "Minutes generated", value: "642", change: "+31.2%", icon: Radio },
  { label: "Automations", value: "14", change: "96% success", icon: Sparkles },
];

const activity = [
  ["Nova Receptionist", "Generated a 42s response", "2m ago"],
  ["Studio Voice / EN", "New clone created", "18m ago"],
  ["Lead Qualifier", "Conversation completed", "41m ago"],
];

export default function Dashboard() {
  return (
    <PageTransition>
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(circle_at_65%_10%,rgba(118,87,255,.2),transparent_38%),radial-gradient(circle_at_20%_25%,rgba(63,140,255,.1),transparent_32%)]" />

        <section className="grid-glow relative overflow-hidden rounded-[32px] border border-white/[.08] bg-black/20 px-6 py-10 sm:px-10 lg:px-14 lg:py-14">
          <div className="absolute right-[-8%] top-[-25%] h-80 w-80 rounded-full bg-violet-500/10 blur-3xl" />
          <div className="max-w-4xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.04] px-3 py-1.5 text-[11px] uppercase tracking-[.18em] text-white/60">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_14px_#56d9ff]" /> Reachmark Voice OS
            </div>
            <h1 className="text-5xl font-semibold tracking-[-.055em] sm:text-6xl lg:text-7xl">
              Give every idea <span className="text-gradient">a voice.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-white/55 sm:text-lg">
              Generate natural speech, build private voices, deploy AI receptionists and orchestrate conversations from one self-hosted workspace.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/voices" className="group inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-black transition hover:-translate-y-0.5 hover:bg-white/90">
                <Wand2 size={16} /> Create a voice <ArrowUpRight size={15} className="transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
              <Link href="/agents" className="inline-flex h-11 items-center gap-2 rounded-full border border-white/10 bg-white/[.04] px-5 text-sm font-medium text-white transition hover:bg-white/[.08]">
                <Bot size={16} /> Build an agent
              </Link>
            </div>
          </div>

          <motion.div initial={{ opacity: 0, scale: .9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: .8 }} className="absolute bottom-8 right-10 hidden h-40 w-40 items-center justify-center rounded-full border border-white/10 bg-black/40 lg:flex">
            <div className="absolute inset-5 rounded-full border border-violet-400/20" />
            <div className="absolute inset-10 rounded-full border border-cyan-300/20" />
            <Mic2 size={30} className="text-violet-200" />
          </motion.div>
        </section>

        <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map(({ label, value, change, icon: Icon }, i) => (
            <motion.div key={label} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * .06 }} className="glass rounded-2xl p-5">
              <div className="flex items-center justify-between text-white/45"><span className="text-xs uppercase tracking-[.12em]">{label}</span><Icon size={17} /></div>
              <div className="mt-5 flex items-end justify-between"><span className="text-3xl font-semibold tracking-tight">{value}</span><span className="text-xs text-cyan-300">{change}</span></div>
            </motion.div>
          ))}
        </section>

        <section className="mt-8 grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
          <div className="glass overflow-hidden rounded-3xl">
            <div className="flex items-center justify-between border-b border-white/[.07] px-5 py-4 sm:px-6">
              <div><p className="text-xs uppercase tracking-[.15em] text-white/35">Voice Studio</p><h2 className="mt-1 text-lg font-medium">Generate something</h2></div>
              <Link href="/voices" className="text-xs text-white/45 hover:text-white">Open studio ↗</Link>
            </div>
            <div className="p-5 sm:p-6"><VoiceTester /></div>
          </div>

          <div className="glass rounded-3xl p-6">
            <div className="flex items-center justify-between"><div><p className="text-xs uppercase tracking-[.15em] text-white/35">Quick launch</p><h2 className="mt-1 text-lg font-medium">Build faster</h2></div><Sparkles size={18} className="text-violet-300" /></div>
            <div className="mt-6 space-y-3">
              {[['Clone a voice','Turn a clean reference into a private voice.','/voices',Mic2],['Create an agent','Start with a receptionist, support or sales agent.','/agents',Bot],['Automate a flow','Connect conversations to repeatable actions.','/automation',Plus]].map(([title,desc,href,Icon]) => {
                const I = Icon as typeof Mic2;
                return <Link key={title as string} href={href as string} className="group flex items-center gap-4 rounded-2xl border border-white/[.07] bg-white/[.025] p-4 transition hover:border-white/15 hover:bg-white/[.05]"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[.06] text-white/70"><I size={17}/></span><span className="min-w-0 flex-1"><span className="block text-sm font-medium">{title as string}</span><span className="mt-1 block text-xs leading-5 text-white/40">{desc as string}</span></span><ArrowUpRight size={15} className="text-white/25 transition group-hover:text-white/70"/></Link>;
              })}
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-5 lg:grid-cols-[1.25fr_.75fr]">
          <div className="glass overflow-hidden rounded-3xl">
            <div className="flex items-center justify-between border-b border-white/[.07] px-5 py-4 sm:px-6"><div><p className="text-xs uppercase tracking-[.15em] text-white/35">Live workspace</p><h2 className="mt-1 text-lg font-medium">Talk to your agent</h2></div><span className="inline-flex items-center gap-2 text-xs text-cyan-300"><span className="h-1.5 w-1.5 rounded-full bg-cyan-300"/>Ready</span></div>
            <div className="p-5 sm:p-6"><ConversationWindow /></div>
          </div>
          <div className="glass rounded-3xl p-6"><p className="text-xs uppercase tracking-[.15em] text-white/35">Recent activity</p><div className="mt-5 space-y-5">{activity.map(([title,desc,time])=><div key={title} className="flex gap-3"><div className="mt-1 h-2 w-2 rounded-full bg-violet-400 shadow-[0_0_12px_rgba(167,139,250,.8)]"/><div className="min-w-0 flex-1"><p className="text-sm font-medium">{title}</p><p className="mt-1 text-xs text-white/40">{desc}</p></div><span className="text-[11px] text-white/25">{time}</span></div>)}</div><Link href="/conversations" className="mt-7 inline-flex items-center gap-2 text-xs text-white/50 hover:text-white">View conversations <ArrowUpRight size={14}/></Link></div>
        </section>

        <section className="mt-8 rounded-3xl border border-white/[.08] bg-gradient-to-br from-violet-500/[.12] via-white/[.02] to-cyan-400/[.06] p-6 sm:p-8"><div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs uppercase tracking-[.15em] text-violet-200/60">Built for your infrastructure</p><h2 className="mt-2 text-2xl font-medium tracking-tight">Your models. Your voices. Your runtime.</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">Reachmark is designed around self-hosted TTS, agent models and future speech-to-speech services instead of locking the product to a single inference provider.</p></div><Link href="/agents" className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-black hover:bg-white/90"><Play size={15} fill="currentColor"/> Explore agents</Link></div></section>
      </div>
    </PageTransition>
  );
}
