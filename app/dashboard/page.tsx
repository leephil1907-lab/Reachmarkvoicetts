import { ConversationWindow } from "@/components/app/ConversationWindow";
import { PageTransition } from "@/components/app/PageTransition";
import { VoiceTester } from "@/components/app/VoiceTester";

export default function Dashboard() {
  return (
    <PageTransition>
      <div className="space-y-8">
        <header>
          <p className="text-sm text-accent">Reachmark Voice</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Your voice workspace
          </h1>
          <p className="mt-2 text-muted">
            Create voices, deploy agents and automate conversations from one place.
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Voices", "12", "Cloned and ready"],
            ["Agents", "4", "Active runtimes"],
            ["Conversations", "28", "This week"],
            ["Automations", "7", "Running"],
          ].map(([label, value, detail]) => (
            <div
              key={label}
              className="rounded-2xl border border-border bg-surface p-5"
            >
              <div className="text-sm text-muted">{label}</div>
              <div className="mt-3 text-3xl font-semibold">{value}</div>
              <div className="mt-1 text-xs text-muted">{detail}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <VoiceTester />
          <ConversationWindow />
        </div>
      </div>
    </PageTransition>
  );
}
