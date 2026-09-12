import { protectSpecialContent, restoreSpecialContent } from "./protected-content.ts";
import { buildRewritePrompt } from "./rewrite-prompt.ts";

/** Keep the editing pipeline identical for every generation backend. */
export async function rewriteWith(
  generate: (prompt: string) => Promise<string>,
  userQuestion: string,
  originalAnswer: string,
): Promise<string> {
  const protectedAnswer = protectSpecialContent(originalAnswer);
  const text = await generate(buildRewritePrompt(userQuestion, protectedAnswer.text));
  if (!text) throw new Error("Generation returned no text");
  return restoreSpecialContent(text, protectedAnswer);
}

export async function rewriteOrOriginal(
  rewrite: () => Promise<string>,
  originalAnswer: string,
  onError: (error: unknown) => void,
) {
  try {
    return { content: [{ type: "text" as const, text: await rewrite() }] };
  } catch (error) {
    onError(error);
    return { content: [{ type: "text" as const, text: originalAnswer }] };
  }
}
