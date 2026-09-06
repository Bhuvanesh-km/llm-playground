import "server-only";

import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";

import { serverEnv } from "@/lib/env";
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

export type AnalyticsIdentity = {
  readonly distinctId: string;
  /**
   * False tells PostHog to record the event without creating or updating a
   * person profile. Used only when there is genuinely no way to tell one
   * visitor from another, so the event still counts in the funnel but does not
   * invent a person.
   */
  readonly processPersonProfile: boolean;
};

/**
 * posthog-js keeps its own device id in a cookie named for the project token.
 * Reading it lets a server event carry the very same id the browser is already
 * using, which is the only way an anonymous visitor's client and server events
 * end up on one timeline.
 */
const posthogCookieDistinctId = async (): Promise<string | null> => {
  const jar = await cookies();
  const raw = jar.get(`ph_${serverEnv.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN}_posthog`)?.value;
  if (raw === undefined) return null;

  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(raw));
    if (typeof parsed !== "object" || parsed === null) return null;
    const id = (parsed as { distinct_id?: unknown }).distinct_id;
    return typeof id === "string" && id.length > 0 ? id : null;
  } catch {
    // A malformed cookie is not worth failing a request over. Fall through to
    // an un-profiled event rather than guessing at an identity.
    return null;
  }
};

/**
 * Who to attribute a server-side analytics event to.
 *
 * An earlier version returned the literal string "anonymous" for everyone who
 * was not signed in. That merged every signed-out visitor into a single PostHog
 * person, so the funnel counted one impossibly busy user instead of many real
 * ones, and none of it joined up with what those same browsers were reporting
 * under their own ids.
 *
 * The order matters. A signed-in person is keyed by their Clerk id, which is
 * also what the browser calls `identify()` with, so both halves agree. A
 * signed-out visitor is keyed by the id posthog-js already put in its cookie,
 * which keeps visitors apart and correlates with their client events. Only when
 * neither exists, a first request before the browser SDK has written anything,
 * does the event get a throwaway id and skip person processing entirely.
 */
export const analyticsIdentity = async (): Promise<AnalyticsIdentity> => {
  const { userId } = await auth();
  if (userId !== null) {
    return { distinctId: userId, processPersonProfile: true };
  }

  const cookieId = await posthogCookieDistinctId();
  if (cookieId !== null) {
    return { distinctId: cookieId, processPersonProfile: true };
  }

  return { distinctId: crypto.randomUUID(), processPersonProfile: false };
};
