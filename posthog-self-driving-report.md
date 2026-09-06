# PostHog Self-driving setup report

## Summary

PostHog Self-driving is configured for this Next.js LLM playground: Session Replay, Error Tracking, and Support were enabled, and native responders for health checks, error tracking, and support tickets were enabled. The focused scout troop is active and will begin scanning within approximately 30 minutes; findings will appear in the [Self-driving inbox](https://us.posthog.com/project/588956/inbox).

The repository already initializes `posthog-js` in `instrumentation-client.ts` and does not disable replay or exception capture. No application source files were changed during this setup.

## AI data processing

Approved by the organization-level Self-driving gate.

## GitHub

The PostHog GitHub App was already connected before this setup. No GitHub Issues responder or data warehouse source was enabled because no external tools were selected.

## Products enabled

| Product        | Result  | Notes                                                                                                                                                                                      |
| -------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Session Replay | enabled | Web SDK initialization is compatible: no session-recording disable override is present. No recordings were found in the 30-day probe, so scanners would begin work when recordings arrive. |
| Error Tracking | enabled | Browser initialization explicitly enables exception capture. No error-tracking issues were found in the probe.                                                                             |
| Support        | enabled | Connect an inbound email, inbox, or Slack channel in PostHog before tickets can arrive.                                                                                                    |

## Signal sources

| source_product   | source_type                | Action                                                                  | Source config ID                       |
| ---------------- | -------------------------- | ----------------------------------------------------------------------- | -------------------------------------- |
| `signals_scout`  | `cross_source_issue`       | Enabled by default; no row is needed unless opting out.                 | —                                      |
| `health_checks`  | `health_issue`             | enabled                                                                 | `01a05e03-f4e9-7155-b7e1-71873e7bbdaa` |
| `error_tracking` | `issue_created`            | enabled                                                                 | `01a05e03-f50c-7d1c-952c-9faca36eec53` |
| `error_tracking` | `issue_reopened`           | enabled                                                                 | `01a05e03-f4dc-7510-a727-b2bdbb69422f` |
| `error_tracking` | `issue_spiking`            | enabled                                                                 | `01a05e03-f4e6-76a0-843e-5966cad69d9d` |
| `conversations`  | `ticket`                   | enabled                                                                 | `01a05e03-f4ce-7452-80e0-f6acf0ec2197` |
| `session_replay` | `session_analysis_cluster` | deliberately skipped; this retired source is not used.                  | —                                      |
| `replay_vision`  | scanner findings           | not configured; scanner API access failed (see Replay Vision scanners). | —                                      |

## Connected tools

The connected-tools selection was cancelled, so no external responder was authorized or created. GitHub Issues, Linear, Jira, Sentry, and Zendesk are recorded as **not used** for this setup.

## Scout troop

The troop was materialized and uses the server default daily cadence.

| Scout                             | State    | Reason                                                                                                                                                              |
| --------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `signals-scout-general`           | enabled  | Covers cross-product correlations and otherwise-uncovered surfaces.                                                                                                 |
| `signals-scout-ai-observability`  | enabled  | The application uses OpenRouter via the AI SDK and records model, latency, token, and cost-related metrics.                                                         |
| `signals-scout-product-analytics` | enabled  | Prompt submission and streamed-completion behavior are core product flow signals.                                                                                   |
| `signals-scout-error-tracking`    | disabled | Covered by the native Error Tracking responder.                                                                                                                     |
| `signals-scout-session-replay`    | disabled | Covered by Replay Vision scanners when scanner access is available.                                                                                                 |
| Other 22 built-in specialists     | disabled | Their product surfaces were not evidenced in this early-stage repository, or they are not among the highest-use surfaces. They can be enabled later from the inbox. |

- **Active scouts:** 3 of 27.
- **Verified run budget:** 100 maximum runs per day; 0 used today; 100 remaining today.
- **Announcement:** “Scouts are in early access. Each project gets up to 100 scout runs a day. Contact team-self-driving@posthog.com if you need more.”

## Custom scouts

No custom scouts were created because the proposal was cancelled.

- **Proposed and declined:** model-answer delivery reliability — would compare stable incoming prompt volume with completed-answer rate, failure/interruption increases, and model concentration.
- **Why it was a candidate:** `app/api/chat/route.ts` records received chat requests and `app/dev/stream/page.tsx` records streamed completions, while the AI observability scout targets LLM traces and the product-analytics scout focuses on saved behavioral flows.
- **Event-schema verification:** unavailable because this MCP connection lacks the `property_definition:read` scope; the proposed candidate was therefore not asserted as live server-side coverage.
- **Considered and ruled out:** voting and multi-model arena health are planned in `docs/scope.md` but are not implemented or instrumented yet, so they are not watchable surfaces.
- **Noise escape hatch:** set a custom scout configuration’s `emit` value to `false` in PostHog to retain dry-run scans without inbox reports.

## Replay Vision scanners

A scanner is an LLM that watches individual session recordings on a schedule and pushes what it finds to the inbox. It is the only item in this setup that spends Replay Vision quota; individual findings arrive at half weight and need independent corroboration before promotion to an inbox report.

Neither required monitor was created. Both the in-product scanner guide and the scanner inventory endpoint were inaccessible because scanner requests returned `INVALID_API_KEY`; no quota or spend estimate could be read. The current product also has no confirmed production completion route: `/dev/stream` is explicitly a temporary proof harness and the real parallel arena remains planned.

| Brief               | Planned name                      | Intended scope                                                                                                       | Status                                                                                               | Sampling rate | Estimate      |
| ------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------- | ------------- |
| Breakage monitor    | LLM Playground answer breakage    | A future real model-answer completion route and immediate predecessors; no safe production route is implemented yet. | skipped — scanner API authentication failed and no production completion flow is available to scope. | 0.5           | Not available |
| Frustration monitor | LLM Playground prompt frustration | `$rageclick` only, with no URL filter; this remains separate from the breakage monitor.                              | skipped — scanner API authentication failed.                                                         | 1.0           | Not available |

## Files modified or created

| File                             | Change                     |
| -------------------------------- | -------------------------- |
| `posthog-self-driving-report.md` | Created this setup report. |

No existing repository source, configuration, or environment files were modified.

## Follow-ups

- [ ] Connect an inbound Support channel (email, inbox, or Slack) in PostHog so the enabled Support responder can receive tickets.
- [ ] Re-authenticate or update the MCP credentials that service Replay Vision. Scanner inventory, scanner creation, quota, and the in-product Replay Vision guide returned `INVALID_API_KEY`.
- [ ] Once the real arena is implemented, create the two Replay Vision monitors with a production answer-completion URL scope and the `$rageclick` frustration scope.
- [ ] If custom delivery-reliability coverage is desired, approve the proposed custom scout after granting the MCP connection `property_definition:read` so its events can be confirmed server-side.
- [ ] Add PostHog LLM analytics tracing around actual model calls, as planned in `docs/scope.md`, so the enabled AI observability scout has trace data to analyze.

## What happens next

Fresh scout configurations are picked up by the coordinator within about 30 minutes. Their runs draw from the verified daily budget, and validated findings cluster into reports in the [Self-driving inbox](https://us.posthog.com/project/588956/inbox). Immediately actionable reports can start coding tasks.
