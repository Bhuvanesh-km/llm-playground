import "server-only";

import { auth } from "@clerk/nextjs/server";

import { prisma } from "@/lib/prisma";

/**
 * The signed-in person's row in this app's own `User` table, created on demand.
 *
 * Deliberately a lazy upsert rather than a Clerk webhook. A webhook would need
 * a publicly reachable URL, which does not exist in development, plus signature
 * verification, all to keep a table in sync that nothing reads until a signed-in
 * write actually happens. The row is needed at exactly two moments, creating a
 * thread and casting a vote, and both go through here. If profile data ever has
 * to stay fresh, a webhook can be added later without touching the schema.
 *
 * Returns null when nobody is signed in. Reading a thread never needs a row, so
 * an anonymous visitor is an ordinary case here, not a failure.
 */
export const ensureCurrentUser = async (): Promise<{ id: string } | null> => {
  const { userId: clerkUserId } = await auth();
  if (clerkUserId === null) return null;

  // Upsert rather than find-then-create: two requests from the same person can
  // race, and the unique index on clerkUserId would make the loser throw.
  return prisma.user.upsert({
    where: { clerkUserId },
    create: { clerkUserId },
    update: {},
    select: { id: true },
  });
};

/**
 * Who to attribute an analytics event to. PostHog needs a stable id for every
 * event, so a signed-out visitor is explicitly "anonymous" rather than being
 * dropped: the prompt-to-answer-to-vote funnel has to count the people who
 * never signed in too, or it measures the wrong thing.
 */
export const analyticsDistinctId = async (): Promise<string> => {
  const { userId } = await auth();
  return userId ?? "anonymous";
};
