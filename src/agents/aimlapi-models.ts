import type { ModelDefinitionConfig } from "../config/types.models.js";
import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("aimlapi-models");

export const AIMLAPI_BASE_URL = "https://api.aimlapi.com/v1";
export const AIMLAPI_DEFAULT_MODEL_ID = "openai/gpt-5-nano-2025-08-07";
export const AIMLAPI_DEFAULT_MODEL_NAME = "GPT-5 Nano (2025-08-07)";
export const AIMLAPI_DEFAULT_CONTEXT_WINDOW = 128000;
export const AIMLAPI_DEFAULT_MAX_TOKENS = 16384;
export const AIMLAPI_DEFAULT_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};

export function buildAimlapiDefaultModelDefinition(): ModelDefinitionConfig {
  return {
    id: AIMLAPI_DEFAULT_MODEL_ID,
    name: AIMLAPI_DEFAULT_MODEL_NAME,
    reasoning: false,
    input: ["text", "image"],
    cost: AIMLAPI_DEFAULT_COST,
    contextWindow: AIMLAPI_DEFAULT_CONTEXT_WINDOW,
    maxTokens: AIMLAPI_DEFAULT_MAX_TOKENS,
  };
}

export const AIMLAPI_STATIC_CATALOG: ModelDefinitionConfig[] = [
  buildAimlapiDefaultModelDefinition(),
  {
    id: "openai/gpt-4o",
    name: "GPT 4o",
    reasoning: false,
    input: ["text", "image"],
    cost: AIMLAPI_DEFAULT_COST,
    contextWindow: AIMLAPI_DEFAULT_CONTEXT_WINDOW,
    maxTokens: AIMLAPI_DEFAULT_MAX_TOKENS,
  },
  {
    id: "openai/gpt-4o-mini",
    name: "GPT 4o mini",
    reasoning: false,
    input: ["text", "image"],
    cost: AIMLAPI_DEFAULT_COST,
    contextWindow: AIMLAPI_DEFAULT_CONTEXT_WINDOW,
    maxTokens: AIMLAPI_DEFAULT_MAX_TOKENS,
  },
];

interface AimlapiModel {
  id: string;
  type: string;
  info?: {
    name?: string;
    contextLength?: number;
    maxTokens?: number;
  };
  features?: string[];
}

interface AimlapiModelsResponse {
  object?: string;
  data?: AimlapiModel[];
}

let discoveryPromise: Promise<ModelDefinitionConfig[]> | null = null;
let discoveryCache: ModelDefinitionConfig[] | null = null;

function cacheAimlapiCatalog(models: ModelDefinitionConfig[]): ModelDefinitionConfig[] {
  discoveryCache = models;
  return models;
}

function resolveAimlapiStaticFallback(): ModelDefinitionConfig[] {
  return AIMLAPI_STATIC_CATALOG;
}

function mapAimlapiModel(model: AimlapiModel): ModelDefinitionConfig {
  const modelId = model.id;
  const lowerModelId = modelId.toLowerCase();
  const isReasoning =
    model.features?.includes("openai/chat-completion.reasoning") ||
    lowerModelId.includes("o1") ||
    lowerModelId.includes("o3") ||
    lowerModelId.includes("reasoning");
  const hasVision =
    model.features?.includes("openai/chat-completion.vision") || lowerModelId.includes("vision");

  const input: Array<"text" | "image"> = ["text"];
  if (hasVision) {
    input.push("image");
  }

  const rawMaxTokens = model.info?.maxTokens ?? AIMLAPI_DEFAULT_MAX_TOKENS;
  const maxTokens = Math.max(1, Math.min(rawMaxTokens, 32768));

  return {
    id: modelId,
    name: model.info?.name || modelId,
    reasoning: isReasoning,
    input,
    cost: AIMLAPI_DEFAULT_COST,
    contextWindow: model.info?.contextLength ?? AIMLAPI_DEFAULT_CONTEXT_WINDOW,
    maxTokens,
  };
}

export async function discoverAimlapiModels(): Promise<ModelDefinitionConfig[]> {
  if (process.env.VITEST || process.env.NODE_ENV === "test") {
    return AIMLAPI_STATIC_CATALOG;
  }
  if (discoveryCache) {
    return discoveryCache;
  }
  if (discoveryPromise) {
    return discoveryPromise;
  }

  discoveryPromise = (async () => {
    try {
      const response = await fetch(`${AIMLAPI_BASE_URL}/models`, {
        signal: AbortSignal.timeout(25_000),
        headers: { accept: "application/json" },
      });
      if (!response.ok) {
        log.warn(`GET /models failed: HTTP ${response.status}, using static catalog`);
        return resolveAimlapiStaticFallback();
      }

      const body = (await response.json()) as AimlapiModelsResponse;
      const list = Array.isArray(body?.data) ? body.data : [];
      if (list.length === 0) {
        log.warn("GET /models returned empty data, using static catalog");
        return resolveAimlapiStaticFallback();
      }

      const models = list.filter((model) => model.type === "chat-completion").map(mapAimlapiModel);
      return models.length > 0 ? cacheAimlapiCatalog(models) : resolveAimlapiStaticFallback();
    } catch (error) {
      log.warn(`AIMLAPI discovery failed: ${String(error)}, using static catalog`);
      return resolveAimlapiStaticFallback();
    } finally {
      if (!discoveryCache) {
        discoveryPromise = null;
      }
    }
  })();

  return discoveryPromise;
}
