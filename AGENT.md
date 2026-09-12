# GPT Polisher Development Guide

This repository contains the hosted GPT Polisher service. The public `README.md` is user-facing and must not include
self-hosting or deployment instructions; keep operational and development details here instead.

## Architecture

1. ChatGPT connects to the Worker at `/mcp` and starts MCP OAuth.
2. `apps/hono/src/worker.ts` keeps OAuth and MCP routes on the Worker and delegates hosted pages to Astro.
3. Astro renders the landing and setup routes with React components; those components call the Hono JSON API for setup
   data and actions.
4. `apps/hono/src/google-handler.ts` handles Google OAuth and project setup API requests without rendering frontend HTML.
5. Google refresh tokens are encrypted with AES-256-GCM and stored in the `USER_CREDENTIALS` KV namespace.
6. `apps/hono/src/index.ts` exposes the `rewrite_response` and `connection_info` MCP tools.
7. `apps/hono/src/google.ts` refreshes access tokens and calls Gemini with the selected project in `x-goog-user-project`.

## Important files

- `apps/hono/src/worker.ts` — Worker entry point and Astro/backend request routing.
- `apps/hono/src/index.ts` — Durable Object and MCP tool registration.
- `apps/astro/src/pages/index.astro` and `apps/astro/src/pages/setup.astro` — Astro-hosted frontend routes.
- `apps/astro/src/components/LandingPage.tsx` and `apps/astro/src/components/SetupPage.tsx` — React frontend UI and interactions.
- `apps/astro/src/styles/globals.css` — shared landing and setup page styles.
- `apps/hono/src/google-handler.ts` — Hono OAuth routes and project setup JSON API.
- `apps/hono/src/google.ts` — Google OAuth, project, API enablement, and Gemini calls.
- `apps/hono/src/crypto.ts` — credential encryption and decryption.
- `apps/astro/src/examples.ts` — examples rendered by the hosted website.
- `apps/hono/wrangler.jsonc` — Cloudflare Worker, Durable Object, KV, and development port configuration.
- `apps/hono/worker-configuration.d.ts` — Worker binding types.

## Commands

- `pnpm install` — install dependencies.
- `pnpm dev` — run Astro and the Worker locally on port 8788.
- `pnpm build` — build the Astro site and Worker bundle.
- `pnpm type-check` — run TypeScript checks without emitting files.
- `pnpm cf-typegen` — regenerate Cloudflare binding types after configuration changes.
- `pnpm deploy` — deploy the hosted service; only run when explicitly requested.

## Environment and Cloudflare bindings

Local development uses `apps/hono/.dev.vars`, based on `apps/hono/.dev.vars.example`. Existing root `.env`/`.dev.vars` files must be migrated there locally; never commit their values. Never commit `.dev.vars` or secret values.

Required secrets:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `COOKIE_ENCRYPTION_KEY`
- `CREDENTIAL_ENCRYPTION_KEY` — base64-encoded 32-byte key

Optional secret:

- `HOSTED_DOMAIN` — restricts Google logins to one Workspace domain

Required bindings configured in `apps/hono/wrangler.jsonc`:

- `OAUTH_KV` — OAuth provider and temporary authorization state
- `USER_CREDENTIALS` — encrypted Google credentials and selected project
- `MCP_OBJECT` — `MyMCP` Durable Object

## Google Cloud configuration

The OAuth client is a Web application. Its local redirect URI is `http://localhost:8788/callback`; production uses the
hosted Worker's `/callback` endpoint.

The OAuth client's project needs these APIs enabled:

- Cloud Resource Manager API (`cloudresourcemanager.googleapis.com`)
- Service Usage API (`serviceusage.googleapis.com`)
- Generative Language API (`generativelanguage.googleapis.com`)

Requested Google scopes are defined by `GOOGLE_SCOPES` in `apps/hono/src/google.ts`. The selected user quota project also needs
the Generative Language API; the setup flow attempts to enable it.

## Validation

Run `pnpm type-check` after TypeScript or configuration changes. For MCP integration checks, run MCP Inspector and
connect to the local or hosted `/mcp` endpoint.

Do not commit generated local state from `node_modules`, `.wrangler`, `.dev.vars`, `.env`, or macOS metadata.
## Directory layout

- `apps/hono/` — Hono OAuth/API routes, public and private MCP agents, Cloudflare bindings.
- `apps/astro/` — Astro SSR pages, React UI, styles, frontend TypeScript configuration.
- `vps/antigravity/` — independent Go module for the VPS HTTP-to-Antigravity CLI gateway.
- `tests/` — TypeScript regression tests (`pnpm test`). Go tests run with `pnpm test:go`.

The TypeScript apps share the root dependency manifest and lockfile. Astro builds the existing single Worker
using `apps/hono/wrangler.jsonc`; frontend query parameters and language detection remain server-rendered.
Build output is `apps/astro/dist/`. Deploy the generated `apps/astro/dist/server/wrangler.json`, not the raw
TypeScript entrypoint. Dependency versions were not changed.

## Private MCP

`/mcp` keeps its existing Google quota/Gemini behavior. `/private/mcp` exposes the same `rewrite_response`
input and response format and uses the same protection, prompt, restoration, and original-answer fallback.
Its `connection_info` returns the authenticated email and Antigravity/VPC backend instead of a quota project.

Both routes use OAuth through `/authorize`, `/callback`, `/register`, and `/token`. Private access requires a
verified Google email in `PRIVATE_MCP_ALLOWED_EMAILS` (comma-separated, exact case-insensitive matches).
The default in `apps/hono/wrangler.jsonc` is `iwa124816@gmail.com`; an empty or missing value denies everyone.
The callback checks the allowlist before issuing a private grant, and every private MCP request checks it again,
so removing an email also blocks already-issued tokens and existing sessions. Clients cannot supply their own
email header; identity comes from Google userinfo and the provider's validated OAuth token props.

Connect to `https://gpt-polisher.kota113.com/private/mcp` with OAuth. Its 401 response advertises
`/.well-known/oauth-protected-resource/private/mcp`. A client using that metadata sends the private endpoint as
its OAuth `resource`; this requests only `openid email profile` and skips Google Cloud project setup and
refresh-token storage. Older clients that omit the resource follow the existing public Google project setup;
the private request allowlist still applies. Tokens issued before verified-email props were introduced need
reconnection to use the private endpoint.

## VPS gateway setup

1. Install Go 1.26+ and the current Antigravity CLI (`agy`) on the VPS. Create a dedicated service user with its
   own home directory (`/var/lib/gpt-polisher` for the included systemd unit) and authenticate once as that user with `agy`. Do not configure a Gemini API key for this
   service. Confirm the installed CLI supports `--input-format stream-json` and `--output-format stream-json`.
2. Merge `vps/antigravity/settings.example.json` into that user's
   `~/.gemini/antigravity-cli/settings.json`. The gateway checks the required deny rules at startup: rewriting
   only needs text generation, so file, shell, web, and MCP tools must be disabled. Keep this profile free of
   custom rules, skills, plugins, and MCP servers that could alter editing behavior.
3. Build with `cd vps/antigravity` then `go build -o antigravity-gateway .`. Install the binary at
   `/usr/local/bin/antigravity-gateway` if using the provided systemd unit.
4. Copy `.env.example` to `/etc/gpt-polisher-antigravity.env`, restrict its permissions, and set
   `ANTIGRAVITY_GATEWAY_TOKEN` to a random shared secret. Set `ANTIGRAVITY_BIN` to the installed `agy` path.
   `ANTIGRAVITY_MODEL` defaults to `gemini-3.8-flash-medium`; check `agy models` under the service account and
   choose the desired available model. The gateway never falls back to a different provider or model.
5. Install `vps/antigravity/antigravity-gateway.service`, adjust its user/paths, and start it with systemd.
   Alternatively, export the settings and run `./antigravity-gateway` as that user. The Go binary does not
   load `.env` files itself; systemd's `EnvironmentFile` loads the provided settings.

The listener defaults to `127.0.0.1:8080`. `GET /healthz` returns 204 for process liveness;
`POST /rewrite` requires the gateway bearer secret and accepts `{"prompt":"..."}`, returning `{"text":"..."}`.
Each request starts a fresh CLI process in a temporary directory, writes one JSON prompt to stdin, closes
stdin, and accepts exactly one successful terminal result. Prompts do not enter shell commands or process
arguments. Gateway secrets are not inherited by the CLI, and prompts/output are not logged.

Requests are limited to 1 MiB and CLI output to 4 MiB. One generation runs at a time; overload returns 503.
The CLI process group is terminated on request cancellation or the 120-second timeout. HTTP/CLI errors,
empty answers, and broken placeholders cause the Worker to return the exact original answer.

## Cloudflare VPC connection

1. Run `cloudflared` on the VPS as a Cloudflare Tunnel connector.
2. Create an HTTP VPC Service in Cloudflare's Connectivity Directory using that Tunnel. If the connector and
   Go process share the host network, use `127.0.0.1` and HTTP port `8080`. If the connector is containerized,
   configure a reachable private host address and `LISTEN_ADDR` instead.
3. Enable the commented `vpc_services` entry in `apps/hono/wrangler.jsonc` and replace `YOUR_VPC_SERVICE_ID`
   with the actual service ID. Keep the binding name `ANTIGRAVITY`. `remote: true` enables access to the real
   VPC service during local development; it requires Cloudflare credentials and a running tunnel.
4. Set the Worker secret `ANTIGRAVITY_GATEWAY_TOKEN` to the same value configured on the VPS. For production,
   use `pnpm exec wrangler secret put ANTIGRAVITY_GATEWAY_TOKEN --config apps/hono/wrangler.jsonc`.
   For development, set it in `apps/hono/.dev.vars`.
5. Run `pnpm type-check`, `pnpm test`, `pnpm test:go`, and `pnpm build`. Deploy only when requested.

Only `env.ANTIGRAVITY.fetch` can reach the gateway; there is no public-fetch or Gemini fallback on the private
route. The VPC Service determines the destination and port, while `antigravity.internal` supplies the HTTP Host.
The gateway port does not need public ingress. No service ID, tunnel, production secret, or deployment is
created automatically by this repository change.

References: [Workers VPC Services](https://developers.cloudflare.com/workers-vpc/configuration/vpc-services/),
[Antigravity headless protocol](https://antigravity.google/docs/cli/headless/),
[Antigravity permissions](https://antigravity.google/docs/cli/permissions/).
