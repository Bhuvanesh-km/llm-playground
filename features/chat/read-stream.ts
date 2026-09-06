import type { ChatRequest } from "./request";
import { parseStreamEvent, type ChatStreamEvent } from "./stream-events";

const FRAME_SEPARATOR = "\n\n";
const DATA_PREFIX = "data: ";

const eventsInFrame = (frame: string): readonly ChatStreamEvent[] =>
  frame
    .split("\n")
    .filter((line) => line.startsWith(DATA_PREFIX))
    .map((line) => parseStreamEvent(line.slice(DATA_PREFIX.length)))
    .filter((event): event is ChatStreamEvent => event !== null);

async function* frames(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      // `stream: true` keeps a multi-byte character split across two chunks
      // from being decoded as two broken ones.
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split(FRAME_SEPARATOR);
      // The last part is whatever arrived after the final separator, which is
      // an incomplete frame until more bytes show up.
      buffer = parts[parts.length - 1] ?? "";
      for (const frame of parts.slice(0, -1)) {
        yield frame;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Sends one model's request and yields our events as they arrive. Anything that
 * goes wrong, a rejected request, a dropped connection, an aborted read, comes
 * back as a final `error` event rather than a thrown exception, so a caller
 * renders one failed card and never has to wrap this in a try block.
 */
export async function* streamChat(
  request: ChatRequest,
  abortSignal: AbortSignal,
): AsyncGenerator<ChatStreamEvent> {
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal: abortSignal,
    });

    if (!response.ok || response.body === null) {
      const message = await response
        .json()
        .then((body: unknown) =>
          typeof body === "object" && body !== null && "message" in body
            ? String((body as { message: unknown }).message)
            : null,
        )
        .catch(() => null);

      yield { type: "error", message: message ?? "That model couldn't be reached." };
      return;
    }

    for await (const frame of frames(response.body)) {
      for (const event of eventsInFrame(frame)) {
        yield event;
      }
    }
  } catch (error) {
    yield {
      type: "error",
      message:
        error instanceof DOMException && error.name === "AbortError"
          ? "This answer was stopped before it finished."
          : "The connection to that model dropped.",
    };
  }
}
