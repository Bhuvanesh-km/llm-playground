import "server-only";

import { z } from "zod";

/**
 * Every environment variable the server needs, validated once at import time.
 * Nothing else in the app reads `process.env` directly: a missing or empty key
 * fails on boot with a readable message instead of halfway through a stream.
 *
 * The `server-only` import above is a build-time guard, not a convention. This
 * module holds real secrets, so a client component importing it must fail the
 * build rather than quietly inline `OPENROUTER_API_KEY` into the browser
 * bundle. Client-safe variables live in `env-client.ts` instead.
 */
const serverEnvSchema = z.object({
  OPENROUTER_API_KEY: z.string().min(1),
  ARCJET_KEY: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  // Read by the PostHog *server* client. Despite the prefix, nothing in the
  // browser uses either of these: the browser talks to the `/ingest` proxy.
  // See the note in env-client.ts.
  NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: z.string().min(1),
  NEXT_PUBLIC_POSTHOG_HOST: z.url(),
  CLERK_SECRET_KEY: z.string().min(1),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
});

type ServerEnv = Readonly<z.infer<typeof serverEnvSchema>>;

const formatMissing = (error: z.ZodError): string => {
  const names = error.issues.map((issue) => issue.path.join("."));
  return `Missing or invalid environment variable(s): ${names.join(", ")}. Add them to .env.local and restart the dev server.`;
};

const parseServerEnv = (source: NodeJS.ProcessEnv): ServerEnv => {
  const result = serverEnvSchema.safeParse(source);
  if (!result.success) {
    throw new Error(formatMissing(result.error));
  }
  return Object.freeze(result.data);
};

export const serverEnv: ServerEnv = parseServerEnv(process.env);
