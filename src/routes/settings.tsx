import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ParticleAvatar } from "@/components/iris/ParticleAvatar";
import { useIris, pickButlerVoice } from "@/lib/iris/useIris";
import { resetSettings } from "@/lib/iris/settings";
import { thresholdFor } from "@/lib/iris/wake";
import { DiagnosticsPanel } from "@/components/iris/DiagnosticsPanel";
import { MemoryAlarmPanel } from "@/components/iris/MemoryAlarmPanel";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Iris Settings — Wake Word, Voice & Theme" },
      {
        name: "description",
        content:
          "Tune Iris wake-word sensitivity and test mode, choose push-to-talk behavior and a speaking voice, and preview theme tokens live.",
      },
      { property: "og:title", content: "Iris Settings — Wake Word, Voice & Theme" },
      {
        property: "og:description",
        content:
          "Wake-word thresholds with confidence test mode, voice selection, privacy redaction rules and a live theme preview.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-border py-4 last:border-b-0">
      <div className="max-w-sm">
        <p className="text-sm text-foreground">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div className="w-56 shrink-0">{children}</div>
    </div>
  );
}

function SettingsPage() {
  const iris = useIris();
  const s = iris.settings;
  const set = iris.updateSettings;
  const threshold = thresholdFor(s.sensitivity);

  return (
    <main className="min-h-screen bg-background px-5 py-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Settings</h1>
            <p className="text-sm text-muted-foreground">
              Changes apply instantly and persist on this device.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => resetSettings()}>
              Reset defaults
            </Button>
            <Link to="/">
              <Button>Back to Iris</Button>
            </Link>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="grid gap-6">
            <section className="rounded-xl border border-border bg-card px-5 py-2">
              <h2 className="py-4 text-xs uppercase tracking-[0.3em] text-iris-dim">Wake word</h2>
              <Row label="Your name" hint="Iris greets you by name and answers “who am I”.">
                <Input value={s.ownerName} onChange={(e) => set({ ownerName: e.target.value })} />
              </Row>
              <Row label="Wake phrase" hint="What Iris listens for while idle.">
                <Input
                  value={s.wakeWord}
                  onChange={(e) => set({ wakeWord: e.target.value.toLowerCase() })}
                />
              </Row>
              <Row
                label="Sensitivity"
                hint={`Fires at ${(threshold * 100).toFixed(0)}% match or better. Lower sensitivity means fewer false positives.`}
              >
                <div className="flex items-center gap-3">
                  <Slider
                    value={[s.sensitivity]}
                    min={0}
                    max={1}
                    step={0.05}
                    onValueChange={([v]) => set({ sensitivity: v ?? 0.45 })}
                  />
                  <span className="w-10 text-right text-xs text-primary">
                    {(s.sensitivity * 100).toFixed(0)}%
                  </span>
                </div>
              </Row>
              <Row
                label="Detection test mode"
                hint="Shows a live confidence bar for every candidate phrase on the main screen, including rejections."
              >
                <div className="flex justify-end">
                  <Switch checked={s.testMode} onCheckedChange={(v) => set({ testMode: v })} />
                </div>
              </Row>
              <Row
                label="Background noise gate"
                hint="Ignores audio below this microphone level. Raise it in noisy rooms."
              >
                <div className="flex items-center gap-3">
                  <Slider value={[s.noiseGate]} min={0.01} max={0.2} step={0.005} onValueChange={([v]) => set({ noiseGate: v ?? 0.035 })} />
                  <span className="w-10 text-right text-xs text-primary">{Math.round(s.noiseGate * 100)}%</span>
                </div>
              </Row>
              <Row label="Owner voice lock" hint="Browser speech recognition does not expose speaker identity. Iris uses strict wake-word gating here; biometric voice enrollment is reserved for the Windows app.">
                <span className="block text-right text-xs text-iris-dim">Windows only</span>
              </Row>
              <Row label="Sleep timeout" hint="Seconds of silence before the avatar dissolves.">
                <div className="flex items-center gap-3">
                  <Slider
                    value={[s.sleepTimeoutSec]}
                    min={4}
                    max={60}
                    step={1}
                    onValueChange={([v]) => set({ sleepTimeoutSec: v ?? 12 })}
                  />
                  <span className="w-10 text-right text-xs text-primary">{s.sleepTimeoutSec}s</span>
                </div>
              </Row>
            </section>

            <section className="rounded-xl border border-border bg-card px-5 py-2">
              <h2 className="py-4 text-xs uppercase tracking-[0.3em] text-iris-dim">Voice</h2>
              <Row
                label="Speaking voice"
                hint="Auto picks the deepest British voice your system offers."
              >
                <select
                  value={s.voiceURI}
                  onChange={(e) => set({ voiceURI: e.target.value })}
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground"
                >
                  <option value="">Auto — deep British</option>
                  {iris.voices.map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.name} ({v.lang})
                    </option>
                  ))}
                </select>
              </Row>
              <Row label="Speaking rate">
                <div className="flex items-center gap-3">
                  <Slider
                    value={[s.rate]}
                    min={0.7}
                    max={1.5}
                    step={0.01}
                    onValueChange={([v]) => set({ rate: v ?? 1 })}
                  />
                  <span className="w-10 text-right text-xs text-primary">{s.rate.toFixed(2)}x</span>
                </div>
              </Row>
              <Row label="Pitch" hint="Lower is deeper. 0.7 gives the butler register.">
                <div className="flex items-center gap-3">
                  <Slider
                    value={[s.pitch]}
                    min={0.4}
                    max={1.4}
                    step={0.01}
                    onValueChange={([v]) => set({ pitch: v ?? 0.72 })}
                  />
                  <span className="w-10 text-right text-xs text-primary">{s.pitch.toFixed(2)}</span>
                </div>
              </Row>
              <Row
                label="Barge-in"
                hint="Speak over Iris to cut her off mid-sentence — no button required."
              >
                <div className="flex justify-end">
                  <Switch checked={s.bargeIn} onCheckedChange={(v) => set({ bargeIn: v })} />
                </div>
              </Row>
              <Row label="Test voice">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    const u = new SpeechSynthesisUtterance(
                      `Good evening, ${s.ownerName || "there"}. Everything is running smoothly. Say the wake word whenever you need me.`,
                    );
                    const all = window.speechSynthesis.getVoices();
                    const v = s.voiceURI
                      ? all.find((x) => x.voiceURI === s.voiceURI)
                      : pickButlerVoice(all);
                    if (v) u.voice = v;
                    u.rate = s.rate;
                    u.pitch = s.pitch;
                    window.speechSynthesis.cancel();
                    window.speechSynthesis.speak(u);
                  }}
                >
                  Speak sample
                </Button>
              </Row>
            </section>

            <MemoryAlarmPanel iris={iris} />
            <DiagnosticsPanel iris={iris} />

            <section className="rounded-xl border border-border bg-card px-5 py-2">
              <h2 className="py-4 text-xs uppercase tracking-[0.3em] text-iris-dim">
                Theme tokens
              </h2>
              <Row label="Background" hint="Sets --background and derived surfaces.">
                <input
                  type="color"
                  value={s.theme.bg}
                  onChange={(e) => set({ theme: { ...s.theme, bg: e.target.value } })}
                  className="h-9 w-full rounded-md border border-input bg-background"
                />
              </Row>
              <Row label="Primary accent" hint="Sets --primary and the avatar glow.">
                <input
                  type="color"
                  value={s.theme.accent}
                  onChange={(e) => set({ theme: { ...s.theme, accent: e.target.value } })}
                  className="h-9 w-full rounded-md border border-input bg-background"
                />
              </Row>
              <Row label="Secondary accent" hint="Muted text, nebula wash and log chrome.">
                <input
                  type="color"
                  value={s.theme.accent2}
                  onChange={(e) => set({ theme: { ...s.theme, accent2: e.target.value } })}
                  className="h-9 w-full rounded-md border border-input bg-background"
                />
              </Row>
            </section>

            <section className="rounded-xl border border-border bg-card px-5 py-2">
              <h2 className="py-4 text-xs uppercase tracking-[0.3em] text-iris-dim">Privacy</h2>
              <Row label="Redact email addresses in exports">
                <div className="flex justify-end">
                  <Switch
                    checked={s.redactEmails}
                    onCheckedChange={(v) => set({ redactEmails: v })}
                  />
                </div>
              </Row>
              <Row label="Redact long number sequences" hint="Cards, phone numbers, account numbers.">
                <div className="flex justify-end">
                  <Switch
                    checked={s.redactNumbers}
                    onCheckedChange={(v) => set({ redactNumbers: v })}
                  />
                </div>
              </Row>
              <Row label="Redact note bodies">
                <div className="flex justify-end">
                  <Switch checked={s.redactNotes} onCheckedChange={(v) => set({ redactNotes: v })} />
                </div>
              </Row>
              <Row label="Log retention" hint="Older entries are pruned automatically on load.">
                <div className="flex items-center gap-3">
                  <Slider
                    value={[s.retentionDays]}
                    min={1}
                    max={90}
                    step={1}
                    onValueChange={([v]) => set({ retentionDays: v ?? 7 })}
                  />
                  <span className="w-12 text-right text-xs text-primary">{s.retentionDays}d</span>
                </div>
              </Row>
              <Row label="Clear everything" hint="Logs, notes, reminders, timers and transcripts.">
                <Button variant="outline" className="w-full" onClick={iris.clearData}>
                  Clear my data
                </Button>
              </Row>
            </section>
          </div>

          <aside className="lg:sticky lg:top-8 lg:self-start">
            <div className="rounded-2xl border border-border bg-card/40 p-3">
              <p className="px-2 pb-1 text-xs uppercase tracking-[0.3em] text-iris-dim">
                Live preview
              </p>
              <div className="scale-90">
                <ParticleAvatar state={iris.state === "hidden" ? "listening" : iris.state} mouth={iris.mouth} />
              </div>
              <div className="grid gap-2 px-2 pb-2">
                <Button onClick={() => iris.handleUtterance("what are my notes")}>
                  Primary button
                </Button>
                <Button variant="outline">Outline button</Button>
                <p className="text-sm text-muted-foreground">Muted body copy sample.</p>
                <p className="font-mono text-[11px] text-primary/80">19:04:22 wake.detected — 0.98</p>
                <p className="font-mono text-[11px] text-destructive">19:04:31 stt.error — network</p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
