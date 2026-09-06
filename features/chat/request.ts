import { z } from "zod";

/**
 * What the browser sends to start one model's answer. One request carries one
 * model: the arena fires a separate request per model so each streams and fails
 * on its own, and a follow-up replays that model's own conversation.
 */
export const chatRequestSchema = z.object({
  modelId: z.string().min(1),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      }),
    )
    .min(1),
});

export type ChatRequest = Readonly<z.infer<typeof chatRequestSchema>>;
