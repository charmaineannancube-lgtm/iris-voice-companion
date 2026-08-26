import { Activity, AudioLines, BrainCircuit, Mic, Radio, Route, Volume2, Wrench } from "lucide-react";
import type { useIris } from "@/lib/iris/useIris";

type Iris = ReturnType<typeof useIris>;

function Status({ active }: { active: boolean }) {
  return <span className={`h-2 w-2 rounded-full ${active ? "bg-primary shadow-[0_0_10px_var(--iris-glow)]" : "bg-muted-foreground/40"}`} />;
}

export function DiagnosticsPanel({ iris }: { iris: Iris }) {
  const d = iris.diag;
  const rows = [
    { icon: Mic, label: "Microphone", value: d.micReceiving ? "receiving" : "offline", active: d.micReceiving },
    { icon: Radio, label: "Wake word", value: d.wakeActive ? "armed" : "inactive", active: d.wakeActive },
    { icon: AudioLines, label: "Speech recognition", value: d.stt, active: d.stt === "listening" },
    { icon: Route, label: "Router", value: d.route, active: d.route !== "—" },
    { icon: Wrench, label: "Selected tool", value: d.tool, active: d.tool !== "none" },
    { icon: BrainCircuit, label: "Brain", value: d.brain, active: d.brain !== "idle" },
    { icon: Volume2, label: "Voice output", value: d.tts, active: d.tts === "speaking" },
  ];

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-iris-dim">
          <Activity className="size-4" /> Developer diagnostics
        </h2>
        <span className="max-w-52 truncate font-mono text-[10px] text-muted-foreground" title={d.micDevice}>{d.micDevice}</span>
      </div>

      <div className="mb-4">
        <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
          <span>Audio level</span><span className="font-mono">{Math.round(d.level * 100)}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
          <div className="h-full rounded-full bg-primary transition-[width] duration-75" style={{ width: `${Math.min(100, d.level * 100)}%` }} />
        </div>
      </div>

      <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {rows.map(({ icon: Icon, label, value, active }) => (
          <div key={label} className="flex min-w-0 items-center gap-2 border-b border-border/60 py-2 text-xs">
            <Icon className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="text-muted-foreground">{label}</span>
            <span className="ml-auto flex min-w-0 items-center gap-2 font-mono text-foreground"><Status active={active} /><span className="truncate">{value}</span></span>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 font-mono text-[11px]">
        <div><p className="mb-1 text-muted-foreground">Last raw transcript</p><p className="min-h-8 rounded-md bg-background/70 p-2 text-foreground">{d.rawTranscript || "—"}</p></div>
        <div><p className="mb-1 text-muted-foreground">Brain response</p><p className="max-h-24 min-h-8 overflow-y-auto rounded-md bg-background/70 p-2 text-primary">{d.lastResponse || "—"}</p></div>
        {d.sttError && <p className="text-destructive">STT error: {d.sttError}</p>}
      </div>
    </section>
  );
}