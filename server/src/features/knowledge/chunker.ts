import type {
  KnowledgeArticleInput,
  KnowledgeChunk,
} from './knowledge.types.js';

export type ChunkOptions = {
  maxCharacters?: number;
  overlapCharacters?: number;
};

const DEFAULT_MAX_CHARACTERS = 900;
const DEFAULT_OVERLAP_CHARACTERS = 120;

export function normalizeArticleText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function chunkArticle(
  article: KnowledgeArticleInput,
  options: ChunkOptions = {}
): KnowledgeChunk[] {
  const maxCharacters = options.maxCharacters ?? DEFAULT_MAX_CHARACTERS;
  const overlapCharacters =
    options.overlapCharacters ?? DEFAULT_OVERLAP_CHARACTERS;

  if (!Number.isInteger(maxCharacters) || maxCharacters < 1) {
    throw new Error('maxCharacters must be a positive integer.');
  }
  if (
    !Number.isInteger(overlapCharacters) ||
    overlapCharacters < 0 ||
    overlapCharacters >= maxCharacters
  ) {
    throw new Error(
      'overlapCharacters must be non-negative and smaller than maxCharacters.'
    );
  }

  const normalized = normalizeArticleText(article.body);
  if (!normalized) {
    throw new Error(`Knowledge article "${article.id}" has no body content.`);
  }

  const paragraphs = normalized.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = '';

  const pushCurrent = () => {
    const trimmed = current.trim();
    if (trimmed) chunks.push(trimmed);
    current = '';
  };

  for (const paragraph of paragraphs) {
    if (paragraph.length <= maxCharacters) {
      const combined = current ? `${current}\n\n${paragraph}` : paragraph;
      if (combined.length <= maxCharacters) {
        current = combined;
      } else {
        pushCurrent();
        current = paragraph;
      }
      continue;
    }

    pushCurrent();
    let remaining = paragraph;
    while (remaining.length > maxCharacters) {
      let end = remaining.lastIndexOf(' ', maxCharacters);
      if (end < Math.floor(maxCharacters * 0.6)) end = maxCharacters;
      chunks.push(remaining.slice(0, end).trim());
      const next = Math.max(end - overlapCharacters, 1);
      remaining = remaining.slice(next).trimStart();
    }
    current = remaining;
  }
  pushCurrent();

  return chunks.map((content, index) => ({
    articleId: article.id,
    articleTitle: article.title,
    sourceName: article.sourceName,
    category: article.category,
    content,
    ordinal: index,
  }));
}

export function validateArticleInput(input: unknown): KnowledgeArticleInput {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Knowledge article must be an object.');
  }

  const candidate = input as Record<string, unknown>;
  const required = ['id', 'title', 'sourceName', 'category', 'body'] as const;
  for (const field of required) {
    if (typeof candidate[field] !== 'string' || !candidate[field].trim()) {
      throw new Error(`Knowledge article ${field} is required.`);
    }
  }
  if (typeof candidate.isPublished !== 'boolean') {
    throw new Error('Knowledge article isPublished must be a boolean.');
  }

  const article: KnowledgeArticleInput = {
    id: (candidate.id as string).trim(),
    title: (candidate.title as string).trim(),
    sourceName: (candidate.sourceName as string).trim(),
    category: (candidate.category as string).trim(),
    body: normalizeArticleText(candidate.body as string),
    isPublished: candidate.isPublished,
  };
  if (!article.body) throw new Error('Knowledge article body is required.');

  return article;
}
