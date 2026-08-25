import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { runBrain, type BrainOutput } from "./brain.server";

const schema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["system", "user", "assistant", "tool"]),
      content: z.string(),
      tool_call_id: z.string().optional(),
      name: z.string().optional(),
    }),
  ),
  ownerName: z.string(),
  memories: z.array(z.string()),
  notes: z.array(z.string()),
  schedule: z.array(z.string()),
  localTime: z.string(),
  mode: z.string(),
});

export const askIris = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }): Promise<BrainOutput> => runBrain(data));
