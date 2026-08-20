// AI/ML API plugin entrypoint registers its OpenClaw integration.
import { readConfiguredProviderCatalogEntries } from "openclaw/plugin-sdk/provider-catalog-shared";
import { defineSingleProviderPluginEntry } from "openclaw/plugin-sdk/provider-entry";
import { buildProviderReplayFamilyHooks } from "openclaw/plugin-sdk/provider-model-shared";
import { buildProviderToolCompatFamilyHooks } from "openclaw/plugin-sdk/provider-tools";
import manifest from "./openclaw.plugin.json" with { type: "json" };

const PROVIDER_ID = "aimlapi";

export default defineSingleProviderPluginEntry({
  id: PROVIDER_ID,
  name: "AI/ML API Provider",
  description: "AI/ML API model provider plugin for OpenClaw",
  manifest,
  provider: {
    label: "AI/ML API",
    docsPath: "/providers/aimlapi",
    manifestAuth: {
      noteTitle: "AI/ML API",
      noteMessage: "Manage API keys at https://aimlapi.com/app/keys",
    },
    catalog: {
      allowExplicitBaseUrl: true,
      liveModelDiscovery: false,
    },
    augmentModelCatalog: ({ config }) =>
      readConfiguredProviderCatalogEntries({
        config,
        providerId: PROVIDER_ID,
      }),
    ...buildProviderReplayFamilyHooks({
      family: "openai-compatible",
      dropReasoningFromHistory: false,
    }),
    ...buildProviderToolCompatFamilyHooks("openai"),
  },
});
