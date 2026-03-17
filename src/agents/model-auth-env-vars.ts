import {
  PROVIDER_AUTH_ENV_VAR_CANDIDATES,
  listKnownProviderAuthEnvVarNames,
} from "../secrets/provider-env-vars.js";

const NON_BUNDLED_PROVIDER_AUTH_ENV_VAR_CANDIDATES: Record<string, readonly string[]> = {
  // AIMLAPI remains a core implicit provider until a bundled provider catalog exists.
  aimlapi: ["AIMLAPI_API_KEY", "AIML_API_KEY"],
};

export const PROVIDER_ENV_API_KEY_CANDIDATES: Record<string, readonly string[]> = {
  ...PROVIDER_AUTH_ENV_VAR_CANDIDATES,
  ...NON_BUNDLED_PROVIDER_AUTH_ENV_VAR_CANDIDATES,
};

export function listKnownProviderEnvApiKeyNames(): string[] {
  return [
    ...new Set([
      ...listKnownProviderAuthEnvVarNames(),
      ...Object.values(NON_BUNDLED_PROVIDER_AUTH_ENV_VAR_CANDIDATES).flatMap((vars) => vars),
    ]),
  ];
}
