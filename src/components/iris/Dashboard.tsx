import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { skills } from "@/lib/iris/skills";
import type { useIris } from "@/lib/iris/useIris";

export function Dashboard({ iris }: { iris: ReturnType<typeof useIris> }) {
  return (
    <div className="grid gap-4">
      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="mb-3 text-xs uppercase tracking-[0.3em] text-iris-dim">Conversation</h2>
        <p className="text-sm text-muted-foreground">You said</p>
        <p className="mb-3 text-sm text-foreground">{iris.transcript || "—"}</p>
        <p className="text-sm text-muted-foreground">Iris</p>
        <p className="text-sm text-primary">{iris.reply || "—"}</p>

        {iris.pending && (
          <div className="mt-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
            <p className="text-sm text-foreground">
              {iris.pending.skill.name} needs confirmation before it runs.
            </p>
            <div className="mt-2 flex gap-2">
              <Button size="sm" onClick={iris.confirmPending}>
                Confirm
              </Button>
              <Button size="sm" variant="outline" onClick={iris.cancelPending}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="mb-3 text-xs uppercase tracking-[0.3em] text-iris-dim">Skills</h2>
        <div className="grid gap-2">
          {skills.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-foreground">
                  {s.name}{" "}
                  <span className="text-[10px] uppercase tracking-wider text-iris-dim">
                    {s.sensitivity}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">{s.examples[0]}</p>
              </div>
              <Switch checked={iris.enabled[s.id]} onCheckedChange={() => iris.toggleSkill(s.id)} />
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="mb-3 text-xs uppercase tracking-[0.3em] text-iris-dim">Settings</h2>
        <label className="text-xs text-muted-foreground">Wake word</label>
        <Input
          value={iris.wakeWord}
          onChange={(e) => iris.setWakeWord(e.target.value.toLowerCase())}
          className="mt-1"
        />
        <div className="mt-3 flex items-center justify-between">
          <span className="text-sm text-foreground">Continuous wake-word listening</span>
          <Switch checked={iris.wakeEnabled} onCheckedChange={iris.setWakeEnabled} />
        </div>
        {!iris.supported && (
          <p className="mt-2 text-xs text-destructive">
            This browser has no speech recognition. Use push-to-talk with typed input.
          </p>
        )}
        <Button variant="outline" size="sm" className="mt-3" onClick={iris.clearData}>
          Clear my data
        </Button>
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="mb-3 text-xs uppercase tracking-[0.3em] text-iris-dim">
          Timers &amp; notes
        </h2>
        {iris.timers.length === 0 && iris.notes.length === 0 && (
          <p className="text-xs text-muted-foreground">Nothing stored.</p>
        )}
        {iris.timers.map((t) => (
          <p key={t.id} className="text-sm text-primary">
            ⏱ {t.label} — {Math.max(0, Math.round((t.endsAt - Date.now()) / 1000))}s left
          </p>
        ))}
        {iris.notes.map((n, i) => (
          <p key={i} className="text-sm text-foreground">
            • {n}
          </p>
        ))}
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="mb-3 text-xs uppercase tracking-[0.3em] text-iris-dim">Activity log</h2>
        <div className="max-h-64 overflow-y-auto font-mono text-[11px] leading-relaxed">
          {iris.logs.length === 0 && <p className="text-muted-foreground">No events yet.</p>}
          {iris.logs.map((l) => (
            <p
              key={l.id}
              className={
                l.level === "error"
                  ? "text-destructive"
                  : l.level === "warn"
                    ? "text-iris-dim"
                    : "text-primary/80"
              }
            >
              {l.at.slice(11, 19)} {l.event} {l.detail ? `— ${l.detail}` : ""}
            </p>
          ))}
        </div>
      </section>
    </div>
  );
}
