const OPENROUTER_MODELS_URL =
  "https://openrouter.ai/api/v1/models?output_modalities=text";
const CATALOG_TTL_MS = 15 * 60 * 1000;
const STALE_RETRY_MS = 60 * 1000;
const REQUEST_TIMEOUT_MS = 10 * 1000;

export const DEFAULT_MODEL = "openai/gpt-4o-mini";

export interface ModelOption {
  id: string;
  name: string;
  contextLength: number;
  priceTier: number;
}

interface OpenRouterModel {
  id: string;
  name: string;
  context_length: number;
  architecture?: {
    output_modalities?: string[];
  };
  pricing: {
    prompt?: string;
    completion?: string;
  };
}

interface OpenRouterModelsResponse {
  data?: OpenRouterModel[];
}

let cachedModels: ModelOption[] | null = null;
let cacheExpiresAt = 0;
let pendingRequest: Promise<ModelOption[]> | null = null;

/** Maps token pricing to a stable one-to-five relative cost indicator. */
export function getPriceTier(promptPerToken: number, completionPerToken: number) {
  const combinedPerMillion = (promptPerToken + completionPerToken) * 1_000_000;

  if (combinedPerMillion === 0) return 1;
  if (combinedPerMillion <= 2) return 2;
  if (combinedPerMillion <= 8) return 3;
  if (combinedPerMillion <= 30) return 4;
  return 5;
}

/** Converts a valid text-output OpenRouter model into the public catalog shape. */
function normalizeModel(model: OpenRouterModel) {
  const promptPrice = Number(model.pricing?.prompt);
  const completionPrice = Number(model.pricing?.completion);
  const supportsText = model.architecture?.output_modalities?.includes("text") ?? true;

  if (
    !model.id?.trim() ||
    !model.name?.trim() ||
    !Number.isFinite(model.context_length) ||
    model.context_length <= 0 ||
    !supportsText ||
    !Number.isFinite(promptPrice) ||
    promptPrice < 0 ||
    !Number.isFinite(completionPrice) ||
    completionPrice < 0
  ) {
    return null;
  }

  return {
    id: model.id,
    name: model.name,
    contextLength: model.context_length,
    priceTier: getPriceTier(promptPrice, completionPrice),
  } satisfies ModelOption;
}

/** Fetches and normalizes the current text model catalog from OpenRouter. */
async function fetchModels() {
  const apiKey = process.env.OPEN_ROUTER_API_KEY;
  const response = await fetch(OPENROUTER_MODELS_URL, {
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`OpenRouter models request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as OpenRouterModelsResponse;
  if (!Array.isArray(payload.data)) {
    throw new Error("OpenRouter returned an invalid models response");
  }

  const models = payload.data
    .map(normalizeModel)
    .filter((model): model is ModelOption => model !== null)
    .sort((left, right) => left.name.localeCompare(right.name));

  if (models.length === 0) {
    throw new Error("OpenRouter returned no selectable text models");
  }

  return models;
}

/** Returns the cached selectable model catalog, refreshing it when expired. */
export async function getSelectableModels() {
  if (cachedModels && cacheExpiresAt > Date.now()) return cachedModels;
  if (pendingRequest) return pendingRequest;

  pendingRequest = fetchModels()
    .then((models) => {
      cachedModels = models;
      cacheExpiresAt = Date.now() + CATALOG_TTL_MS;
      return models;
    })
    .catch((error: unknown) => {
      if (cachedModels) {
        cacheExpiresAt = Date.now() + STALE_RETRY_MS;
        return cachedModels;
      }
      throw error;
    })
    .finally(() => {
      pendingRequest = null;
    });

  return pendingRequest;
}

/** Checks whether a model ID is currently selectable for text chat. */
export async function isSelectableModel(modelId: string) {
  const models = await getSelectableModels();
  return models.some((model) => model.id === modelId);
}
