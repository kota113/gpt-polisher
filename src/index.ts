import OAuthProvider from "@cloudflare/workers-oauth-provider";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { z } from "zod";
import { GoogleHandler, type McpProps } from "./google-handler";
import { getSelectedProject, refreshAccessToken, rewriteWithGemini } from "./google";

export class MyMCP extends McpAgent<Env, Record<string, never>, McpProps> {
  server = new McpServer({ name: "Gemini Rewrite MCP", version: "0.1.0" });

  async init() {
    this.server.tool(
      "rewrite_response",
      "Rewrite an AI response with Gemini 3.8 Flash for clarity and concision without adding information. Use the original answer as the only factual source.",
      {
        user_question: z.string().describe("The user's original question. Used only to judge relevance."),
        original_answer: z.string().describe("The answer to rewrite. This is the only factual source."),
      },
      async ({ user_question, original_answer }) => {
        try {
          const accessToken = await refreshAccessToken(this.env, this.props!.userId);
          const projectId = await getSelectedProject(this.env, this.props!.userId);
          const rewritten = await rewriteWithGemini(accessToken, projectId, user_question, original_answer);
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
      },
    );

    this.server.tool("connection_info", "Show the Google account and quota project currently linked to this MCP connection.", {}, async () => ({
      content: [{ type: "text", text: JSON.stringify({ email: this.props!.email, projectId: await getSelectedProject(this.env, this.props!.userId) }) }],
    }));

  }
}

export default new OAuthProvider({
  apiHandler: MyMCP.serve("/mcp"),
  apiRoute: "/mcp",
  authorizeEndpoint: "/authorize",
  clientRegistrationEndpoint: "/register",
  defaultHandler: GoogleHandler as any,
  tokenEndpoint: "/token",
});
