import { after } from "next/server";

import { analyticsIdentity, type AnalyticsIdentity } from "@/features/auth/current-user";

import { aj, toDenial } from "@/lib/arcjet";
import { streamModelAnswer } from "@/features/chat/openrouter";
import { chatRequestSchema } from "@/features/chat/request";
import { isModelAllowed } from "@/features/models/catalog";
import { serverSentEventHeaders, toServerSentEventStream } from "@/features/chat/sse";
import { posthog } from "@/lib/posthog-server";

// Prisma and the PostHog server SDK both need Node, and a streamed answer must
// never be cached or prerendered.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Analytics is never on the critical path. `after` hands the flush to the
 * runtime to finish once the response is on its way, so slow or unreachable
 * PostHog ingestion cannot add latency to a denial, a validation failure, or
 * the wait for the first token.
 */
const captureRequestError = (identity: AnalyticsIdentity, reason: string): void => {
  posthog.capture({
    distinctId: identity.distinctId,
    event: "chat_request_error",
    properties: {
      reason,
      $process_person_profile: identity.processPersonProfile,
    },
  });
  after(() => posthog.flush());
};

/**
 * One request, one model. The arena fires one of these per selected model so
 * each answer streams and fails entirely on its own.
 */
export async function POST(request: Request): Promise<Response> {
  // Resolved once, up front, so every event this request emits is attributed to
  // the same person. Signed-out visitors are counted too, keyed by the id
  // posthog-js already put in its own cookie so they stay distinct from each
  // other and line up with their own browser events.
  const identity = await analyticsIdentity();

  // `Request.json()` is typed `any`. This body is untrusted input and the very
  // next line hands it to Zod, so it is narrowed to `unknown` here rather than
  // letting `any` leak into the handler.
  const body: unknown = await request.json().catch(() => null);
  const parsed = chatRequestSchema.safeParse(body);

  if (!parsed.success) {
    captureRequestError(identity, "invalid_request");
    return Response.json(
      { message: "That request didn't look right. Try sending the prompt again." },
      { status: 400 },
    );
  }

  // The model has to be one from this app's own free catalogue before anything
  // reaches OpenRouter. The provider call uses the server's API key, so without
  // this an unauthenticated caller could post the id of any paid model and have
  // it billed here. A non-empty string is not a permission.
  const allowed = await isModelAllowed(parsed.data.modelId);
  if (!allowed.allowed) {
    captureRequestError(identity, "model_not_allowed");
    return Response.json({ message: allowed.message }, { status: 400 });
  }

  // Arcjet runs after the body parses and before any model is called, so a
  // blocked request never costs a provider call. It is deliberately here in the
  // handler and not in `proxy.ts`: middleware would also fire on static assets,
  // and different routes need different rules.
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

  posthog.capture({
    distinctId: identity.distinctId,
    event: "chat_request_received",
    properties: {
      model_id: parsed.data.modelId,
      message_count: parsed.data.messages.length,
      $process_person_profile: identity.processPersonProfile,
    },
  });
  after(() => posthog.flush());

  const events = streamModelAnswer(parsed.data, request.signal);

  return new Response(toServerSentEventStream(events), {
    headers: serverSentEventHeaders,
  });
}
