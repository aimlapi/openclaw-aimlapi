import {
  AIMLAPI_ATTRIBUTION_HEADERS,
  AIMLAPI_BASE_URL,
  discoverAimlapiModels,
  type ModelProviderConfig,
} from "./runtime-api.js";

export async function buildAimlapiProvider(): Promise<ModelProviderConfig> {
  return {
    baseUrl: AIMLAPI_BASE_URL,
    api: "openai-completions",
    headers: AIMLAPI_ATTRIBUTION_HEADERS,
    models: await discoverAimlapiModels(),
  };
}
