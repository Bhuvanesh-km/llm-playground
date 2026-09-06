import { Button } from "@/components/ui/button";
import { fetchFreeModels } from "@/features/models/catalog";
import { ModelPickerHarness } from "@/features/models/model-picker-harness";
import { ThemeToggle } from "@/features/theme/theme-toggle";

/**
 * The design system on one page: every token, the type scale, the states, and
 * the one structure this product actually turns on. It exists so the palette
 * can be judged by eye in both themes, which the brief explicitly asks for and
 * which no contrast number can settle on its own.
 *
 * A dev route rather than a real screen. The arena, leaderboard and models
 * pages are features 5 to 9.
 */

const SWATCHES = [
  { name: "page", className: "bg-page", note: "the ground" },
  { name: "panel", className: "bg-panel", note: "lanes, sidebar" },
  { name: "raised", className: "bg-raised", note: "hover, recessed" },
  { name: "subtle", className: "bg-subtle", note: "hairlines" },
  { name: "strong", className: "bg-strong", note: "emphasis rules" },
  { name: "rust", className: "bg-rust", note: "interactive only" },
  { name: "winner", className: "bg-winner", note: "winner only" },
  { name: "danger", className: "bg-danger", note: "errors only" },
] as const;

const LANES = [
  { model: "Nemotron 3 Ultra", ttft: "1,186", tps: "57", won: false },
  { model: "Ling 3.0 Flash", ttft: "842", tps: "71", won: true },
  { model: "MiniMax M3", ttft: "1,402", tps: "44", won: false },
] as const;

const Section = ({
  title,
  children,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
}) => (
  <section className="border-subtle border-t pt-8">
    <h2 className="text-muted-ink mb-5 text-sm font-medium">{title}</h2>
    {children}
  </section>
);

export default async function DesignReferencePage() {
  const catalogue = await fetchFreeModels();

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-12 px-6 py-12">
      <header className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <h1 className="text-display text-3xl">LLM Arena</h1>
          <p className="text-muted-ink mt-2 max-w-[60ch] text-balance">
            Three models answer the same prompt. The numbers are measured, not estimated,
            and the record is built from real votes.
          </p>
        </div>
        <ThemeToggle />
      </header>

      <Section title="Palette">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {SWATCHES.map(({ name, className, note }) => (
            <div key={name}>
              <div className={`${className} border-subtle h-14 rounded-lg border`} />
              <p className="mt-2 text-sm">{name}</p>
              <p className="text-muted-ink text-xs">{note}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Type">
        <div className="flex flex-col gap-3">
          <p className="text-display text-4xl">Won 507 of 700</p>
          <p className="text-2xl">Send one prompt, watch three models answer</p>
          <p className="max-w-[68ch]">
            Body text sits at a comfortable measure. Archivo carries the whole interface
            at one width, and widens on its own axis only for the wordmark and the
            win-rate figure.
          </p>
          <p className="text-muted-ink text-sm">
            Muted text, for the quieter numbers underneath a result.
          </p>
        </div>
      </Section>

      <Section title="Controls">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Send prompt</Button>
          <Button variant="secondary">Add model</Button>
          <Button variant="outline">Cancel</Button>
          <Button variant="ghost">Dismiss</Button>
          <Button disabled>Sending</Button>
          <a href="#palette" className="text-rust underline underline-offset-4">
            A link
          </a>
        </div>
        <p className="text-muted-ink mt-4 text-sm">
          Tab through these. Every control takes a visible rust focus ring, and the toggle
          above is one tab stop with arrow-key movement.
        </p>
      </Section>

      <Section title="Model picker">
        {catalogue.ok ? (
          <ModelPickerHarness models={catalogue.models} />
        ) : (
          <p className="text-danger text-sm">{catalogue.message}</p>
        )}
      </Section>

      <Section title="Lanes, the one structure this product turns on">
        {/* On a narrow screen the lanes scroll sideways rather than stacking.
            Stacking would put each model's numbers on its own row and destroy
            the shared baseline, which is the entire point of this layout; you
            cannot compare three values you cannot see at once. Scrolling keeps
            the comparison and costs a swipe. The scroll is inside this
            container, so the page body never scrolls horizontally. */}
        <div className="border-subtle overflow-x-auto rounded-lg border">
          <div className="grid min-w-[36rem] grid-cols-3 divide-x divide-[var(--border-subtle)]">
            {LANES.map(({ model, won }) => (
              <div key={model} className="bg-panel p-4">
                <div className="flex items-center gap-2">
                  {won && (
                    <span
                      aria-hidden
                      className="bg-winner h-4 w-1 shrink-0 rounded-full"
                    />
                  )}
                  <p className="truncate text-sm font-medium">{model}</p>
                </div>
                <p className="text-muted-ink mt-3 text-sm">
                  A streamed answer arrives here, one lane per model.
                  {won && <span className="sr-only"> This answer won.</span>}
                </p>
              </div>
            ))}
          </div>
          {/* The shared baseline. Three separate cards would put these numbers
              on three different lines and defeat the comparison entirely. */}
          <dl className="bg-raised border-subtle grid min-w-[36rem] grid-cols-3 divide-x divide-[var(--border-subtle)] border-t">
            {LANES.map(({ model, ttft, tps }) => (
              <div
                key={model}
                className="flex flex-wrap justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm"
              >
                <div>
                  <dt className="text-muted-ink text-xs">to first token</dt>
                  <dd>{ttft} ms</dd>
                </div>
                <div className="text-right">
                  <dt className="text-muted-ink text-xs">tokens/sec</dt>
                  <dd>{tps}</dd>
                </div>
              </div>
            ))}
          </dl>
        </div>
      </Section>

      <Section title="Win rate, and an error">
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-4">
            <p className="text-display text-rust text-3xl">71%</p>
            <div>
              <p className="text-sm">won 507 of 700</p>
              <div
                className="bg-raised mt-1 h-2 w-48 overflow-hidden rounded-full"
                role="img"
                aria-label="Won 507 of 700 turns"
              >
                <div className="bg-rust h-full" style={{ width: "71%" }} />
              </div>
            </div>
          </div>
          <p className="text-danger text-sm" role="status">
            That model is busy and turned this request away. Give it a moment.
          </p>
        </div>
      </Section>
    </main>
  );
}
