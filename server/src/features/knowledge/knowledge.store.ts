import type {
  KnowledgeArticleInput,
  KnowledgeChunk,
  KnowledgeEmbedding,
  KnowledgeSearchResult,
  KnowledgeStore,
} from './knowledge.types.js';
import { randomUUID } from 'node:crypto';

export class InMemoryKnowledgeStore implements KnowledgeStore {
  private readonly chunks = new Map<
    string,
    { isPublished: boolean; rows: KnowledgeEmbedding[] }
  >();

  async replaceArticleChunks(
    article: KnowledgeArticleInput,
    chunks: KnowledgeChunk[],
    embeddings: number[][]
  ): Promise<void> {
    if (chunks.length !== embeddings.length) {
      throw new Error('Each knowledge chunk must have exactly one embedding.');
    }
    const dimension = embeddings[0]?.length;
    for (const [index, vector] of embeddings.entries()) {
      if (
        vector.length === 0 ||
        vector.some((value) => !Number.isFinite(value)) ||
        (dimension !== undefined && vector.length !== dimension)
      ) {
        throw new Error(`embedding ${index} has invalid dimensions or values.`);
      }
    }
    if (
      chunks.some(
        (chunk) => chunk.ordinal < 0 || !Number.isInteger(chunk.ordinal)
      )
    ) {
      throw new Error('Chunk ordinals must be non-negative integers.');
    }
    const articleRows = chunks.map((chunk, index) => ({
      ...chunk,
      embedding: embeddings[index]!,
    }));
    const storedDimension = Array.from(this.chunks.entries())
      .filter(([articleId]) => articleId !== article.id)
      .flatMap(([, storedArticle]) => storedArticle.rows)
      .find((chunk) => chunk.embedding.length > 0)?.embedding.length;
    if (
      dimension !== undefined &&
      storedDimension !== undefined &&
      dimension !== storedDimension
    ) {
      throw new Error(
        'Embedding dimensions do not match for similarity search.'
      );
    }

    this.chunks.set(article.id, {
      isPublished: article.isPublished,
      rows: articleRows,
    });
  }

  async search(input: {
    embedding: number[];
    topK: number;
    minSimilarity: number;
  }): Promise<KnowledgeSearchResult[]> {
    validateInteger(input.topK, 'topK', 1, 20);
    if (
      input.embedding.length === 0 ||
      input.embedding.some((value) => !Number.isFinite(value))
    ) {
      throw new Error('Query embedding must contain finite values.');
    }
    if (
      !Number.isFinite(input.minSimilarity) ||
      input.minSimilarity < -1 ||
      input.minSimilarity > 1
    ) {
      throw new Error('minSimilarity must be between -1 and 1.');
    }
    const storedDimension = Array.from(this.chunks.values())
      .flatMap((article) => article.rows)
      .find((chunk) => chunk.embedding.length > 0)?.embedding.length;
    if (
      storedDimension !== undefined &&
      input.embedding.length !== storedDimension
    ) {
      throw new Error(
        'Embedding dimensions do not match for similarity search.'
      );
    }
    const matches: KnowledgeSearchResult[] = [];
    for (const article of this.chunks.values()) {
      if (!article.isPublished) continue;
      for (const chunk of article.rows) {
        const similarity = cosineSimilarity(input.embedding, chunk.embedding);
        if (similarity >= input.minSimilarity) {
          matches.push({
            chunkId: `${chunk.articleId}:${chunk.ordinal}`,
            articleId: chunk.articleId,
            title: chunk.articleTitle,
            sourceName: chunk.sourceName,
            content: chunk.content,
            similarity,
          });
        }
      }
    }
    return matches
      .sort((left, right) => right.similarity - left.similarity)
      .slice(0, input.topK);
  }
}

export type SupabaseRestOptions = {
  url?: string;
  serviceRoleKey?: string;
  dimensions?: number;
  fetcher?: typeof fetch;
};

type MatchRow = {
  chunk_id: string;
  article_id: string;
  title: string;
  source_name: string | null;
  chunk_text: string;
  similarity: number;
};

export class SupabaseRestKnowledgeStore implements KnowledgeStore {
  private readonly url: string;
  private readonly serviceRoleKey: string;
  private readonly dimensions: number;
  private readonly fetcher: typeof fetch;

  constructor(options: SupabaseRestOptions = {}) {
    this.url = (options.url ?? process.env.SUPABASE_URL ?? '').replace(
      /\/$/,
      ''
    );
    this.serviceRoleKey =
      options.serviceRoleKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
    this.dimensions =
      options.dimensions ?? Number(process.env.EMBEDDING_DIMENSIONS ?? 0);
    this.fetcher = options.fetcher ?? fetch;
  }

  async replaceArticleChunks(
    article: KnowledgeArticleInput,
    chunks: KnowledgeChunk[],
    embeddings: number[][]
  ): Promise<void> {
    this.assertConfigured();
    if (chunks.length !== embeddings.length) {
      throw new Error('Each knowledge chunk must have exactly one embedding.');
    }
    if (
      chunks.some(
        (chunk) => chunk.ordinal < 0 || !Number.isInteger(chunk.ordinal)
      )
    ) {
      throw new Error('Chunk ordinals must be non-negative integers.');
    }
    for (const [index, vector] of embeddings.entries()) {
      this.validateVector(vector, `embedding ${index}`);
    }

    await this.request('/rest/v1/knowledge_articles?on_conflict=id', {
      method: 'POST',
      headers: {
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify([
        {
          id: article.id,
          title: article.title,
          body: article.body,
          category: article.category,
          source_name: article.sourceName,
          is_published: article.isPublished,
          updated_at: new Date().toISOString(),
        },
      ]),
    });

    const rows = chunks.map((chunk, index) => ({
      id: randomUUID(),
      chunk_ordinal: chunk.ordinal,
      chunk_text: chunk.content,
      embedding: `[${embeddings[index]!.join(',')}]`,
    }));
    await this.request('/rest/v1/rpc/replace_knowledge_chunks', {
      method: 'POST',
      body: JSON.stringify({
        target_article_id: article.id,
        chunk_rows: rows,
      }),
    });
  }

  async search(input: {
    embedding: number[];
    topK: number;
    minSimilarity: number;
  }): Promise<KnowledgeSearchResult[]> {
    this.assertConfigured();
    this.validateVector(input.embedding, 'query embedding');
    const count = validateInteger(input.topK, 'topK', 1, 20);
    if (
      !Number.isFinite(input.minSimilarity) ||
      input.minSimilarity < -1 ||
      input.minSimilarity > 1
    ) {
      throw new Error('minSimilarity must be between -1 and 1.');
    }

    const response = await this.request('/rest/v1/rpc/match_chunks', {
      method: 'POST',
      body: JSON.stringify({
        query_embedding: `[${input.embedding.join(',')}]`,
        match_count: count,
        min_similarity: input.minSimilarity,
      }),
    });
    const rows = (await response.json()) as MatchRow[];
    return rows.map((row) => ({
      chunkId: row.chunk_id,
      articleId: row.article_id,
      title: row.title,
      sourceName: row.source_name ?? '',
      content: row.chunk_text,
      similarity: Number(row.similarity),
    }));
  }

  private validateVector(vector: number[], label: string): void {
    if (
      !Number.isInteger(this.dimensions) ||
      this.dimensions < 1 ||
      vector.length !== this.dimensions ||
      vector.some((value) => !Number.isFinite(value))
    ) {
      throw new Error(
        `${label} must contain exactly ${this.dimensions} finite dimensions.`
      );
    }
  }

  private assertConfigured(): void {
    if (!this.url || !this.serviceRoleKey) {
      throw new Error(
        'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for knowledge storage.'
      );
    }
  }

  private async request(
    path: string,
    options: {
      method: string;
      headers?: Record<string, string>;
      body?: string;
    }
  ): Promise<Response> {
    const response = await this.fetcher(`${this.url}${path}`, {
      method: options.method,
      headers: {
        apikey: this.serviceRoleKey,
        authorization: `Bearer ${this.serviceRoleKey}`,
        'content-type': 'application/json',
        ...options.headers,
      },
      body: options.body,
    });
    if (!response.ok) {
      throw new Error(
        `Supabase knowledge request failed with HTTP ${response.status}.`
      );
    }
    return response;
  }
}

function cosineSimilarity(left: number[], right: number[]): number {
  if (left.length !== right.length || left.length === 0) {
    throw new Error('Embedding dimensions do not match for similarity search.');
  }
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index]!;
    const rightValue = right[index]!;
    dot += leftValue * rightValue;
    leftNorm += leftValue ** 2;
    rightNorm += rightValue ** 2;
  }
  if (leftNorm === 0 || rightNorm === 0) return 0;
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

function validateInteger(
  value: number,
  field: string,
  minimum: number,
  maximum: number
): number {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(
      `${field} must be an integer between ${minimum} and ${maximum}.`
    );
  }
  return value;
}
