# GPT Polisher Development Guide

This repository contains the hosted GPT Polisher service. The public `README.md` is user-facing and must not include
self-hosting or deployment instructions; keep operational and development details here instead.

## Architecture

1. ChatGPT connects to the Worker at `/mcp` and starts MCP OAuth.
2. `src/worker.ts` keeps OAuth and MCP routes on the Worker and delegates hosted pages to Astro.
3. Astro renders the landing and setup routes with React components; those components call the Hono JSON API for setup
   data and actions.
4. `src/google-handler.ts` handles Google OAuth and project setup API requests without rendering frontend HTML.
5. Google refresh tokens are encrypted with AES-256-GCM and stored in the `USER_CREDENTIALS` KV namespace.
6. `src/index.ts` exposes the `rewrite_response` and `connection_info` MCP tools.
7. `src/google.ts` refreshes access tokens and calls Gemini with the selected project in `x-goog-user-project`.

## Important files

- `src/worker.ts` — Worker entry point and Astro/backend request routing.
- `src/index.ts` — Durable Object and MCP tool registration.
- `src/pages/index.astro` and `src/pages/setup.astro` — Astro-hosted frontend routes.
- `src/components/LandingPage.tsx` and `src/components/SetupPage.tsx` — React frontend UI and interactions.
- `src/styles/app.css` — shared landing and setup page styles.
- `src/google-handler.ts` — Hono OAuth routes and project setup JSON API.
- `src/google.ts` — Google OAuth, project, API enablement, and Gemini calls.
- `src/crypto.ts` — credential encryption and decryption.
- `src/examples.ts` — examples rendered by the hosted website.
- `wrangler.jsonc` — Cloudflare Worker, Durable Object, KV, and development port configuration.
- `worker-configuration.d.ts` — Worker binding types.

## Commands

- `pnpm install` — install dependencies.
- `pnpm dev` — run Astro and the Worker locally on port 8788.
- `pnpm build` — build the Astro site and Worker bundle.
- `pnpm type-check` — run TypeScript checks without emitting files.
- `pnpm cf-typegen` — regenerate Cloudflare binding types after configuration changes.
- `pnpm deploy` — deploy the hosted service; only run when explicitly requested.

## Environment and Cloudflare bindings

Local development uses `.dev.vars`, based on `.dev.vars.example`. Never commit `.dev.vars` or secret values.

Required secrets:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `COOKIE_ENCRYPTION_KEY`
- `CREDENTIAL_ENCRYPTION_KEY` — base64-encoded 32-byte key

Optional secret:

- `HOSTED_DOMAIN` — restricts Google logins to one Workspace domain

Required bindings configured in `wrangler.jsonc`:

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

Requested Google scopes are defined by `GOOGLE_SCOPES` in `src/google.ts`. The selected user quota project also needs
the Generative Language API; the setup flow attempts to enable it.

## Validation

Run `pnpm type-check` after TypeScript or configuration changes. For MCP integration checks, run MCP Inspector and
connect to the local or hosted `/mcp` endpoint.

Do not commit generated local state from `node_modules`, `.wrangler`, `.dev.vars`, `.env`, or macOS metadata.