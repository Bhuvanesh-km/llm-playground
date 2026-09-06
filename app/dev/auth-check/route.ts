import { analyticsIdentity, ensureCurrentUser } from "@/features/auth/current-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The only thing that currently exercises `ensureCurrentUser`.
 *
 * The lazy upsert fires when a signed-in write happens, and the two writes that
 * need it, creating a thread and casting a vote, are feature 6. Until then this
 * is the only way to confirm that signing in really does produce a row. Delete
 * it once feature 6 exercises the same path for real.
 *
 * Development only, and that guard is not a formality. This route writes to the
 * database on a GET and reports back, so shipped as-is it would let any caller
 * probe the deployment: an earlier version also returned the total number of
 * registered users, which is nobody's business but ours. It now reports only
 * whether the caller's own row exists, never a count and never another person's
 * data, and outside development it does not exist at all.
 */
export async function GET(): Promise<Response> {
  if (process.env.NODE_ENV === "production") {
    return new Response("Not found", { status: 404 });
  }

  const user = await ensureCurrentUser();
  const identity = await analyticsIdentity();

  return Response.json({
    signedIn: user !== null,
    // The caller's own row id, so a second request can be checked against the
    // first to prove the upsert does not duplicate.
    userId: user?.id ?? null,
    distinctId: identity.distinctId,
    processPersonProfile: identity.processPersonProfile,
  });
}
