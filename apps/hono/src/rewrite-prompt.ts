export function buildRewritePrompt(userQuestion: string, originalAnswer: string): string {
  return `You are a response editor.

Your task is to rewrite the original answer to be easier to read.

Rules:
1. Use only the information contained in the original answer. Do not add or remove any facts, knowledge or reasoning. The user question is provided only to help judge which parts are most relevant — do not use it as a source of information.
2. Rewrite the answer to be clear and concise. If the original answer is already concise, make only minimal changes.
3. Return ONLY the rewritten answer.
4. Rewrite in the same language as the original answer.
5. Keep every angle-bracketed placeholder (for example, <CITATION_1>, <TEXTBLOCK_1>) unchanged and exactly once, moving it to the appropriate place when restructuring.

<user_question>
${userQuestion}
</user_question>

<original_answer>
${originalAnswer}
</original_answer>`;
}