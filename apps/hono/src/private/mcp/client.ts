import { rewriteWith } from "../../rewrite.ts";

export type GatewayEnv = {
  ANTIGRAVITY?: Pick<Fetcher, "fetch">;
  ANTIGRAVITY_GATEWAY_TOKEN?: string;
};

export function rewriteWithAntigravity(env: GatewayEnv, question: string, answer: string) {
  return rewriteWith(async (prompt) => {
    if (!env.ANTIGRAVITY || !env.ANTIGRAVITY_GATEWAY_TOKEN) {
      throw new Error("Antigravity VPC binding or gateway token is not configured");
    }
    // The VPC service controls the destination host/port. Never use public fetch here.
    const response = await env.ANTIGRAVITY.fetch("http://antigravity.internal/rewrite", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.ANTIGRAVITY_GATEWAY_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt }),
      signal: AbortSignal.timeout(125_000),
      redirect: "error",
    });
    if (!response.ok) throw new Error(`Antigravity gateway failed: ${response.status}`);
    const body: unknown = await response.json();
    if (!body || typeof body !== "object" || !("text" in body) || typeof body.text !== "string") {
      throw new Error("Invalid Antigravity gateway response");
    }
    return body.text;
  }, question, answer);
}
