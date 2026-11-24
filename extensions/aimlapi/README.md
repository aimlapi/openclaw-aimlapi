# AI/ML API

Use 300+ models from [AI/ML API](https://aimlapi.com) in OpenClaw with one API
key: chat models, web search, video generation, the AI/ML API MCP server and
agent skills.

## Get started

Create a key at [aimlapi.com/app/keys](https://aimlapi.com/app/keys), then run:

```bash
openclaw onboard --aimlapi-api-key <key>
```

You can also provide `AIMLAPI_API_KEY` in the Gateway's environment. Browse
models with `openclaw models list --provider aimlapi`; the catalog (context
size, reasoning, vision, prices) is read live from AI/ML API.

Set `aimlapi/<vendor>/<model>` as the default model, for example
`aimlapi/openai/gpt-5.6-terra`.

## Web search and video

`web_search` uses provider `aimlapi` with an AI/ML API key. Video models are
under `agents.defaults.mediaModels.video`, for example
`aimlapi/google/veo-3.1-t2v-fast`.

## MCP server

The plugin declares the AI/ML API MCP server (`https://mcp.aimlapi.com/mcp`,
Streamable HTTP) with `Authorization: Bearer ${AIMLAPI_API_KEY}`. It needs
`AIMLAPI_API_KEY` in the Gateway's environment; a key saved only by onboarding
is not passed to MCP. Without the key the server fails to connect and is
skipped. To sign in through the browser instead, override it:

```bash
openclaw mcp set aimlapi '{"url":"https://mcp.aimlapi.com/mcp","transport":"streamable-http","auth":"oauth"}'
openclaw mcp login aimlapi
```

## Skills

`skills/` holds the agent skills of [`@ai-ml.api/skills`](https://github.com/aimlapi/skills)
(Apache-2.0, `skills/LICENSE`): chat, images, speech, video jobs, batch,
webhooks, costs, errors, models, protocols, decisions, sandbox and setup. They
load while the plugin is enabled.
