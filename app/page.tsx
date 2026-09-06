import { Show, SignInButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { PromptComposer } from "@/features/arena/prompt-composer";
import { ensureCurrentUser } from "@/features/auth/current-user";
import { fetchFreeModels } from "@/features/models/catalog";
import { ThemeToggle } from "@/features/theme/theme-toggle";

export const dynamic = "force-dynamic";

/**
 * Where a thread starts.
 *
 * No thread row is written until a prompt is actually sent, so opening the page
 * and thinking better of it leaves nothing behind. The composer redirects to
 * the new thread once the rows exist.
 */
export default async function HomePage() {
  const [user, catalogue] = await Promise.all([ensureCurrentUser(), fetchFreeModels()]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-8 px-6 py-12">
      <div className="flex items-start justify-between gap-6">
        <p className="text-display text-xl">LLM Arena</p>
        <div className="flex items-center gap-3">
          <Link href="/models" className="text-rust text-sm underline underline-offset-4">
            Models
          </Link>
          <ThemeToggle />
          <Show when="signed-out">
            <SignInButton mode="modal">
              <Button variant="outline">Sign in</Button>
            </SignInButton>
          </Show>
          <Show when="signed-in">
            <UserButton />
          </Show>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h1 className="text-display text-4xl text-balance">
          Three models, one prompt, an honest record
        </h1>
        <p className="text-muted-ink max-w-[60ch] text-lg">
          Send a prompt to up to three models at once and watch them answer side by side.
          Every answer carries its own measured speed and token count.
        </p>
      </div>

      {catalogue.ok ? (
        <PromptComposer
          models={catalogue.models}
          threadId={null}
          canSend={user !== null}
        />
      ) : (
        <p className="text-danger">{catalogue.message}</p>
      )}
    </main>
  );
}
