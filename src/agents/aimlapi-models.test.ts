import { afterEach, describe, expect, it, vi } from "vitest";

describe("discoverAimlapiModels", () => {
  const originalFetch = global.fetch;
  const originalVitest = process.env.VITEST;
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalVitest === undefined) {
      delete process.env.VITEST;
    } else {
      process.env.VITEST = originalVitest;
    }
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("retries discovery after a fallback response instead of pinning the static catalog", async () => {
    delete process.env.VITEST;
    delete process.env.NODE_ENV;

    const discoveredCatalog = [
      {
        id: "openai/gpt-5-nano-2025-08-07",
        type: "chat-completion",
        info: {
          name: "GPT-5 Nano (2025-08-07)",
          contextLength: 128000,
          maxTokens: 16384,
        },
        features: [],
      },
      {
        id: "openai/gpt-4.1-mini",
        type: "chat-completion",
        info: {
          name: "GPT-4.1 Mini",
          contextLength: 128000,
          maxTokens: 16384,
        },
        features: [],
      },
    ];
    const mockFetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("network unavailable"))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: discoveredCatalog }),
      });
    global.fetch = mockFetch as typeof fetch;

    const module = await import("./aimlapi-models.js");
    const first = await module.discoverAimlapiModels();
    const second = await module.discoverAimlapiModels();

    expect(first).toEqual(module.AIMLAPI_STATIC_CATALOG);
    expect(second).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "openai/gpt-5-nano-2025-08-07",
        }),
        expect.objectContaining({
          id: "openai/gpt-4.1-mini",
        }),
      ]),
    );
    expect(first).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: module.AIMLAPI_DEFAULT_MODEL_ID,
        }),
      ]),
    );
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
