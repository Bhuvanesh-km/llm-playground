import "server-only";

import { PostHog } from "posthog-node";

import { serverEnv } from "./env";

/**
 * One shared PostHog client for the whole server.
 *
 * `flushAt: 1` / `flushInterval: 0` send every event immediately, because a
 * Next route handler can be torn down the moment its response finishes and a
 * batched event would die with it.
 *
 * This returns a real client rather than `PostHog | null`. The token is
 * validated in `env.ts` and a missing one fails on boot, so there is no such
 * thing here as a run where analytics are quietly absent, and callers do not
 * have to guard every capture with a null check.
 */
const createPostHogClient = (): PostHog =>
  new PostHog(serverEnv.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN, {
    host: serverEnv.NEXT_PUBLIC_POSTHOG_HOST,
    flushAt: 1,
    flushInterval: 0,
  });

const globalForPostHog = globalThis as unknown as {
  posthog?: PostHog;
};

export const posthog: PostHog = globalForPostHog.posthog ?? createPostHogClient();

if (process.env.NODE_ENV !== "production") {
  globalForPostHog.posthog = posthog;
}
