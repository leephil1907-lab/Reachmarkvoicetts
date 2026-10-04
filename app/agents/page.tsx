import { AgentBuilder } from "@/components/app/AgentBuilder";
import { PageTransition } from "@/components/app/PageTransition";

export default function Agents() {
  return <PageTransition><div className="space-y-8"><header><p className="text-sm text-accent">Reachmark Agents</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">AI agent builder</h1><p className="mt-2 max-w-2xl text-muted">Configure receptionist, sales and support agents with their own instructions, voice and runtime behavior.</p></header><AgentBuilder /></div></PageTransition>;
}
