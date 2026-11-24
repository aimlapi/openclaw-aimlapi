import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AIMLAPI_ATTRIBUTION_HEADERS,
  AIMLAPI_MAX_OUTPUT_TOKENS_CAP,
  buildAimlapiCatalogUrl,
  buildAimlapiStaticCatalog,
  discoverAimlapiModels,
  mapAimlapiCatalog,
  mapAimlapiModel,
  mapAimlapiPricing,
  resetAimlapiDiscoveryCache,
  type AimlapiCatalogModel,
} from "./runtime-api.js";

// Shape of GET /v1/models?type=openai/chat-completions&include=capabilities,modalities,pricing
const daisyRose: AimlapiCatalogModel = {
  id: "radixark/daisyrose-27b",
  type: "openai/chat-completions",
  info: { name: "DaisyRose 27B", contextLength: 262144, outputMax: 235929 },
  capabilities: ["reasoning", "streaming", "structured_output", "tools", "vision"],
  pricing: {
    units: [
      {
        name: "token",
        content: "text",
        origin: "provided",
        author: "user",
        price: 0.2116,
        per: 1_000_000,
      },
      {
        name: "token",
        content: "text",
        origin: "cached",
        author: "user",
        price: 0.0529,
        per: 1_000_000,
      },
      {
        name: "token",
        content: "text",
        origin: "generated",
        author: "model",
        price: 2.645,
        per: 1_000_000,
      },
      {
        name: "token",
        content: "text",
        origin: "generated",
        author: "model",
        price: 9,
        per: 1_000_000,
        tag: "reasoning",
      },
      {
        name: "call",
        content: "structured",
        origin: "generated",
        author: "tool",
        price: 0,
        per: 1,
      },
    ],
  },
};

afterEach(() => {
  resetAimlapiDiscoveryCache();
  vi.restoreAllMocks();
});

describe("catalogue mapping", () => {
  it("maps capabilities, limits and per-million prices", () => {
    expect(mapAimlapiModel(daisyRose)).toEqual({
      id: "radixark/daisyrose-27b",
      name: "DaisyRose 27B",
      reasoning: true,
      input: ["text", "image"],
      cost: { input: 0.2116, output: 2.645, cacheRead: 0.0529, cacheWrite: 0 },
      contextWindow: 262144,
      maxTokens: AIMLAPI_MAX_OUTPUT_TOKENS_CAP,
    });
  });

  it("prefers the untagged unit and divides by per", () => {
    expect(
      mapAimlapiPricing({
        id: "x",
        pricing: {
          units: [
            {
              name: "token",
              content: "text",
              origin: "generated",
              tag: "reasoning",
              price: 9,
              per: 1_000_000,
            },
            { name: "token", content: "text", origin: "generated", price: 0.6, per: 1_000_000 },
            { name: "token", content: "text", origin: "provided", price: 15, per: 1000 },
          ],
        },
      }),
    ).toEqual({ input: 15000, output: 0.6, cacheRead: 0, cacheWrite: 0 });
  });

  it("defaults missing limits and treats a text-only model as text input", () => {
    expect(mapAimlapiModel({ id: "vendor/plain", type: "openai/chat-completions" })).toMatchObject({
      name: "vendor/plain",
      reasoning: false,
      input: ["text"],
      contextWindow: 128000,
      maxTokens: 16384,
    });
  });

  it("keeps only chat-completions models", () => {
    const models = mapAimlapiCatalog([
      daisyRose,
      { id: "google/veo-3.1-t2v-fast", type: "internal/video-generations/submit" },
      { id: "anthropic/claude-haiku-5-5", type: "anthropic/messages" },
      { id: "", type: "openai/chat-completions" },
    ]);
    expect(models.map((model) => model.id)).toEqual(["radixark/daisyrose-27b"]);
  });

  it("asks the catalogue for chat models with capabilities and prices", () => {
    const url = new URL(buildAimlapiCatalogUrl());
    expect(url.origin + url.pathname).toBe("https://api.aimlapi.com/v1/models");
    expect(url.searchParams.get("type")).toBe("openai/chat-completions");
    expect(url.searchParams.get("include")).toBe("capabilities,modalities,pricing");
  });
});

describe("discovery", () => {
  it("fetches the public catalogue without a key and caches it", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: [daisyRose] })));
    const first = await discoverAimlapiModels(fetchMock as unknown as typeof fetch);
    const second = await discoverAimlapiModels(fetchMock as unknown as typeof fetch);

    expect(first.map((model) => model.id)).toEqual(["radixark/daisyrose-27b"]);
    expect(second).toBe(first);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers).toMatchObject(AIMLAPI_ATTRIBUTION_HEADERS);
    expect(Object.keys(headers).map((name) => name.toLowerCase())).not.toContain("authorization");
  });

  it("falls back to the static catalogue on an error status, empty list or network failure", async () => {
    const fallback = buildAimlapiStaticCatalog().map((model) => model.id);
    const cases = [
      async () => new Response("nope", { status: 503 }),
      async () => new Response(JSON.stringify({ data: [] })),
      async () => {
        throw new Error("offline");
      },
    ];
    for (const impl of cases) {
      resetAimlapiDiscoveryCache();
      const models = await discoverAimlapiModels(vi.fn(impl) as unknown as typeof fetch);
      expect(models.map((model) => model.id)).toEqual(fallback);
    }
  });

  it("retries after a fallback instead of caching it", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [daisyRose] })));
    await discoverAimlapiModels(fetchMock as unknown as typeof fetch);
    const models = await discoverAimlapiModels(fetchMock as unknown as typeof fetch);
    expect(models.map((model) => model.id)).toEqual(["radixark/daisyrose-27b"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
