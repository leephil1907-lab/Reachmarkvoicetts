import { VoiceStudio } from "@/components/app/VoiceStudio";
import { PageTransition } from "@/components/app/PageTransition";

export default function Voices() {
  return <PageTransition><div className="space-y-8"><header><p className="text-sm text-accent">Reachmark Voice</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Voice studio</h1><p className="mt-2 max-w-2xl text-muted">Create, clone, preview and manage the voices powering your agents. The studio is designed around the self-hosted XTTS runtime.</p></header><VoiceStudio /></div></PageTransition>;
}
