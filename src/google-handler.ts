import type {AuthRequest, OAuthHelpers} from "@cloudflare/workers-oauth-provider";
import {Hono, type Context} from "hono";
import {
  GOOGLE_SCOPES,
  createProject,
  enableGeminiApi,
  exchangeCode,
  getUserInfo,
  listProjects,
  refreshAccessToken,
  saveRefreshToken,
  setSelectedProject,
} from "./google";

export type McpProps = { userId: string; email: string; name: string; projectId: string };

type Bindings = Env & { OAUTH_PROVIDER: OAuthHelpers };
type AppContext = Context<{ Bindings: Bindings }>;
const app = new Hono<{ Bindings: Bindings }>();
const encoder = new TextEncoder();

function randomToken(bytes = 32): string {
  const raw = crypto.getRandomValues(new Uint8Array(bytes));
  let s = "";
  for (const b of raw) s += String.fromCharCode(b);
  return btoa(s).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function hmac(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), {
    name: "HMAC",
    hash: "SHA-256"
  }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
  let s = "";
  for (const b of sig) s += String.fromCharCode(b);
  return btoa(s).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function makeStateCookie(state: string, env: Env): Promise<string> {
  const sig = await hmac(state, env.COOKIE_ENCRYPTION_KEY);
  return `mcp_oauth_state=${state}.${sig}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`;
}

async function verifyStateCookie(request: Request, state: string, env: Env): Promise<boolean> {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(/(?:^|;\s*)mcp_oauth_state=([^;]+)/);
  if (!match) return false;
  const [cookieState, cookieSig] = match[1].split(".");
  if (!cookieState || !cookieSig || cookieState !== state) return false;
  return cookieSig === (await hmac(cookieState, env.COOKIE_ENCRYPTION_KEY));
}

function clearStateCookie(): string {
  return "mcp_oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";
}

type PendingAuth = { oauthReqInfo: AuthRequest; createdAt: number };
type PendingSetup = { oauthReqInfo: AuthRequest; userId: string; email: string; name: string; createdAt: number };

app.get("/authorize", async (c) => {
  const oauthReqInfo = await c.env.OAUTH_PROVIDER.parseAuthRequest(c.req.raw);
  if (!oauthReqInfo.clientId) return c.text("Invalid OAuth request", 400);

  const state = randomToken();
  const pending: PendingAuth = {oauthReqInfo, createdAt: Date.now()};
  await c.env.OAUTH_KV.put(`upstream:${state}`, JSON.stringify(pending), {expirationTtl: 600});

  const callback = new URL("/callback", c.req.url).href;
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", c.env.GOOGLE_CLIENT_ID);
  url.searchParams.set("redirect_uri", callback);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_SCOPES);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);
  if (c.env.HOSTED_DOMAIN) url.searchParams.set("hd", c.env.HOSTED_DOMAIN);

  return new Response(null, {
    status: 302,
    headers: {Location: url.href, "Set-Cookie": await makeStateCookie(state, c.env)}
  });
});

app.get("/callback", async (c) => {
  const state = c.req.query("state");
  const code = c.req.query("code");
  if (!state || !code) return c.text("Missing OAuth state or code", 400);
  if (!(await verifyStateCookie(c.req.raw, state, c.env))) return c.text("OAuth state validation failed", 400);

  const pending = await c.env.OAUTH_KV.get<PendingAuth>(`upstream:${state}`, "json");
  await c.env.OAUTH_KV.delete(`upstream:${state}`);
  if (!pending || Date.now() - pending.createdAt > 600_000) return c.text("OAuth state expired", 400);

  try {
    const token = await exchangeCode(c.env, code, new URL("/callback", c.req.url).href);
    if (!token.refresh_token) return c.text("Google did not return a refresh token. Revoke this app in your Google Account and reconnect.", 400);
    const profile = await getUserInfo(token.access_token);
    await saveRefreshToken(c.env, profile.id, token.refresh_token, profile);

    const setupState = randomToken();
    const setup: PendingSetup = {
      oauthReqInfo: pending.oauthReqInfo,
      userId: profile.id,
      email: profile.email,
      name: profile.name,
      createdAt: Date.now()
    };
    await c.env.OAUTH_KV.put(`setup:${setupState}`, JSON.stringify(setup), {expirationTtl: 900});
    return new Response(null, {
      status: 302,
      headers: {
        Location: new URL(`/setup?state=${encodeURIComponent(setupState)}`, c.req.url).href,
        "Set-Cookie": clearStateCookie()
      }
    });
  } catch (error) {
    console.error(error);
    return c.text(error instanceof Error ? error.message : "Google OAuth failed", 500);
  }
});

app.get("/api/setup", async (c) => {
  const state = c.req.query("state");
  if (!state) return c.json({error: "Missing setup state"}, 400);

  const setup = await c.env.OAUTH_KV.get<PendingSetup>(`setup:${state}`, "json");
  if (!setup || Date.now() - setup.createdAt > 900_000) {
    return c.json({error: "Setup session expired. Reconnect the MCP app."}, 400);
  }

  try {
    const {accessToken} = await refreshAccessToken(c.env, setup.userId);
    const projects = await listProjects(accessToken);
    return c.json({projects: projects.map(({projectId, displayName}) => ({projectId, displayName}))});
  } catch (error) {
    console.error(error);
    return c.json({error: error instanceof Error ? error.message : "Failed to load projects"}, 500);
  }
});

app.post("/api/setup/select", async (c) => {
  const body = await c.req.parseBody();
  const state = String(body.state ?? "");
  const projectId = String(body.projectId ?? "");
  return finishSetup(c, state, projectId, false);
});

app.post("/api/setup/create", async (c) => {
  const body = await c.req.parseBody();
  const state = String(body.state ?? "");
  const projectId = String(body.projectId ?? "");
  const displayName = String(body.displayName ?? "GPT Polisher");
  if (!/^[a-z][a-z0-9-]{5,29}$/.test(projectId)) return c.json({error: "Invalid Google Cloud project ID"}, 400);
  return finishSetup(c, state, projectId, true, displayName);
});

async function finishSetup(c: AppContext, state: string, projectId: string, create: boolean, displayName?: string) {
  if (!state || !projectId) return c.json({error: "Missing setup state or project ID"}, 400);
  const setup = (await c.env.OAUTH_KV.get(`setup:${state}`, "json")) as PendingSetup | null;
  if (!setup || Date.now() - setup.createdAt > 900_000) return c.json({error: "Setup session expired"}, 400);
  try {
    const {accessToken} = await refreshAccessToken(c.env, setup.userId);
    if (create) await createProject(accessToken, projectId, displayName ?? "GPT Polisher");
    await enableGeminiApi(accessToken, projectId);
    await setSelectedProject(c.env, setup.userId, projectId);

    const {redirectTo} = await c.env.OAUTH_PROVIDER.completeAuthorization({
      request: setup.oauthReqInfo,
      userId: setup.userId,
      metadata: {label: setup.name},
      scope: setup.oauthReqInfo.scope,
      props: {userId: setup.userId, email: setup.email, name: setup.name, projectId} satisfies McpProps,
    });
    await c.env.OAUTH_KV.delete(`setup:${state}`);
    return c.json({redirectTo});
  } catch (error) {
    console.error(error);
    return c.json({error: error instanceof Error ? error.message : "Setup failed"}, 500);
  }
}

export {app as GoogleHandler};
