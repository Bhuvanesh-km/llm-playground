import posthog from "posthog-js";

import { clientEnv } from "@/lib/env-client";

posthog.init(clientEnv.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN, {
  // The browser posts to this app's own `/ingest` rewrite rather than straight
  // to PostHog, so an ad blocker cannot drop the requests. That is why the
  // client never needs NEXT_PUBLIC_POSTHOG_HOST; only the server does.
  api_host: "/ingest",
  ui_host: "https://us.posthog.com",
  defaults: "2026-01-30",
  // Enables capturing unhandled exceptions via Error Tracking
  capture_exceptions: true,
  debug: process.env.NODE_ENV === "development",
});

// IMPORTANT: Never combine this approach with other client-side PostHog initialization
// approaches, especially components like a PostHogProvider.
// instrumentation-client.ts is the correct solution for initializing client-side
// PostHog in Next.js 15.3+ apps.
