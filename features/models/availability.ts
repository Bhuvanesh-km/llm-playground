import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * Models whose most recent attempt was a refusal this app cannot argue with.
 *
 * Looks at the latest answer per model rather than any failure in a window, so
 * this heals on its own: the moment a model that was gated answers once, it is
 * back in the defaults. A window would keep punishing a model for a bad
 * afternoon long after it recovered.
 *
 * Only ever used to choose defaults. Every model stays selectable by hand,
 * because a list that silently hides options is worse than one that ranks them,
 * and hiding is also how a recovered model would never get the one call it
 * needs to prove itself.
 */
export const permanentlyRefusedModelIds = async (): Promise<ReadonlySet<string>> => {
  const rows = await prisma.$queryRaw<readonly { modelId: string }[]>`
    SELECT DISTINCT ON ("modelId") "modelId", "failureKind"
    FROM "Answer"
    ORDER BY "modelId", "createdAt" DESC
  `.then((all) =>
    all.filter(
      (row) => (row as { failureKind?: string }).failureKind === "PERMANENT_REFUSAL",
    ),
  );

  return new Set(rows.map((row) => row.modelId));
};
