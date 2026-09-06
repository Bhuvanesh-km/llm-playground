import { z } from "zod";

/**
 * The `NEXT_PUBLIC_*` variables the browser needs, validated at import time so
 * a missing one fails the moment the bundle loads rather than turning into
 * analytics that silently never arrive.
 *
 * This is a separate module from `env.ts` on purpose, for two reasons that both
 * bite if ignored. `env.ts` carries real secrets and is `server-only`, so it
 * can never be imported here. And Next only substitutes a `NEXT_PUBLIC_*` value
 * into the browser bundle where the full `process.env.NEXT_PUBLIC_X` expression
 * appears literally in the source: reading it through a variable, a loop, or a
 * spread of `process.env` yields `undefined` at runtime. That is why each key
 * below is spelled out by hand instead of the schema being handed `process.env`
 * the way the server one is.
 */
const clientEnvSchema = z.object({
  NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: z.string().min(1),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
});

type ClientEnv = Readonly<z.infer<typeof clientEnvSchema>>;

const formatMissing = (error: z.ZodError): string => {
  const names = error.issues.map((issue) => issue.path.join("."));
  return `Missing or invalid environment variable(s): ${names.join(", ")}. Add them to .env.local and restart the dev server.`;
};

const parseClientEnv = (): ClientEnv => {
  const result = clientEnvSchema.safeParse({
    NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  });
  if (!result.success) {
    throw new Error(formatMissing(result.error));
  }
  return Object.freeze(result.data);
};

export const clientEnv: ClientEnv = parseClientEnv();
