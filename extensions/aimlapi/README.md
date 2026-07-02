# AI/ML API provider for OpenClaw

This plugin adds AI/ML API to OpenClaw onboarding and the model picker through
OpenClaw's provider-plugin SDK.

## Install

```bash
openclaw plugins install clawhub:@aimlapi/openclaw-provider
openclaw onboard --aimlapi-api-key <key>
```

The plugin uses `https://api.aimlapi.com/v1`, bearer authentication through
`AIMLAPI_API_KEY`, and a curated text/chat catalog. The default model is
`aimlapi/openai/gpt-5-chat`.

Every inference request includes the AI/ML API rebates attribution contract:

```text
X-AIMLAPI-Partner-ID: openclaw
X-AIMLAPI-Integration-Repo: openclaw/openclaw
X-AIMLAPI-Integration-Version: 1.0.0
```
