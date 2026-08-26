import { useState } from "react";
import { AlarmClock, Brain, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { useIris } from "@/lib/iris/useIris";

type Iris = ReturnType<typeof useIris>;

export function MemoryAlarmPanel({ iris }: { iris: Iris }) {
  const [fact, setFact] = useState("");
  const [label, setLabel] = useState("Morning briefing");
  const [time, setTime] = useState("07:00");

  const addFact = () => {
    if (!fact.trim()) return;
    iris.rememberFact(fact);
    setFact("");
  };
  const addAlarm = () => {
    const [hour, minute] = time.split(":").map(Number);
    iris.addAlarm(label.trim() || "Alarm", Number.isFinite(hour) ? (hour ?? 7) : 7, Number.isFinite(minute) ? (minute ?? 0) : 0, true);
  };

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-4 text-xs uppercase tracking-[0.2em] text-iris-dim">Memory & schedule</h2>
      <div className="grid gap-6 xl:grid-cols-2">
        <div>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground"><Brain className="size-4 text-primary" /> Memories</h3>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); addFact(); }}>
            <Input value={fact} onChange={(e) => setFact(e.target.value)} placeholder="A fact Iris should remember" />
            <Button size="icon" type="submit" aria-label="Add memory" title="Add memory"><Plus /></Button>
          </form>
          <div className="mt-3 max-h-48 space-y-1 overflow-y-auto">
            {iris.memories.length === 0 && <p className="text-xs text-muted-foreground">No memories stored.</p>}
            {iris.memories.map((memory) => (
              <div key={memory.id} className="flex items-start gap-2 border-b border-border/60 py-2 text-xs">
                <p className="min-w-0 flex-1 text-foreground">{memory.text}</p>
                <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => iris.forgetFact(memory.id)} aria-label={`Forget ${memory.text}`} title="Forget memory"><Trash2 /></Button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground"><AlarmClock className="size-4 text-primary" /> Alarms</h3>
          <div className="grid grid-cols-[1fr_7rem_auto] gap-2">
            <Input value={label} onChange={(e) => setLabel(e.target.value)} aria-label="Alarm label" />
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Alarm time" />
            <Button size="icon" onClick={addAlarm} aria-label="Add daily alarm" title="Add daily alarm"><Plus /></Button>
          </div>
          <div className="mt-3 max-h-48 space-y-1 overflow-y-auto">
            {iris.alarms.length === 0 && <p className="text-xs text-muted-foreground">No alarms scheduled.</p>}
            {iris.alarms.map((alarm) => (
              <div key={alarm.id} className="flex items-center gap-2 border-b border-border/60 py-2 text-xs">
                <Button size="icon" variant="ghost" onClick={() => iris.toggleAlarm(alarm.id)} className="h-7 w-7" aria-label={alarm.enabled ? "Disable alarm" : "Enable alarm"} title={alarm.enabled ? "Disable alarm" : "Enable alarm"}><span className={`h-2.5 w-2.5 rounded-full ${alarm.enabled ? "bg-primary" : "bg-muted-foreground/40"}`} /></Button>
                <p className="min-w-0 flex-1 truncate text-foreground">{alarm.label}</p>
                <span className="font-mono text-muted-foreground">{String(alarm.hour).padStart(2, "0")}:{String(alarm.minute).padStart(2, "0")}</span>
                <span className="text-[10px] uppercase text-iris-dim">{alarm.daily ? "daily" : "once"}</span>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => iris.removeAlarm(alarm.id)} aria-label={`Delete ${alarm.label}`} title="Delete alarm"><Trash2 /></Button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}