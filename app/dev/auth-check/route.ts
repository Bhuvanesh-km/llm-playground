import { analyticsDistinctId, ensureCurrentUser } from "@/features/auth/current-user";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The only thing that currently exercises `ensureCurrentUser`.
 *
 * The lazy upsert fires when a signed-in write happens, and the two writes that
 * need it, creating a thread and casting a vote, are feature 6. Until then this
 * route is the only way to confirm that signing in really does produce a row.
 * Delete it once feature 6 exercises the same path for real.
 *
 * Signed out it must report no user, no row, and an anonymous analytics id.
 * Signed in it must report a real row, and hitting it twice must not create a
 * second one.
 */
export async function GET(): Promise<Response> {
  const user = await ensureCurrentUser();
  const distinctId = await analyticsDistinctId();
  const userCount = await prisma.user.count();
  return Response.json({ signedIn: user !== null, user, distinctId, userCount });
}
