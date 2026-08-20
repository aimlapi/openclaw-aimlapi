# AI/ML API provider for OpenClaw

Adds AI/ML API to OpenClaw onboarding and the model picker as an
OpenAI-compatible provider.

## Install

```sh
openclaw plugins install @aimlapi/openclaw-provider
openclaw gateway restart
```

## Configuration

Select **AI/ML API** during onboarding, or run:

```sh
openclaw onboard --aimlapi-api-key <key>
```

Manage keys at https://aimlapi.com/app/keys. The plugin uses
`https://api.aimlapi.com/v1`, bearer authentication through `AIMLAPI_API_KEY`,
and a curated text/chat catalog. The default model is
`aimlapi/openai/gpt-5-chat`.

Every inference request carries the AI/ML API partner attribution headers:

```text
X-AIMLAPI-Source: agent/openclaw
X-AIMLAPI-Partner-ID: part_xKZeoMXjy4GOKOqmmziVxWcX
```

## Docs

See the published docs at `https://docs.aimlapi.com/quickstart/openclaw`.
