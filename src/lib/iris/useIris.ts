import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { route, skills, type Skill } from "./skills";
import { getSettings, setSettings, useSettings, applyTheme } from "./settings";
import { scoreWake, thresholdFor } from "./wake";

export type IrisState =
  | "hidden"
  | "building"
  | "listening"
  | "thinking"
  | "speaking"
  | "error"
  | "muted";

export interface LogEntry {
  id: string;
  at: string;
  level: "info" | "warn" | "error";
  event: string;
  detail?: string | undefined;
}

export interface Timer {
  id: string;
  label: string;
  endsAt: number;
}

export interface Reminder {
  id: string;
  text: string;
  dueAt: number;
  done: boolean;
}

export interface Detection {
  id: string;
  at: string;
  heard: string;
  score: number;
  threshold: number;
  fired: boolean;
}

interface Pending {
  skill: Skill;
  args: Record<string, string>;
}

const uid = () => Math.random().toString(36).slice(2, 10);

/** Prefer a deep British male voice — the "digital butler" register. */
const BRITISH_PREFERENCE = [
  "google uk english male",
  "microsoft ryan",
  "microsoft george",
  "microsoft thomas",
  "daniel",
  "arthur",
  "oliver",
];

export function pickButlerVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  const byName = (needle: string) =>
    voices.find((v) => v.name.toLowerCase().includes(needle) && v.lang.toLowerCase().startsWith("en"));
  for (const n of BRITISH_PREFERENCE) {
    const hit = byName(n);
    if (hit) return hit;
  }
  return (
    voices.find((v) => v.lang.toLowerCase() === "en-gb") ??
    voices.find((v) => v.lang.toLowerCase().startsWith("en-g")) ??
    voices.find((v) => v.lang.toLowerCase().startsWith("en"))
  );
}

function persisted<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage disabled */
  }
}

const K = {
  logs: "iris.logs.v1",
  notes: "iris.notes.v1",
  timers: "iris.timers.v1",
  reminders: "iris.reminders.v1",
  skills: "iris.skills.v1",
  convo: "iris.convo.v1",
};

export function useIris() {
  const settings = useSettings();

  const [state, setState] = useState<IrisState>("hidden");
  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState("");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [timers, setTimers] = useState<Timer[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [pending, setPending] = useState<Pending | null>(null);
  const [mouth, setMouth] = useState(0);
  const [supported, setSupported] = useState(true);
  const [micDenied, setMicDenied] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [enabled, setEnabledState] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(skills.map((s) => [s.id, true])),
  );

  const sleepTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef<IrisState>("hidden");
  const settingsRef = useRef(settings);
  stateRef.current = state;
  settingsRef.current = settings;

  // ---- hydrate persisted state (client only, avoids SSR mismatch) ----
  useEffect(() => {
    setLogs(persisted<LogEntry[]>(K.logs, []));
    setNotes(persisted<string[]>(K.notes, []));
    setTimers(persisted<Timer[]>(K.timers, []));
    setReminders(persisted<Reminder[]>(K.reminders, []));
    const conv = persisted<{ transcript: string; reply: string }>(K.convo, {
      transcript: "",
      reply: "",
    });
    setTranscript(conv.transcript);
    setReply(conv.reply);
    setEnabledState((e) => ({ ...e, ...persisted<Record<string, boolean>>(K.skills, {}) }));
    applyTheme(getSettings());
    setHydrated(true);
  }, []);

  // ---- persist ----
  useEffect(() => {
    if (hydrated) save(K.logs, logs);
  }, [hydrated, logs]);
  useEffect(() => {
    if (hydrated) save(K.notes, notes);
  }, [hydrated, notes]);
  useEffect(() => {
    if (hydrated) save(K.timers, timers);
  }, [hydrated, timers]);
  useEffect(() => {
    if (hydrated) save(K.reminders, reminders);
  }, [hydrated, reminders]);
  useEffect(() => {
    if (hydrated) save(K.skills, enabled);
  }, [hydrated, enabled]);
  useEffect(() => {
    if (hydrated) save(K.convo, { transcript, reply });
  }, [hydrated, transcript, reply]);

  // ---- retention pruning ----
  useEffect(() => {
    if (!hydrated) return;
    const cutoff = Date.now() - settings.retentionDays * 86400000;
    setLogs((l) => l.filter((e) => new Date(e.at).getTime() >= cutoff));
  }, [hydrated, settings.retentionDays]);

  const log = useCallback((level: LogEntry["level"], event: string, detail?: string) => {
    setLogs((l) =>
      [{ id: uid(), at: new Date().toISOString(), level, event, detail }, ...l].slice(0, 500),
    );
  }, []);

  const ctx = useMemo(
    () => ({
      notes,
      reminders,
      addNote: (text: string) => setNotes((n) => [text, ...n]),
      addTimer: (label: string, seconds: number) =>
        setTimers((t) => [...t, { id: uid(), label, endsAt: Date.now() + seconds * 1000 }]),
      addReminder: (text: string, dueAt: number) =>
        setReminders((r) => [...r, { id: uid(), text, dueAt, done: false }]),
    }),
    [notes, reminders],
  );

  const scheduleSleep = useCallback(() => {
    if (sleepTimer.current) clearTimeout(sleepTimer.current);
    sleepTimer.current = setTimeout(
      () => {
        setState("hidden");
        log("info", "avatar.dissolve", "idle timeout");
      },
      Math.max(3, settingsRef.current.sleepTimeoutSec) * 1000,
    );
  }, [log]);

  // ---- voices ----
  useEffect(() => {
    const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
    if (!synth) return;
    const read = () => setVoices(synth.getVoices());
    read();
    synth.addEventListener("voiceschanged", read);
    return () => synth.removeEventListener("voiceschanged", read);
  }, []);

  const speak = useCallback(
    (text: string) => {
      setReply(text);
      setState("speaking");
      log("info", "tts.start", text);
      const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
      if (!synth) {
        setState("listening");
        scheduleSleep();
        return;
      }
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = settingsRef.current.rate;
      u.pitch = settingsRef.current.pitch;
      const all = synth.getVoices();
      const chosen = settingsRef.current.voiceURI
        ? all.find((v) => v.voiceURI === settingsRef.current.voiceURI)
        : pickButlerVoice(all);
      if (chosen) u.voice = chosen;
      // Amplitude-approximated lip sync: the Web Speech API exposes no visemes.
      const mouthLoop = setInterval(() => setMouth(Math.random() * 0.85 + 0.15), 90);
      const done = () => {
        clearInterval(mouthLoop);
        setMouth(0);
        log("info", "tts.end");
        if (stateRef.current === "speaking") {
          setState("listening");
          scheduleSleep();
        }
      };
      u.onend = done;
      u.onerror = done;
      synth.speak(u);
    },
    [log, scheduleSleep],
  );

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis?.cancel();
    setMouth(0);
    log("warn", "tts.interrupted", "user stop");
    setState("listening");
    scheduleSleep();
  }, [log, scheduleSleep]);

  const handleUtterance = useCallback(
    (raw: string) => {
      const text = raw.trim();
      if (!text) return;
      setTranscript(text);
      log("info", "stt.final", text);
      setState("thinking");
      window.setTimeout(() => {
        const hit = route(text.toLowerCase(), enabled);
        if (!hit) {
          speak("I heard you, but I don't have a skill for that yet.");
          return;
        }
        if (hit.skill.id === "sleep") {
          setReply(hit.skill.run(hit.args, ctx).reply);
          log("info", "avatar.dissolve", "user dismissed");
          setState("hidden");
          return;
        }
        if (hit.skill.sensitivity === "sensitive") {
          setPending(hit);
          log("warn", "permission.required", hit.skill.name);
          speak(hit.skill.run(hit.args, ctx).reply);
          return;
        }
        const r = hit.skill.run(hit.args, ctx);
        r.effect?.();
        log("info", `skill.${hit.skill.id}`, JSON.stringify(hit.args));
        speak(r.reply);
      }, 450);
    },
    [ctx, enabled, log, speak],
  );

  const confirmPending = useCallback(() => {
    if (!pending) return;
    const r = pending.skill.run(pending.args, ctx);
    r.effect?.();
    log("info", `skill.${pending.skill.id}.confirmed`, JSON.stringify(pending.args));
    setPending(null);
    speak("Done.");
  }, [ctx, log, pending, speak]);

  const cancelPending = useCallback(() => {
    if (!pending) return;
    log("warn", `skill.${pending.skill.id}.cancelled`);
    setPending(null);
    speak("Cancelled.");
  }, [log, pending, speak]);

  const greetedRef = useRef(0);

  const greeting = useCallback(() => {
    const name = settingsRef.current.ownerName.trim();
    const h = new Date().getHours();
    const part = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
    return name ? `${part}, ${name}.` : `${part}.`;
  }, []);

  const wake = useCallback(() => {
    if (stateRef.current === "muted") return;
    setState("building");
    window.setTimeout(() => {
      setState("listening");
      scheduleSleep();
      // Greet at most once every 10 minutes so it stays a butler, not a parrot.
      if (Date.now() - greetedRef.current > 600000) {
        greetedRef.current = Date.now();
        log("info", "greeting", settingsRef.current.ownerName);
      }
    }, 480);
  }, [log, scheduleSleep]);

  // ---- speech recognition: wake scoring + dictation ----
  useEffect(() => {
    if (typeof window === "undefined" || !hydrated) return;
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SR) {
      setSupported(false);
      return;
    }
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    let stopped = false;

    rec.onresult = (e: any) => {
      const res = e.results[e.resultIndex];
      const heard: string = res[0].transcript.toLowerCase();
      const s = settingsRef.current;

      if (stateRef.current === "hidden" || stateRef.current === "muted") {
        if (!res.isFinal) return;
        const { score, remainder } = scoreWake(heard, s.wakeWord);
        const threshold = thresholdFor(s.sensitivity);
        const fired = score >= threshold && stateRef.current !== "muted";
        if (s.testMode || fired) {
          setDetections((d) =>
            [
              { id: uid(), at: new Date().toISOString(), heard, score, threshold, fired },
              ...d,
            ].slice(0, 40),
          );
        }
        if (!fired) {
          if (score > threshold - 0.2) log("warn", "wake.rejected", `${heard} (${score.toFixed(2)})`);
          return;
        }
        log("info", "wake.detected", `${heard} · confidence ${score.toFixed(2)}`);
        wake();
        if (remainder) window.setTimeout(() => handleUtterance(remainder), 520);
        return;
      }

      if (stateRef.current === "speaking") {
        // Natural barge-in: any confident speech cuts Iris off mid-sentence.
        const words = heard.trim().split(/\s+/).filter(Boolean);
        const isCommand = /\b(stop|wait|hold on|shut up|quiet|enough|nevermind|never mind)\b/.test(heard);
        if (s.bargeIn && (isCommand || words.length >= 2)) {
          log("warn", "tts.bargein", heard);
          stopSpeaking();
          if (!isCommand && res.isFinal) {
            window.setTimeout(() => handleUtterance(heard), 220);
          }
          return;
        }
        if (isCommand) {
          stopSpeaking();
          return;
        }
      }
      if (res.isFinal && stateRef.current === "listening") {
        const { score, remainder } = scoreWake(heard, s.wakeWord);
        handleUtterance(score >= thresholdFor(s.sensitivity) ? remainder || heard : heard);
      }
    };

    rec.onerror = (e: any) => {
      const err = e?.error ?? "unknown";
      if (err === "not-allowed" || err === "service-not-allowed") setMicDenied(true);
      if (err !== "no-speech") log("error", "stt.error", err);
    };
    rec.onend = () => {
      if (!stopped) {
        try {
          rec.start();
        } catch {
          /* already running */
        }
      }
    };
    try {
      rec.start();
      log("info", "wake.listening", `"${settingsRef.current.wakeWord}"`);
    } catch {
      /* noop */
    }
    return () => {
      stopped = true;
      rec.onend = null;
      rec.stop();
    };
  }, [handleUtterance, hydrated, log, stopSpeaking, wake]);

  // ---- timers + reminders due ----
  useEffect(() => {
    const i = setInterval(() => {
      const now = Date.now();
      const dueTimers = timers.filter((t) => t.endsAt <= now);
      if (dueTimers.length) {
        setTimers((t) => t.filter((x) => x.endsAt > now));
        dueTimers.forEach((t) => log("info", "timer.fired", t.label));
        if (stateRef.current === "hidden") setState("listening");
        speak(`Your ${dueTimers[0]?.label ?? ""} timer is done.`);
        return;
      }
      const dueRem = reminders.find((r) => !r.done && r.dueAt <= now);
      if (dueRem) {
        setReminders((r) => r.map((x) => (x.id === dueRem.id ? { ...x, done: true } : x)));
        log("info", "reminder.fired", dueRem.text);
        if (stateRef.current === "hidden") setState("listening");
        speak(`Reminder: ${dueRem.text}`);
      }
    }, 1000);
    return () => clearInterval(i);
  }, [log, reminders, speak, timers]);

  const toggleSkill = (id: string) => setEnabledState((e) => ({ ...e, [id]: !e[id] }));

  const clearData = () => {
    setLogs([]);
    setNotes([]);
    setTimers([]);
    setReminders([]);
    setDetections([]);
    setTranscript("");
    setReply("");
    Object.values(K).forEach((k) => window.localStorage.removeItem(k));
    log("warn", "privacy.cleared", "all local data removed");
  };

  const toggleMute = () =>
    setState((s) => {
      if (s === "muted") return "hidden";
      window.speechSynthesis?.cancel();
      return "muted";
    });

  return {
    state,
    setState,
    transcript,
    reply,
    logs,
    notes,
    timers,
    reminders,
    detections,
    clearDetections: () => setDetections([]),
    pending,
    enabled,
    toggleSkill,
    settings,
    updateSettings: setSettings,
    voices,
    supported,
    micDenied,
    mouth,
    wake,
    handleUtterance,
    stopSpeaking,
    confirmPending,
    cancelPending,
    clearData,
    toggleMute,
  };
}
