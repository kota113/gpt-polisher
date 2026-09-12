import assert from "node:assert/strict";
import test from "node:test";
import { GoogleHandler } from "../apps/hono/src/google-handler.ts";

test("private OAuth accepts only the configured verified Google email and skips quota setup", async (t) => {
  for (const profile of [
    { email: "iwa124816@gmail.com", email_verified: true, allowed: true },
    { email: "other@gmail.com", email_verified: true, allowed: false },
    { email: "iwa124816@gmail.com", email_verified: false, allowed: false },
  ]) {
    await t.test(`${profile.email} verified=${profile.email_verified}`, async () => {
      const kv = new Map<string, string>();
      let issued: any;
      const env = {
        GOOGLE_CLIENT_ID: "client", GOOGLE_CLIENT_SECRET: "secret", COOKIE_ENCRYPTION_KEY: "cookie-secret",
        PRIVATE_MCP_ALLOWED_EMAILS: "iwa124816@gmail.com",
        OAUTH_KV: {
          put: async (key: string, value: string) => { kv.set(key, value); },
          get: async (key: string) => kv.has(key) ? JSON.parse(kv.get(key)!) : null,
          delete: async (key: string) => { kv.delete(key); },
        },
        OAUTH_PROVIDER: {
          parseAuthRequest: async () => ({ clientId: "client", scope: [], resource: "https://example.com/private/mcp" }),
          completeAuthorization: async (grant: unknown) => { issued = grant; return { redirectTo: "https://client.example/callback" }; },
        },
        // No USER_CREDENTIALS binding or encryption key: private OAuth must not use quota setup.
      } as any;
      const authorize = await GoogleHandler.request("https://example.com/authorize", {}, env);
      assert.equal(authorize.status, 302);
      const googleUrl = new URL(authorize.headers.get("Location")!);
      assert.equal(googleUrl.searchParams.get("scope"), "openid email profile");
      const state = googleUrl.searchParams.get("state");
      const cookie = authorize.headers.get("Set-Cookie")!.split(";")[0];
      const mock = t.mock.method(globalThis, "fetch", async (input: any) => {
        const url = String(input);
        if (url === "https://oauth2.googleapis.com/token") return Response.json({ access_token: "google-access" });
        assert.equal(url, "https://openidconnect.googleapis.com/v1/userinfo");
        return Response.json({ sub: "google-user", name: "User", ...profile });
      });
      try {
        const callback = await GoogleHandler.request(`https://example.com/callback?code=code&state=${state}`, { headers: { cookie } }, env);
        assert.equal(callback.status, profile.allowed ? 302 : 403);
        assert.equal(Boolean(issued), profile.allowed);
        if (issued) {
          assert.equal(issued.props.email, profile.email);
          assert.equal(issued.props.emailVerified, true);
          assert.equal(callback.headers.get("Location"), "https://client.example/callback");
        }
        assert.equal(kv.size, 0);
        const replay = await GoogleHandler.request(`https://example.com/callback?code=code&state=${state}`, { headers: { cookie } }, env);
        assert.equal(replay.status, 400);
      } finally { mock.mock.restore(); }
    });
  }
});
