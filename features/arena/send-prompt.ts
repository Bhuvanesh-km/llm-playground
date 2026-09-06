"use server";

import { redirect } from "next/navigation";

import { ensureCurrentUser } from "@/features/auth/current-user";
import { MAX_SELECTED_MODELS, resolveFreeModels } from "@/features/models/catalog";
import { prisma } from "@/lib/prisma";

export type SendPromptResult = { readonly error: string };

/** A thread needs a name before anyone has named it, so the prompt provides one. */
const titleFrom = (prompt: string): string => {
  const firstLine = prompt.trim().split("\n")[0] ?? prompt.trim();
  return firstLine.length > 60 ? `${firstLine.slice(0, 57)}…` : firstLine;
};

/**
 * Starts a turn: the rows exist before a single token is streamed.
 *
 * The server creates the thread, the turn and one answer per model, and the
 * browser is then only allowed to say "stream answer X". Doing it the other way
 * round, letting the client report what came back, would mean an answer is
 * whatever the browser claims it is, and would lose the whole reply if someone
 * closed the tab halfway through.
 *
 * Everything is written in one transaction. A turn that exists with no answers,
 * or answers spread across two half-written turns, is a state nothing else in
 * the app knows how to read.
 */
export const sendPrompt = async (input: {
  readonly threadId: string | null;
  readonly prompt: string;
  readonly modelIds: readonly string[];
}): Promise<SendPromptResult> => {
  const user = await ensureCurrentUser();
  if (user === null) {
    return { error: "Sign in to send a prompt." };
  }

  const prompt = input.prompt.trim();
  if (prompt.length === 0) {
    return { error: "Write a prompt first." };
  }

  const modelIds = [...new Set(input.modelIds)];
  if (modelIds.length === 0) {
    return { error: "Choose at least one model." };
  }
  if (modelIds.length > MAX_SELECTED_MODELS) {
    return { error: `Choose no more than ${MAX_SELECTED_MODELS} models.` };
  }

  // The same gate the streaming route applies, checked here too so a
  // disallowed model is refused before any row is written rather than
  // producing a turn whose answers can never stream. It also hands back the
  // catalogue entries, so the name snapshotted below is a real one.
  const resolved = await resolveFreeModels(modelIds);
  if (!resolved.ok) {
    return { error: resolved.message };
  }

  const threadId = await prisma.$transaction(async (tx) => {
    const thread =
      input.threadId === null
        ? await tx.thread.create({
            data: { ownerId: user.id, title: titleFrom(prompt) },
          })
        : // Scoped by ownerId, so a thread id belonging to somebody else simply
          // does not resolve rather than being appended to.
          await tx.thread.findFirst({
            where: { id: input.threadId, ownerId: user.id },
            select: { id: true },
          });

    if (thread === null) return null;

    const lastTurn = await tx.turn.findFirst({
      where: { threadId: thread.id },
      orderBy: { index: "desc" },
      select: { index: true },
    });

    const turn = await tx.turn.create({
      data: {
        threadId: thread.id,
        prompt,
        index: lastTurn === null ? 0 : lastTurn.index + 1,
      },
    });

    await tx.answer.createMany({
      data: resolved.models.map((model) => ({
        turnId: turn.id,
        modelId: model.id,
        // A snapshot, so a model that later leaves the catalogue can still be
        // named on this thread and on the leaderboard.
        modelName: model.name,
        status: "STREAMING" as const,
      })),
    });

    await tx.thread.update({
      where: { id: thread.id },
      data: { updatedAt: new Date() },
    });

    return thread.id;
  });

  if (threadId === null) {
    return { error: "That thread could not be found." };
  }

  redirect(`/t/${threadId}`);
};
