import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { AgentMessage, StreamFn } from "@mariozechner/pi-agent-core";
import { resolveStateDir } from "../config/paths.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { resolveUserPath } from "../utils.js";
import { parseBooleanValue } from "../utils/boolean.js";

type PayloadLogStage = "request" | "response" | "error" | "prompt-start" | "prompt-finish";

type PayloadLogEvent = {
  ts: string;
  stage: PayloadLogStage;
  runId?: string;
  sessionId?: string;
  sessionKey?: string;
  provider?: string;
  modelId?: string;
  modelApi?: string | null;
  workspaceDir?: string;
  payload?: unknown;
  payloadDigest?: string;
  response?: unknown;
  responseDigest?: string;
  error?: string;
  info?: Record<string, unknown>;
};

type PayloadLogConfig = {
  enabled: boolean;
  filePath: string;
};

type PayloadLogWriter = {
  filePath: string;
  write: (line: string) => void;
};

const writers = new Map<string, PayloadLogWriter>();
const log = createSubsystemLogger("agent/aimlapi-payload");

function resolvePayloadLogConfig(env: NodeJS.ProcessEnv): PayloadLogConfig {
  const enabled = parseBooleanValue(env.OPENCLAW_AIMLAPI_PAYLOAD_LOG) ?? false;
  const fileOverride = env.OPENCLAW_AIMLAPI_PAYLOAD_LOG_FILE?.trim();
  const filePath = fileOverride
    ? resolveUserPath(fileOverride)
    : path.join(resolveStateDir(env), "logs", "aimlapi-payload.jsonl");
  return { enabled, filePath };
}

function getWriter(filePath: string): PayloadLogWriter {
  const existing = writers.get(filePath);
  if (existing) {
    return existing;
  }

  const dir = path.dirname(filePath);
  const ready = fs.mkdir(dir, { recursive: true }).catch(() => undefined);
  let queue = Promise.resolve();

  const writer: PayloadLogWriter = {
    filePath,
    write: (line: string) => {
      queue = queue
        .then(() => ready)
        .then(() => fs.appendFile(filePath, line, "utf8"))
        .catch(() => undefined);
    },
  };

  writers.set(filePath, writer);
  return writer;
}

function safeJsonStringify(value: unknown): string | null {
  try {
    return JSON.stringify(value, (_key, val) => {
      if (typeof val === "bigint") {
        return val.toString();
      }
      if (typeof val === "function") {
        return "[Function]";
      }
      if (val instanceof Error) {
        return { name: val.name, message: val.message, stack: val.stack };
      }
      if (val instanceof Uint8Array) {
        return { type: "Uint8Array", data: Buffer.from(val).toString("base64") };
      }
      return val;
    });
  } catch {
    return null;
  }
}

function formatUnknownError(value: unknown, fallback = "unknown error"): string {
  if (value instanceof Error) {
    return value.message;
  }
  if (typeof value === "string") {
    return value;
  }
  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint" ||
    typeof value === "symbol"
  ) {
    return String(value);
  }
  if (value && typeof value === "object") {
    return safeJsonStringify(value) ?? fallback;
  }
  return fallback;
}

function digest(value: unknown): string | undefined {
  const serialized = safeJsonStringify(value);
  if (!serialized) {
    return undefined;
  }
  return crypto.createHash("sha256").update(serialized).digest("hex");
}

function summarizeAssistant(messages: AgentMessage[]) {
  const lastAssistant = messages
    .slice()
    .toReversed()
    .find((entry) => entry.role === "assistant") as
    | {
        role?: unknown;
        provider?: unknown;
        model?: unknown;
        errorMessage?: unknown;
        content?: unknown;
      }
    | undefined;
  if (!lastAssistant) {
    return null;
  }
  return {
    provider: lastAssistant.provider,
    model: lastAssistant.model,
    hasErrorMessage:
      typeof lastAssistant.errorMessage === "string" && lastAssistant.errorMessage.length > 0,
    errorMessage:
      lastAssistant.errorMessage !== undefined
        ? formatUnknownError(lastAssistant.errorMessage, "")
        : undefined,
    content: lastAssistant.content,
  };
}

export type AimlapiPayloadLogger = {
  enabled: true;
  wrapStreamFn: (streamFn: StreamFn) => StreamFn;
  recordPromptStart: (params: { prompt: string; messageCount: number; imageCount: number }) => void;
  recordPromptFinish: (params: {
    durationMs: number;
    messageCount: number;
    aborted: boolean;
    timedOut: boolean;
  }) => void;
  recordPromptError: (error: unknown) => void;
  recordResponse: (messages: AgentMessage[]) => void;
};

export function createAimlapiPayloadLogger(params: {
  env?: NodeJS.ProcessEnv;
  runId?: string;
  sessionId?: string;
  sessionKey?: string;
  provider?: string;
  modelId?: string;
  modelApi?: string | null;
  workspaceDir?: string;
}): AimlapiPayloadLogger | null {
  const env = params.env ?? process.env;
  const cfg = resolvePayloadLogConfig(env);
  if (!cfg.enabled) {
    return null;
  }
  if (params.provider !== "aimlapi") {
    return null;
  }

  const writer = getWriter(cfg.filePath);
  const base = {
    runId: params.runId,
    sessionId: params.sessionId,
    sessionKey: params.sessionKey,
    provider: params.provider,
    modelId: params.modelId,
    modelApi: params.modelApi,
    workspaceDir: params.workspaceDir,
  };

  const record = (event: PayloadLogEvent) => {
    const line = safeJsonStringify(event);
    if (!line) {
      return;
    }
    writer.write(`${line}\n`);
  };

  const wrapStreamFn: AimlapiPayloadLogger["wrapStreamFn"] = (streamFn) => {
    const wrapped: StreamFn = (model, context, options) => {
      const nextOnPayload = (payload: unknown) => {
        const payloadRecord = payload as {
          tools?: unknown[];
          messages?: unknown[];
        };
        record({
          ...base,
          ts: new Date().toISOString(),
          stage: "request",
          payload,
          payloadDigest: digest(payload),
          info: {
            toolsCount: Array.isArray(payloadRecord?.tools)
              ? payloadRecord.tools.length
              : undefined,
            messagesCount: Array.isArray(payloadRecord?.messages)
              ? payloadRecord.messages.length
              : undefined,
          },
        });
        options?.onPayload?.(payload);
      };
      return streamFn(model, context, {
        ...options,
        onPayload: nextOnPayload,
      });
    };
    return wrapped;
  };

  const recordPromptStart: AimlapiPayloadLogger["recordPromptStart"] = (info) => {
    record({
      ...base,
      ts: new Date().toISOString(),
      stage: "prompt-start",
      info,
    });
  };

  const recordPromptFinish: AimlapiPayloadLogger["recordPromptFinish"] = (info) => {
    record({
      ...base,
      ts: new Date().toISOString(),
      stage: "prompt-finish",
      info,
    });
  };

  const recordPromptError: AimlapiPayloadLogger["recordPromptError"] = (error) => {
    const message = formatUnknownError(error);
    record({
      ...base,
      ts: new Date().toISOString(),
      stage: "error",
      error: message,
    });
    log.warn("aimlapi payload logger: captured prompt error", {
      runId: params.runId,
      sessionId: params.sessionId,
      error: message.slice(0, 1200),
    });
  };

  const recordResponse: AimlapiPayloadLogger["recordResponse"] = (messages) => {
    const response = {
      messages,
      assistantSummary: summarizeAssistant(messages),
    };
    record({
      ...base,
      ts: new Date().toISOString(),
      stage: "response",
      response,
      responseDigest: digest(response),
      info: { messageCount: messages.length },
    });
  };

  log.info("aimlapi payload logger enabled", { filePath: writer.filePath });
  return {
    enabled: true,
    wrapStreamFn,
    recordPromptStart,
    recordPromptFinish,
    recordPromptError,
    recordResponse,
  };
}
