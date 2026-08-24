export type Sensitivity = "safe" | "sensitive";

export interface SkillResult {
  reply: string;
  effect?: () => void;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  sensitivity: Sensitivity;
  examples: string[];
  match: (utterance: string) => Record<string, string> | null;
  run: (args: Record<string, string>, ctx: SkillContext) => SkillResult;
}

export interface SkillContext {
  addTimer: (label: string, seconds: number) => void;
  addNote: (text: string) => void;
  notes: string[];
}

const num = (word: string): number => {
  const words: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
    eight: 8, nine: 9, ten: 10, fifteen: 15, twenty: 20, thirty: 30, sixty: 60,
  };
  return Number.isNaN(Number(word)) ? (words[word.toLowerCase()] ?? 1) : Number(word);
};

export const skills: Skill[] = [
  {
    id: "timer",
    name: "Timers",
    description: "Set a countdown timer for a given duration.",
    sensitivity: "safe",
    examples: [
      "set a timer for 5 minutes",
      "timer for 30 seconds",
      "start a ten minute timer",
    ],
    match: (u) => {
      const m = u.match(/timer.*?(\d+|\w+)\s*(second|minute|hour)/i) ?? u.match(/(\d+|\w+)\s*(second|minute|hour).*timer/i);
      return m ? { amount: m[1] ?? "1", unit: m[2] ?? "minute" } : null;
    },
    run: (args, ctx) => {
      const amount = args.amount ?? "1";
      const unit = args.unit ?? "minute";
      const n = num(amount);
      const mult = unit.startsWith("hour") ? 3600 : unit.startsWith("minute") ? 60 : 1;
      const seconds = n * mult;
      ctx.addTimer(`${n} ${unit}${n === 1 ? "" : "s"}`, seconds);
      return { reply: `Timer set for ${n} ${unit}${n === 1 ? "" : "s"}. I'll let you know.` };
    },
  },
  {
    id: "notes",
    name: "Notes",
    description: "Store a short note or memory locally.",
    sensitivity: "safe",
    examples: ["remember that the wifi password is bluebird", "write a note: call mum", "take a note about groceries"],
    match: (u) => {
      const m = u.match(/(?:remember that|note that|write a note[:,]?|take a note[:,]?|make a note[:,]?)\s+(.*)/i);
      return m ? { text: m[1] ?? "" } : null;
    },
    run: (args, ctx) => {
      const text = args.text ?? "";
      ctx.addNote(text);
      return { reply: `Noted: ${text}` };
    },
  },
  {
    id: "recall",
    name: "Recall",
    description: "Read back stored notes.",
    sensitivity: "safe",
    examples: ["what are my notes", "read my notes back", "what do you remember"],
    match: (u) => (/(my notes|what do you remember|read.*notes)/i.test(u) ? {} : null),
    run: (_a, ctx) =>
      ctx.notes.length
        ? { reply: `You have ${ctx.notes.length} note${ctx.notes.length === 1 ? "" : "s"}. Most recent: ${ctx.notes[0] ?? ""}` }
        : { reply: "No notes stored yet." },
  },
  {
    id: "smarthome",
    name: "Smart home",
    description: "Generic REST adapter for lights, plugs and scenes.",
    sensitivity: "sensitive",
    examples: ["turn on the living room lights", "turn off the lamp", "switch off the kitchen plug"],
    match: (u) => {
      const m = u.match(/turn (on|off)\s+(?:the\s+)?(.+)/i) ?? u.match(/switch (on|off)\s+(?:the\s+)?(.+)/i);
      return m ? { action: (m[1] ?? "on").toLowerCase(), device: m[2] ?? "device" } : null;
    },
    run: (args) => ({
      reply: `Ready to turn ${args.action} the ${args.device}. Confirm and I'll send it to the smart home adapter.`,
    }),
  },
  {
    id: "search",
    name: "Web search",
    description: "Read-only web search. No purchases, no form submissions.",
    sensitivity: "safe",
    examples: ["search for oat milk recipes", "look up the weather in Warsaw", "google tanstack start"],
    match: (u) => {
      const m = u.match(/(?:search for|look up|google)\s+(.*)/i);
      return m ? { query: m[1] ?? "" } : null;
    },
    run: (args) => ({
      // eslint-disable-next-line
      reply: `Opening a read-only search for "${args.query ?? ""}".`,
      effect: () => window.open(`https://duckduckgo.com/?q=${encodeURIComponent(args.query ?? "")}`, "_blank", "noopener"),
    }),
  },
  {
    id: "sleep",
    name: "Sleep",
    description: "Dismiss the avatar back to hidden/idle.",
    sensitivity: "safe",
    examples: ["go to sleep", "that's all", "never mind"],
    match: (u) => (/(go to sleep|that'?s all|never ?mind|goodbye|dismiss)/i.test(u) ? {} : null),
    run: () => ({ reply: "Going quiet. Say the wake word when you need me." }),
  },
];

export function route(
  utterance: string,
  enabled: Record<string, boolean>,
): { skill: Skill; args: Record<string, string> } | null {
  for (const skill of skills) {
    if (enabled[skill.id] === false) continue;
    const args = skill.match(utterance);
    if (args) return { skill, args };
  }
  return null;
}
