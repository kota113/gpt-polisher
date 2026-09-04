# Gemini Rewrite MCP

Cloudflare Workers remote MCP server that authenticates users with Google OAuth, lets each user select or create their own Google Cloud project, enables the Gemini API on that project, and calls Gemini 3.8 Flash using the user's OAuth credential and project quota.

## Architecture

1. ChatGPT connects to `/mcp` and starts MCP OAuth.
2. The Worker redirects the user to Google OAuth.
3. Google returns an authorization code and refresh token.
4. The refresh token is AES-256-GCM encrypted in `USER_CREDENTIALS` KV.
5. The user selects an existing Google Cloud project or creates one in the setup UI.
6. The Worker enables `generativelanguage.googleapis.com` on the selected project.
7. The MCP authorization is completed.
8. `rewrite_response` refreshes a short-lived Google access token and calls Gemini with `x-goog-user-project` set to the user's selected project.

No long-lived Google credential is stored in plaintext. The encryption key is kept only as a Workers Secret.

## Credentials you need

Create one Google OAuth 2.0 Web application in Google Cloud.

Required Worker secrets:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `COOKIE_ENCRYPTION_KEY`
- `CREDENTIAL_ENCRYPTION_KEY` — base64 encoded 32 random bytes

Optional:

- `HOSTED_DOMAIN` — only if you want to limit Google logins to one Workspace domain

Required Google OAuth redirect URI:

- Production: `https://YOUR_WORKER_DOMAIN/callback`
- Local: `http://localhost:8788/callback`

The Google OAuth app requests:

- `openid`
- `email`
- `profile`
- `https://www.googleapis.com/auth/cloud-platform`
- `https://www.googleapis.com/auth/generative-language.retriever`

For public use, configure the Google Auth Platform consent screen as External and complete any verification Google requires for the requested scopes.

## Cloudflare setup

```bash
npm install

npx wrangler kv namespace create OAUTH_KV
npx wrangler kv namespace create USER_CREDENTIALS
```

Put the two returned IDs into `wrangler.jsonc`.

Generate secrets:

```bash
openssl rand -hex 32
openssl rand -base64 32
```

Store them:

```bash
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put COOKIE_ENCRYPTION_KEY
npx wrangler secret put CREDENTIAL_ENCRYPTION_KEY
```

Deploy:

```bash
npm run deploy
```

## Google Cloud APIs on the OAuth application's own project

Before testing, enable at least these APIs on the project that owns your OAuth client:

- Cloud Resource Manager API (`cloudresourcemanager.googleapis.com`)
- Service Usage API (`serviceusage.googleapis.com`)
- Generative Language API (`generativelanguage.googleapis.com`)

The selected *user quota project* also needs Generative Language API enabled; the setup flow attempts to enable it automatically.

## Local development

Copy `.dev.vars.example` to `.dev.vars`, fill in the values, and run:

```bash
npm run dev
```

Use `http://localhost:8788/callback` as a Google OAuth redirect URI.

## Test with MCP Inspector

```bash
npx @modelcontextprotocol/inspector@latest
```

Connect with Streamable HTTP to:

```text
https://YOUR_WORKER_DOMAIN/mcp
```

## Connect to ChatGPT

In ChatGPT, create a custom MCP app/connector and use:

```text
https://YOUR_WORKER_DOMAIN/mcp
```

Select OAuth authentication. ChatGPT will follow the server's OAuth flow, which redirects through Google and then the project setup page.

## Production notes

- Google may require OAuth app verification before arbitrary users can grant the `cloud-platform` scope.
- Project creation only succeeds for accounts with `resourcemanager.projects.create` permission at an allowed resource hierarchy location. Existing-project selection still works when creation is not allowed.
- Creating a project does not attach a billing account. Users who need paid Gemini quota may need to attach billing in Google Cloud separately.
- KV is eventually consistent. Credential writes normally propagate quickly, but if you need strict immediate global consistency for account settings, use Durable Objects or D1 instead.
- Add rate limiting / abuse controls before broad public launch.
