import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { skills } from "@/lib/iris/skills";
import { download, redactLogs, toCSV } from "@/lib/iris/redact";
import type { useIris } from "@/lib/iris/useIris";
import { DiagnosticsPanel } from "./DiagnosticsPanel";
import { MemoryAlarmPanel } from "./MemoryAlarmPanel";

export function Dashboard({ iris }: { iris: ReturnType<typeof useIris> }) {
  const [showExport, setShowExport] = useState(false);
  const s = iris.settings;

  const redacted = useMemo(
    () =>
      redactLogs(iris.logs, {
        redactEmails: s.redactEmails,
        redactNumbers: s.redactNumbers,
        redactNotes: s.redactNotes,
      }),
    [iris.logs, s.redactEmails, s.redactNumbers, s.redactNotes],
  );

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");

  return (
    <div className="grid gap-4">
      <DiagnosticsPanel iris={iris} />
      <MemoryAlarmPanel iris={iris} />
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

      {s.testMode && (
        <section className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs uppercase tracking-[0.3em] text-iris-dim">
              Wake test — confidence
            </h2>
            <Button size="sm" variant="ghost" onClick={iris.clearDetections}>
              Clear
            </Button>
          </div>
          {iris.detections.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Speak near the mic. Every candidate phrase is scored against “{s.wakeWord}”.
            </p>
          )}
          <div className="grid gap-2">
            {iris.detections.map((d) => (
              <div key={d.id}>
                <div className="flex items-center justify-between text-xs">
                  <span className={d.fired ? "text-primary" : "text-muted-foreground"}>
                    {d.heard}
                  </span>
                  <span className={d.fired ? "text-primary" : "text-iris-dim"}>
                    {(d.score * 100).toFixed(0)}% {d.fired ? "· fired" : "· rejected"}
                  </span>
                </div>
                <div className="relative mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.min(100, d.score * 100)}%` }}
                  />
                  <div
                    className="absolute top-0 h-full w-px bg-foreground/60"
                    style={{ left: `${d.threshold * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="mb-3 text-xs uppercase tracking-[0.3em] text-iris-dim">Skills</h2>
        <div className="grid gap-2">
          {skills.map((sk) => (
            <div key={sk.id} className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-foreground">
                  {sk.name}{" "}
                  <span className="text-[10px] uppercase tracking-wider text-iris-dim">
                    {sk.sensitivity}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">{sk.examples[0]}</p>
              </div>
              <Switch
                checked={iris.enabled[sk.id] ?? true}
                onCheckedChange={() => iris.toggleSkill(sk.id)}
              />
            </div>
          ))}
        </div>
        <Link
          to="/settings"
          className="mt-3 inline-block text-xs text-primary underline-offset-4 hover:underline"
        >
          Open settings →
        </Link>
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="mb-3 text-xs uppercase tracking-[0.3em] text-iris-dim">
          Timers, reminders &amp; notes
        </h2>
        {iris.timers.length === 0 && iris.notes.length === 0 && iris.reminders.length === 0 && (
          <p className="text-xs text-muted-foreground">Nothing stored.</p>
        )}
        {iris.timers.map((t) => (
          <p key={t.id} className="text-sm text-primary">
            ⏱ {t.label} — {Math.max(0, Math.round((t.endsAt - Date.now()) / 1000))}s left
          </p>
        ))}
        {iris.reminders.map((r) => (
          <p
            key={r.id}
            className={r.done ? "text-sm text-muted-foreground line-through" : "text-sm text-foreground"}
          >
            🔔 {r.text} — {new Date(r.dueAt).toLocaleTimeString()}
          </p>
        ))}
        {iris.notes.map((n, i) => (
          <p key={i} className="text-sm text-foreground">
            • {n}
          </p>
        ))}
        <p className="mt-2 text-[11px] text-iris-dim">
          Stored locally on this device and restored on reload.
        </p>
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs uppercase tracking-[0.3em] text-iris-dim">Activity log</h2>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowExport((v) => !v)}>
              {showExport ? "Hide export" : "Export"}
            </Button>
            <Button size="sm" variant="ghost" onClick={iris.clearData}>
              Clear my data
            </Button>
          </div>
        </div>

        {showExport && (
          <div className="mb-4 rounded-lg border border-border bg-background/60 p-3">
            <p className="text-xs text-muted-foreground">
              Redaction preview — {redacted.hits.length} field
              {redacted.hits.length === 1 ? "" : "s"} will be masked before download.
            </p>
            <div className="mt-2 max-h-40 space-y-2 overflow-y-auto">
              {redacted.hits.length === 0 && (
                <p className="text-[11px] text-iris-dim">
                  Nothing matched the active redaction rules. Adjust them in settings.
                </p>
              )}
              {redacted.hits.map((h, i) => (
                <div key={i} className="font-mono text-[10px] leading-relaxed">
                  <p className="text-iris-dim">
                    {h.field} · {h.kind}
                  </p>
                  <p className="text-destructive line-through">{h.before}</p>
                  <p className="text-primary">{h.after}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                onClick={() =>
                  download(
                    `iris-logs-${stamp}.json`,
                    JSON.stringify(redacted.rows, null, 2),
                    "application/json",
                  )
                }
              >
                Download JSON
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => download(`iris-logs-${stamp}.csv`, toCSV(redacted.rows), "text/csv")}
              >
                Download CSV
              </Button>
            </div>
          </div>
        )}

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

        {iris.micDenied && (
          <p className="mt-2 text-xs text-destructive">
            Microphone access was blocked. Allow it in the address bar so Iris can keep listening.
          </p>
        )}
        {!iris.supported && (
          <p className="mt-2 text-xs text-destructive">
            This browser has no speech recognition. Use Summon and typed input instead.
          </p>
        )}
      </section>
    </div>
  );
}
