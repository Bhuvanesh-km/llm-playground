import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/features/theme/theme-toggle";

/**
 * A holding page, on the real palette. The app shell, sidebar and thread list
 * are feature 7; this exists so the root route is not still the framework's
 * starter markup, which used a neutral grey and a true black and so contradicted
 * the design on the one point the brief is most specific about.
 */
export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-8 px-6 py-16">
      <div className="flex items-start justify-between gap-6">
        <p className="text-display text-xl">LLM Arena</p>
        <ThemeToggle />
      </div>

      <div className="flex flex-col gap-4">
        <h1 className="text-display text-4xl text-balance">
          Three models, one prompt, an honest record
        </h1>
        <p className="text-muted-ink max-w-[60ch] text-lg">
          Send a prompt to up to three models at once and watch them answer side by side.
          Every answer carries its own measured speed and token count, and the model you
          pick is the one that wins.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button disabled>Open the arena</Button>
        <Link href="/dev/design" className="text-rust underline underline-offset-4">
          Design reference
        </Link>
      </div>
      <p className="text-muted-ink text-sm">The arena arrives with feature 6.</p>
    </main>
  );
}
