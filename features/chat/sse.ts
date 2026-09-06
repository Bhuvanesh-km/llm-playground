import { encodeStreamEvent, type ChatStreamEvent } from "./stream-events";

const encoder = new TextEncoder();

/**
 * Drains an event generator into an SSE body. This is the one place the pure
 * event stream meets a real network side effect, which is why the enqueueing
 * lives here and nowhere else.
 */
export const toServerSentEventStream = (
  events: AsyncGenerator<ChatStreamEvent>,
): ReadableStream<Uint8Array> =>
  new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of events) {
          controller.enqueue(encoder.encode(encodeStreamEvent(event)));
        }
      } finally {
        controller.close();
      }
    },
    async cancel() {
      await events.return(undefined);
    },
  });

export const serverSentEventHeaders: Readonly<Record<string, string>> = Object.freeze({
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  // Stops proxies that buffer by default from holding the whole answer back.
  "X-Accel-Buffering": "no",
});
