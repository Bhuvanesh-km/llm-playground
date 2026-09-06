"use client";

import { Check, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { MAX_SELECTED_MODELS, type FreeModel } from "./catalog";
import { formatContext, formatExactContext } from "./format";
import { ModelBadge } from "./model-badge";

type ModelPickerProps = {
  readonly models: readonly FreeModel[];
  readonly selectedIds: readonly string[];
  readonly onChange: (ids: readonly string[]) => void;
};

/**
 * Choosing who answers the next prompt.
 *
 * Controlled rather than holding its own state: the arena owns the selection,
 * because it is what a prompt is actually sent to and what a follow-up has to
 * keep consistent. This component only proposes changes.
 *
 * There is no search box. Nineteen models fit in a scrollable list, and a field
 * that filters a list you can already see is one accessory too many.
 */
export const ModelPicker = ({ models, selectedIds, onChange }: ModelPickerProps) => {
  /**
   * Only the selections that still exist in the catalogue.
   *
   * The catalogue is live and models leave it. Counting capacity from the raw
   * `selectedIds` meant a departed model went on occupying a slot while having
   * no chip to remove it by: three stale ids could show no removable chips,
   * disable "Add model", and disable every replacement in the list, leaving the
   * picker stuck with nothing selectable and nothing to undo.
   */
  const selected = selectedIds
    .map((id) => models.find((model) => model.id === id))
    .filter((model): model is FreeModel => model !== undefined);

  const droppedCount = selectedIds.length - selected.length;
  const atCapacity = selected.length >= MAX_SELECTED_MODELS;

  const toggle = (id: string): void => {
    // Built from the surviving ids, so any that have left the catalogue are
    // dropped by the next interaction rather than lingering invisibly and being
    // sent to a model that is no longer there.
    const live = selected.map((model) => model.id);

    if (live.includes(id)) {
      onChange(live.filter((selectedId) => selectedId !== id));
      return;
    }
    if (live.length >= MAX_SELECTED_MODELS) return;
    onChange([...live, id]);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {selected.map((model) => (
        <span
          key={model.id}
          className="border-subtle bg-raised flex items-center gap-1.5 rounded-full border py-1 pr-1 pl-2.5 text-sm"
        >
          <span className="max-w-[14rem] truncate">{model.name}</span>
          <button
            type="button"
            onClick={() => toggle(model.id)}
            aria-label={`Remove ${model.name}`}
            className="hover:bg-page rounded-full p-0.5"
          >
            <X aria-hidden className="size-3.5" />
          </button>
        </span>
      ))}

      <Popover>
        {/* Base UI merges the trigger onto a given element through `render`.
            This build of shadcn is Base UI rather than Radix, so there is no
            `asChild` here. */}
        <PopoverTrigger
          render={<Button variant="outline" size="sm" disabled={atCapacity} />}
        >
          <Plus aria-hidden className="size-4" />
          Add model
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 p-0">
          <div className="border-subtle border-b px-3 py-2">
            <p className="text-sm">
              {selectedIds.length} of {MAX_SELECTED_MODELS} chosen
            </p>
            <p className="text-muted-ink text-xs">Largest context first.</p>
          </div>
          <ul className="max-h-72 overflow-y-auto py-1">
            {models.map((model) => {
              const isSelected = selectedIds.includes(model.id);
              // Full at three: the rest go genuinely disabled rather than
              // silently doing nothing when clicked.
              const blocked = !isSelected && atCapacity;
              return (
                <li key={model.id}>
                  {/* A plain toggle button with `aria-pressed`, not
                      `role="menuitemcheckbox"`. That role only means anything
                      inside a `menu` with arrow-key navigation, and claiming it
                      without implementing that promises a keyboard contract
                      this list does not honour. As buttons these are each a tab
                      stop and Space or Enter toggles them, which is behaviour
                      the browser already provides and screen readers already
                      announce. */}
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    disabled={blocked}
                    onClick={() => toggle(model.id)}
                    className="hover:bg-raised flex w-full items-center gap-2.5 px-3 py-2 text-left disabled:opacity-45"
                  >
                    <ModelBadge name={model.name} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{model.name}</span>
                      <span
                        className="text-muted-ink block text-xs"
                        title={formatExactContext(model.contextLength)}
                      >
                        {formatContext(model.contextLength)} context
                      </span>
                    </span>
                    {isSelected && <Check aria-hidden className="text-rust size-4" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </PopoverContent>
      </Popover>

      {atCapacity && (
        // Says why the button is dead. A greyed-out control with no reason is
        // the most common way an interface stops explaining itself.
        <p className="text-muted-ink text-xs">
          Three at a time. Remove one to swap it out.
        </p>
      )}

      {droppedCount > 0 && (
        // Their selection changed without them touching it, so say so rather
        // than letting a model quietly disappear from the row.
        <p className="text-muted-ink text-xs">
          {droppedCount === 1 ? "A model you" : `${droppedCount} models you`} had chosen{" "}
          {droppedCount === 1 ? "is" : "are"} no longer available.
        </p>
      )}
    </div>
  );
};
