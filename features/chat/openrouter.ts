import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { streamText } from "ai";

import { serverEnv } from "@/lib/env";

import { toHumanErrorMessage } from "./error-message";
import type { ChatRequest } from "./request";
import type { ChatStreamEvent, StreamMetrics } from "./stream-events";

/**
 * `strict` compatibility is what tells the provider it is talking to the real
 * OpenRouter API, which is what makes usage come back on the stream at all.
 */
const openrouter = createOpenRouter({
  apiKey: serverEnv.OPENROUTER_API_KEY,
  compatibility: "strict",
});

type UsageSnapshot = {
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly totalTokens: number | null;
  readonly costUsd: number | null;
};

const noUsage: UsageSnapshot = {
  inputTokens: null,
  outputTokens: null,
  totalTokens: null,
  costUsd: null,
};

const orNull = (value: number | undefined): number | null => value ?? null;

/**
 * Tokens per second measures generation speed, so it divides output tokens by
 * the time spent generating, not by the whole call. The wait for the first
 * token is already reported on its own as time-to-first-token, and counting it
 * twice would make a slow-to-start model look slow to generate as well.
 */
const tokensPerSecond = (
  outputTokens: number | null,
  ttftMs: number | null,
  elapsedMs: number,
): number | null => {
  if (outputTokens === null || ttftMs === null) return null;
  const generatingMs = elapsedMs - ttftMs;
  if (generatingMs <= 0) return null;
  return (outputTokens * 1000) / generatingMs;
};

const buildMetrics = (
  ttftMs: number | null,
  elapsedMs: number,
  usage: UsageSnapshot,
): StreamMetrics => ({
  ttftMs,
  elapsedMs,
  inputTokens: usage.inputTokens,
  outputTokens: usage.outputTokens,
  totalTokens: usage.totalTokens,
  tokensPerSecond: tokensPerSecond(usage.outputTokens, ttftMs, elapsedMs),
  costUsd: usage.costUsd,
});

/**
 * OpenRouter reports the real cost of the call in its own provider metadata.
 * On this app's free-tier models that is genuinely 0, which is a measured
 * number rather than a placeholder, so it is read rather than assumed.
 */
const readCostUsd = (providerMetadata: unknown): number | null => {
  if (typeof providerMetadata !== "object" || providerMetadata === null) return null;
  const openrouterMeta = (providerMetadata as Record<string, unknown>).openrouter;
  if (typeof openrouterMeta !== "object" || openrouterMeta === null) return null;
  const usage = (openrouterMeta as Record<string, unknown>).usage;
  if (typeof usage !== "object" || usage === null) return null;
  const cost = (usage as Record<string, unknown>).cost;
  return typeof cost === "number" ? cost : null;
};

/**
 * The human sentence is all the browser ever sees, so the real error is kept
 * here where it can still be diagnosed. Feature 6 replaces this with proper
 * server-side reporting through PostHog.
 */
const logModelFailure = (modelId: string, error: unknown): void => {
  console.error(`[chat] model call failed: ${modelId}`, error);
};

/**
 * One model's answer, as our own events. Everything that can go wrong on the
 * provider side is caught here and yielded as a single `error` event carrying a
 * plain sentence, so a failure is an ordinary part of the stream rather than an
 * exception that tears the response down.
 */
export async function* streamModelAnswer(
  request: ChatRequest,
  abortSignal: AbortSignal,
): AsyncGenerator<ChatStreamEvent> {
  const startedAt = Date.now();
  const since = (): number => Date.now() - startedAt;

  let ttftMs: number | null = null;
  let usage: UsageSnapshot = noUsage;
  let finishReason = "unknown";
  let failure: string | null = null;

  try {
    const result = streamText({
      model: openrouter(request.modelId, { usage: { include: true } }),
      messages: request.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      abortSignal,
    });

    for await (const part of result.fullStream) {
      if (part.type === "text-delta") {
        if (ttftMs === null) {
          ttftMs = since();
          yield { type: "metrics", metrics: buildMetrics(ttftMs, since(), usage) };
        }
        yield { type: "delta", text: part.text };
        continue;
      }

      if (part.type === "finish-step") {
        usage = {
          inputTokens: orNull(part.usage.inputTokens),
          outputTokens: orNull(part.usage.outputTokens),
          totalTokens: orNull(part.usage.totalTokens),
          costUsd: readCostUsd(part.providerMetadata),
        };
        continue;
      }

      if (part.type === "finish") {
        finishReason = part.finishReason;
        continue;
      }

      // The SDK reports a mid-stream provider failure as an `error` part rather
      // than by throwing, so it has to be handled here as well as in `catch`.
      if (part.type === "error") {
        logModelFailure(request.modelId, part.error);
        failure = toHumanErrorMessage(part.error);
        break;
      }

      if (part.type === "abort") {
        failure = toHumanErrorMessage(new DOMException("Aborted", "AbortError"));
        break;
      }
    }
  } catch (error) {
    logModelFailure(request.modelId, error);
    failure = toHumanErrorMessage(error);
  }

  yield { type: "metrics", metrics: buildMetrics(ttftMs, since(), usage) };

  yield failure === null
    ? { type: "done", finishReason }
    : { type: "error", message: failure };
}
