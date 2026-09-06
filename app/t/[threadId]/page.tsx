import { notFound } from "next/navigation";

import { ensureCurrentUser } from "@/features/auth/current-user";
import { PromptComposer } from "@/features/arena/prompt-composer";
import { ThreadView, type ThreadTurn } from "@/features/arena/thread-view";
import { fetchFreeModels } from "@/features/models/catalog";
import { permanentlyRefusedModelIds } from "@/features/models/availability";
import { ThemeToggle } from "@/features/theme/theme-toggle";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * One thread.
 *
 * Readable by anyone holding the link, which is what makes a thread shareable;
 * only its owner gets a prompt box. Feature 8 formalises that, but building the
 * page as owner-gated from the start avoids a rewrite when it lands.
 */
export default async function ThreadPage({ params }: PageProps<"/t/[threadId]">) {
  const { threadId } = await params;
  const [user, catalogue, refused] = await Promise.all([
    ensureCurrentUser(),
    fetchFreeModels(),
    permanentlyRefusedModelIds(),
  ]);

  const thread = await prisma.thread.findUnique({
    where: { id: threadId },
    select: {
      id: true,
      title: true,
      ownerId: true,
      turns: {
        orderBy: { index: "asc" },
        select: {
          id: true,
          prompt: true,
          answers: {
            orderBy: { modelId: "asc" },
            select: {
              id: true,
              modelId: true,
              modelName: true,
              status: true,
              content: true,
              errorMessage: true,
              ttftMs: true,
              tokensPerSecond: true,
              totalTokens: true,
            },
          },
        },
      },
    },
  });

  if (thread === null) notFound();

  const isOwner = user !== null && user.id === thread.ownerId;
  const turns: readonly ThreadTurn[] = thread.turns;
  const lastTurn = turns.at(-1);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-display min-w-0 truncate text-xl">{thread.title}</h1>
        <ThemeToggle />
      </header>

      <ThreadView turns={turns} />

      {isOwner && catalogue.ok && (
        <PromptComposer
          models={catalogue.models}
          threadId={thread.id}
          // A follow-up keeps whoever answered last, so continuing a
          // conversation does not silently change who is in it.
          initialSelection={lastTurn?.answers.map((answer) => answer.modelId)}
          unavailableModelIds={[...refused]}
          canSend
        />
      )}
    </main>
  );
}
