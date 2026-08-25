/** Local pre-classifier — surfaced in the debug panel. The brain makes the final call. */

export type RouteKind = "conversation" | "tool" | "memory" | "web" | "clarify";

const TOOL_RE =
  /\b(set (a )?(timer|alarm)|remind me|wake me|turn (on|off)|switch (on|off)|start a timer|note that|write a note)\b/i;
const MEMORY_RE = /\b(remember|forget|what did i tell you|do you remember|my notes)\b/i;
const WEB_RE = /\b(search|google|look up|latest|news|weather|price of|near me)\b/i;

export function classify(utterance: string): RouteKind {
  const u = utterance.trim();
  if (!u) return "clarify";
  if (MEMORY_RE.test(u)) return "memory";
  if (TOOL_RE.test(u)) return "tool";
  if (WEB_RE.test(u)) return "web";
  return "conversation";
}
