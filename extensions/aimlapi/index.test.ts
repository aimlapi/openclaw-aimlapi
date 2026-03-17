import { describe, expect, it, vi } from "vitest";
import aimlapiPlugin from "./index.js";
import { registerSingleProviderPlugin } from "../../src/test-utils/plugin-registration.js";

describe("AIMLAPI provider plugin", () => {
  it("normalizes tool schemas before sending the payload", async () => {
    const provider = registerSingleProviderPlugin(aimlapiPlugin);
    const wrapStreamFn = provider.wrapStreamFn;
    expect(wrapStreamFn).toBeTypeOf("function");

    const payload = {
      tools: [
        {
          name: "example_tool",
          description: "Example",
          parameters: {
            anyOf: [
              {
                type: "object",
                properties: {
                  action: {
                    const: "run",
                  },
                },
                required: ["action"],
              },
              {
                type: "object",
                properties: {
                  action: {
                    const: "stop",
                  },
                },
                required: ["action"],
              },
            ],
          },
        },
      ],
    };

    const baseStreamFn = vi.fn(async (_model, _context, options) => {
      options?.onPayload?.(payload, _model);
      return {} as never;
    });

    const wrapped = wrapStreamFn?.({
      provider: "aimlapi",
      modelId: "openai/gpt-5-nano-2025-08-07",
      extraParams: {},
      streamFn: baseStreamFn,
    });

    await wrapped?.(
      {
        id: "openai/gpt-5-nano-2025-08-07",
        provider: "aimlapi",
      } as never,
      {} as never,
      {},
    );

    expect(baseStreamFn).toHaveBeenCalledOnce();
    expect(payload.tools[0]?.parameters).toMatchObject({
      type: "object",
      properties: {
        action: {
          enum: ["run", "stop"],
        },
      },
      required: ["action"],
    });
    expect(payload.tools[0]?.parameters).not.toHaveProperty("additionalProperties");
  });

  it("broadens unsupported tool_choice payloads before sending", async () => {
    const provider = registerSingleProviderPlugin(aimlapiPlugin);
    const wrapStreamFn = provider.wrapStreamFn;
    expect(wrapStreamFn).toBeTypeOf("function");

    const payload: Record<string, unknown> = {
      tool_choice: "required",
      tools: [
        {
          name: "read",
          description: "Read a file",
          parameters: {
            type: "object",
            properties: {},
          },
        },
      ],
    };

    const baseStreamFn = vi.fn(async (_model, _context, options) => {
      options?.onPayload?.(payload, _model);
      return {} as never;
    });

    const wrapped = wrapStreamFn?.({
      provider: "aimlapi",
      modelId: "openai/gpt-5-nano-2025-08-07",
      extraParams: {},
      streamFn: baseStreamFn,
    });

    await wrapped?.(
      {
        id: "openai/gpt-5-nano-2025-08-07",
        provider: "aimlapi",
      } as never,
      {} as never,
      {},
    );

    expect(baseStreamFn).toHaveBeenCalledOnce();
    expect(payload.tool_choice).toBe("auto");
  });

  it("converts pinned tool_choice payloads to OpenAI function format", async () => {
    const provider = registerSingleProviderPlugin(aimlapiPlugin);
    const wrapStreamFn = provider.wrapStreamFn;
    expect(wrapStreamFn).toBeTypeOf("function");

    const payload: Record<string, unknown> = {
      tool_choice: { type: "tool", name: "read" },
      tools: [
        {
          name: "read",
          description: "Read a file",
          parameters: {
            type: "object",
            properties: {},
          },
        },
      ],
    };

    const baseStreamFn = vi.fn(async (_model, _context, options) => {
      options?.onPayload?.(payload, _model);
      return {} as never;
    });

    const wrapped = wrapStreamFn?.({
      provider: "aimlapi",
      modelId: "openai/gpt-5-nano-2025-08-07",
      extraParams: {},
      streamFn: baseStreamFn,
    });

    await wrapped?.(
      {
        id: "openai/gpt-5-nano-2025-08-07",
        provider: "aimlapi",
      } as never,
      {} as never,
      {},
    );

    expect(baseStreamFn).toHaveBeenCalledOnce();
    expect(payload.tool_choice).toEqual({
      type: "function",
      function: { name: "read" },
    });
  });

  it("removes AIMLAPI-unsupported schema keywords before sending", async () => {
    const provider = registerSingleProviderPlugin(aimlapiPlugin);
    const wrapStreamFn = provider.wrapStreamFn;
    expect(wrapStreamFn).toBeTypeOf("function");

    const payload = {
      tools: [
        {
          name: "example_tool",
          description: "Example",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: ["string", "null"],
                format: "email",
                minLength: 3,
              },
            },
            required: ["query"],
            additionalProperties: false,
          },
        },
      ],
    };

    const baseStreamFn = vi.fn(async (_model, _context, options) => {
      options?.onPayload?.(payload, _model);
      return {} as never;
    });

    const wrapped = wrapStreamFn?.({
      provider: "aimlapi",
      modelId: "openai/gpt-5-nano-2025-08-07",
      extraParams: {},
      streamFn: baseStreamFn,
    });

    await wrapped?.(
      {
        id: "openai/gpt-5-nano-2025-08-07",
        provider: "aimlapi",
      } as never,
      {} as never,
      {},
    );

    expect(baseStreamFn).toHaveBeenCalledOnce();
    expect(payload.tools[0]?.parameters).toEqual({
      type: "object",
      properties: {
        query: {
          type: "string",
        },
      },
      required: ["query"],
    });
  });

  it("rewrites assistant null content in outbound messages", async () => {
    const provider = registerSingleProviderPlugin(aimlapiPlugin);
    const wrapStreamFn = provider.wrapStreamFn;
    expect(wrapStreamFn).toBeTypeOf("function");

    const payload: Record<string, unknown> = {
      messages: [
        { role: "user", content: "hello" },
        { role: "assistant", content: null, tool_calls: [{ id: "call_1" }] },
      ],
    };

    const baseStreamFn = vi.fn(async (_model, _context, options) => {
      options?.onPayload?.(payload, _model);
      return {} as never;
    });

    const wrapped = wrapStreamFn?.({
      provider: "aimlapi",
      modelId: "openai/gpt-5-nano-2025-08-07",
      extraParams: {},
      streamFn: baseStreamFn,
    });

    await wrapped?.(
      {
        id: "openai/gpt-5-nano-2025-08-07",
        provider: "aimlapi",
      } as never,
      {} as never,
      {},
    );

    expect(baseStreamFn).toHaveBeenCalledOnce();
    expect((payload.messages as Array<Record<string, unknown>>)[1]?.content).toBe("");
  });
});
