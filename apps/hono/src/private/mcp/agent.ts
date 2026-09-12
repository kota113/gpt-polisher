import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { registerRewriteTool } from "../../mcp-tools";
import type { PrivateIdentity } from "./access";
import { rewriteWithAntigravity } from "./client";

export class PrivateMCP extends McpAgent<Env, Record<string, never>, PrivateIdentity> {
  server = new McpServer({ name: "GPT Polisher", version: "0.1.0" });

  async init() {
    registerRewriteTool(
      this.server,
      (question, answer) => rewriteWithAntigravity(this.env, question, answer),
      (work) => this.keepAliveWhile(work),
      (error) => console.error(JSON.stringify({
        event: "antigravity_rewrite_failed",
        message: error instanceof Error ? error.message : "Unknown rewrite error",
        timestamp: new Date().toISOString(),
      })),
      "Rewrite an AI response with Antigravity for clarity and concision without adding information. Use the original answer as the only factual source.",
    );
    this.server.tool("connection_info", "Show the backend currently linked to this MCP connection.", {}, async () => ({
      content: [{ type: "text", text: JSON.stringify({ email: this.props!.email, backend: "antigravity", transport: "cloudflare-vpc" }) }],
    }));
  }
}
