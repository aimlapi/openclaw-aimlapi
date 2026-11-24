import type {
  ModelDefinitionConfig,
  ModelProviderConfig,
} from "openclaw/plugin-sdk/provider-onboard";

export const AIMLAPI_BASE_URL = "https://api.aimlapi.com/v1";
/**
 * Partner attribution sent on every AI/ML API request (inference, catalog
 * discovery, video generation, web search) - registered via
 * `POST /v3/rebate-partners` (partnerName: "openclaw").
 */
export const AIMLAPI_ATTRIBUTION_HEADERS = {
  "X-AIMLAPI-Source": "agent/openclaw",
  "X-AIMLAPI-Partner-ID": "part_xKZeoMXjy4GOKOqmmziVxWcX",
} as const;
export const AIMLAPI_DEFAULT_MODEL_ID = "openai/gpt-5.6-terra";
export const AIMLAPI_DEFAULT_MODEL_REF = `aimlapi/${AIMLAPI_DEFAULT_MODEL_ID}`;
export const AIMLAPI_DEFAULT_MODEL_NAME = "GPT-5.6 Terra";
export const AIMLAPI_DEFAULT_CONTEXT_WINDOW = 128000;
export const AIMLAPI_DEFAULT_MAX_TOKENS = 16384;
/** Upper bound for the per-turn output budget OpenClaw reserves for a model. */
export const AIMLAPI_MAX_OUTPUT_TOKENS_CAP = 32768;
export const AIMLAPI_DISCOVERY_TIMEOUT_MS = 10_000;
/** The catalogue type OpenClaw can drive through its `openai-completions` transport. */
export const AIMLAPI_CHAT_MODEL_TYPE = "openai/chat-completions";

type ModelCost = ModelDefinitionConfig["cost"];

/** Used only when the live catalogue is unreachable: prices are never hard-coded. */
export const AIMLAPI_UNKNOWN_COST: ModelCost = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};

export function buildAimlapiModelDefinition(): ModelDefinitionConfig {
  return {
    id: AIMLAPI_DEFAULT_MODEL_ID,
    name: AIMLAPI_DEFAULT_MODEL_NAME,
    reasoning: true,
    input: ["text", "image"],
    cost: AIMLAPI_UNKNOWN_COST,
    contextWindow: 1_050_000,
    maxTokens: AIMLAPI_MAX_OUTPUT_TOKENS_CAP,
  };
}

/** Offline fallback: a small set of long-lived models, without prices. */
export function buildAimlapiStaticCatalog(): ModelDefinitionConfig[] {
  return [
    buildAimlapiModelDefinition(),
    {
      id: "openai/gpt-4o",
      name: "GPT-4o",
      reasoning: false,
      input: ["text", "image"],
      cost: AIMLAPI_UNKNOWN_COST,
      contextWindow: AIMLAPI_DEFAULT_CONTEXT_WINDOW,
      maxTokens: AIMLAPI_DEFAULT_MAX_TOKENS,
    },
    {
      id: "openai/gpt-4o-mini",
      name: "GPT-4o Mini",
      reasoning: false,
      input: ["text", "image"],
      cost: AIMLAPI_UNKNOWN_COST,
      contextWindow: AIMLAPI_DEFAULT_CONTEXT_WINDOW,
      maxTokens: AIMLAPI_DEFAULT_MAX_TOKENS,
    },
  ];
}

const AIMLAPI_STATIC_CATALOG: ModelDefinitionConfig[] = buildAimlapiStaticCatalog();

/** One price unit from `GET /v1/models?include=pricing` (see docs: complete-model-list). */
export type AimlapiPriceUnit = {
  name?: string;
  content?: string;
  origin?: string;
  author?: string;
  tag?: string;
  price?: number;
  per?: number;
};

export type AimlapiCatalogModel = {
  id: string;
  type?: string;
  info?: {
    name?: string;
    contextLength?: number;
    outputMax?: number;
  };
  capabilities?: string[];
  modalities?: { input?: string[]; output?: string[] };
  pricing?: { units?: AimlapiPriceUnit[] };
};

type AimlapiModelsResponse = {
  data?: AimlapiCatalogModel[];
};

let discoveryPromise: Promise<ModelDefinitionConfig[]> | null = null;
let discoveryCache: ModelDefinitionConfig[] | null = null;

/** USD per 1M tokens for one text-token origin; the untagged unit wins over tagged duplicates. */
function readTextTokenPrice(units: AimlapiPriceUnit[], origin: string): number {
  const matches = units.filter(
    (unit) =>
      unit.name === "token" &&
      unit.content === "text" &&
      unit.origin === origin &&
      typeof unit.price === "number" &&
      Number.isFinite(unit.price),
  );
  const unit = matches.find((candidate) => !candidate.tag) ?? matches[0];
  if (!unit || typeof unit.price !== "number") {
    return 0;
  }
  const per = typeof unit.per === "number" && unit.per > 0 ? unit.per : 1_000_000;
  return (unit.price / per) * 1_000_000;
}

export function mapAimlapiPricing(model: AimlapiCatalogModel): ModelCost {
  const units = Array.isArray(model.pricing?.units) ? model.pricing.units : [];
  return {
    input: readTextTokenPrice(units, "provided"),
    output: readTextTokenPrice(units, "generated"),
    cacheRead: readTextTokenPrice(units, "cached"),
    cacheWrite: readTextTokenPrice(units, "cache_write"),
  };
}

export function mapAimlapiModel(model: AimlapiCatalogModel): ModelDefinitionConfig {
  const capabilities = Array.isArray(model.capabilities) ? model.capabilities : [];
  const inputModalities = Array.isArray(model.modalities?.input) ? model.modalities.input : [];
  const input: Array<"text" | "image"> = ["text"];
  if (capabilities.includes("vision") || inputModalities.includes("image")) {
    input.push("image");
  }
  const contextWindow =
    typeof model.info?.contextLength === "number" && model.info.contextLength > 0
      ? model.info.contextLength
      : AIMLAPI_DEFAULT_CONTEXT_WINDOW;
  const outputMax =
    typeof model.info?.outputMax === "number" && model.info.outputMax > 0
      ? model.info.outputMax
      : AIMLAPI_DEFAULT_MAX_TOKENS;
  return {
    id: model.id,
    name: model.info?.name?.trim() || model.id,
    reasoning: capabilities.includes("reasoning"),
    input,
    cost: mapAimlapiPricing(model),
    contextWindow,
    maxTokens: Math.max(1, Math.min(outputMax, contextWindow, AIMLAPI_MAX_OUTPUT_TOKENS_CAP)),
  };
}

export function mapAimlapiCatalog(models: AimlapiCatalogModel[]): ModelDefinitionConfig[] {
  return models
    .filter(
      (model) =>
        typeof model?.id === "string" &&
        model.id.trim() !== "" &&
        model.type === AIMLAPI_CHAT_MODEL_TYPE,
    )
    .map(mapAimlapiModel);
}

export function buildAimlapiCatalogUrl(baseUrl: string = AIMLAPI_BASE_URL): string {
  const url = new URL(`${baseUrl.replace(/\/+$/, "")}/models`);
  url.searchParams.set("type", AIMLAPI_CHAT_MODEL_TYPE);
  url.searchParams.set("include", "capabilities,modalities,pricing");
  return url.toString();
}

export async function discoverAimlapiModels(
  fetchImpl: typeof fetch = fetch,
): Promise<ModelDefinitionConfig[]> {
  if (discoveryCache) {
    return discoveryCache;
  }
  if (discoveryPromise) {
    return discoveryPromise;
  }

  discoveryPromise = (async () => {
    try {
      // The catalogue is public: no key is sent, so discovery never leaks credentials.
      const response = await fetchImpl(buildAimlapiCatalogUrl(), {
        signal: AbortSignal.timeout(AIMLAPI_DISCOVERY_TIMEOUT_MS),
        headers: { accept: "application/json", ...AIMLAPI_ATTRIBUTION_HEADERS },
      });
      if (!response.ok) {
        return AIMLAPI_STATIC_CATALOG;
      }
      const body = (await response.json()) as AimlapiModelsResponse;
      const models = mapAimlapiCatalog(Array.isArray(body?.data) ? body.data : []);
      if (models.length === 0) {
        return AIMLAPI_STATIC_CATALOG;
      }
      discoveryCache = models;
      return models;
    } catch {
      return AIMLAPI_STATIC_CATALOG;
    } finally {
      discoveryPromise = null;
    }
  })();

  return discoveryPromise;
}

/** Test hook: forget the cached catalogue. */
export function resetAimlapiDiscoveryCache(): void {
  discoveryCache = null;
  discoveryPromise = null;
}

export type { ModelProviderConfig };
