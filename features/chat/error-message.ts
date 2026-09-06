import { APICallError, RetryError } from "ai";

/**
 * Turns anything a provider can throw into one plain sentence a person can act
 * on. Nothing raw ever reaches the browser: no stack, no provider JSON, no
 * status code shouted at the user. Every branch pairs with a retry action on
 * the card, so the sentence says what happened, not what to click.
 */

/**
 * Whether a failure says anything about the model itself.
 *
 * PERMANENT_REFUSAL is a claim with consequences: it takes a model out of the
 * default selection. So it is reserved for the two statuses that really are
 * about this model and this app, 403 and 404.
 *
 * 401 is deliberately not one of them, and the distinction matters more than it
 * looks. A rejected API key returns 401 for every model in the catalogue, so
 * treating it as permanent would empty the arena of every default in a single
 * bad deploy, from a fault that has nothing to do with any model.
 */
export type FailureKind = "PERMANENT_REFUSAL" | "TRANSIENT";

const kindByStatus = (status: number | undefined): FailureKind =>
  status === 403 || status === 404 ? "PERMANENT_REFUSAL" : "TRANSIENT";

const byStatus = (status: number | undefined): string | null => {
  if (status === undefined) return null;
  // 401 and 403 look alike and are not. 401 is our own credentials being
  // rejected, which is a configuration problem on this side and affects every
  // model. 403 is the provider refusing this particular model to this app, and
  // no amount of retrying changes it: OpenRouter's free tier gates some models
  // to "agentic harnesses" only, and two of them happen to have the largest
  // context windows in the catalogue, so they are the ones a person is most
  // likely to reach for. Collapsing both into one sentence told someone to wait
  // for something that was never going to start working.
  if (status === 401) {
    return "This app isn't authorised to reach that model right now.";
  }
  if (status === 403) {
    return "That model won't accept requests from this app. Pick another one.";
  }
  if (status === 404) {
    return "That model isn't available anymore.";
  }
  if (status === 429) {
    return "That model is busy and turned this request away. Give it a moment.";
  }
  if (status >= 500) {
    return "That model's provider had a problem answering.";
  }
  return null;
};

/**
 * The SDK retries a failed call and then reports a `RetryError` wrapping the
 * real one, so the useful status code sits one level down. Without unwrapping,
 * every retried failure, a rate limit very much included, collapses into the
 * same vague catch-all sentence.
 */
const unwrap = (error: unknown): unknown =>
  RetryError.isInstance(error) ? error.lastError : error;

export type DescribedFailure = {
  /** The one thing a person ever sees. */
  readonly message: string;
  /** The one thing the app acts on. */
  readonly kind: FailureKind;
};

export const describeFailure = (error: unknown): DescribedFailure => {
  if (error instanceof DOMException && error.name === "AbortError") {
    return {
      message: "This answer was stopped before it finished.",
      kind: "TRANSIENT",
    };
  }

  const cause = unwrap(error);

  if (APICallError.isInstance(cause)) {
    return {
      message: byStatus(cause.statusCode) ?? "That model couldn't be reached.",
      kind: kindByStatus(cause.statusCode),
    };
  }

  return {
    message: "Something went wrong getting this answer.",
    kind: "TRANSIENT",
  };
};

export const toHumanErrorMessage = (error: unknown): string =>
  describeFailure(error).message;
