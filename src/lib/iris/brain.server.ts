/** Iris brain: conversation-first reasoning with optional tool calls, via the Lovable AI Gateway. */

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

export interface BrainMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string | undefined;
  name?: string | undefined;
}

export interface BrainInput {
  messages: BrainMessage[];
  ownerName: string;
  memories: string[];
  notes: string[];
  schedule: string[];
  localTime: string;
  mode: string;
}

export interface BrainToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface BrainOutput {
  reply: string;
  toolCalls: BrainToolCall[];
  route: "conversation" | "tool" | "memory" | "web" | "clarify";
  error?: string;
}

const tool = (name: string, description: string, properties: Record<string, unknown>, required: string[]) => ({
  type: "function",
  function: { name, description, parameters: { type: "object", properties, required, additionalProperties: false } },
});

export const IRIS_TOOLS = [
  tool("set_timer", "Start a countdown timer.", {
    label: { type: "string" },
    seconds: { type: "number" },
  }, ["label", "seconds"]),
  tool("add_reminder", "Save a reminder that fires at a future time.", {
    text: { type: "string" },
    in_seconds: { type: "number" },
  }, ["text", "in_seconds"]),
  tool("set_alarm", "Set a daily or one-off alarm at a wall-clock time (24h).", {
    label: { type: "string" },
    hour: { type: "number" },
    minute: { type: "number" },
    daily: { type: "boolean" },
  }, ["label", "hour", "minute", "daily"]),
  tool("remember", "Store a durable fact about Anna or her life in long-term memory.", {
    fact: { type: "string" },
  }, ["fact"]),
  tool("forget", "Remove a stored memory that matches this text.", {
    match: { type: "string" },
  }, ["match"]),
  tool("add_note", "Save a short note.", { text: { type: "string" } }, ["text"]),
  tool("web_search", "Open or look up current information on the web.", {
    query: { type: "string" },
  }, ["query"]),
  tool("smart_home", "Control an authorised smart-home device (needs confirmation).", {
    device: { type: "string" },
    action: { type: "string" },
  }, ["device", "action"]),
];

function systemPrompt(i: BrainInput): string {
  return [
    `You are Iris — ${i.ownerName}'s personal AI assistant. You speak in a calm, dry, warm British-butler register: think a trusted aide, not a chatbot.`,
    `You know your owner is ${i.ownerName}. Address her by name occasionally, never every sentence.`,
    `Local time: ${i.localTime}. Current mode: ${i.mode}.`,
    ``,
    `ROUTING RULES (critical):`,
    `- Ordinary conversation, greetings, feelings, opinions and questions NEVER require a tool. Just answer naturally.`,
    `- Never say "I don't have the skill for that" or "I have no access to that". If you cannot do an action, say plainly what you'd need, then still respond helpfully.`,
    `- Only call a tool when the user asks for an ACTION you have a tool for.`,
    `- If a request is genuinely ambiguous, ask one short clarifying question.`,
    ``,
    `Keep spoken replies to 1-3 sentences unless asked for detail. No markdown, no lists, no emoji — this is read aloud.`,
    i.memories.length ? `\nLong-term memory about ${i.ownerName}:\n- ${i.memories.join("\n- ")}` : "",
    i.notes.length ? `\nRecent notes:\n- ${i.notes.slice(0, 8).join("\n- ")}` : "",
    i.schedule.length ? `\nUpcoming schedule:\n- ${i.schedule.join("\n- ")}` : "",
  ].join("\n");
}

export async function runBrain(input: BrainInput): Promise<BrainOutput> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) {
    return { reply: "My reasoning core isn't configured yet.", toolCalls: [], route: "conversation", error: "missing LOVABLE_API_KEY" };
  }

  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "system", content: systemPrompt(input) }, ...input.messages],
      tools: IRIS_TOOLS,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    const message =
      res.status === 429
        ? "I'm being rate limited right now — give me a moment and ask again."
        : res.status === 402
          ? "My reasoning credits have run out, so I can't think that through until they're topped up."
          : "My reasoning core just failed to answer.";
    return { reply: message, toolCalls: [], route: "conversation", error: `${res.status}: ${body.slice(0, 400)}` };
  }

  const json = (await res.json()) as any;
  const msg = json?.choices?.[0]?.message ?? {};
  const rawCalls: any[] = msg.tool_calls ?? [];
  const toolCalls: BrainToolCall[] = rawCalls.map((c) => {
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(c?.function?.arguments ?? "{}");
    } catch {
      args = {};
    }
    return { id: c?.id ?? "call", name: c?.function?.name ?? "", args };
  });

  const route: BrainOutput["route"] = toolCalls.length
    ? toolCalls[0]?.name === "web_search"
      ? "web"
      : toolCalls[0]?.name === "remember" || toolCalls[0]?.name === "forget"
        ? "memory"
        : "tool"
    : /\?$/.test((msg.content ?? "").trim())
      ? "clarify"
      : "conversation";

  return { reply: (msg.content ?? "").trim(), toolCalls, route };
}
