type ProtectedContentEntry = {
  placeholder: string;
  content: string;
};

export type ProtectedContent = {
  text: string;
  entries: ProtectedContentEntry[];
  existingPlaceholders: Map<string, number>;
};

const SPECIAL_BLOCK_PATTERN = /:::[ \t]*([A-Za-z][\w-]*)[ \t]*(?:\{[^\r\n]*})?[ \t]*(?:\r?\n)?[\s\S]*?:::/g;
const CITATION_PATTERN = /\uE200cite\uE202[\s\S]*?\uE201/g;
const PLACEHOLDER_PATTERN = /<[A-Z][A-Z0-9_]*>/g;

function countOccurrences(text: string, value: string): number {
  return text.split(value).length - 1;
}

function nextPlaceholder(prefix: string, source: string, entries: ProtectedContentEntry[]): string {
  let index = 1;
  let placeholder = `<${prefix}_${index}>`;
  while (source.includes(placeholder) || entries.some((entry) => entry.placeholder === placeholder)) {
    placeholder = `<${prefix}_${++index}>`;
  }
  return placeholder;
}

export function protectSpecialContent(source: string): ProtectedContent {
  const entries: ProtectedContentEntry[] = [];
  let text = source.replace(SPECIAL_BLOCK_PATTERN, (content, name: string) => {
    const prefix = name.toLowerCase() === "writing" ? "TEXTBLOCK" : "SPECIALBLOCK";
    const placeholder = nextPlaceholder(prefix, source, entries);
    entries.push({ placeholder, content });
    return placeholder;
  });

  text = text.replace(CITATION_PATTERN, (content) => {
    const placeholder = nextPlaceholder("CITATION", source, entries);
    entries.push({ placeholder, content });
    return placeholder;
  });

  const generatedPlaceholders = new Set(entries.map((entry) => entry.placeholder));
  const existingPlaceholders = new Map<string, number>();
  for (const placeholder of text.match(PLACEHOLDER_PATTERN) ?? []) {
    if (!generatedPlaceholders.has(placeholder)) {
      existingPlaceholders.set(placeholder, (existingPlaceholders.get(placeholder) ?? 0) + 1);
    }
  }

  return { text, entries, existingPlaceholders };
}

export function restoreSpecialContent(rewritten: string, protectedContent: ProtectedContent): string {
  for (const entry of protectedContent.entries) {
    if (countOccurrences(rewritten, entry.placeholder) !== 1) {
      throw new Error(`Gemini did not preserve placeholder ${entry.placeholder}`);
    }
  }
  for (const [placeholder, count] of protectedContent.existingPlaceholders) {
    if (countOccurrences(rewritten, placeholder) !== count) {
      throw new Error(`Gemini did not preserve existing placeholder ${placeholder}`);
    }
  }

  let restored = rewritten;
  for (const entry of protectedContent.entries) {
    restored = restored.replace(entry.placeholder, entry.content);
  }
  return restored;
}