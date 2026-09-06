# Scope: LLM Playground

Send one prompt, watch up to three AI models answer it at the same time, and vote for the best one. Over time those votes and the real per-call numbers, speed, tokens, cost, build an honest leaderboard of which model is actually worth using.

Build it in a thin, working slice first, one prompt actually reaching a model and coming back, before making any single part of it fuller. Then thicken it piece by piece. Before building anything, decide what you're doing and why in a few plain sentences, then build it, and if the plan turns out wrong once it's actually built, say so and fix the plan too, not just the code.

Whenever a "build it" style step actually gets underway, break it into its own short list of what's genuinely being done, and check each part off as it's finished, right in this file. That way this file can be opened fresh, in a brand new conversation, and it's obvious what's already done and what's still left, without anyone re-explaining the feature from scratch.

## Stack

Already decided, nothing open here: Next.js (App Router), TypeScript, Tailwind, shadcn for components (card, button, popover, loading skeleton, and whatever else the UI actually needs as it gets built), Prisma with Postgres, Clerk for auth, Arcjet in front of the endpoint, PostHog for analytics and observability.

## Sketches

There are rough hand-drawn sketches for the arena screen, the leaderboard, and the models page. Treat them as structure only, where things sit, what exists on the page, not as the final design or the actual colors, all of that is already decided elsewhere in this file. If something in a sketch genuinely contradicts what's written here, stop and ask which one actually wins rather than guessing.

## At a glance

| #   | Feature                                     | Phase      | Status      |
| --- | ------------------------------------------- | ---------- | ----------- |
| 1   | Connecting to a model                       | Foundation | 1a done; 1b: Arcjet + Prisma done, PostHog all but session replay, Clerk deferred to after feature 4 |
| 2   | Coding standards & tooling                  | Foundation | not started |
| 3   | Data model                                  | Foundation | not started |
| 4   | Design & look                               | Foundation | not started |
| 5   | Model picker                                | Slice 1    | not started |
| 6   | Send a prompt, parallel streams, and voting | Slice 1    | not started |
| 7   | App shell & thread history                  | Slice 2    | not started |
| 8   | Public thread visibility & sharing          | Slice 3    | not started |
| 9   | Leaderboard: global & personal              | Slice 4    | not started |

## Foundation

### 1. How the app actually connects to a model

The Next.js project itself gets created manually first, `create-next-app`, fast and simple, no reason to spend agent time or tokens on something that easy.

Two real decisions still open once that exists: how the app calls OpenRouter to get a model's answer, and how streaming three models back to the browser at once should actually work. This one's worth real thought: routing all three through one shared connection looks simpler, but if that one connection drops, all three answers die together, which breaks the whole point of one model failing never affecting the others. Decide both properly, then wire them, along with Prisma, Clerk, and Arcjet, into the project that already exists.

PostHog should be wired in from the start too, session replay and heatmaps turned on, and tied to the signed-in user once Clerk resolves, so events are attached to a real person, not left anonymous.

#### The approach, decided

**Calling OpenRouter.** The server talks to OpenRouter through the Vercel AI SDK's `streamText` with the OpenRouter provider, but the SDK stops at the server boundary. It absorbs the provider-side mess, reasoning deltas, usage chunks, the odd chunking free-tier models sometimes produce, without us owning an SSE parser we have no test runner to cover. What goes out to the browser is our own protocol, not the SDK's, because the per-call numbers and the error copy are the actual product here and they should not be threaded through someone else's data parts.

**Streaming topology.** One HTTP request per model, so up to three fully independent streams. Each gets its own `AbortController`, its own error state, its own lifecycle. A model that dies, times out, or gets rate-limited affects only its own card. Fanning out to three models inside one route and multiplexing tagged events back over a single connection is less client code, but it puts all three answers behind one dropped connection and one function-timeout budget, which contradicts feature 6's promise that each model streams and fails independently. Three concurrent connections is nothing, well under any browser limit.

**Wire format.** SSE from a Node-runtime Route Handler returning a `ReadableStream`, carrying a small typed event set: `delta` for text, `metrics` for the numbers, `done`, and `error`. The typed `error` event is the reason for a custom protocol rather than a raw text stream, a provider failure has to arrive as a plain human sentence the card can render with a retry, never as a thrown exception or raw provider text leaking through.

**Where the numbers come from.** Time-to-first-token is stamped on the server the moment the first content delta arrives, so it measures the model, not the browser. Total tokens and finish reason come from OpenRouter's usage chunk; tokens per second is derived from those two. Cost is a real measured `$0.0000` and gets shown as one.

**Runtime and environment.** Node runtime, not edge, because Prisma and the PostHog server SDK both need it. A single `env.ts` validates every required variable at import time and throws a named, readable error at startup; nothing else in the app reads `process.env` directly, so a missing key fails on boot instead of halfway through a stream.

**A correction to this plan.** This feature as originally written wires OpenRouter, Prisma, Clerk, Arcjet, and PostHog in one lump, while the top of this file insists on a thin working slice first. Those pull against each other, and four of the five need real third-party accounts that do not exist yet. So it splits:

- **1a, the thin slice.** `env.ts`, the OpenRouter client, the streaming route, and one throwaway proof page. Needs only an OpenRouter key, so it is not blocked on anything else.
- **1b, the rest of the wiring.** Prisma client and a verified connection, with the schema itself left to feature 3. Clerk. Arcjet installed and mounted on the stream route, with the rate-limit and bot rules left to feature 6 where they belong. PostHog with session replay and heatmaps, identifying against the Clerk user once it resolves.

**A risk to check, not assume.** Next 16 renamed `middleware.ts` to `proxy.ts`. Clerk's own official Next.js documentation is the reference for where `clerkMiddleware` goes now, and it gets read at build time rather than guessed from how it used to work.

#### 1a build checklist

- [x] Install `ai`, `@openrouter/ai-sdk-provider`, and `zod`
- [x] `lib/env.ts`, validating every required variable at import so a missing key fails on boot
- [x] The SSE event contract, one module both the server and the browser import
- [x] The OpenRouter call, mapped onto those events, with time-to-first-token, tokens, and cost measured for real
- [x] Provider failures turned into a plain human sentence before they ever leave the server
- [x] The streaming route handler
- [x] The browser-side reader for the event contract
- [x] A throwaway proof page, deliberately unstyled, deleted once feature 6 has a real arena
- [x] Typecheck, lint, build, and a real streamed answer confirmed by hand — all pass. Fail-fast on a missing key, the 400 path, and a provider failure arriving as a plain sentence were confirmed by `curl` earlier; the successful stream is now confirmed too, against `minimax/minimax-m3:free`, returning real deltas and real numbers (ttft 1665ms, 37 output tokens, 100.5 tok/s, cost `0`, finish reason `stop`). The proof page's default model was a stale id that no longer exists on OpenRouter and was corrected to a live free-tier one.

Two things surfaced while building 1a and are recorded here rather than worked around:

- **Cost contradicts itself between the two documents.** `CLAUDE.md` says cost will always read `$0.0000` and should be shown anyway, because it is a real measured number. Feature 6 below says no cost is shown, because it would always read zero. Both cannot hold. 1a measures and carries cost either way, reading OpenRouter's own reported figure rather than assuming zero, so whichever way this lands the number is honest. The display question is still open and belongs to feature 6.
- **Tokens per second needed a definition.** It divides output tokens by the time spent generating, so it excludes the wait for the first token. That wait is already reported on its own as time-to-first-token, and counting it in both places would make a slow-to-start model look slow to generate too.

- [x] Decide the approach
- [ ] Write the spec

#### 1b build checklist, Arcjet

Arcjet is the first piece of 1b to land. Clerk and PostHog are still open; Prisma is covered in its own checklist below.

- [x] `pnpm add @arcjet/next` (1.11.0). Node 24.19 clears the SDK's `>=22.21.0 <23 || >=24.5.0` baseline and Next 16 is a supported target, both checked before installing rather than after.
- [x] `ARCJET_KEY` added to `lib/env.ts`'s schema and to `.env.example`, so it fails on boot like every other variable instead of surfacing as a broken request later.
- [x] The key itself pulled from the real Arcjet account with the CLI's device flow, into `.env.local` (already covered by `.gitignore`'s `.env*`), never hardcoded. The `llm-playground` site already existed on the Personal team, so nothing new was created.
- [x] `lib/arcjet.ts`, one shared client. Route-specific rules get layered on with `aj.withRule(...)` when feature 6 needs them, because clones share the decision cache and a second `arcjet()` constructor would not.
- [x] `aj.protect(request)` called inside the chat route handler, after the body parses and before any model is called, so a blocked request never costs a provider call.
- [x] Denials mapped to a plain human sentence and a status, with Arcjet's own reason, rule id, and fingerprint kept on the server. `isErrored()` logs and allows: Arcjet failing open must not turn a security-check outage into an app outage.
- [x] Typecheck, lint, and build all pass. Verified by hand against a running dev server: a valid prompt still streams end to end, the malformed-body 400 still returns, and eleven suspicious requests in a row tripped Shield into a 403 carrying only the plain sentence. Both denials show up as `CONCLUSION_DENY` / `REASON_SHIELD` in the Arcjet console, so the decisions are genuinely reaching the platform and not being faked locally. Blanking `ARCJET_KEY` fails the boot with the named error.

Two things worth recording rather than leaving implicit:

- **Shield was not deferred, and the split above is corrected to say so.** 1b as originally written left *all* the rules, shield included, to feature 6. That was wrong once actually built. Shield is the always-on baseline against things like SQL injection, it needs no per-user identity to be meaningful, and it costs nothing to carry on every route, so holding it back would have meant mounting Arcjet and getting no protection from it. What genuinely belongs to feature 6 is the rate limit and bot detection, because the interesting version of both is keyed to a signed-in Clerk user and to a budget spanning all three models at once, and neither of those exists yet. Prompt-injection detection also waits for feature 6, since it is a rule about the prompt rather than about the connection.
- **Shield does not block on the first bad request, by design.** It scores suspicion across several requests before it denies, which is why ten attack-shaped calls returned 200 and only the eleventh returned 403. That is correct behaviour, not a misconfiguration, and it is written down here so a future check of one hand-crafted malicious request does not read a 200 as proof that protection is broken.

#### 1b build checklist, Prisma

Prisma is the second piece of 1b. Clerk and PostHog are still open. This lands the client and a verified connection only, the actual data model is feature 3 and is deliberately not designed here.

- [x] Pinned `prisma` and `@prisma/client` to `7.10.0` exactly, not `latest`. This is the fix for the failure that started this step: the Prisma plugin's install pulled `latest`, and `latest` on npm currently resolves to `8.0.0-rc.13`, which is not the ORM CLI at all but the new Prisma Developer Platform CLI. It has no `migrate` and no `generate` command, so `prisma migrate dev --name init` failed with `No command registered for 'migrate', did you mean 'migration'?`. Pinning is not fussiness here, an unpinned range on this package silently swaps one product for another.
- [x] Removed the `postinstall: "prisma skills sync || exit 0"` script. `skills` is an 8-only command; on 7 it fails on every single install and the `|| exit 0` swallows it. That is exactly the silent failure this project's rules forbid. The synced skills are already checked in under `.agents/`, so nothing was lost.
- [x] `@prisma/adapter-pg` and `pg`. Prisma 7 requires a driver adapter rather than connecting on its own. `DATABASE_URL` is a `postgres://pooled.db.prisma.io` URL, plain Postgres over TCP, so the pg adapter is the correct one, not Accelerate.
- [x] `pnpm-workspace.yaml` now allows builds for `prisma` and `@prisma/engines`. pnpm blocks postinstall scripts by default and those two need theirs to fetch the query engine binaries.
- [x] `prisma.config.ts` rewritten for 7. It loads `.env.local` explicitly, because the Prisma CLI reads `.env` and this project keeps real secrets in `.env.local`. Without that the CLI reports `DATABASE_URL` as missing even though the running app can see it.
- [x] The connection URL lives in `prisma.config.ts`, not in the schema. Prisma 7 removed `url` from the `datasource` block entirely and errors on it (`P1012`). The config entry serves only the CLI's migrate and introspect commands; the app itself reaches the database through the adapter in `lib/prisma.ts`.
- [x] `prisma/schema.prisma` with the `prisma-client` generator, emitting to `lib/generated/prisma`. The older `prisma-client-js` generator is legacy in 7 and writes into `node_modules`, which does not survive a pnpm store. The generated output is git-ignored and eslint-ignored, it is build output, regenerated by `pnpm exec prisma generate`.
- [x] `DATABASE_URL` added to `lib/env.ts`'s schema and to `.env.example`, so a missing database URL fails on boot like every other key.
- [x] `lib/prisma.ts`, one shared client built on the adapter, with the standard `globalThis` cache outside production. Without it Next's hot reload constructs a fresh client on every edit and opens another pool until the database refuses connections.
- [x] Typecheck, lint, and a real production build all pass. Verified by hand against a running dev server, not just read: `prisma migrate dev --name init` created and applied `20260906044432_init` against the live database, `prisma generate` produced the client, and a temporary route wrote a row, read it back, and deleted it, returning a real server-generated uuid and timestamp over `curl`. Blanking `DATABASE_URL` fails the boot with the named error.

Three things worth recording rather than leaving implicit:

- **The first migration creates a table that is meant to be deleted.** `ConnectionCheck` exists only to prove that migrations reach the live database and that writes come back. The alternative, a schema with no models, produces an empty migration and proves nothing. Feature 3 should drop this model and the `init` migration along with it. It is marked `TEMPORARY` in the schema so it cannot quietly become part of the real data model.
- **The verification route was temporary and is already gone.** `app/api/dev-db-check/route.ts` existed for the `curl` above and was deleted immediately after. It is recorded here so the passing check is traceable even though the code is not in the tree.
- **The 8 RC is a real fork in the road, not just a newer number.** Prisma 8 replaces `schema.prisma` and `migrate`/`generate` with a contract model driven by a TypeScript schema and `prisma db update` / `prisma migration plan`. Staying on 7 was a deliberate choice for stable docs and a matching tool ecosystem, not an oversight. The CLI will keep advertising the 8 upgrade on every command, and that notice should be ignored until 8 ships stable and someone decides to migrate on purpose.

#### 1b build checklist, Clerk

**Deliberately deferred until after feature 4, design & look.** Clerk ships visible sign-in and user-button UI, and building those screens before the palette and contrast rules exist would mean building them twice. Nothing else in 1b is blocked by this, and feature 4 does not depend on Clerk, so the order is safe. The one knock-on is that PostHog's identify step waits with it, because there is no user to identify until Clerk exists.

Not started. Nothing in the tree touches Clerk yet: `@clerk/nextjs` is not installed, there is no `proxy.ts`, and no source file imports or calls it. The only Clerk presence anywhere is prose in comments describing what feature 6 will eventually key its rate limit to.

- [ ] `pnpm add @clerk/nextjs`
- [ ] `clerkMiddleware` mounted in the right place for Next 16, read from Clerk's own official Next.js documentation rather than guessed. This is the risk already flagged above: Next 16 renamed `middleware.ts` to `proxy.ts`, and it must be confirmed against current docs, not from how it used to work.
- [ ] `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` added to `lib/env.ts`'s schema. Both keys are already sitting in `.env.local` and `.env.example`, but nothing validates or reads them, so today a missing or wrong Clerk key fails silently, which the project's fail-fast rule forbids.
- [ ] `<ClerkProvider>` in the root layout.
- [ ] Typecheck, lint, build, and a real signed-in session confirmed by hand.

#### 1b build checklist, PostHog

Nearly done. Env validation and heatmaps are finished; two items remain. Session replay is unblocked and can be picked up any time, but wants someone watching the PostHog dashboard to confirm a recording actually lands. Identify is blocked on Clerk, and so waits for feature 4.

- [x] `posthog-js` initialised in `instrumentation-client.ts`, with `capture_exceptions` on and debug in development only.
- [x] The `/ingest` reverse-proxy rewrites in `next.config.ts`, plus `skipTrailingSlashRedirect`, so ingestion survives ad blockers.
- [x] `lib/posthog-server.ts`, a singleton `posthog-node` client with `flushAt: 1` / `flushInterval: 0` so events actually send before a short-lived route handler tears down.
- [x] Real events firing from the chat route: `chat_request_received` and `chat_request_error`, the latter distinguishing an invalid body from an Arcjet denial.
- [ ] **Session replay confirmed on, and the localhost trap dealt with.** Replay is only implied by `defaults: "2026-01-30"`, never set explicitly. Worse, reading the installed `posthog-js` 1.422.5 bundle shows that same defaults date also sets `internal_or_test_user_hostname` to `/^(localhost|127\.0\.0\.1)$/` and calls `setInternalOrTestUser()` when it matches. So every dev session on localhost is flagged as an internal test user, which is the most likely reason the setup wizard's own report found no recordings in its 30-day probe. Set `disable_session_recording: false` explicitly, decide deliberately whether localhost should stay excluded, and only then confirm a real recording lands.
- [x] **Heatmaps on.** Confirmed by hand in the PostHog project settings, where the toggle is on. This was correctly a settings check and not a code change: the bundle resolves heatmaps as `capture_heatmaps`, falling back to `enable_heatmaps`, falling back to a value delivered by remote config, and both client flags are deliberately left unset so the project setting stays the single source of truth. Adding a client flag on top would only create a second place to disagree.
- [ ] **Identify against the Clerk user.** Every server event is hardcoded to `distinctId: "anonymous"` and there is no `identify()` call anywhere, so nothing is attached to a real person. Blocked on Clerk, and should land in the same step.
- [x] **`NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` and `NEXT_PUBLIC_POSTHOG_HOST` validated and in `.env.example`.** Both are now in `lib/env.ts`'s schema, the host as `z.url()` rather than a bare string so a typo'd host fails on boot instead of sending events nowhere. `lib/posthog-server.ts` no longer reads `process.env`, no longer returns `null`, and no longer logs a silent-miss warning: it exports a real `posthog` client, which deleted all three `if (posthog)` guards in the chat route. A `globalThis` cache matches `lib/prisma.ts`, so hot reload stops leaking a client per edit.
- [x] **A client-safe env module, and a `server-only` guard on the secret one.** Typecheck, lint, and a real production build all pass, and the fail-fast path was verified by hand rather than assumed: blanking the token and setting the host to `not-a-url` each fail the boot with the named variable. A real prompt still streams end to end and the malformed-body 400 still returns, both with no PostHog warning in the log.

Three things worth recording rather than leaving implicit:

- **`env.ts` could not simply grow the two variables, which is why there are now two env modules.** `NEXT_PUBLIC_*` values only reach the browser where the full `process.env.NEXT_PUBLIC_X` expression appears literally in the source; read through a validated object, a loop, or a spread, they are `undefined` at runtime. So `lib/env-client.ts` spells each key out by hand, while the server module keeps handing the whole of `process.env` to Zod. The two look inconsistent on purpose and the reason is commented in both.
- **`lib/env.ts` now imports `server-only`, and that guard was tested, not assumed.** The module holds `OPENROUTER_API_KEY`, `ARCJET_KEY`, and `DATABASE_URL`, and nothing previously stopped a client component importing it and inlining all three into the browser bundle. Importing it from a client component now fails the build, naming the import chain. Worth knowing for anyone who repeats the check: an *unused* import is tree-shaken and the build passes, which looks like the guard is broken. It only fires when the value is actually referenced.
- **`NEXT_PUBLIC_POSTHOG_HOST` is misnamed and was deliberately not renamed.** Only the server reads it; the browser posts to the `/ingest` rewrite and never touches it, so the `NEXT_PUBLIC_` prefix publishes a value that does not need publishing. Renaming means editing `.env.local`, which is not in the repo, so it is left alone and recorded here instead. Worth folding into the Clerk step, since that already touches env.
- **PostHog arrived out of order, and that is why it is uneven.** It was wired by PostHog's own setup wizard during 1a rather than built as a deliberate 1b step, which is why the client init and the `/ingest` proxy are solid while env validation and user identity were never done. The remaining boxes above are exactly the difference between what the wizard installed and what 1b asked for. The `posthog-self-driving-report.md` at the repo root is from that same wizard run; it records Session Replay, Error Tracking, and Support being enabled on the PostHog side, which is server-side project configuration and separate from the client flags above.

### 2. Coding standards & tooling

Write down the real conventions for this project once it actually exists, then install linting, formatting, and a pre-commit hook that actually enforces them.

- [ ] Decide the approach
- [ ] Install lint, format, and whatever else is needed, and write it up in a coding-standards doc

### 3. Data model

The core things every feature depends on: users tied to Clerk, threads, each model's own messages inside a thread, and votes. A vote should only ever be possible on a turn where two or more models actually answered.

- [ ] Decide the approach
- [ ] Build it

### 4. Design & look

A coffee or dark brown background, warm, not neutral gray or true black. One accent color, rust, used only for things you interact with, buttons, links, focus states, the win-rate bar, never as decoration. Because the background and the accent are both warm tones from the same family, the accent has to stay clearly brighter and more saturated than the background, enough that a button never blends into the page behind it, that's a real risk with two warm colors this close and worth checking by eye, not just by the numbers. Blue, indigo, and purple are never the accent, under any circumstance. Green is reserved only for marking a winner, red only for errors, never reused for anything else. Contrast should genuinely hold up in both light and dark mode, not just look fine at a glance.

- [ ] Decide the approach
- [ ] Build it

## Slice 1: Core arena loop

### 5. Model picker

An "Add model" popover pulling OpenRouter's live free-tier list, sorted by context window, capped at three models, defaulting to all three selected, with removable chips next to the prompt box. Also render that same catalog as a simple `/models` page, name, context window, and pricing for each one, so anyone can browse the full list without opening the picker.

- [ ] Decide the approach
- [ ] Build it

### 6. Send a prompt, parallel streams, and voting

The heart of the product. One prompt goes to every selected model at once, each streaming and failing independently, so one being slow or down never blocks the others. Each answer shows its own real time-to-first-token, tokens per second, and total tokens. No cost shown, every model here is free tier, so it would always read zero. A vote only exists once two or more models have answered, and picking one writes exactly one vote and marks that answer as the winner, while every answer stays visible the whole time. A follow-up continues each model's own separate conversation.

Arcjet sits in front of this endpoint before any model is ever called: rate limiting, bot protection, and a shield against prompt injection, plus a real limit on how much one person can use across all three models at once, not just a limit on the endpoint overall.

Every prompt sent, every answer finishing, and every vote cast should be tracked as a real PostHog event, so there's an honest funnel from prompt to answer to vote. A model failing should also be logged properly on the server, not just shown to the user and forgotten. Separately from that funnel, every actual model call should also be wrapped so PostHog captures its own real tokens, cost, and latency per call, that's PostHog's own LLM analytics, not the same thing as the funnel events or the numbers already shown on the response card.

- [ ] Decide the approach
- [ ] Build it

## Slice 2: App shell & thread history

### 7. App shell & thread history

The frame everything else sits inside: a top bar and sidebar that stay in place while the page scrolls, the thread's name, and each model's win record shown right there (shrinking down to a small dot and number if it gets crowded). The sidebar lists a signed-in user's own past threads so the tool actually feels usable across visits, not just in one sitting.

- [ ] Decide the approach
- [ ] Build it

## Slice 3: Public visibility & sharing

### 8. Public thread visibility & sharing

Anyone should be able to open a thread's link and see it, without an account, that's what actually makes it shareable. Only sending a prompt and voting need sign-in. A made-up or deleted thread just shows a plain not-found page either way. The thread's real owner sees everything everyone else sees, plus the ability to actually use it.

- [ ] Decide the approach
- [ ] Build it

## Slice 4: Leaderboard

### 9. Leaderboard: global & personal

Two leaderboards from the same votes, one for everyone, one just for the signed-in user. Each row's win rate is the big, bold number, in the accent color, with a small bar next to it, always written as "won 4 of 5," never a bare percentage or a made-up score. Smaller, quieter numbers underneath for average speed and time-to-first-token, each clearly labeled. No cost or "cheapest" stat, every model is free, so that number never means anything here. First place gets a subtle highlight, nobody else does.

- [ ] Decide the approach
- [ ] Build it

## Not doing right now

Kept here so the plan stays honest about what's deliberately left out.

- A "fastest" label on the leaderboard, tagging whichever model already has the best average speed, only for models with enough votes to mean anything. Nice to have, not required.
- Giving each model's own little icon a distinct look instead of plain gray. Nice to have, not required.
- Privacy policy and terms pages.
- Rich link previews when a thread gets shared somewhere.
- Any kind of admin or moderation page.
- A public API for the leaderboard data. Nobody's asked for this.
