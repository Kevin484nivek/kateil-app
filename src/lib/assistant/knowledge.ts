import { readFile } from "node:fs/promises";
import path from "node:path";

import { getSmartSearchScore, normalizeSearchText } from "@/lib/utils/search";

import type { AssistantKnowledgeSnippet } from "./types";

type KnowledgeSource = {
  filePath: string;
  title: string;
};

const KNOWLEDGE_SOURCES: KnowledgeSource[] = [
  {
    filePath: "docs/help/manual-usuario.md",
    title: "Manual de usuario",
  },
  {
    filePath: "docs/help/faq-operativa.md",
    title: "FAQ operativa",
  },
  {
    filePath: "docs/product/returns-exchange-flow.md",
    title: "Flujo devoluciones/cambios",
  },
  {
    filePath: "docs/operations/backups.md",
    title: "Backups y restauración",
  },
];

function splitMarkdownIntoChunks(content: string, sourceTitle: string, sourcePath: string) {
  const lines = content.split(/\r?\n/);
  const chunks: Array<{ title: string; body: string; source: string }> = [];

  let currentHeading = sourceTitle;
  let buffer: string[] = [];

  const flush = () => {
    const body = buffer.join("\n").trim();

    if (body.length >= 60) {
      chunks.push({
        title: currentHeading,
        body,
        source: sourcePath,
      });
    }

    buffer = [];
  };

  for (const line of lines) {
    if (line.startsWith("#")) {
      flush();
      currentHeading = line.replace(/^#+\s*/, "").trim() || sourceTitle;
      continue;
    }

    buffer.push(line);
  }

  flush();

  return chunks;
}

function compactExcerpt(text: string, maxChars = 520) {
  const clean = text.replace(/\s+/g, " ").trim();

  if (clean.length <= maxChars) {
    return clean;
  }

  return `${clean.slice(0, maxChars - 1)}…`;
}

export async function searchKnowledgeSnippets(query: string, maxItems = 4): Promise<AssistantKnowledgeSnippet[]> {
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) {
    return [];
  }

  const loadedSources = await Promise.all(
    KNOWLEDGE_SOURCES.map(async (source) => {
      try {
        const absolutePath = path.join(process.cwd(), source.filePath);
        const content = await readFile(absolutePath, "utf8");

        return splitMarkdownIntoChunks(content, source.title, source.filePath);
      } catch {
        return [];
      }
    }),
  );

  const allChunks = loadedSources.flat();
  const scored = allChunks
    .map((chunk) => {
      const score = getSmartSearchScore(query, [
        { value: chunk.title, weight: 5 },
        { value: chunk.body, weight: 2 },
      ]);

      if (score === null) {
        return null;
      }

      return {
        source: chunk.source,
        title: chunk.title,
        excerpt: compactExcerpt(chunk.body),
        score,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .sort((left, right) => right.score - left.score)
    .slice(0, maxItems);

  return scored;
}

