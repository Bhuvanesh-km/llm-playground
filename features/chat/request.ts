import { z } from "zod";

/**
 * What the browser sends to start one model's answer.
 *
 * An answer id and nothing else. The row already exists, created by the server
 * when the prompt was sent, and it carries the model, the thread and the
 * position in the conversation. The browser is asking the server to run a row
 * it already owns, not describing a call it would like made.
 *
 * This used to carry the model id and the whole message array. Both were
 * client-controlled input that reached a paid provider: one of them turned out
 * to let any caller bill an arbitrary model to this account, and the other let
 * the browser decide what text we spend tokens on.
 */
export const chatRequestSchema = z.object({
  answerId: z.uuid(),
});

export type ChatRequest = Readonly<z.infer<typeof chatRequestSchema>>;
