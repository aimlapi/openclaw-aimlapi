import { createCapturedPluginRegistration } from "openclaw/plugin-sdk/plugin-test-runtime";
import { describe, expect, it } from "vitest";
import aimlapiPlugin, {
  AIMLAPI_ATTRIBUTION_HEADERS,
  withAimlapiAttributionHeaders,
} from "./index.js";

describe("aimlapi provider plugin", () => {
  it("registers the branded provider", () => {
    const captured = createCapturedPluginRegistration();

    aimlapiPlugin.register(captured.api);

    expect(captured.providers.map((provider) => provider.id)).toEqual(["aimlapi"]);
    expect(captured.providers[0]?.label).toBe("AI/ML API");
    expect(captured.providers[0]?.envVars).toEqual(["AIMLAPI_API_KEY"]);
  });

  it("adds the rebates attribution contract without dropping caller headers", () => {
    expect(withAimlapiAttributionHeaders({ headers: { Authorization: "Bearer test" } })).toEqual({
      headers: {
        authorization: "Bearer test",
        "x-aimlapi-integration-repo": "openclaw/openclaw",
        "x-aimlapi-integration-version": "1.0.0",
        "x-aimlapi-partner-id": "openclaw",
      },
    });
  });

  it("adds attribution headers to a runtime inference request", async () => {
    const captured = createCapturedPluginRegistration();
    aimlapiPlugin.register(captured.api);
    const provider = captured.providers[0];
    let receivedOptions: { headers?: HeadersInit } | undefined;
    const wrapped = provider?.wrapStreamFn?.({
      provider: "aimlapi",
      modelId: "openai/gpt-5-chat",
      model: { api: "openai-completions" },
      streamFn: ((_model, _context, options) => {
        receivedOptions = options;
        return {};
      }) as never,
    } as never);

    expect(wrapped).toBeTypeOf("function");
    await wrapped?.({ provider: "aimlapi" } as never, {} as never, {
      headers: { Authorization: "Bearer test" },
    });

    expect(receivedOptions?.headers).toEqual({
      authorization: "Bearer test",
      "x-aimlapi-integration-repo": "openclaw/openclaw",
      "x-aimlapi-integration-version": "1.0.0",
      "x-aimlapi-partner-id": "openclaw",
    });
  });
});
