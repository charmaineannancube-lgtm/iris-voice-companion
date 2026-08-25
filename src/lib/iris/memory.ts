/** Memory agent: durable, user-owned facts stored locally. */

export interface Memory {
  id: string;
  text: string;
  at: string;
}

const KEY = "iris.memories.v1";

export function loadMemories(): Memory[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as Memory[];
  } catch {
    return [];
  }
}

export function saveMemories(m: Memory[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(m));
  } catch {
    /* storage disabled */
  }
}

export function addMemory(list: Memory[], text: string): Memory[] {
  const clean = text.trim();
  if (!clean) return list;
  if (list.some((m) => m.text.toLowerCase() === clean.toLowerCase())) return list;
  return [{ id: Math.random().toString(36).slice(2, 10), text: clean, at: new Date().toISOString() }, ...list].slice(0, 200);
}

export function forgetMemory(list: Memory[], match: string): Memory[] {
  const needle = match.trim().toLowerCase();
  if (!needle) return list;
  return list.filter((m) => !m.text.toLowerCase().includes(needle));
}

export const MEMORY_KEY = KEY;
