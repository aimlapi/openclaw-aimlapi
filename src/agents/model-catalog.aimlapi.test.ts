import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import { __setModelCatalogImportForTest, loadModelCatalog } from "./model-catalog.js";
import { resetModelCatalogCacheForTest } from "./model-catalog.js";

const augmentModelCatalogWithProviderPlugins = vi.fn();

vi.mock("./models-config.js", () => ({
  ensureOpenClawModelsJson: vi.fn().mockResolvedValue({ agentDir: "/tmp/openclaw", wrote: false }),
}));

vi.mock("./agent-paths.js", () => ({
  resolveOpenClawAgentDir: () => "/tmp/openclaw",
}));

vi.mock("../plugins/provider-runtime.runtime.js", () => ({
  augmentModelCatalogWithProviderPlugins: (params: unknown) =>
    augmentModelCatalogWithProviderPlugins(params),
}));

describe("loadModelCatalog AIMLAPI augmentation", () => {
  beforeEach(() => {
    resetModelCatalogCacheForTest();
    augmentModelCatalogWithProviderPlugins.mockReset();
    __setModelCatalogImportForTest(
      async () =>
        ({
          discoverAuthStorage: () => ({}),
          AuthStorage: class {},
          ModelRegistry: class {
            getAll() {
              return [{ id: "gpt-4.1", provider: "openai", name: "GPT-4.1" }];
            }
          },
        }) as never,
    );
  });

  afterEach(() => {
    __setModelCatalogImportForTest();
    resetModelCatalogCacheForTest();
    vi.restoreAllMocks();
  });

  it("merges AIMLAPI rows returned by provider runtime augmentation", async () => {
    augmentModelCatalogWithProviderPlugins.mockResolvedValue([
      {
        provider: "aimlapi",
        id: "openai/gpt-5-nano-2025-08-07",
        name: "GPT-5 Nano",
      },
    ]);

    const result = await loadModelCatalog({ config: {} as OpenClawConfig });

    expect(result).toContainEqual({
      provider: "aimlapi",
      id: "openai/gpt-5-nano-2025-08-07",
      name: "GPT-5 Nano",
    });
  });

  it("does not duplicate AIMLAPI rows already present in the discovered catalog", async () => {
    __setModelCatalogImportForTest(
      async () =>
        ({
          discoverAuthStorage: () => ({}),
          AuthStorage: class {},
          ModelRegistry: class {
            getAll() {
              return [
                { id: "gpt-4.1", provider: "openai", name: "GPT-4.1" },
                {
                  id: "openai/gpt-5-nano-2025-08-07",
                  provider: "aimlapi",
                  name: "GPT-5 Nano",
                },
              ];
            }
          },
        }) as never,
    );
    augmentModelCatalogWithProviderPlugins.mockResolvedValue([
      {
        provider: "aimlapi",
        id: "openai/gpt-5-nano-2025-08-07",
        name: "GPT-5 Nano",
      },
    ]);

    const result = await loadModelCatalog({ config: {} as OpenClawConfig });
    const matches = result.filter(
      (entry) => entry.provider === "aimlapi" && entry.id === "openai/gpt-5-nano-2025-08-07",
    );

    expect(matches).toHaveLength(1);
  });
});
