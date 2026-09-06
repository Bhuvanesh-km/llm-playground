"use client";

import { useState } from "react";

import { defaultSelection, type FreeModel } from "./catalog";
import { ModelPicker } from "./model-picker";

/**
 * Somewhere to actually exercise the picker until feature 6 gives it a home.
 * The arena owns the selection for real; this stands in for that owner so the
 * component can be built and checked as a controlled one from the start,
 * rather than growing its own state and having it taken away later.
 */
export const ModelPickerHarness = ({
  models,
}: {
  readonly models: readonly FreeModel[];
}) => {
  const [selectedIds, setSelectedIds] = useState<readonly string[]>(() =>
    defaultSelection(models),
  );

  return (
    <div className="flex flex-col gap-3">
      <ModelPicker models={models} selectedIds={selectedIds} onChange={setSelectedIds} />
      <p className="text-muted-ink text-xs">
        Selected: {selectedIds.length === 0 ? "none" : selectedIds.join(", ")}
      </p>
    </div>
  );
};
