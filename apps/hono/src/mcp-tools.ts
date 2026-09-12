import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { rewriteOrOriginal } from "./rewrite.ts";

export function registerRewriteTool(
  server: McpServer,
  rewrite: (question: string, answer: string) => Promise<string>,
  keepAlive: <T>(work: () => Promise<T>) => Promise<T>,
  onError: (error: unknown) => void,
  description = "Rewrite an AI response with Gemini 3.8 Flash for clarity and concision without adding information. Use the original answer as the only factual source.",
) {
  server.tool("rewrite_response", description, {
    user_question: z.string().describe("The user's original question. Used only to judge relevance."),
    original_answer: z.string().describe("The answer to rewrite. This is the only factual source."),
  }, async ({ user_question, original_answer }) => keepAlive(() =>
    rewriteOrOriginal(() => rewrite(user_question, original_answer), original_answer, onError),
  ));
}
