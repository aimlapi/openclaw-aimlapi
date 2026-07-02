// extensions/aimlapi/index.ts
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { createProviderApiKeyAuthMethod } from "openclaw/plugin-sdk/provider-auth-api-key";
var PROVIDER_ID = "aimlapi";
var DEFAULT_MODEL_REF = "aimlapi/openai/gpt-5-chat";
var AIMLAPI_ATTRIBUTION_HEADERS = {
  "X-AIMLAPI-Partner-ID": "openclaw",
  "X-AIMLAPI-Integration-Repo": "openclaw/openclaw",
  "X-AIMLAPI-Integration-Version": "1.0.0"
};
function withAimlapiAttributionHeaders(options) {
  const headers = new Headers(options?.headers);
  for (const [name, value] of Object.entries(AIMLAPI_ATTRIBUTION_HEADERS)) {
    headers.set(name, value);
  }
  return {
    ...options,
    headers: Object.fromEntries(headers.entries())
  };
}
var aimlapi_default = definePluginEntry({
  id: PROVIDER_ID,
  name: "AI/ML API Provider",
  description: "AI/ML API model provider plugin",
  register(api) {
    api.registerProvider({
      id: PROVIDER_ID,
      label: "AI/ML API",
      docsPath: "/providers/models",
      envVars: ["AIMLAPI_API_KEY"],
      auth: [
        createProviderApiKeyAuthMethod({
          providerId: PROVIDER_ID,
          methodId: "api-key",
          label: "AI/ML API key",
          hint: "One API key for multiple model families",
          optionKey: "aimlapiApiKey",
          flagName: "--aimlapi-api-key",
          envVar: "AIMLAPI_API_KEY",
          promptMessage: "Enter AI/ML API key",
          defaultModel: DEFAULT_MODEL_REF,
          wizard: {
            choiceId: "aimlapi-api-key",
            choiceLabel: "AI/ML API key",
            choiceHint: "OpenAI-compatible multi-model inference",
            groupId: PROVIDER_ID,
            groupLabel: "AI/ML API",
            groupHint: "One API key for multiple model families"
          }
        })
      ],
      wrapStreamFn: (ctx) => {
        if (!ctx.streamFn) {
          return;
        }
        const inner = ctx.streamFn;
        return (model, context, options) => inner(model, context, withAimlapiAttributionHeaders(options));
      }
    });
  }
});
export {
  withAimlapiAttributionHeaders,
  aimlapi_default as default,
  AIMLAPI_ATTRIBUTION_HEADERS
};
