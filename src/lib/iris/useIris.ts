import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { route, skills, type Skill } from "./skills";

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
  detail?: string;
}

export interface Timer {
  id: string;
  label: string;
  endsAt: number;
}

interface Pending {
  skill: Skill;
  args: Record<string, string>;
}

const uid = () => Math.random().toString(36).slice(2, 10);

export function useIris() {
  const [state, setState] = useState<IrisState>("hidden");
  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState("");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [timers, setTimers] = useState<Timer[]>([]);
  const [pending, setPending] = useState<Pending | null>(null);
  const [wakeWord, setWakeWord] = useState("hey iris");
  const [wakeEnabled, setWakeEnabled] = useState(false);
  const [mouth, setMouth] = useState(0);
  const [supported, setSupported] = useState(true);
  const [enabled, setEnabled] = useState<Record<string, boolean>>(
    () => Object.fromEntries(skills.map((s) => [s.id, true])),
  );

  const recognitionRef = useRef<any>(null);
  const sleepTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef<IrisState>("hidden");
  stateRef.current = state;

  const log = useCallback((level: LogEntry["level"], event: string, detail?: string) => {
    setLogs((l) =>
      [{ id: uid(), at: new Date().toISOString(), level, event, detail }, ...l].slice(0, 200),
    );
  }, []);

  const ctx = useMemo(
    () => ({
      notes,
      addNote: (text: string) => setNotes((n) => [text, ...n]),
      addTimer: (label: string, seconds: number) =>
        setTimers((t) => [...t, { id: uid(), label, endsAt: Date.now() + seconds * 1000 }]),
    }),
    [notes],
  );

  const scheduleSleep = useCallback(() => {
    if (sleepTimer.current) clearTimeout(sleepTimer.current);
    sleepTimer.current = setTimeout(() => {
      setState("hidden");
      log("info", "avatar.dissolve", "idle timeout");
    }, 12000);
  }, [log]);

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
      u.rate = 1.03;
      u.pitch = 1.05;
      // Amplitude-approximated lip sync: TTS here exposes no visemes.
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
          const r = hit.skill.run(hit.args, ctx);
          setReply(r.reply);
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

  const wake = useCallback(() => {
    if (stateRef.current === "muted") return;
    log("info", "wake.detected", wakeWord);
    setState("building");
    window.setTimeout(() => {
      setState("listening");
      log("info", "avatar.listening");
      scheduleSleep();
    }, 480);
  }, [log, scheduleSleep, wakeWord]);

  // Speech recognition: wake word + dictation on one continuous stream.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SR) {
      setSupported(false);
      return;
    }
    if (!wakeEnabled) {
      recognitionRef.current?.stop?.();
      recognitionRef.current = null;
      return;
    }
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.onresult = (e: any) => {
      const res = e.results[e.resultIndex];
      const text: string = res[0].transcript.toLowerCase();
      if (stateRef.current === "hidden" || stateRef.current === "muted") {
        if (res.isFinal && text.includes(wakeWord)) {
          const after = text.split(wakeWord)[1]?.trim();
          wake();
          if (after) window.setTimeout(() => handleUtterance(after), 520);
        }
        return;
      }
      if (stateRef.current === "speaking" && /\bstop\b/.test(text)) {
        stopSpeaking();
        return;
      }
      if (res.isFinal && stateRef.current === "listening") {
        handleUtterance(text.replace(wakeWord, "").trim());
      }
    };
    rec.onerror = (e: any) => log("error", "stt.error", e?.error ?? "unknown");
    rec.onend = () => {
      if (wakeEnabled) {
        try {
          rec.start();
        } catch {
          /* already started */
        }
      }
    };
    try {
      rec.start();
      log("info", "wake.listening", `"${wakeWord}"`);
    } catch {
      /* noop */
    }
    recognitionRef.current = rec;
    return () => {
      rec.onend = null;
      rec.stop();
    };
  }, [handleUtterance, log, stopSpeaking, wake, wakeEnabled, wakeWord]);

  // Timer completion
  useEffect(() => {
    if (!timers.length) return;
    const i = setInterval(() => {
      const now = Date.now();
      const due = timers.filter((t) => t.endsAt <= now);
      if (due.length) {
        setTimers((t) => t.filter((x) => x.endsAt > now));
        due.forEach((t) => log("info", "timer.fired", t.label));
        if (stateRef.current === "hidden") setState("listening");
        speak(`Your ${due[0].label} timer is done.`);
      }
    }, 500);
    return () => clearInterval(i);
  }, [log, speak, timers]);

  const toggleSkill = (id: string) => setEnabled((e) => ({ ...e, [id]: !e[id] }));
  const clearData = () => {
    setLogs([]);
    setNotes([]);
    setTimers([]);
    setTranscript("");
    setReply("");
  };
  const toggleMute = () =>
    setState((s) => (s === "muted" ? "hidden" : (window.speechSynthesis?.cancel(), "muted")));

  return {
    state,
    setState,
    transcript,
    reply,
    logs,
    notes,
    timers,
    pending,
    enabled,
    toggleSkill,
    wakeWord,
    setWakeWord,
    wakeEnabled,
    setWakeEnabled,
    supported,
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
