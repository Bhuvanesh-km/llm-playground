import "server-only";

import { conversationFor } from "@/features/arena/conversation";
import { streamModelAnswer } from "@/features/chat/openrouter";
import type { ChatStreamEvent, StreamMetrics } from "@/features/chat/stream-events";
import { prisma } from "@/lib/prisma";

export type RunnableAnswer = {
  readonly id: string;
  readonly modelId: string;
  readonly threadId: string;
  readonly turnIndex: number;
};

/**
 * The answer row this request is allowed to run, or null.
 *
 * Scoped to the caller's own threads. Without that, an answer id is a bearer
 * token: anyone holding one could drive somebody else's row, overwrite what a
 * model said in their thread, and spend our provider budget doing it.
 */
export const findRunnableAnswer = async (
  answerId: string,
  userId: string,
): Promise<RunnableAnswer | null> => {
  const answer = await prisma.answer.findFirst({
    where: { id: answerId, turn: { thread: { ownerId: userId } } },
    select: {
      id: true,
      modelId: true,
      turn: { select: { index: true, threadId: true } },
    },
  });

  return answer === null
    ? null
    : {
        id: answer.id,
        modelId: answer.modelId,
        threadId: answer.turn.threadId,
        turnIndex: answer.turn.index,
      };
};

const persistMetrics = (metrics: StreamMetrics) => ({
  ttftMs: metrics.ttftMs === null ? null : Math.round(metrics.ttftMs),
  elapsedMs: Math.round(metrics.elapsedMs),
  inputTokens: metrics.inputTokens,
  outputTokens: metrics.outputTokens,
  totalTokens: metrics.totalTokens,
  tokensPerSecond: metrics.tokensPerSecond,
  costUsd: metrics.costUsd,
});

/**
 * Runs one answer and records what happened.
 *
 * The text is accumulated here rather than written per delta: a token-by-token
 * update would be one database round trip per word for no gain, since nothing
 * reads a half-written answer.
 *
 * The write is in a `finally`, so an answer is recorded even when the reader
 * walks away. Closing the tab aborts the request and cancels this generator,
 * and without that the row would sit at STREAMING for ever, which the vote rule
 * would then read as "still arriving" rather than "abandoned".
 */
export async function* runAnswer(
  answer: RunnableAnswer,
  abortSignal: AbortSignal,
): AsyncGenerator<ChatStreamEvent> {
  const messages = await conversationFor(
    answer.threadId,
    answer.modelId,
    answer.turnIndex,
  );

  let content = "";
  let metrics: StreamMetrics | null = null;
  let finishReason: string | null = null;
  let failure: string | null = null;

  try {
    for await (const event of streamModelAnswer(
      { modelId: answer.modelId, messages },
      abortSignal,
    )) {
      if (event.type === "delta") content += event.text;
      if (event.type === "metrics") metrics = event.metrics;
      if (event.type === "done") finishReason = event.finishReason;
      if (event.type === "error") failure = event.message;
      yield event;
    }
  } finally {
    const aborted = failure === null && finishReason === null;
    await prisma.answer.update({
      where: { id: answer.id },
      data: {
        content,
        status: failure !== null ? "FAILED" : aborted ? "ABORTED" : "COMPLETE",
        errorMessage: failure,
        finishReason,
        ...(metrics === null ? {} : persistMetrics(metrics)),
      },
    });
  }
}
