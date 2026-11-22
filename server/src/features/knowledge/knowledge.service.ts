import { chunkArticle, validateArticleInput } from './chunker.js';
import type { EmbeddingProvider } from './gemini-embeddings.js';
import type {
  KnowledgeArticleInput,
  KnowledgeSearchResult,
  KnowledgeStore,
} from './knowledge.types.js';
import type { KnowledgeArticleRepository } from './article.repository.js';

export type KnowledgeServiceOptions = {
  articles: KnowledgeArticleRepository;
  store: KnowledgeStore;
  embeddings: EmbeddingProvider;
  topK?: number;
  minSimilarity?: number;
  maxChunkCharacters?: number;
  overlapCharacters?: number;
};

export class KnowledgeService {
  private readonly options: Required<
    Pick<
      KnowledgeServiceOptions,
      'topK' | 'minSimilarity' | 'maxChunkCharacters' | 'overlapCharacters'
    >
  > &
    Omit<
      KnowledgeServiceOptions,
      'topK' | 'minSimilarity' | 'maxChunkCharacters' | 'overlapCharacters'
    >;

  constructor(options: KnowledgeServiceOptions) {
    this.options = {
      ...options,
      topK: options.topK ?? 5,
      minSimilarity: options.minSimilarity ?? 0.5,
      maxChunkCharacters: options.maxChunkCharacters ?? 900,
      overlapCharacters: options.overlapCharacters ?? 120,
    };
  }

  async ingest(
    input: unknown
  ): Promise<{ articleId: string; chunksIndexed: number }> {
    const article = validateArticleInput(input);
    const chunks = article.isPublished
      ? chunkArticle(article, {
          maxCharacters: this.options.maxChunkCharacters,
          overlapCharacters: this.options.overlapCharacters,
        })
      : [];
    const vectors = chunks.length
      ? await this.options.embeddings.embed(
          chunks.map((chunk) => `${article.title}\n${chunk.content}`),
          'RETRIEVAL_DOCUMENT'
        )
      : [];
    if (vectors.length !== chunks.length) {
      throw new Error('Embedding provider returned an incomplete batch.');
    }

    await this.options.store.replaceArticleChunks(article, chunks, vectors);
    return { articleId: article.id, chunksIndexed: chunks.length };
  }

  async ingestAll(): Promise<{ articles: number; chunksIndexed: number }> {
    const articles = await this.options.articles.listPublished();
    return this.ingestArticles(articles);
  }

  async ingestArticles(
    articles: KnowledgeArticleInput[]
  ): Promise<{ articles: number; chunksIndexed: number }> {
    let chunksIndexed = 0;
    for (const article of articles) {
      const result = await this.ingest(article);
      chunksIndexed += result.chunksIndexed;
    }
    return { articles: articles.length, chunksIndexed };
  }

  async search(query: string): Promise<KnowledgeSearchResult[]> {
    const normalized = query.trim();
    if (!normalized) throw new Error('A retrieval query is required.');
    if (normalized.length > 1000) {
      throw new Error('Retrieval query must be 1000 characters or fewer.');
    }
    const [embedding] = await this.options.embeddings.embed(
      [normalized],
      'RETRIEVAL_QUERY'
    );
    if (!embedding) {
      throw new Error('Embedding provider returned no query vector.');
    }
    return this.options.store.search({
      embedding,
      topK: this.options.topK,
      minSimilarity: this.options.minSimilarity,
    });
  }
}

export function articleFromSeed(
  article: KnowledgeArticleInput
): KnowledgeArticleInput {
  return { ...article };
}
