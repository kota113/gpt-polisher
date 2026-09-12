import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { registerRewriteTool } from "./mcp-tools";
import type { McpProps } from "./google-handler";
import { GeminiApiError, type GoogleAccessToken, refreshAccessToken, rewriteWithGemini } from "./google";

const ACCESS_TOKEN_EXPIRY_BUFFER_MS = 60_000;

export class MyMCP extends McpAgent<Env, Record<string, never>, McpProps> {
  server = new McpServer({ name: "GPT Polisher", version: "0.1.0" });
  private cachedAccessToken?: GoogleAccessToken;
  private accessTokenRefresh?: Promise<GoogleAccessToken>;

  private async getAccessToken(): Promise<string> {
    if (this.cachedAccessToken && Date.now() < this.cachedAccessToken.expiresAt - ACCESS_TOKEN_EXPIRY_BUFFER_MS) {
      return this.cachedAccessToken.accessToken;
    }

    if (!this.accessTokenRefresh) {
      this.accessTokenRefresh = refreshAccessToken(this.env, this.props!.userId);
    }

    const refresh = this.accessTokenRefresh;
    try {
      this.cachedAccessToken = await refresh;
      return this.cachedAccessToken.accessToken;
    } finally {
      if (this.accessTokenRefresh === refresh) this.accessTokenRefresh = undefined;
    }
  }

  private async rewriteResponse(userQuestion: string, originalAnswer: string): Promise<string> {
    const accessToken = await this.getAccessToken();
    try {
      return await rewriteWithGemini(accessToken, this.props!.projectId, userQuestion, originalAnswer);
    } catch (error) {
      if (!(error instanceof GeminiApiError) || error.status !== 401) throw error;
      if (this.cachedAccessToken?.accessToken === accessToken) this.cachedAccessToken = undefined;
      const refreshedAccessToken = await this.getAccessToken();
      return rewriteWithGemini(refreshedAccessToken, this.props!.projectId, userQuestion, originalAnswer);
    }
  }

  async init() {
    registerRewriteTool(
      this.server,
      (question, answer) => this.rewriteResponse(question, answer),
      (work) => this.keepAliveWhile(work),
      (error) => console.error(JSON.stringify({
        event: "gemini_rewrite_failed",
        userId: this.props!.userId,
        message: error instanceof Error ? error.message : "Unknown rewrite error",
        timestamp: new Date().toISOString(),
      })),
    );

    this.server.tool("connection_info", "Show the Google account and quota project currently linked to this MCP connection.", {}, async () => ({
      content: [{ type: "text", text: JSON.stringify({ email: this.props!.email, projectId: this.props!.projectId }) }],
    }));

  }
}
