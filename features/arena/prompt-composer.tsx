"use client";

import { ArrowUp } from "lucide-react";
import { useState, useTransition, type FormEvent, type KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import { sendPrompt } from "@/features/arena/send-prompt";
import { defaultSelection, type FreeModel } from "@/features/models/catalog";
import { ModelPicker } from "@/features/models/model-picker";

/**
 * The prompt box, the picker and the send control.
 *
 * The selection lives here rather than inside the picker, because it is what a
 * prompt is actually sent to. A follow-up defaults to whoever answered the last
 * turn, so continuing a conversation keeps the same models unless you say
 * otherwise.
 */
export const PromptComposer = ({
  models,
  threadId,
  initialSelection,
  unavailableModelIds,
  canSend,
}: {
  readonly models: readonly FreeModel[];
  readonly threadId: string | null;
  readonly initialSelection?: readonly string[];
  /** Models whose last attempt was an outright refusal; skipped in defaults. */
  readonly unavailableModelIds?: readonly string[];
  readonly canSend: boolean;
}) => {
  const [prompt, setPrompt] = useState("");
  const [selectedIds, setSelectedIds] = useState<readonly string[]>(
    () => initialSelection ?? defaultSelection(models, new Set(unavailableModelIds)),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (): void => {
    if (prompt.trim().length === 0 || selectedIds.length === 0 || pending) return;

    startTransition(async () => {
      setError(null);
      const result = await sendPrompt({ threadId, prompt, modelIds: selectedIds });
      // A successful send redirects, so anything returned here is a refusal.
      if (result?.error !== undefined) {
        setError(result.error);
        return;
      }
      setPrompt("");
    });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    // Enter sends, shift+enter breaks the line, which is what the sketch's own
    // placeholder promises the box will do.
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <form
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        submit();
      }}
      className="border-subtle bg-panel flex flex-col gap-3 rounded-lg border p-3"
    >
      <label htmlFor="prompt" className="sr-only">
        Prompt
      </label>
      <textarea
        id="prompt"
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        onKeyDown={onKeyDown}
        rows={3}
        placeholder="Ask anything. Enter to send, shift + enter for a new line"
        className="resize-none bg-transparent outline-none"
      />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <ModelPicker
          models={models}
          selectedIds={selectedIds}
          onChange={setSelectedIds}
        />
        <Button type="submit" disabled={!canSend || pending} aria-label="Send prompt">
          {pending ? "Sending" : <ArrowUp aria-hidden className="size-4" />}
        </Button>
      </div>

      {!canSend && (
        <p className="text-muted-ink text-sm">
          Reading a thread never needs an account. Sign in to send a prompt.
        </p>
      )}
      {error !== null && (
        <p className="text-danger text-sm" role="alert">
          {error}
        </p>
      )}
    </form>
  );
};
