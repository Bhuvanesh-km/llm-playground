import { z } from "zod";

/**
 * The wire contract between the streaming route and the browser.
 *
 * Deliberately ours rather than the AI SDK's: the per-call numbers and the
 * error copy are the product here, so they are first-class events rather than
 * something threaded through a general-purpose data-part protocol.
 */

/**
 * A snapshot of what is known about a call so far. Fields are null until the
 * provider has actually reported them, so nothing is ever guessed or filled in
 * with a placeholder zero. Every model here is free tier, so `costUsd` reads
 * 0 rather than nothing, and that is a real measured number, not a stub.
 */
export type StreamMetrics = {
  readonly ttftMs: number | null;
  readonly elapsedMs: number;
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly totalTokens: number | null;
  readonly tokensPerSecond: number | null;
  readonly costUsd: number | null;
};

export type ChatStreamEvent =
  | { readonly type: "delta"; readonly text: string }
  | { readonly type: "metrics"; readonly metrics: StreamMetrics }
  | { readonly type: "done"; readonly finishReason: string }
  | { readonly type: "error"; readonly message: string };

const metricsSchema = z.object({
  ttftMs: z.number().nullable(),
  elapsedMs: z.number(),
  inputTokens: z.number().nullable(),
  outputTokens: z.number().nullable(),
  totalTokens: z.number().nullable(),
  tokensPerSecond: z.number().nullable(),
  costUsd: z.number().nullable(),
});

const chatStreamEventSchema: z.ZodType<ChatStreamEvent> = z.discriminatedUnion("type", [
  z.object({ type: z.literal("delta"), text: z.string() }),
  z.object({ type: z.literal("metrics"), metrics: metricsSchema }),
  z.object({ type: z.literal("done"), finishReason: z.string() }),
  z.object({ type: z.literal("error"), message: z.string() }),
]);

/**
 * One SSE frame per event. `JSON.stringify` escapes newlines, so the payload is
 * always a single `data:` line and never needs multi-line framing.
 */
export const encodeStreamEvent = (event: ChatStreamEvent): string =>
  `data: ${JSON.stringify(event)}\n\n`;

export const parseStreamEvent = (data: string): ChatStreamEvent | null => {
  try {
    const result = chatStreamEventSchema.safeParse(JSON.parse(data));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
};

export const emptyMetrics: StreamMetrics = Object.freeze({
  ttftMs: null,
  elapsedMs: 0,
  inputTokens: null,
  outputTokens: null,
  totalTokens: null,
  tokensPerSecond: null,
  costUsd: null,
});
