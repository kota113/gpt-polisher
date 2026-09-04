import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { z } from "zod";
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
    this.server.tool(
      "rewrite_response",
      "Rewrite an AI response with Gemini 3.8 Flash for clarity and concision without adding information. Use the original answer as the only factual source.",
      {
        user_question: z.string().describe("The user's original question. Used only to judge relevance."),
        original_answer: z.string().describe("The answer to rewrite. This is the only factual source."),
      },
      async ({ user_question, original_answer }) => this.keepAliveWhile(async () => {
        try {
          const rewritten = await this.rewriteResponse(user_question, original_answer);
          return { content: [{ type: "text", text: rewritten }] };
        } catch (error) {
          console.error(JSON.stringify({
            event: "gemini_rewrite_failed",
            userId: this.props!.userId,
            message: error instanceof Error ? error.message : "Unknown rewrite error",
            timestamp: new Date().toISOString(),
          }));
          return {
            content: [{ type: "text", text: original_answer }],
          };
        }
      }),
    );

    this.server.tool("connection_info", "Show the Google account and quota project currently linked to this MCP connection.", {}, async () => ({
      content: [{ type: "text", text: JSON.stringify({ email: this.props!.email, projectId: this.props!.projectId }) }],
    }));

  }
}
