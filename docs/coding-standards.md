# Coding standards

The conventions this project actually follows, and which tool enforces each one.

The short version: **`pnpm check` is the contract.** It runs the formatter, the
linter, and the typechecker, it is exactly what the pre-commit hook enforces,
and if it passes the code is acceptable. When something fails, `pnpm fix`
repairs everything repairable and reports the rest.

## The tools, and why each one is here

| Tool                | Owns                            | Run by                    |
| ------------------- | ------------------------------- | ------------------------- |
| Prettier            | All formatting, no exceptions   | `pnpm format`, `pnpm fix` |
| ESLint              | Correctness and the style rules | `pnpm lint`, `pnpm fix`   |
| `tsc --noEmit`      | Types                           | `pnpm typecheck`          |
| husky + lint-staged | Making the above unavoidable    | `git commit`              |

**Prettier owns formatting outright**, at `printWidth: 90`. That number is not
arbitrary: it is where this codebase already sat, so adopting Prettier
reformatted five files instead of all of them. `eslint-config-prettier` is
loaded last in the ESLint config and switches off every rule that merely
concerns layout, because when two tools both believe they own formatting a file
can end up unable to satisfy either.

Prettier is deliberately **not** run as an ESLint rule. That is slower, and it
turns a misplaced space into a lint error sitting alongside real bugs, which
trains people to skim past lint output.

**ESLint is `eslint-config-next` plus a type-aware layer.** The Next config
alone brings 86 rules and not one of them can see types, which left the failure
this project is most exposed to completely uncaught: a dropped `await`. The
server awaits `posthog.flush()` before a route handler tears down and drives
model answers through async generators, so a forgotten await does not throw. It
silently loses an event or truncates an answer. `no-floating-promises` catches
it, and only a type-aware rule can.

Turning that layer on found four real defects on its first run, including an
`any` leaking out of `request.json()` into a route handler and a redundant type
assertion hiding the fact that a narrowing already proved the type. All four
were fixed rather than suppressed.

## The rules

**Strict TypeScript, no `any`.** `strict` is on, plus `noUncheckedIndexedAccess`,
because indexing an array can miss and `strict` alone does not say so.
`@typescript-eslint/no-explicit-any` is an error. Untrusted input is typed
`unknown` and narrowed with Zod, never cast.

**Functional by default.** Pure functions, immutable data, `const` and
`readonly`, side effects pushed to the edges. `prefer-const`, `no-var`, and
`no-param-reassign` enforce the mechanical parts; reassigning a parameter is the
most common way shared mutable state creeps back into a function that reads as
pure.

**Loops are allowed where a loop is the right answer.** `CLAUDE.md` prefers
`map`/`filter`/`reduce` over mutating loops, and that preference is real, but it
is written here as prose and deliberately **not** as a lint rule.
`features/chat/read-stream.ts` and `openrouter.ts` consume streams with
`for await...of` and a `for(;;)` reader loop, which is the correct way to drive
an async iterator. A rule banning loops would flag correct code and teach
everyone to reach for `eslint-disable`, which is worse than no rule. Prefer the
array methods when transforming a collection; use a loop when consuming a
stream.

**Type-only imports use `import type`,** so they leave no trace in the emitted
bundle. Enforced, and auto-fixable.

**Unused variables are an error, not a warning.** A warning fails nothing, and
this project's rule is to fix whatever fails. Prefix a genuinely unused binding
with `_` when it must exist.

**Secrets never reach the browser.** `lib/env.ts` imports `server-only`, so a
client component importing it fails the build instead of quietly inlining
`OPENROUTER_API_KEY` into the bundle. Client-visible variables live in
`lib/env-client.ts`, where each `NEXT_PUBLIC_*` key is spelled out literally,
because Next only substitutes those where the full expression appears in source.

**Folder by feature.** Code lives in `features/<feature>/`. `lib/` is for
genuinely cross-cutting infrastructure — the env schemas, the Prisma client, the
Arcjet client — not a dumping ground for shared layers.

**Errors reaching a user are plain sentences.** No stack traces, no provider
JSON, no status codes shouted at anyone. The real error is logged server-side
where it can be diagnosed. See `features/chat/error-message.ts`.

## The pre-commit hook

`.husky/pre-commit` runs two things:

1. **`lint-staged`** — Prettier and `eslint --fix` across the staged files only,
   with the results re-staged. Formatting and auto-fixable lint never bounce a
   commit; they are simply repaired.
2. **`next typegen`** — writes the route and layout types (`LayoutProps`,
   `PageProps`) that `tsc` cannot derive on its own. Without it a fresh clone,
   which has no `.next/`, fails with `Cannot find name 'LayoutProps'`, an error
   that points nowhere near the real problem. It is in `pnpm typecheck` for the
   same reason.
3. **`tsc --noEmit`** — whole-project, and the part that genuinely blocks. A type
   error in a file you did not touch still means the commit is broken, and `tsc`
   has no `--fix`.

The hook lives in `.husky/`, not `.git/hooks/`, because the latter is not shared
through git and would exist only on the machine that created it.

To bypass it in a genuine emergency: `git commit --no-verify`. That is an
escape hatch, not a workflow, and `pnpm check` still has to pass before the
branch is opened for review.

## Deliberately not here

**No test runner, and no browser automation framework.** Already decided in
`CLAUDE.md`, not an omission. Verification is a running dev server and a real
browser, or `curl`. Do not install one to check that something works.

**No import-ordering rule.** Prettier does not sort imports and the plugin that
does would churn every file for no correctness gain. The existing convention —
external packages, then `@/` aliases, then relative — is followed by hand.

## Known, and left alone on purpose

`tsconfig.json` still targets `ES2017`, which is stale for Node 24 and current
browsers. Raising it is a build and bundle-size decision rather than a coding
standard, so it is recorded here rather than folded quietly into this feature.
