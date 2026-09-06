import type { Metadata } from "next";

import { fetchFreeModels } from "@/features/models/catalog";
import {
  formatContext,
  formatExactContext,
  formatPricePerMillion,
} from "@/features/models/format";
import { ModelBadge } from "@/features/models/model-badge";
import { ThemeToggle } from "@/features/theme/theme-toggle";

export const metadata: Metadata = {
  title: "Models · LLM Arena",
  description: "Every free model this arena can send a prompt to.",
};

/**
 * The whole catalogue, browsable without opening the picker or signing in.
 *
 * Pricing is shown here and deliberately not on a response card. That settles a
 * contradiction recorded during feature 1a: CLAUDE.md says the measured cost is
 * real and should be shown, while feature 6 says a response card shows no cost.
 * Both hold once the surfaces are separated. Here the figure answers "what
 * would this model cost", which is a fact about the catalogue. On a card it
 * would be a column of zeroes next to the numbers that actually vary.
 */
export default async function ModelsPage() {
  const result = await fetchFreeModels();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-6 py-12">
      <header className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <h1 className="text-display text-3xl">Models</h1>
          <p className="text-muted-ink mt-2 max-w-[60ch]">
            Every model the arena can send a prompt to, largest context first. All of them
            are free, which is why every price below reads the same.
          </p>
        </div>
        <ThemeToggle />
      </header>

      {!result.ok ? (
        <div className="border-subtle flex flex-col items-start gap-3 rounded-lg border p-6">
          <p>{result.message}</p>
          {/* A plain link, because reloading the page is genuinely the retry:
              the catalogue is fetched on the server and cached there. */}
          <a href="/models" className="text-rust underline underline-offset-4">
            Try again
          </a>
        </div>
      ) : (
        <div className="border-subtle divide-subtle divide-y overflow-hidden rounded-lg border">
          <div className="text-muted-ink bg-raised grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-2 text-xs sm:grid-cols-[1fr_6rem_7rem]">
            <p>Model</p>
            <p className="text-right">Context</p>
            <p className="text-right">Per 1M tokens</p>
          </div>
          {result.models.map((model) => (
            <div
              key={model.id}
              className="bg-panel grid grid-cols-[1fr_auto_auto] items-center gap-4 px-4 py-3 sm:grid-cols-[1fr_6rem_7rem]"
            >
              <div className="flex min-w-0 items-center gap-3">
                <ModelBadge name={model.name} />
                <div className="min-w-0">
                  <p className="truncate">{model.name}</p>
                  <p className="text-muted-ink truncate text-xs">{model.id}</p>
                </div>
              </div>
              <p className="text-right" title={formatExactContext(model.contextLength)}>
                {formatContext(model.contextLength)}
              </p>
              <p className="text-muted-ink text-right text-sm">
                {formatPricePerMillion(model.promptPriceUsd)}
              </p>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
