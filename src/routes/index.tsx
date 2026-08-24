import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ParticleAvatar } from "@/components/iris/ParticleAvatar";
import { Dashboard } from "@/components/iris/Dashboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useIris } from "@/lib/iris/useIris";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Iris — Voice Assistant with a Humanoid Avatar" },
      {
        name: "description",
        content:
          "Iris is a wake-word voice assistant with an animated humanoid avatar, skills registry, live logs and a dark pink control dashboard.",
      },
      { property: "og:title", content: "Iris — Voice Assistant with a Humanoid Avatar" },
      {
        property: "og:description",
        content:
          "Wake word, push-to-talk, timers, notes, smart home and web search — driven by an avatar that materializes when you call it.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: IrisPage,
});

function IrisPage() {
  const iris = useIris();
  const [typed, setTyped] = useState("");

  const summon = () => {
    if (iris.state === "hidden" || iris.state === "muted") iris.wake();
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!typed.trim()) return;
    if (iris.state === "hidden" || iris.state === "muted") iris.wake();
    const text = typed;
    setTyped("");
    window.setTimeout(() => iris.handleUtterance(text), 520);
  };

  return (
    <main className="min-h-screen bg-background px-5 py-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Iris<span className="text-primary">.</span>
            </h1>
            <p className="text-sm text-muted-foreground">
              Always listening for “{iris.settings.wakeWord}” · local skills · private by default
            </p>
          </div>
          <div className="flex gap-2">
            {iris.settings.pttMode !== "off" && (
              <Button
                onClick={iris.settings.pttMode === "click" ? summon : undefined}
                onPointerDown={iris.settings.pttMode === "hold" ? summon : undefined}
                onPointerUp={iris.settings.pttMode === "hold" ? iris.toggleMute : undefined}
              >
                {iris.settings.pttMode === "hold" ? "Hold to talk" : "Summon"}
              </Button>
            )}
            <Button variant="outline" onClick={iris.stopSpeaking}>
              Stop
            </Button>
            <Button variant="secondary" onClick={iris.toggleMute}>
              {iris.state === "muted" ? "Wake" : "Sleep"}
            </Button>
            <Link to="/settings">
              <Button variant="ghost">Settings</Button>
            </Link>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          <div className="rounded-2xl border border-border bg-card/40 p-4">
            <ParticleAvatar state={iris.state} mouth={iris.mouth} />
            <form onSubmit={submit} className="mt-4 flex gap-2">
              <Input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder="Try: set a timer for 2 minutes"
              />
              <Button type="submit">Send</Button>
            </form>
          </div>
          <Dashboard iris={iris} />
        </div>
      </div>
    </main>
  );
}
