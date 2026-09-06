import { z } from "zod";

/**
 * OpenRouter's live catalogue, narrowed to the models this arena can actually
 * use. The endpoint is public, so this needs no API key and works before anyone
 * signs in.
 */

const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";

/**
 * The catalogue moves, but not by the minute, and every arena page load would
 * otherwise pay for a round trip to OpenRouter. An hour keeps a newly free
 * model from taking a day to appear without making the list a hot path.
 */
const REVALIDATE_SECONDS = 3600;

export type FreeModel = {
  readonly id: string;
  readonly name: string;
  readonly contextLength: number;
  readonly promptPriceUsd: number;
  readonly completionPriceUsd: number;
};

/**
 * Only the fields this app uses. Everything else OpenRouter returns is ignored
 * rather than modelled, so a new field upstream cannot break the parse.
 */
const modelSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  context_length: z.number().int().positive(),
  pricing: z.object({
    prompt: z.string(),
    completion: z.string(),
  }),
  architecture: z.object({
    output_modalities: z.array(z.string()),
  }),
});

type RawModel = z.infer<typeof modelSchema>;

const priceOf = (value: string): number => {
  const parsed = Number(value);
  // An unparseable price is treated as "not free" rather than as zero. Guessing
  // the other way would let a paid model into an arena that promises free ones.
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
};

/**
 * What counts as usable here, and why each clause earns its place.
 *
 * Price alone is not enough: 22 of OpenRouter's models cost nothing, but two of
 * them are Lyria models that emit audio and one is `openrouter/free`, a router
 * pseudo-model rather than something you can put in a lane and compare.
 *
 * Matching on the `:free` suffix would work today and is what OpenRouter's own
 * naming suggests, but it is a convention rather than a contract. These clauses
 * describe the actual requirement, and were checked to select exactly the same
 * nineteen models the suffix does.
 *
 * Modality has to be read from the output side. Filtering on `text->text` looks
 * right and is wrong: it drops eight free models that accept an image or video
 * alongside the prompt and still answer in text, including ones this app has
 * already streamed from successfully.
 */
const isUsableFreeModel = (model: RawModel): boolean => {
  const free =
    priceOf(model.pricing.prompt) === 0 && priceOf(model.pricing.completion) === 0;
  const outputs = model.architecture.output_modalities;
  return (
    free &&
    outputs.includes("text") &&
    !outputs.includes("audio") &&
    !model.id.startsWith("openrouter/")
  );
};

/**
 * Every model here is free, so saying so nineteen times in a list of nineteen
 * is noise rather than information.
 */
const cleanName = (name: string): string => name.replace(/\s*\(free\)\s*$/i, "").trim();

const toFreeModel = (model: RawModel): FreeModel => ({
  id: model.id,
  name: cleanName(model.name),
  contextLength: model.context_length,
  promptPriceUsd: priceOf(model.pricing.prompt),
  completionPriceUsd: priceOf(model.pricing.completion),
});

/**
 * Largest context first. The tie-break is not decoration: three models share a
 * 1,048,576 token context today, and without it their order could differ
 * between two renders of the same list.
 */
const byContextThenName = (a: FreeModel, b: FreeModel): number =>
  b.contextLength - a.contextLength || a.name.localeCompare(b.name);

/**
 * Parses one record at a time on purpose. This is untrusted external input, and
 * a single malformed entry should cost us that entry, not the entire catalogue.
 */
const parseCatalogue = (payload: unknown): readonly FreeModel[] => {
  const body = z.object({ data: z.array(z.unknown()) }).safeParse(payload);
  if (!body.success) return [];

  return body.data.data
    .map((entry) => modelSchema.safeParse(entry))
    .filter((result) => result.success)
    .map((result) => result.data)
    .filter(isUsableFreeModel)
    .map(toFreeModel)
    .sort(byContextThenName);
};

export type CatalogueResult =
  | { readonly ok: true; readonly models: readonly FreeModel[] }
  | { readonly ok: false; readonly message: string };

/**
 * Never throws. A catalogue this app cannot reach is an ordinary state that the
 * page renders as a plain sentence with a retry, not an exception that takes a
 * screen down. The real reason is logged server-side where it can be diagnosed.
 */
export const fetchFreeModels = async (): Promise<CatalogueResult> => {
  try {
    const response = await fetch(OPENROUTER_MODELS_URL, {
      next: { revalidate: REVALIDATE_SECONDS },
    });

    if (!response.ok) {
      console.error(`[models] OpenRouter returned ${response.status}`);
      return { ok: false, message: "The model list is unavailable right now." };
    }

    const models = parseCatalogue(await response.json());
    if (models.length === 0) {
      console.error("[models] OpenRouter returned no usable free models");
      return { ok: false, message: "The model list is unavailable right now." };
    }

    return { ok: true, models };
  } catch (error) {
    console.error("[models] could not reach OpenRouter", error);
    return { ok: false, message: "The model list is unavailable right now." };
  }
};

export type ModelAllowed =
  { readonly allowed: true } | { readonly allowed: false; readonly message: string };

/**
 * Whether this app is willing to send a prompt to a given model id.
 *
 * This is a spend control, not a validation nicety. The chat route calls
 * OpenRouter with the server's own API key, so any model id that reaches it is
 * billed to this account. Before this existed the only gate was "a non-empty
 * string", which meant an unauthenticated caller could post the id of any paid
 * frontier model and have it charged to us.
 *
 * It fails closed. If the catalogue cannot be reached the answer is no, because
 * the alternative is letting an unchecked id through on exactly the request we
 * are least able to reason about. The cost of that is small in practice: a
 * request that cannot reach OpenRouter's catalogue is unlikely to reach its
 * completions endpoint either.
 */
export const isModelAllowed = async (modelId: string): Promise<ModelAllowed> => {
  const catalogue = await fetchFreeModels();

  if (!catalogue.ok) {
    return {
      allowed: false,
      message: "The model list is unavailable right now, so this prompt wasn't sent.",
    };
  }

  if (!catalogue.models.some((model) => model.id === modelId)) {
    return {
      allowed: false,
      message: "That model isn't one this arena can use.",
    };
  }

  return { allowed: true };
};

export type ResolvedModels =
  | { readonly ok: true; readonly models: readonly FreeModel[] }
  | { readonly ok: false; readonly message: string };

/**
 * Turns a set of ids into catalogue entries, refusing the whole set if any one
 * of them is not a model this arena will pay for.
 *
 * Callers need both halves of this at once: the permission check, and the
 * display name to snapshot onto the answer row. Doing it in one pass means the
 * name written to the database is the one the catalogue actually gave us,
 * rather than the id standing in for a name nobody ever looked up.
 */
export const resolveFreeModels = async (
  modelIds: readonly string[],
): Promise<ResolvedModels> => {
  const catalogue = await fetchFreeModels();
  if (!catalogue.ok) {
    return {
      ok: false,
      message: "The model list is unavailable right now, so this prompt wasn't sent.",
    };
  }

  const resolved = modelIds.map((id) =>
    catalogue.models.find((model) => model.id === id),
  );

  return resolved.every((model): model is FreeModel => model !== undefined)
    ? { ok: true, models: resolved }
    : { ok: false, message: "That model isn't one this arena can use." };
};

/** How many models can answer one prompt at once. */
export const MAX_SELECTED_MODELS = 3;

/**
 * The arena opens with the three largest contexts already chosen, skipping any
 * model that has most recently refused this app outright.
 *
 * That exclusion is not a nicety. The two largest context windows in the
 * catalogue belong to models OpenRouter gates to agentic harnesses, so ranking
 * by context alone put two lanes that could never answer in front of every new
 * person's first prompt. Excluded models remain selectable by hand.
 */
export const defaultSelection = (
  models: readonly FreeModel[],
  unavailableIds: ReadonlySet<string> = new Set(),
): readonly string[] => {
  const usable = models.filter((model) => !unavailableIds.has(model.id));
  // If everything is excluded, something is wrong with our own setup rather
  // than with every model at once, so fall back to the plain ranking instead of
  // opening an arena with no models in it.
  const pool = usable.length > 0 ? usable : models;
  return pool.slice(0, MAX_SELECTED_MODELS).map((model) => model.id);
};
