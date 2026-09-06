import { after } from "next/server";

import { findRunnableAnswer, runAnswer } from "@/features/arena/answer-runner";
import { analyticsIdentity, type AnalyticsIdentity } from "@/features/auth/current-user";
import { chatRequestSchema } from "@/features/chat/request";
import { serverSentEventHeaders, toServerSentEventStream } from "@/features/chat/sse";
import { ensureCurrentUser } from "@/features/auth/current-user";
import { aj, toDenial } from "@/lib/arcjet";
import { posthog } from "@/lib/posthog-server";

// Prisma and the PostHog server SDK both need Node, and a streamed answer must
// never be cached or prerendered.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Analytics is never on the critical path. `after` hands the flush to the
 * runtime once the response is already on its way, so a slow ingestion round
 * trip is not charged to time-to-first-token.
 */
const captureRequestError = (identity: AnalyticsIdentity, reason: string): void => {
  posthog.capture({
    distinctId: identity.distinctId,
    event: "chat_request_error",
    properties: { reason, $process_person_profile: identity.processPersonProfile },
  });
  after(() => posthog.flush());
};

/**
 * Runs one answer that already exists.
 *
 * The browser sends an answer id and nothing else. Which model runs, and what
 * conversation it is shown, are both decided here from rows the server wrote
 * when the prompt was sent. Nothing a caller can type reaches the provider.
 */
export async function POST(request: Request): Promise<Response> {
  const identity = await analyticsIdentity();

  const body: unknown = await request.json().catch(() => null);
  const parsed = chatRequestSchema.safeParse(body);

  if (!parsed.success) {
    captureRequestError(identity, "invalid_request");
    return Response.json(
      { message: "That request didn't look right. Try sending the prompt again." },
      { status: 400 },
    );
  }

  const user = await ensureCurrentUser();
  if (user === null) {
    captureRequestError(identity, "signed_out");
    return Response.json({ message: "Sign in to send a prompt." }, { status: 401 });
  }

  // Scoped to this person's own threads, so an answer id is not a bearer token
  // for driving somebody else's row and spending our provider budget on it.
  const answer = await findRunnableAnswer(parsed.data.answerId, user.id);
  if (answer === null) {
    captureRequestError(identity, "answer_not_found");
    return Response.json({ message: "That answer could not be found." }, { status: 404 });
  }

  // Arcjet runs before any model is called, so a blocked request never costs a
  // provider call. Deliberately here in the handler and not in `proxy.ts`:
  // middleware would also fire on static assets, and different routes need
  // different rules. The real per-person budget across all three models is
  // feature 6c.
  const decision = await aj.protect(request);

  if (decision.isDenied()) {
    const denial = toDenial(decision);
    captureRequestError(identity, "blocked");
    return Response.json({ message: denial.message }, { status: denial.status });
  }

  if (decision.isErrored()) {
    // Arcjet failed open: the rules could not be evaluated, so the request is
    // allowed through rather than a security check outage becoming an outage.
    console.error("Arcjet decision errored, allowing request:", decision.reason);
  }

  return new Response(toServerSentEventStream(runAnswer(answer, request.signal)), {
    headers: serverSentEventHeaders,
  });
}
