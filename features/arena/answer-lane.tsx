"use client";

import { useEffect, useRef, useState } from "react";

import { streamChat } from "@/features/chat/read-stream";
import { emptyMetrics, type StreamMetrics } from "@/features/chat/stream-events";
import { ModelBadge } from "@/features/models/model-badge";

export type LaneAnswer = {
  readonly id: string;
  readonly modelId: string;
  readonly modelName: string;
  readonly status: "STREAMING" | "COMPLETE" | "FAILED" | "ABORTED";
  readonly content: string;
  readonly errorMessage: string | null;
  readonly ttftMs: number | null;
  readonly tokensPerSecond: number | null;
  readonly totalTokens: number | null;
};

type LaneState = {
  readonly text: string;
  readonly metrics: StreamMetrics;
  readonly error: string | null;
  readonly streaming: boolean;
};

const restingState = (answer: LaneAnswer): LaneState => ({
  text: answer.content,
  metrics: {
    ...emptyMetrics,
    ttftMs: answer.ttftMs,
    tokensPerSecond: answer.tokensPerSecond,
    totalTokens: answer.totalTokens,
  },
  error: answer.errorMessage,
  streaming: false,
});

/**
 * One model's lane.
 *
 * Each lane opens its own connection and owns its own state, which is the whole
 * point of one request per model: a lane that fails, stalls or gets rate
 * limited does it alone, and the other two carry on. Nothing here can observe
 * another lane, so there is no shared object for one failure to poison.
 */
export const AnswerLane = ({
  answer,
  onSettled,
}: {
  readonly answer: LaneAnswer;
  readonly onSettled: () => void;
}) => {
  const [state, setState] = useState<LaneState>(() => restingState(answer));
  // Held in a ref so a change of callback identity between renders cannot
  // restart a stream that is already running. Assigned in an effect rather than
  // during render, because a render can be thrown away and re-run.
  const settledRef = useRef(onSettled);
  useEffect(() => {
    settledRef.current = onSettled;
  }, [onSettled]);

  useEffect(() => {
    if (answer.status !== "STREAMING") return;

    const controller = new AbortController();
    let cancelled = false;

    const run = async (): Promise<void> => {
      setState((prev) => ({ ...prev, streaming: true, error: null }));

      for await (const event of streamChat(answer.id, controller.signal)) {
        if (cancelled) return;
        if (event.type === "delta") {
          setState((prev) => ({ ...prev, text: prev.text + event.text }));
        } else if (event.type === "metrics") {
          setState((prev) => ({ ...prev, metrics: event.metrics }));
        } else if (event.type === "error") {
          setState((prev) => ({ ...prev, error: event.message, streaming: false }));
        } else {
          setState((prev) => ({ ...prev, streaming: false }));
        }
      }

      if (!cancelled) {
        setState((prev) => ({ ...prev, streaming: false }));
        // Tells the page a lane has settled so it can refresh the server's view
        // of the row, which is the copy that survives a reload.
        settledRef.current();
      }
    };

    void run();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [answer.id, answer.status]);

  return (
    <div className="bg-panel flex min-w-0 flex-col">
      <div className="border-subtle flex items-center gap-2 border-b px-4 py-3">
        <ModelBadge name={answer.modelName} />
        <p className="min-w-0 flex-1 truncate text-sm font-medium">{answer.modelName}</p>
        {state.streaming && (
          <span className="text-muted-ink text-xs" role="status">
            answering
          </span>
        )}
      </div>

      <div className="flex-1 px-4 py-3">
        {state.error !== null ? (
          <p className="text-danger text-sm" role="alert">
            {state.error}
          </p>
        ) : state.text.length === 0 ? (
          <p className="text-muted-ink text-sm">Waiting for the first token…</p>
        ) : (
          <p className="text-sm whitespace-pre-wrap">{state.text}</p>
        )}
      </div>

      <dl className="bg-raised border-subtle flex flex-wrap justify-between gap-x-4 gap-y-1 border-t px-4 py-3 text-sm">
        <div>
          <dt className="text-muted-ink text-xs">to first token</dt>
          <dd>{state.metrics.ttftMs === null ? "—" : `${state.metrics.ttftMs} ms`}</dd>
        </div>
        <div className="text-right">
          <dt className="text-muted-ink text-xs">tokens/sec</dt>
          <dd>
            {state.metrics.tokensPerSecond === null
              ? "—"
              : state.metrics.tokensPerSecond.toFixed(0)}
          </dd>
        </div>
        <div className="text-right">
          <dt className="text-muted-ink text-xs">tokens</dt>
          <dd>{state.metrics.totalTokens ?? "—"}</dd>
        </div>
      </dl>
    </div>
  );
};
