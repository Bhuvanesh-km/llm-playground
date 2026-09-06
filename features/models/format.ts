/**
 * How a model's numbers are written, in one place, so the picker, the models
 * page and anything later all say them the same way.
 */

/**
 * Context windows here run from 65,536 to 1,048,576, and the exact digits carry
 * no meaning to a reader choosing between them. "1M" and "262K" compare at a
 * glance in a way that "1,048,576" and "262,144" do not.
 *
 * Decimal units throughout, which matters because the catalogue mixes the two
 * conventions: some models advertise 1,048,576 and others a round 1,000,000.
 * An earlier version divided by 1,048,576 and rendered those as "1M" and
 * "1.0M", so the smaller of the two carried more apparent precision and read as
 * though it were the larger. They differ by five percent, which changes nobody's
 * choice, so both now say "1M". Trailing zeroes are stripped for the same
 * reason: ".0" is precision this number does not have.
 *
 * The exact figure is not lost, it is put in the `title` where these are shown.
 */
export const formatContext = (tokens: number): string => {
  if (tokens >= 1_000_000) return `${Number((tokens / 1_000_000).toFixed(1))}M`;
  if (tokens >= 1000) return `${Math.round(tokens / 1000)}K`;
  return String(tokens);
};

/** The unrounded count, for a `title` beside the compact label. */
export const formatExactContext = (tokens: number): string =>
  `${tokens.toLocaleString("en-US")} tokens`;

/**
 * Every model in this arena is free, so this always reads $0.0000. That is a
 * real measured figure taken from OpenRouter's own catalogue rather than an
 * assumption, and it is shown rather than hidden precisely because it is true.
 * Four decimal places because that is the scale at which paid models differ,
 * so a zero here is legible as a price and not as a missing value.
 */
export const formatPricePerMillion = (usdPerToken: number): string =>
  `$${(usdPerToken * 1_000_000).toFixed(4)}`;
