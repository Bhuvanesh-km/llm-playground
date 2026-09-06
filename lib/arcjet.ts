import arcjet, { shield } from "@arcjet/next";
import type { ArcjetDecision } from "@arcjet/next";

import { serverEnv } from "@/lib/env";

/**
 * The one Arcjet client for the whole app. Route-specific rules are layered on
 * with `aj.withRule(...)` rather than a second `arcjet()` call, because clones
 * share the decision cache and sibling constructors do not.
 *
 * Shield is the only rule here on purpose. It is the always-on baseline against
 * common attacks like SQL injection, and it costs nothing to carry everywhere.
 * The rate limit, bot detection, and prompt-injection rules that the chat
 * endpoint actually needs belong to feature 6, where the real per-person budget
 * across all three models gets designed against a signed-in Clerk user.
 *
 * `mode: "LIVE"` is not optional: an omitted mode is `DRY_RUN`, which logs a
 * match and lets the request through.
 */
export const aj = arcjet({
  key: serverEnv.ARCJET_KEY,
  rules: [shield({ mode: "LIVE" })],
});

type Denial = Readonly<{ status: number; message: string }>;

/**
 * A denial mapped to the one thing the browser is allowed to see: a plain
 * sentence and a status. Arcjet's own reason, rule id, and fingerprint stay on
 * the server. Only reasons that deserve a *different* status get their own
 * branch; shield, bot, and filter all land on the same 403 default, so spelling
 * them out separately would add noise and no behaviour.
 */
export const toDenial = (decision: ArcjetDecision): Denial => {
  if (decision.reason.isRateLimit()) {
    return {
      status: 429,
      message:
        "You're sending prompts faster than this app allows. Wait a moment, then try again.",
    };
  }

  if (decision.reason.isPromptInjection() || decision.reason.isSensitiveInfo()) {
    return {
      status: 400,
      message:
        "That prompt was turned away by this app's safety checks. Try rewording it.",
    };
  }

  return {
    status: 403,
    message: "This request was blocked before it reached a model. Try again.",
  };
};
