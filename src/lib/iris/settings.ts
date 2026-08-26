import { useSyncExternalStore } from "react";

export interface IrisSettings {
  ownerName: string;
  wakeWord: string;
  /** 0 = strict (few false positives), 1 = permissive */
  sensitivity: number;
  /** minimum score required to fire, derived from sensitivity */
  testMode: boolean;
  pttMode: "click" | "hold" | "off";
  voiceURI: string;
  /** "" = auto-pick a deep British voice */
  rate: number;
  pitch: number;
  bargeIn: boolean;
  /** minimum recent microphone peak accepted as speech */
  noiseGate: number;
  sleepTimeoutSec: number;
  redactEmails: boolean;
  redactNumbers: boolean;
  redactNotes: boolean;
  retentionDays: number;
  theme: { bg: string; accent: string; accent2: string };
}

export const DEFAULT_SETTINGS: IrisSettings = {
  ownerName: "Anna",
  wakeWord: "hey iris",
  sensitivity: 0.45,
  testMode: false,
  pttMode: "click",
  voiceURI: "",
  rate: 0.96,
  pitch: 0.72,
  bargeIn: true,
  noiseGate: 0.035,
  sleepTimeoutSec: 12,
  redactEmails: true,
  redactNumbers: true,
  redactNotes: false,
  retentionDays: 7,
  theme: { bg: "#0b0709", accent: "#d1追", accent2: "#8d5f7d" },
};

// keep the default theme valid even if edited above
DEFAULT_SETTINGS.theme = { bg: "#0b0709", accent: "#c85f95", accent2: "#8d5f7d" };

const KEY = "iris.settings.v1";

let current: IrisSettings = DEFAULT_SETTINGS;
let loaded = false;
const listeners = new Set<() => void>();

function load(): IrisSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  if (loaded) return current;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) current = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    current = DEFAULT_SETTINGS;
  }
  return current;
}

function emit() {
  listeners.forEach((l) => l());
}

export function getSettings(): IrisSettings {
  return load();
}

export function setSettings(patch: Partial<IrisSettings>) {
  current = { ...load(), ...patch };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* storage disabled */
  }
  applyTheme(current);
  emit();
}

export function resetSettings() {
  current = DEFAULT_SETTINGS;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
  applyTheme(current);
  emit();
}

export function useSettings(): IrisSettings {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => load(),
    () => DEFAULT_SETTINGS,
  );
}

/** hex -> oklch-ish: we just set raw hex on the CSS variables, which is valid CSS. */
export function applyTheme(s: IrisSettings) {
  if (typeof document === "undefined") return;
  const r = document.documentElement.style;
  r.setProperty("--background", s.theme.bg);
  r.setProperty("--card", shade(s.theme.bg, 0.05));
  r.setProperty("--popover", shade(s.theme.bg, 0.05));
  r.setProperty("--primary", s.theme.accent);
  r.setProperty("--ring", s.theme.accent);
  r.setProperty("--iris-glow", s.theme.accent);
  r.setProperty("--iris-deep", s.theme.accent2);
  r.setProperty("--iris-dim", s.theme.accent2);
  r.setProperty("--border", shade(s.theme.bg, 0.14));
  r.setProperty("--input", shade(s.theme.bg, 0.16));
  r.setProperty("--secondary", shade(s.theme.bg, 0.1));
  r.setProperty("--accent", shade(s.theme.accent2, -0.25));
}

function shade(hex: string, amount: number): string {
  const m = hex.replace("#", "");
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const n = parseInt(full, 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const r = clamp(((n >> 16) & 255) + amount * 255);
  const g = clamp(((n >> 8) & 255) + amount * 255);
  const b = clamp((n & 255) + amount * 255);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}
