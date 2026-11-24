---
summary: "Use AI/ML API models, web search, video generation, MCP tools and skills with OpenClaw"
read_when:
  - You want to use AI/ML API models with OpenClaw
  - You want one API key for chat, web search and video generation
title: "AI/ML API"
---

[AI/ML API](https://aimlapi.com) serves 300+ models from many vendors behind one
OpenAI-compatible API key. OpenClaw uses it through the AI/ML API-maintained
provider plugin.

| Capability       | What the plugin adds                                                                                |
| ---------------- | --------------------------------------------------------------------------------------------------- |
| Text inference   | `aimlapi/<vendor>/<model>`, catalog discovered live with context size, reasoning, vision and prices |
| Web search       | `web_search` provider `aimlapi`                                                                     |
| Video generation | `aimlapi/...` video models                                                                          |
| MCP              | The AI/ML API MCP server (`aimlapi`) while the plugin is enabled                                    |
| Skills           | `aimlapi-*` agent skills for the AI/ML API APIs                                                     |

## Install

Install the external
[`@aimlapi/openclaw-provider` plugin](https://hub.openclaw.ai/aimlapi/plugins/openclaw-provider):

```bash
openclaw plugins install @aimlapi/openclaw-provider
```

Then choose **AI/ML API key** in `openclaw onboard`, or pass
`--aimlapi-api-key <key>`. Keys are at
[aimlapi.com/app/keys](https://aimlapi.com/app/keys).

Follow [AI/ML API's OpenClaw guide](https://docs.aimlapi.com/integrations/openclaw)
for model choice, the MCP server and skills. The plugin owns the AI/ML API model
catalog and request compatibility.

## Environment

If you use `AIMLAPI_API_KEY`, make it available to the **Gateway process** before
restarting the Gateway. For a managed service, put it in the global runtime
`.env` file or the service environment. Exporting it later in an interactive
shell does not update the running service. See [Environment variables](/help/environment).

The plugin's MCP server reads its key from `AIMLAPI_API_KEY` only; a key saved
through `openclaw onboard` is not passed to MCP. To sign in to the MCP server
in the browser instead, override it with `auth: "oauth"` and run
`openclaw mcp login aimlapi` (see [MCP transports and OAuth](/cli/mcp/transports)).
