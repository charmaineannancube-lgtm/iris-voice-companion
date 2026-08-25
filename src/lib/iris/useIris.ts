import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { skills, type Skill } from "./skills";
import { getSettings, setSettings, useSettings, applyTheme } from "./settings";
import { scoreWake, thresholdFor } from "./wake";
import { classify, type RouteKind } from "./router";
import { addMemory, forgetMemory, loadMemories, saveMemories, type Memory } from "./memory";
import {
  dueAlarms,
  describeAlarm,
  loadAlarms,
  markFired,
  newAlarm,
  saveAlarms,
  type Alarm,
} from "./scheduler";
import { askIris } from "./brain.functions";
import type { BrainMessage, BrainToolCall } from "./brain.server";

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

export interface Turn {
  id: string;
  role: "user" | "iris";
  text: string;
  at: string;
}

export interface Diagnostics {
  micReceiving: boolean;
  micDevice: string;
  level: number;
  wakeActive: boolean;
  stt: "idle" | "listening" | "transcribing" | "failed";
  sttError: string;
  rawTranscript: string;
  route: RouteKind | "—";
  tool: string;
  brain: "idle" | "thinking" | "working";
  lastResponse: string;
  tts: "idle" | "speaking";
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
  turns: "iris.turns.v1",
  memories: "iris.memories.v1",
  alarms: "iris.alarms.v1",
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
  const [turns, setTurns] = useState<Turn[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [diag, setDiag] = useState<Diagnostics>({
    micReceiving: false,
    micDevice: "—",
    level: 0,
    wakeActive: false,
    stt: "idle",
    sttError: "",
    rawTranscript: "",
    route: "—",
    tool: "none",
    brain: "idle",
    lastResponse: "",
    tts: "idle",
  });
  const [enabled, setEnabledState] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(skills.map((s) => [s.id, true])),
  );

  const sleepTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef<IrisState>("hidden");
  const settingsRef = useRef(settings);
  const turnsRef = useRef<Turn[]>([]);
  const memoriesRef = useRef<Memory[]>([]);
  const alarmsRef = useRef<Alarm[]>([]);
  const notesRef = useRef<string[]>([]);
  stateRef.current = state;
  settingsRef.current = settings;
  turnsRef.current = turns;
  memoriesRef.current = memories;
  alarmsRef.current = alarms;
  notesRef.current = notes;

  const patchDiag = useCallback((p: Partial<Diagnostics>) => setDiag((d) => ({ ...d, ...p })), []);

  // ---- hydrate persisted state (client only, avoids SSR mismatch) ----
  useEffect(() => {
    setLogs(persisted<LogEntry[]>(K.logs, []));
    setNotes(persisted<string[]>(K.notes, []));
    setTimers(persisted<Timer[]>(K.timers, []));
    setReminders(persisted<Reminder[]>(K.reminders, []));
    setTurns(persisted<Turn[]>(K.turns, []));
    setMemories(loadMemories());
    setAlarms(loadAlarms());
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
  useEffect(() => {
    if (hydrated) save(K.turns, turns.slice(-40));
  }, [hydrated, turns]);
  useEffect(() => {
    if (hydrated) saveMemories(memories);
  }, [hydrated, memories]);
  useEffect(() => {
    if (hydrated) saveAlarms(alarms);
  }, [hydrated, alarms]);

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
      patchDiag({ tts: "speaking", lastResponse: text });
      setTurns((t) => [...t, { id: uid(), role: "iris", text, at: new Date().toISOString() }].slice(-40));
      log("info", "tts.start", text);
      const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
      if (!synth) {
        setState("listening");
        patchDiag({ tts: "idle" });
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
        patchDiag({ tts: "idle" });
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
    [log, patchDiag, scheduleSleep],
  );

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis?.cancel();
    setMouth(0);
    patchDiag({ tts: "idle" });
    log("warn", "tts.interrupted", "user stop");
    setState("listening");
    scheduleSleep();
  }, [log, patchDiag, scheduleSleep]);

  // ---- tool execution (skills are actions only, never the response mechanism) ----
  const executeTool = useCallback(
    (call: BrainToolCall): string => {
      const a = call.args;
      const str = (k: string, d = "") => (typeof a[k] === "string" ? (a[k] as string) : d);
      const nmb = (k: string, d = 0) => (typeof a[k] === "number" ? (a[k] as number) : Number(a[k] ?? d) || d);
      switch (call.name) {
        case "set_timer": {
          const label = str("label", "timer");
          const seconds = Math.max(1, nmb("seconds", 60));
          setTimers((t) => [...t, { id: uid(), label, endsAt: Date.now() + seconds * 1000 }]);
          return `timer "${label}" started for ${seconds}s`;
        }
        case "add_reminder": {
          const text = str("text", "reminder");
          const secs = Math.max(1, nmb("in_seconds", 300));
          setReminders((r) => [...r, { id: uid(), text, dueAt: Date.now() + secs * 1000, done: false }]);
          return `reminder saved: ${text} in ${secs}s`;
        }
        case "set_alarm": {
          const al = newAlarm(str("label", "alarm"), nmb("hour", 7), nmb("minute", 0), a["daily"] !== false);
          setAlarms((x) => [...x, al]);
          return `alarm set: ${describeAlarm(al)}`;
        }
        case "remember": {
          const fact = str("fact");
          setMemories((m) => addMemory(m, fact));
          return `remembered: ${fact}`;
        }
        case "forget": {
          const match = str("match");
          setMemories((m) => forgetMemory(m, match));
          return `forgot memories matching "${match}"`;
        }
        case "add_note": {
          const text = str("text");
          setNotes((n) => [text, ...n]);
          return `note saved: ${text}`;
        }
        case "web_search": {
          const q = str("query");
          window.open(`https://www.google.com/search?q=${encodeURIComponent(q)}`, "_blank", "noopener");
          return `opened a web search for "${q}" in a new tab`;
        }
        case "smart_home": {
          return `smart-home adapter is not connected yet; the ${str("device")} could not be switched ${str("action")}`;
        }
        default:
          return "unknown tool";
      }
    },
    [],
  );

  const think = useCallback(
    async (text: string, kind: "user" | "event") => {
      setState("thinking");
      patchDiag({ brain: "thinking", route: kind === "event" ? "conversation" : classify(text), tool: "none" });

      const history: BrainMessage[] = turnsRef.current
        .slice(-12)
        .map((t) => ({ role: t.role === "user" ? "assistant" : "assistant", content: t.text }))
        .map((m, i) => ({ ...m, role: turnsRef.current.slice(-12)[i]?.role === "user" ? "user" : "assistant" }));

      const messages: BrainMessage[] = [
        ...history,
        {
          role: "user",
          content:
            kind === "event"
              ? `[system event] ${text}. Speak to Anna naturally about it — vary your phrasing, never repeat a canned line.`
              : text,
        },
      ];

      const base = {
        ownerName: settingsRef.current.ownerName,
        memories: memoriesRef.current.map((m) => m.text),
        notes: notesRef.current.slice(0, 8),
        schedule: alarmsRef.current.map(describeAlarm),
        localTime: new Date().toString(),
        mode: settingsRef.current.testMode ? "test" : "normal",
      };

      try {
        let out = await askIris({ data: { ...base, messages } });
        let guard = 0;
        while (out.toolCalls.length && guard < 3) {
          guard++;
          patchDiag({ brain: "working", tool: out.toolCalls.map((c) => c.name).join(", ") });
          const results = out.toolCalls.map((c) => {
            const res = executeTool(c);
            log("info", `tool.${c.name}`, res);
            return { role: "tool" as const, content: res, tool_call_id: c.id, name: c.name };
          });
          messages.push({ role: "assistant", content: out.reply || "(calling tools)" }, ...results);
          out = await askIris({ data: { ...base, messages } });
        }
        patchDiag({ brain: "idle", route: out.route });
        if (out.error) log("error", "brain.error", out.error);
        speak(out.reply || "I'm here.");
      } catch (e) {
        patchDiag({ brain: "idle" });
        log("error", "brain.failed", String(e));
        speak("I couldn't reach my reasoning core just then. Say that again in a moment?");
      }
    },
    [executeTool, log, patchDiag, speak],
  );

  const handleUtterance = useCallback(
    (raw: string) => {
      const text = raw.trim();
      if (!text) return;
      setTranscript(text);
      patchDiag({ rawTranscript: text, stt: "transcribing" });
      setTurns((t) => [...t, { id: uid(), role: "user", text, at: new Date().toISOString() }].slice(-40));
      log("info", "stt.final", text);
      void think(text, "user");
    },
    [log, patchDiag, think],
  );

  const confirmPending = useCallback(() => {
    if (!pending) return;
    setPending(null);
    speak("Done.");
  }, [pending, speak]);

  const cancelPending = useCallback(() => {
    if (!pending) return;
    setPending(null);
    speak("Cancelled.");
  }, [pending, speak]);

  const greetedRef = useRef(0);

  const wake = useCallback(
    (silent = false) => {
      if (stateRef.current === "muted") return;
      setState("building");
      window.setTimeout(() => {
        setState("listening");
        scheduleSleep();
        if (!silent && Date.now() - greetedRef.current > 600000) {
          greetedRef.current = Date.now();
          log("info", "greeting", settingsRef.current.ownerName);
          void think("Anna just summoned you. Greet her briefly and naturally for the time of day.", "event");
        }
      }, 480);
    },
    [log, scheduleSleep, think],
  );

  // ---- microphone diagnostics: level meter on a shared, non-exclusive stream ----
  useEffect(() => {
    if (!hydrated || typeof window === "undefined" || !navigator.mediaDevices) return;
    let ctxAudio: AudioContext | null = null;
    let stream: MediaStream | null = null;
    let raf = 0;
    let cancelled = false;

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        const label = s.getAudioTracks()[0]?.label || "default microphone";
        patchDiag({ micDevice: label, micReceiving: true });
        log("info", "mic.open", label);
        ctxAudio = new AudioContext();
        const src = ctxAudio.createMediaStreamSource(s);
        const analyser = ctxAudio.createAnalyser();
        analyser.fftSize = 512;
        src.connect(analyser);
        const buf = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          analyser.getByteTimeDomainData(buf);
          let peak = 0;
          for (const v of buf) peak = Math.max(peak, Math.abs(v - 128) / 128);
          patchDiag({ level: peak, micReceiving: true });
          raf = requestAnimationFrame(tick);
        };
        tick();
      })
      .catch((e) => {
        setMicDenied(true);
        patchDiag({ micReceiving: false, sttError: String(e?.name ?? e) });
        log("error", "mic.denied", String(e?.name ?? e));
      });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      void ctxAudio?.close();
    };
  }, [hydrated, log, patchDiag]);

  // ---- speech recognition: wake scoring + dictation ----
  useEffect(() => {
    if (typeof window === "undefined" || !hydrated) return;
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SR) {
      setSupported(false);
      patchDiag({ stt: "failed", sttError: "SpeechRecognition unsupported in this browser" });
      return;
    }
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-GB";
    let stopped = false;

    rec.onstart = () => patchDiag({ stt: "listening", wakeActive: true, sttError: "" });

    rec.onresult = (e: any) => {
      const res = e.results[e.resultIndex];
      const heard: string = res[0].transcript.toLowerCase();
      const s = settingsRef.current;
      patchDiag({ rawTranscript: heard });

      if (stateRef.current === "hidden" || stateRef.current === "muted") {
        if (!res.isFinal) return;
        const { score, remainder } = scoreWake(heard, s.wakeWord);
        const threshold = thresholdFor(s.sensitivity);
        const wakeHit = score >= threshold && stateRef.current !== "muted";
        // Hands-free: a clear sentence also opens the conversation, no button needed.
        const handsFree =
          stateRef.current === "hidden" && heard.trim().split(/\s+/).filter(Boolean).length >= 2;
        const fired = wakeHit || handsFree;
        if (s.testMode || fired) {
          setDetections((d) =>
            [
              { id: uid(), at: new Date().toISOString(), heard, score, threshold, fired },
              ...d,
            ].slice(0, 40),
          );
        }
        if (!fired) return;
        log("info", "wake.detected", `${heard} · confidence ${score.toFixed(2)}`);
        const speech = wakeHit ? remainder : heard;
        wake(Boolean(speech));
        if (speech) window.setTimeout(() => handleUtterance(speech), 520);
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
      if (err !== "no-speech") {
        patchDiag({ stt: "failed", sttError: err });
        log("error", "stt.error", err);
      }
    };
    rec.onend = () => {
      patchDiag({ wakeActive: false });
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
  }, [handleUtterance, hydrated, log, patchDiag, stopSpeaking, wake]);

  // ---- event bus tick: timers, reminders, alarms ----
  useEffect(() => {
    if (!hydrated) return;
    const i = setInterval(() => {
      const now = Date.now();
      const dueTimers = timers.filter((t) => t.endsAt <= now);
      if (dueTimers.length) {
        setTimers((t) => t.filter((x) => x.endsAt > now));
        dueTimers.forEach((t) => log("info", "timer.fired", t.label));
        if (stateRef.current === "hidden") setState("listening");
        void think(`The "${dueTimers[0]?.label ?? ""}" timer just finished.`, "event");
        return;
      }
      const dueRem = reminders.find((r) => !r.done && r.dueAt <= now);
      if (dueRem) {
        setReminders((r) => r.map((x) => (x.id === dueRem.id ? { ...x, done: true } : x)));
        log("info", "reminder.fired", dueRem.text);
        if (stateRef.current === "hidden") setState("listening");
        void think(`A reminder is due: "${dueRem.text}".`, "event");
        return;
      }
      const due = dueAlarms(alarms);
      if (due.length) {
        setAlarms((a) => markFired(a, due.map((x) => x.id)));
        due.forEach((a) => log("info", "alarm.fired", a.label));
        if (stateRef.current === "hidden") setState("listening");
        void think(
          `The alarm "${due[0]?.label ?? "alarm"}" is going off right now. Wake Anna up and tell her what's on today from her schedule and reminders.`,
          "event",
        );
      }
    }, 1000);
    return () => clearInterval(i);
  }, [alarms, hydrated, log, reminders, think, timers]);

  const toggleSkill = (id: string) => setEnabledState((e) => ({ ...e, [id]: !e[id] }));

  const addAlarm = (label: string, hour: number, minute: number, daily: boolean) =>
    setAlarms((a) => [...a, newAlarm(label, hour, minute, daily)]);
  const removeAlarm = (id: string) => setAlarms((a) => a.filter((x) => x.id !== id));
  const rememberFact = (text: string) => setMemories((m) => addMemory(m, text));
  const forgetFact = (id: string) => setMemories((m) => m.filter((x) => x.id !== id));

  const clearData = () => {
    setLogs([]);
    setNotes([]);
    setTimers([]);
    setReminders([]);
    setDetections([]);
    setTurns([]);
    setMemories([]);
    setAlarms([]);
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

  const skillList = useMemo(() => skills, []);

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
    turns,
    memories,
    alarms,
    diag,
    skillList,
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
    addAlarm,
    removeAlarm,
    rememberFact,
    forgetFact,
    clearData,
    toggleMute,
  };
}
