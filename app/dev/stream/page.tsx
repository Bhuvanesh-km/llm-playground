"use client";

import { useCallback, useRef, useState } from "react";
import posthog from "posthog-js";

import { streamChat } from "@/features/chat/read-stream";
import { emptyMetrics, type StreamMetrics } from "@/features/chat/stream-events";

/**
 * Throwaway harness for feature 1a: proves one prompt reaches a real model and
 * streams back with real numbers. It is deliberately unstyled, because the
 * design feature has not been decided yet and inventing a look here would
 * quietly pre-empt it. Feature 6 replaces this with the real arena, and this
 * page gets deleted then.
 */
export default function StreamProofPage() {
  const [modelId, setModelId] = useState("minimax/minimax-m3:free");
  const [prompt, setPrompt] = useState("In one sentence, what is a token?");
  const [answer, setAnswer] = useState("");
  const [metrics, setMetrics] = useState<StreamMetrics>(emptyMetrics);
  const [error, setError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setAnswer("");
    setMetrics(emptyMetrics);
    setError(null);
    setIsStreaming(true);

    // Track the prompt submission
    posthog.capture("prompt_submitted", {
      model_id: modelId,
      prompt_length: prompt.length,
    });

    const events = streamChat(
      { modelId, messages: [{ role: "user", content: prompt }] },
      controller.signal,
    );

    let finalMetrics = emptyMetrics;
    let finalError: string | null = null;

    for await (const event of events) {
      if (event.type === "delta") setAnswer((current) => current + event.text);
      if (event.type === "metrics") {
        setMetrics(event.metrics);
        finalMetrics = event.metrics;
      }
      if (event.type === "error") {
        setError(event.message);
        finalError = event.message;
      }
    }

    setIsStreaming(false);

    // Track stream completion with performance metrics
    posthog.capture("stream_completed", {
      model_id: modelId,
      success: finalError === null,
      ttft_ms: finalMetrics.ttftMs,
      elapsed_ms: finalMetrics.elapsedMs,
      input_tokens: finalMetrics.inputTokens,
      output_tokens: finalMetrics.outputTokens,
      total_tokens: finalMetrics.totalTokens,
      tokens_per_second: finalMetrics.tokensPerSecond,
      cost_usd: finalMetrics.costUsd,
      finish_reason: finalError === null ? "done" : "error",
    });
  }, [modelId, prompt]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    posthog.capture("stream_stopped", {
      model_id: modelId,
    });
  }, [modelId]);

  return (
    <main>
      <h1>Streaming proof</h1>

      <p>
        <label htmlFor="modelId">Model</label>
        <br />
        <input
          id="modelId"
          value={modelId}
          onChange={(event) => setModelId(event.target.value)}
          size={40}
        />
      </p>

      <p>
        <label htmlFor="prompt">Prompt</label>
        <br />
        <textarea
          id="prompt"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          rows={4}
          cols={60}
        />
      </p>

      <p>
        <button type="button" onClick={send} disabled={isStreaming}>
          Send
        </button>{" "}
        <button type="button" onClick={stop} disabled={!isStreaming}>
          Stop
        </button>
      </p>

      {error !== null && (
        <p role="alert">
          {error}{" "}
          <button type="button" onClick={send}>
            Try again
          </button>
        </p>
      )}

      <h2>Answer</h2>
      <pre aria-live="polite" style={{ whiteSpace: "pre-wrap" }}>
        {answer}
      </pre>

      <h2>Numbers</h2>
      <dl>
        <dt>Time to first token</dt>
        <dd>{metrics.ttftMs === null ? "—" : `${metrics.ttftMs} ms`}</dd>
        <dt>Total time</dt>
        <dd>{`${metrics.elapsedMs} ms`}</dd>
        <dt>Tokens per second</dt>
        <dd>
          {metrics.tokensPerSecond === null ? "—" : metrics.tokensPerSecond.toFixed(1)}
        </dd>
        <dt>Total tokens</dt>
        <dd>{metrics.totalTokens ?? "—"}</dd>
        <dt>Cost</dt>
        <dd>{metrics.costUsd === null ? "—" : `$${metrics.costUsd.toFixed(4)}`}</dd>
      </dl>
    </main>
  );
}
