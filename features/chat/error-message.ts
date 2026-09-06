import { APICallError, RetryError } from "ai";

/**
 * Turns anything a provider can throw into one plain sentence a person can act
 * on. Nothing raw ever reaches the browser: no stack, no provider JSON, no
 * status code shouted at the user. Every branch pairs with a retry action on
 * the card, so the sentence says what happened, not what to click.
 */

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

export const toHumanErrorMessage = (error: unknown): string => {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "This answer was stopped before it finished.";
  }

  const cause = unwrap(error);

  if (APICallError.isInstance(cause)) {
    return byStatus(cause.statusCode) ?? "That model couldn't be reached.";
  }

  return "Something went wrong getting this answer.";
};
