import { AIMLAPI_DEFAULT_MODEL_REF } from "./runtime-api.js";
import {
  applyAgentDefaultModelPrimary,
  type OpenClawConfig,
} from "openclaw/plugin-sdk/provider-onboard";

export { AIMLAPI_DEFAULT_MODEL_REF };

export function applyAimlapiProviderConfig(cfg: OpenClawConfig): OpenClawConfig {
  const models = { ...cfg.agents?.defaults?.models };
  models[AIMLAPI_DEFAULT_MODEL_REF] = {
    ...models[AIMLAPI_DEFAULT_MODEL_REF],
    alias: models[AIMLAPI_DEFAULT_MODEL_REF]?.alias ?? "AI/ML API",
  };
  return {
    ...cfg,
    agents: {
      ...cfg.agents,
      defaults: {
        ...cfg.agents?.defaults,
        models,
      },
    },
  };
}

export function applyAimlapiConfig(cfg: OpenClawConfig): OpenClawConfig {
  return applyAgentDefaultModelPrimary(applyAimlapiProviderConfig(cfg), AIMLAPI_DEFAULT_MODEL_REF);
}
