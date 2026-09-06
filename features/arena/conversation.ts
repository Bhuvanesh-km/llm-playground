import "server-only";

import { prisma } from "@/lib/prisma";

export type ConversationMessage = {
  readonly role: "user" | "assistant";
  readonly content: string;
};

/**
 * One model's own conversation, rebuilt on the server.
 *
 * The browser sends an answer id and nothing else. It used to send the whole
 * message array, which meant the text we spent tokens on was whatever the
 * client claimed the history was: the same misplaced trust that let an
 * unchecked model id reach a paid provider.
 *
 * "A follow-up continues each model's own separate conversation" falls out of
 * this naturally. Every turn contributes its prompt, and only this model's own
 * completed answers come back as assistant turns. A turn where this model
 * failed contributes the prompt but no reply, which is the honest record: the
 * model never said anything there, and inventing a placeholder would teach it
 * that it had.
 */
export const conversationFor = async (
  threadId: string,
  modelId: string,
  uptoTurnIndex: number,
): Promise<readonly ConversationMessage[]> => {
  const turns = await prisma.turn.findMany({
    where: { threadId, index: { lte: uptoTurnIndex } },
    orderBy: { index: "asc" },
    select: {
      prompt: true,
      answers: {
        where: { modelId, status: "COMPLETE" },
        select: { content: true },
      },
    },
  });

  return turns.flatMap((turn) => {
    const prompt: ConversationMessage = { role: "user", content: turn.prompt };
    const reply = turn.answers[0];
    return reply === undefined || reply.content.length === 0
      ? [prompt]
      : [prompt, { role: "assistant" as const, content: reply.content }];
  });
};
