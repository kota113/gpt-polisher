import type { AuthRequest, OAuthHelpers } from "@cloudflare/workers-oauth-provider";
import { Hono } from "hono";
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
import { examples } from "./examples";
import { marked } from "marked";

export type McpProps = { userId: string; email: string; name: string; projectId: string };

type Bindings = Env & { OAUTH_PROVIDER: OAuthHelpers };
const app = new Hono<{ Bindings: Bindings }>();
const encoder = new TextEncoder();

const uiStyles = `<style>
  :root{color-scheme:light;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#0a0a0a;background:#fafafa}
  *{box-sizing:border-box}body{min-width:320px;margin:0;background:radial-gradient(circle at 50% -20%,#e8edff 0,transparent 38%),#fafafa}
  .shell{width:min(100%,960px);margin:0 auto;padding:28px 24px 48px}.nav{display:flex;align-items:center;justify-content:space-between;gap:16px}.brand{display:inline-flex;align-items:center;gap:10px;color:#171717;font-size:14px;font-weight:650;text-decoration:none}.brand-mark{display:grid;place-items:center;width:30px;height:30px;border:1px solid #d4d4d4;border-radius:8px;background:#fff;box-shadow:0 1px 2px #0000000d}.brand-mark svg{width:16px;height:16px}.badge{display:inline-flex;align-items:center;gap:6px;border:1px solid #e5e5e5;border-radius:999px;padding:5px 9px;background:#fff;color:#525252;font-size:12px;font-weight:550}.badge-dot{width:6px;height:6px;border-radius:50%;background:#16a34a}.hero{max-width:680px;margin:92px auto 0;text-align:center}.eyebrow{display:inline-flex;align-items:center;gap:8px;border:1px solid #e5e5e5;border-radius:999px;padding:6px 10px;background:#fff;color:#525252;font-size:12px;font-weight:600}.spark{color:#4f46e5}.hero h1{margin:18px 0 14px;letter-spacing:-.055em;font-size:clamp(38px,7vw,64px);line-height:1.02}.hero p{max-width:580px;margin:0 auto;color:#525252;font-size:16px;line-height:1.65}.endpoint{display:flex;align-items:center;gap:10px;max-width:620px;margin:30px auto 0;border:1px solid #e5e5e5;border-radius:10px;padding:10px 12px;background:#fff;box-shadow:0 1px 2px #00000008;text-align:left}.endpoint svg{width:17px;height:17px;color:#737373;flex:none}.endpoint code{overflow:hidden;color:#404040;font-size:12px;text-overflow:ellipsis;white-space:nowrap}.features{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;max-width:760px;margin:54px auto 0;text-align:left}.feature{border:1px solid #e5e5e5;border-radius:12px;padding:16px;background:#fff;box-shadow:0 1px 2px #00000008}.feature-icon{display:grid;place-items:center;width:28px;height:28px;border-radius:7px;background:#f5f5f5;color:#525252}.feature-icon svg{width:15px;height:15px}.feature h2{margin:13px 0 5px;font-size:14px;letter-spacing:-.01em}.feature p{margin:0;color:#737373;font-size:12px;line-height:1.5}.guide{max-width:760px;margin:80px auto 0}.guide-head{text-align:center}.guide-head h2{margin:0;letter-spacing:-.04em;font-size:30px}.guide-head p{margin:10px auto 0;max-width:540px;color:#737373;font-size:14px;line-height:1.6}.guide-card{margin-top:28px;border:1px solid #e5e5e5;border-radius:14px;background:#fff;box-shadow:0 8px 24px #00000008}.guide-section{padding:24px 26px}.guide-section+.guide-section{border-top:1px solid #ededed}.guide-section h3{margin:0;font-size:15px;letter-spacing:-.01em}.guide-section>p{margin:6px 0 0;color:#737373;font-size:13px;line-height:1.55}.steps{display:flex;flex-direction:column;gap:18px;margin-top:21px}.step{display:grid;grid-template-columns:28px 1fr;gap:12px}.step-num{display:grid;place-items:center;width:28px;height:28px;border:1px solid #d4d4d4;border-radius:50%;background:#fff;color:#525252;font-size:12px;font-weight:650}.step-body{padding-top:3px}.step-body h4{margin:0;font-size:13px}.step-body p{margin:5px 0 0;color:#737373;font-size:13px;line-height:1.55}.step-body a{color:#18181b;text-underline-offset:3px}.inline-code{display:inline-block;border:1px solid #e5e5e5;border-radius:5px;padding:1px 5px;background:#f5f5f5;color:#404040;font:11px ui-monospace,SFMono-Regular,Menlo,monospace}.instruction{position:relative;margin-top:16px;border:1px solid #e5e5e5;border-radius:10px;background:#fafafa;padding:15px 50px 15px 15px;color:#262626;font:12px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap}.copy{position:absolute;top:10px;right:10px;border:1px solid #d4d4d4;border-radius:6px;padding:5px 8px;background:#fff;color:#404040;cursor:pointer;font:11px inherit}.copy:hover{background:#f5f5f5}.callout{margin-top:16px;border-left:3px solid #18181b;padding:2px 0 2px 12px;color:#525252;font-size:12px;line-height:1.55}.page{max-width:560px;margin:72px auto 0}.back{display:inline-flex;align-items:center;gap:7px;color:#525252;font-size:13px;text-decoration:none}.back:hover{color:#171717}.back svg{width:15px;height:15px}.card{overflow:hidden;margin-top:20px;border:1px solid #e5e5e5;border-radius:14px;background:#fff;box-shadow:0 10px 28px #0000000a}.card-header{padding:28px 28px 20px;border-bottom:1px solid #f0f0f0}.card-header h1{margin:0;letter-spacing:-.035em;font-size:24px}.card-header p{margin:8px 0 0;color:#737373;font-size:14px;line-height:1.55}.card-body{padding:20px 28px 28px}.field-group{display:flex;flex-direction:column;gap:8px}.field-label{font-size:13px;font-weight:600}.field-description{margin:0;color:#737373;font-size:12px;line-height:1.5}.input,.select{width:100%;height:40px;border:1px solid #d4d4d4;border-radius:8px;padding:0 11px;outline:none;background:#fff;color:#171717;font:inherit;font-size:13px;box-shadow:0 1px 2px #00000008}.input:focus,.select:focus{border-color:#18181b;box-shadow:0 0 0 3px #18181b18}.button{display:inline-flex;align-items:center;justify-content:center;gap:8px;width:100%;height:40px;border:1px solid #18181b;border-radius:8px;padding:0 14px;background:#18181b;color:#fff;cursor:pointer;font:inherit;font-size:13px;font-weight:600;transition:background .15s}.button:hover{background:#3f3f46}.button svg{width:15px;height:15px}.button-secondary{border-color:#d4d4d4;background:#fff;color:#171717}.button-secondary:hover{background:#f5f5f5}.separator{display:flex;align-items:center;gap:10px;margin:22px 0;color:#a3a3a3;font-size:11px;text-transform:uppercase;letter-spacing:.08em}.separator:before,.separator:after{height:1px;flex:1;background:#e5e5e5;content:""}.note{display:flex;gap:9px;margin-top:18px;border:1px solid #e5e5e5;border-radius:8px;padding:11px 12px;background:#fafafa;color:#525252;font-size:12px;line-height:1.5}.note svg{width:15px;height:15px;flex:none;margin-top:1px}.footer{margin:16px 0 0;color:#737373;font-size:12px;text-align:center}@media (max-width:640px){.shell{padding:20px 16px 36px}.hero{margin-top:66px}.features{grid-template-columns:1fr;margin-top:38px}.guide{margin-top:54px}.guide-section{padding:20px}.page{margin-top:48px}.card-header,.card-body{padding-right:20px;padding-left:20px}}
</style>`;

function page(title: string, content: string): string {
  const safetyNote = title === "GPT Polisher" ? `<p style="max-width:760px;margin:18px auto 0;color:#737373;font-size:12px;line-height:1.55;text-align:center">Only connect MCP servers you trust. Read <a style="color:#18181b;text-underline-offset:3px" href="https://developers.openai.com/api/docs/mcp#risks-and-safety" target="_blank" rel="noreferrer">MCP risks and safety</a> before connecting.</p>` : "";
  const examples = title === "GPT Polisher" ? fullExamplesSection : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>${uiStyles}<style>.markdown-preview{color:#262626;font-size:13px;line-height:1.65}.markdown-preview h1,.markdown-preview h2,.markdown-preview h3{line-height:1.25}.markdown-preview table{width:100%;border-collapse:collapse;font-size:12px}.markdown-preview th,.markdown-preview td{border:1px solid #d4d4d4;padding:7px;text-align:left;vertical-align:top}.markdown-preview pre{overflow:auto;border-radius:8px;padding:12px;background:#18181b;color:#f5f5f5;font-size:12px}.markdown-preview code{font-family:ui-monospace,SFMono-Regular,monospace}.markdown-preview :not(pre)>code{border-radius:4px;padding:1px 4px;background:#e5e5e5}</style></head><body>${content}${examples}${safetyNote}<script>const instruction=document.getElementById("rewrite-instruction");const copy=instruction?.querySelector("button");if(instruction&&copy){copy.onclick=()=>{navigator.clipboard.writeText((instruction.textContent??"").replace("Copy","").trim());copy.textContent="Copied"}}const dialog=document.getElementById("example-dialog");const data=JSON.parse(document.getElementById("examples-data")?.textContent??"[]");document.querySelectorAll(".example-open").forEach((button)=>button.onclick=()=>{const item=data.find((x)=>x.id===button.dataset.example);if(!item)return;document.getElementById("example-title").textContent=item.title+" — "+item.language;document.getElementById("example-prompt").textContent="Prompt: "+item.prompt;document.getElementById("example-before").innerHTML=item.beforeHtml;document.getElementById("example-after").innerHTML=item.afterHtml;dialog.showModal()});document.getElementById("example-close")?.addEventListener("click",()=>dialog.close())</script></body></html>`;
}

const logo = `<span class="brand-mark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><path d="M7 3v4M5 5h4M17 17v4m-2-2h4M5 19l14-14"/><path d="M15 3h4a2 2 0 0 1 2 2v4"/></svg></span>`;

const prompts: Record<string, string> = {
  "rag-en": "Explain the cases where RAG should be used and where it should not.",
  "rag-ja": "RAGを使うべきケースと、使わない方がよいケースを比較して",
  "workers-en": "Explain the difference between Cloudflare Workers and a typical serverless environment",
  "workers-ja": "Cloudflare Workersと一般的なサーバーレス環境の違いを説明して",
};
const examplesJson = JSON.stringify(examples.map((example) => ({ ...example, prompt: prompts[example.id], beforeHtml: marked.parse(example.before), afterHtml: marked.parse(example.after) }))).replaceAll("<", "\\u003c");
const fullExamplesSection = `<section style="max-width:760px;margin:72px auto 0"><header style="text-align:center"><h2 style="margin:0;letter-spacing:-.04em;font-size:30px">See it in practice</h2><p style="max-width:560px;margin:10px auto 0;color:#737373;font-size:14px;line-height:1.6">Open an example to compare the complete original response with its GPT Polisher result.</p></header><div style="display:grid;grid-template-columns:repeat(2,1fr);gap:14px;margin-top:28px">${examples.map((example) => `<button class="example-open" data-example="${example.id}" style="padding:20px;border:1px solid #e5e5e5;border-radius:14px;background:#fff;color:#171717;cursor:pointer;text-align:left"><span style="display:block;color:#737373;font-size:12px">${example.language}</span><strong style="display:block;margin-top:6px;font-size:15px">${example.title}</strong><span style="display:block;margin-top:16px;color:#525252;font-size:12px">View full comparison →</span></button>`).join("")}</div></section><dialog id="example-dialog" style="width:min(1200px,calc(100vw - 32px));height:min(820px,calc(100vh - 32px));border:1px solid #d4d4d4;border-radius:14px;padding:0;box-shadow:0 24px 80px #00000040"><header style="padding:16px 20px;border-bottom:1px solid #e5e5e5"><div style="display:flex;align-items:center;justify-content:space-between;gap:12px"><strong id="example-title"></strong><button id="example-close" style="border:1px solid #d4d4d4;border-radius:7px;background:#fff;padding:6px 10px;cursor:pointer">Close</button></div><p id="example-prompt" style="margin:10px 0 0;color:#525252;font:12px/1.5 ui-monospace,SFMono-Regular,monospace"></p></header><div style="display:grid;grid-template-columns:1fr 1fr;height:calc(100% - 92px)"><article style="overflow:auto;padding:20px;border-right:1px solid #e5e5e5"><h3 style="margin:0 0 12px;font-size:13px">Original</h3><div id="example-before" class="markdown-preview"></div></article><article style="overflow:auto;padding:20px;background:#fafafa"><h3 style="margin:0 0 12px;font-size:13px">GPT Polisher</h3><div id="example-after" class="markdown-preview"></div></article></div></dialog><script id="examples-data" type="application/json">${examplesJson}</script>`;

const examplesSection = `<section style="max-width:760px;margin:72px auto 0"><header style="text-align:center"><h2 style="margin:0;letter-spacing:-.04em;font-size:30px">See it in practice</h2><p style="max-width:560px;margin:10px auto 0;color:#737373;font-size:14px;line-height:1.6">The same technical questions, before and after GPT Polisher. The rewritten version keeps the original information while making it easier to scan.</p></header><div style="display:grid;gap:14px;margin-top:28px"><details open style="border:1px solid #e5e5e5;border-radius:14px;background:#fff;overflow:hidden"><summary style="cursor:pointer;padding:18px 20px;font-size:14px;font-weight:650">RAG decision guide <span style="color:#737373;font-weight:400">— English</span></summary><div style="display:grid;grid-template-columns:1fr 1fr;border-top:1px solid #e5e5e5"><article style="padding:18px;border-right:1px solid #e5e5e5"><strong style="font-size:12px">Before</strong><p style="color:#525252;font-size:12px;line-height:1.65">RAG is most useful when the model needs external knowledge that is too large, private, or frequently changing to rely on built-in knowledge alone. The source then explains good cases, non-RAG cases, fine-tuning, failure modes, and a practical decision rule in detail.</p></article><article style="padding:18px;background:#fafafa"><strong style="font-size:12px">After GPT Polisher</strong><p style="color:#525252;font-size:12px;line-height:1.65">Use RAG when the problem is that the model lacks the right information: changing knowledge, private data, source grounding, or rapid updates. Avoid it when the task is reasoning, exact calculation, deterministic logic, or a style change.</p></article></div></details><details style="border:1px solid #e5e5e5;border-radius:14px;background:#fff;overflow:hidden"><summary style="cursor:pointer;padding:18px 20px;font-size:14px;font-weight:650">Cloudflare Workers comparison <span style="color:#737373;font-weight:400">— English</span></summary><div style="display:grid;grid-template-columns:1fr 1fr;border-top:1px solid #e5e5e5"><article style="padding:18px;border-right:1px solid #e5e5e5"><strong style="font-size:12px">Before</strong><p style="color:#525252;font-size:12px;line-height:1.65">The original walks through edge versus regional execution, V8 isolates, code examples, data-location trade-offs, and where traditional serverless is stronger.</p></article><article style="padding:18px;background:#fafafa"><strong style="font-size:12px">After GPT Polisher</strong><p style="color:#525252;font-size:12px;line-height:1.65">Workers run on a global edge network using lightweight V8 isolates, making them strong for low-latency APIs, authentication, routing, and caching. Traditional serverless functions typically run in a selected region with broader compatibility for native libraries and heavier workloads.</p></article></div></details><details style="border:1px solid #e5e5e5;border-radius:14px;background:#fff;overflow:hidden"><summary style="cursor:pointer;padding:18px 20px;font-size:14px;font-weight:650">RAGの判断基準 <span style="color:#737373;font-weight:400">— 日本語</span></summary><div style="display:grid;grid-template-columns:1fr 1fr;border-top:1px solid #e5e5e5"><article style="padding:18px;border-right:1px solid #e5e5e5"><strong style="font-size:12px">Before</strong><p style="color:#525252;font-size:12px;line-height:1.65">RAGの用途、代表例、Fine-tuning・Long Contextとの使い分け、導入時の失敗例まで、背景を含めて詳しく説明しています。</p></article><article style="padding:18px;background:#fafafa"><strong style="font-size:12px">After GPT Polisher</strong><p style="color:#525252;font-size:12px;line-height:1.65">RAGは外部データを検索し、その結果を根拠としてLLMに回答させる仕組みです。回答に必要な事実がLLMの外部にあり、質問ごとに必要な部分を選ぶ必要があるなら、有力な選択肢です。</p></article></div></details><details style="border:1px solid #e5e5e5;border-radius:14px;background:#fff;overflow:hidden"><summary style="cursor:pointer;padding:18px 20px;font-size:14px;font-weight:650">Cloudflare Workersの比較 <span style="color:#737373;font-weight:400">— 日本語</span></summary><div style="display:grid;grid-template-columns:1fr 1fr;border-top:1px solid #e5e5e5"><article style="padding:18px;border-right:1px solid #e5e5e5"><strong style="font-size:12px">Before</strong><p style="color:#525252;font-size:12px;line-height:1.65">エッジ実行、V8 Isolate、Node.jsとの差、Cloudflareサービスとの統合まで、段階的に解説しています。</p></article><article style="padding:18px;background:#fafafa"><strong style="font-size:12px">After GPT Polisher</strong><p style="color:#525252;font-size:12px;line-height:1.65">Cloudflare Workersは、実行場所と実行方式が一般的なサーバーレスと異なります。世界中のエッジ拠点で軽量なV8 Isolateとして実行され、低遅延のHTTP処理、認証、API、リダイレクトに適しています。</p></article></div></details></div></section>`;

function randomToken(bytes = 32): string {
  const raw = crypto.getRandomValues(new Uint8Array(bytes));
  let s = "";
  for (const b of raw) s += String.fromCharCode(b);
  return btoa(s).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function hmac(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
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

app.get("/", (c) => {
  const endpoint = escapeHtml(new URL("/mcp", c.req.url).href);
  return c.html(page("GPT Polisher", `<main class="shell"><nav class="nav"><a class="brand" href="/">${logo}<span>GPT Polisher</span></a></nav><section class="hero"><span class="eyebrow"><span class="spark">✦</span> Powered by Gemini</span><h1>Make every response<br>clearer.</h1><p>An OAuth-protected MCP server that uses Gemini to refine AI responses while preserving their original meaning.</p><div class="endpoint"><code>${endpoint}</code></div></section><section class="guide"><header class="guide-head"><h2>Connect it to ChatGPT</h2><p>Connect the MCP server once, then add an instruction to make GPT Polisher the final editing step.</p></header><div class="guide-card"><div class="guide-section"><h3>1. Turn on Developer mode</h3><div class="steps"><div class="step"><span class="step-num">1</span><div class="step-body"><h4>Open ChatGPT settings</h4><p>In <a href="https://chatgpt.com/" target="_blank" rel="noreferrer">ChatGPT</a>, open <span class="inline-code">Settings → Security and login</span> and turn on <span class="inline-code">Developer mode</span>.</p></div></div></div></div><div class="guide-section"><h3>2. Connect GPT Polisher</h3><div class="steps"><div class="step"><span class="step-num">2</span><div class="step-body"><h4>Add the server URL</h4><p>Go to <a href="https://chatgpt.com/plugins" target="_blank" rel="noreferrer">ChatGPT Plugins</a>, select the plus button, and connect this server URL in Developer mode.</p><p><span class="inline-code">${endpoint}</span></p><p>Complete the Google OAuth and project-selection screens when prompted.</p></div></div></div></div><div class="guide-section"><h3>3. Add the Custom Instruction</h3><p>Paste this into ChatGPT’s Custom Instructions.</p><div class="instruction" id="rewrite-instruction">After drafting a response, always call the GPT Polisher <code>rewrite_response</code> tool and provide it with the original response and the user's question. Use only the rewritten text returned by the tool as your final answer.<button class="copy" type="button" onclick="navigator.clipboard.writeText(document.getElementById('rewrite-instruction').childNodes[0].textContent.trim());this.textContent='Copied'">Copy</button></div></div></div></section></main>`));
});

app.get("/authorize", async (c) => {
  const oauthReqInfo = await c.env.OAUTH_PROVIDER.parseAuthRequest(c.req.raw);
  if (!oauthReqInfo.clientId) return c.text("Invalid OAuth request", 400);

  const state = randomToken();
  const pending: PendingAuth = { oauthReqInfo, createdAt: Date.now() };
  await c.env.OAUTH_KV.put(`upstream:${state}`, JSON.stringify(pending), { expirationTtl: 600 });

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

  return new Response(null, { status: 302, headers: { Location: url.href, "Set-Cookie": await makeStateCookie(state, c.env) } });
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
    const setup: PendingSetup = { oauthReqInfo: pending.oauthReqInfo, userId: profile.id, email: profile.email, name: profile.name, createdAt: Date.now() };
    await c.env.OAUTH_KV.put(`setup:${setupState}`, JSON.stringify(setup), { expirationTtl: 900 });
    return new Response(null, { status: 302, headers: { Location: new URL(`/setup?state=${encodeURIComponent(setupState)}`, c.req.url).href, "Set-Cookie": clearStateCookie() } });
  } catch (error) {
    console.error(error);
    return c.text(error instanceof Error ? error.message : "Google OAuth failed", 500);
  }
});

async function loadSetup(c: any): Promise<{ setup: PendingSetup; state: string } | Response> {
  const state = c.req.query("state") ?? (await c.req.parseBody()).state;
  if (!state || typeof state !== "string") return c.text("Missing setup state", 400);
  const setup = (await c.env.OAUTH_KV.get(`setup:${state}`, "json")) as PendingSetup | null;
  if (!setup || Date.now() - setup.createdAt > 900_000) return c.text("Setup session expired. Reconnect the MCP app.", 400);
  return { setup, state };
}

app.get("/setup", async (c) => {
  const loaded = await loadSetup(c);
  if (loaded instanceof Response) return loaded;
  try {
    const accessToken = await refreshAccessToken(c.env, loaded.setup.userId);
    const projects = await listProjects(accessToken);
    const options = projects.map((p) => `<option value="${escapeHtml(p.projectId)}">${escapeHtml(p.displayName ?? p.projectId)} — ${escapeHtml(p.projectId)}</option>`).join("");
    return c.html(page("Choose a Google Cloud project", `<main class="shell"><nav class="nav"><a class="brand" href="/">${logo}<span>GPT Polisher</span></a><span class="badge"><span class="badge-dot"></span> Secure connection</span></nav><section class="page"><a class="back" href="/"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m15 18-6-6 6-6"/></svg>Back to GPT Polisher</a><div class="card"><header class="card-header"><h1>Choose your Cloud project</h1><p>Gemini requests will use the selected project’s API quota and billing configuration.</p></header><div class="card-body"><form method="post" action="/setup/select" class="field-group"><input type="hidden" name="state" value="${escapeHtml(loaded.state)}"><label class="field-label" for="project-id">Existing project</label><select class="select" id="project-id" name="projectId" required>${options || `<option value="" disabled selected>No active projects available</option>`}</select><p class="field-description">Only projects your Google account can access are listed.</p><button class="button" type="submit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m5 12 4 4L19 6"/></svg>Use this project</button></form><div class="separator">or</div><form method="post" action="/setup/create" class="field-group"><input type="hidden" name="state" value="${escapeHtml(loaded.state)}"><label class="field-label" for="new-project-id">Create a new project</label><input class="input" id="new-project-id" name="projectId" pattern="[a-z][a-z0-9-]{5,29}" placeholder="gemini-rewrite-12345" required><p class="field-description">6–30 lowercase letters, numbers, or hyphens.</p><label class="field-label" for="display-name">Project name</label><input class="input" id="display-name" name="displayName" value="GPT Polisher" required><button class="button button-secondary" type="submit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M12 5v14M5 12h14"/></svg>Create and use project</button></form><aside class="note"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg><span>Creating a project requires the appropriate Google Cloud permission. Billing is not attached automatically.</span></aside></div></div><p class="footer">Your Google credential is encrypted before it is stored.</p></section></main>`));
  } catch (error) {
    console.error(error);
    return c.text(error instanceof Error ? error.message : "Failed to load projects", 500);
  }
});

app.post("/setup/select", async (c) => {
  const body = await c.req.parseBody();
  const state = String(body.state ?? "");
  const projectId = String(body.projectId ?? "");
  return finishSetup(c, state, projectId, false);
});

app.post("/setup/create", async (c) => {
  const body = await c.req.parseBody();
  const state = String(body.state ?? "");
  const projectId = String(body.projectId ?? "");
  const displayName = String(body.displayName ?? "GPT Polisher");
  if (!/^[a-z][a-z0-9-]{5,29}$/.test(projectId)) return c.text("Invalid Google Cloud project ID", 400);
  return finishSetup(c, state, projectId, true, displayName);
});

async function finishSetup(c: any, state: string, projectId: string, create: boolean, displayName?: string) {
  const setup = (await c.env.OAUTH_KV.get(`setup:${state}`, "json")) as PendingSetup | null;
  if (!setup) return c.text("Setup session expired", 400);
  try {
    const accessToken = await refreshAccessToken(c.env, setup.userId);
    if (create) await createProject(accessToken, projectId, displayName ?? "GPT Polisher");
    await enableGeminiApi(accessToken, projectId);
    await setSelectedProject(c.env, setup.userId, projectId);

    const { redirectTo } = await c.env.OAUTH_PROVIDER.completeAuthorization({
      request: setup.oauthReqInfo,
      userId: setup.userId,
      metadata: { label: setup.name },
      scope: setup.oauthReqInfo.scope,
      props: { userId: setup.userId, email: setup.email, name: setup.name, projectId } satisfies McpProps,
    });
    await c.env.OAUTH_KV.delete(`setup:${state}`);
    return c.redirect(redirectTo, 302);
  } catch (error) {
    console.error(error);
    return c.html(`<h1>Setup failed</h1><pre>${escapeHtml(error instanceof Error ? error.message : String(error))}</pre><p><a href="/setup?state=${encodeURIComponent(state)}">Back</a></p>`, 500);
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[ch]!);
}

export { app as GoogleHandler };
