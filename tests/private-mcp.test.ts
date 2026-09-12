import assert from "node:assert/strict";
import test from "node:test";
import { isPrivateEmailAllowed } from "../apps/hono/src/private/mcp/access.ts";
import { createPrivateMcpRoutes } from "../apps/hono/src/private/mcp/routes.ts";
import { rewriteWithAntigravity } from "../apps/hono/src/private/mcp/client.ts";
import { rewriteOrOriginal, rewriteWith } from "../apps/hono/src/rewrite.ts";

test("private access requires a verified email and an exact configured match", () => {
  const allowed = "iwa124816@gmail.com";
  assert.equal(isPrivateEmailAllowed(allowed, { email: allowed, emailVerified: true }), true);
  for (const identity of [undefined, {}, { email: allowed }, { email: allowed, emailVerified: false },
    { email: "other@gmail.com", emailVerified: true }, { email: "iwa124816@gmail.com.attacker.com", emailVerified: true }]) {
    assert.equal(isPrivateEmailAllowed(allowed, identity), false);
  }
  assert.equal(isPrivateEmailAllowed(undefined, { email: allowed, emailVerified: true }), false);
  assert.equal(isPrivateEmailAllowed(" IWA124816@gmail.com , second@example.com ", { email: allowed, emailVerified: true }), true);
});

test("private handler rechecks authorization for every request, including existing sessions", async () => {
  let calls = 0;
  const handler = createPrivateMcpRoutes({ fetch: async () => { calls++; return new Response("MCP"); } });
  const env = { PRIVATE_MCP_ALLOWED_EMAILS: "iwa124816@gmail.com" } as Env;
  const ctx = { props: { email: "iwa124816@gmail.com", emailVerified: true } } as ExecutionContext;
  const request = new Request("https://example.com/private/mcp", { headers: { "Mcp-Session-Id": "existing" } });
  assert.equal((await handler.fetch(request, env, ctx)).status, 200);
  env.PRIVATE_MCP_ALLOWED_EMAILS = "different@example.com";
  assert.equal((await handler.fetch(request, env, ctx)).status, 403);
  assert.equal((await handler.fetch(request, env, { props: {} } as ExecutionContext)).status, 403);
  assert.equal(calls, 1);
});

test("VPC uses the same prompt and restoration as the original generation pipeline", async () => {
  const answer = "本文 :::writing{}保持::: 根拠\uE200cite\uE202turn1search0\uE201";
  let expectedPrompt = "";
  const expected = await rewriteWith(async (prompt) => {
    expectedPrompt = prompt;
    return "整理 <TEXTBLOCK_1> 根拠<CITATION_1>";
  }, "質問", answer);
  let calls = 0;
  const text = await rewriteWithAntigravity({
    ANTIGRAVITY_GATEWAY_TOKEN: "gateway-secret",
    ANTIGRAVITY: { fetch: async (url: unknown, init: RequestInit) => {
      calls++;
      assert.equal(url, "http://antigravity.internal/rewrite");
      assert.equal(new Headers(init.headers).get("Authorization"), "Bearer gateway-secret");
      assert.equal(init.redirect, "error");
      assert.equal(JSON.parse(String(init.body)).prompt, expectedPrompt);
      return Response.json({ text: "整理 <TEXTBLOCK_1> 根拠<CITATION_1>" });
    } } as unknown as Fetcher,
  }, "質問", answer);
  assert.equal(text, expected);
  assert.equal(calls, 1);
});

test("gateway failures and damaged placeholders preserve the original answer", async () => {
  const answer = ":::writing{}元の内容:::";
  for (const reply of [() => new Response("failed", { status: 502 }), () => Response.json({ text: "" }),
    () => Response.json({ text: "lost placeholder" }), () => Response.json({ text: 12 }),
    () => { throw new Error("timeout"); }]) {
    let reported = 0;
    const result = await rewriteOrOriginal(() => rewriteWithAntigravity({
      ANTIGRAVITY_GATEWAY_TOKEN: "secret",
      ANTIGRAVITY: { fetch: async () => reply() } as unknown as Fetcher,
    }, "質問", answer), answer, () => { reported++; });
    assert.deepEqual(result, { content: [{ type: "text", text: answer }] });
    assert.equal(reported, 1);
  }
  await assert.rejects(rewriteWithAntigravity({}, "question", answer), /not configured/);
});
