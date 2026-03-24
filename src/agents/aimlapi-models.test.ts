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

  it("caches the static catalog after a discovery failure", async () => {
    delete process.env.VITEST;
    delete process.env.NODE_ENV;

    const mockFetch = vi.fn(async () => {
      throw new Error("network unavailable");
    });
    global.fetch = mockFetch as typeof fetch;

    const module = await import("./aimlapi-models.js");
    const first = await module.discoverAimlapiModels();
    const second = await module.discoverAimlapiModels();

    expect(first).toEqual(module.AIMLAPI_STATIC_CATALOG);
    expect(second).toEqual(module.AIMLAPI_STATIC_CATALOG);
    expect(first).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: module.AIMLAPI_DEFAULT_MODEL_ID,
        }),
      ]),
    );
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
