/** Scheduler agent: alarms and routines that survive reloads and fire without a wake word. */

export interface Alarm {
  id: string;
  label: string;
  hour: number;
  minute: number;
  daily: boolean;
  enabled: boolean;
  lastFired?: string | undefined;
}

export const ALARMS_KEY = "iris.alarms.v1";

export function loadAlarms(): Alarm[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(ALARMS_KEY) ?? "[]") as Alarm[];
  } catch {
    return [];
  }
}

export function saveAlarms(a: Alarm[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ALARMS_KEY, JSON.stringify(a));
  } catch {
    /* noop */
  }
}

export function newAlarm(label: string, hour: number, minute: number, daily: boolean): Alarm {
  return {
    id: Math.random().toString(36).slice(2, 10),
    label,
    hour: Math.max(0, Math.min(23, Math.round(hour))),
    minute: Math.max(0, Math.min(59, Math.round(minute))),
    daily,
    enabled: true,
  };
}

const stamp = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/** Returns alarms that are due right now (within the current minute, once per day). */
export function dueAlarms(alarms: Alarm[], now = new Date()): Alarm[] {
  const today = stamp(now);
  return alarms.filter(
    (a) => a.enabled && a.hour === now.getHours() && a.minute === now.getMinutes() && a.lastFired !== today,
  );
}

export function markFired(alarms: Alarm[], ids: string[], now = new Date()): Alarm[] {
  const today = stamp(now);
  return alarms
    .map((a) => (ids.includes(a.id) ? { ...a, lastFired: today, enabled: a.daily ? a.enabled : false } : a))
    .filter((a) => a.daily || a.enabled);
}

export function describeAlarm(a: Alarm): string {
  const t = `${String(a.hour).padStart(2, "0")}:${String(a.minute).padStart(2, "0")}`;
  return `${a.label} at ${t}${a.daily ? " every day" : ""}`;
}
