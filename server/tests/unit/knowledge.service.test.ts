import { describe, expect, it, vi } from 'vitest';
import { KnowledgeService } from '../../src/features/knowledge/knowledge.service.js';
import { SeedKnowledgeArticleRepository } from '../../src/features/knowledge/article.repository.js';
import { InMemoryKnowledgeStore } from '../../src/features/knowledge/knowledge.store.js';
import type { EmbeddingProvider } from '../../src/features/knowledge/gemini-embeddings.js';
import type { KnowledgeArticleInput } from '../../src/features/knowledge/knowledge.types.js';

const sampleArticle: KnowledgeArticleInput = {
  id: 'kb-demo-vpn',
  title: 'Demo VPN profile reset',
  sourceName: 'Fictional IT guide',
  category: 'network',
  body: 'For the fictional demo VPN, open the tray icon and reset the profile. Sign in again with the demo account.',
  isPublished: true,
};

function deterministicEmbedding(text: string): number[] {
  const vector = Array.from({ length: 4 }, () => 0);
  for (const [index, char] of Array.from(text).entries()) {
    vector[index % vector.length]! += char.charCodeAt(0);
  }
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value ** 2, 0));
  return vector.map((value) => value / norm);
}

describe('knowledge ingestion and retrieval service', () => {
  it('indexes articles repeatably and searches with query embeddings', async () => {
    const store = new InMemoryKnowledgeStore();
    const embeddingProvider: EmbeddingProvider = {
      embed: vi.fn(async (texts) => texts.map(deterministicEmbedding)),
    };
    const articles = new SeedKnowledgeArticleRepository();
    await articles.upsert(sampleArticle);
    const service = new KnowledgeService({
      articles,
      store,
      embeddings: embeddingProvider,
      maxChunkCharacters: 80,
      overlapCharacters: 10,
      minSimilarity: 0.1,
    });

    const first = await service.ingest(sampleArticle);
    const second = await service.ingest(sampleArticle);
    const results = await service.search('reset the demo VPN profile');

    expect(first.articleId).toBe(sampleArticle.id);
    expect(first.chunksIndexed).toBeGreaterThan(0);
    expect(second.chunksIndexed).toBe(first.chunksIndexed);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toMatchObject({
      articleId: sampleArticle.id,
      title: sampleArticle.title,
      sourceName: sampleArticle.sourceName,
    });
    expect(embeddingProvider.embed).toHaveBeenCalledWith(
      ['reset the demo VPN profile'],
      'RETRIEVAL_QUERY'
    );
  });

  it('does not replace existing article chunks when embedding generation fails', async () => {
    const store = new InMemoryKnowledgeStore();
    const articleRepository = new SeedKnowledgeArticleRepository();
    const embeddingProvider: EmbeddingProvider = {
      embed: vi
        .fn()
        .mockResolvedValueOnce([deterministicEmbedding('old text')])
        .mockRejectedValueOnce(new Error('provider unavailable')),
    };
    const service = new KnowledgeService({
      articles: articleRepository,
      store,
      embeddings: embeddingProvider,
      maxChunkCharacters: 200,
      overlapCharacters: 10,
      minSimilarity: -1,
    });

    await service.ingest(sampleArticle);
    await expect(
      service.ingest({ ...sampleArticle, body: 'Updated fictional procedure.' })
    ).rejects.toThrow('provider unavailable');
    const results = await store.search({
      embedding: deterministicEmbedding('old text'),
      topK: 5,
      minSimilarity: -1,
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.content).toContain('For the fictional demo VPN');
  });

  it('removes chunks from unpublished articles', async () => {
    const store = new InMemoryKnowledgeStore();
    const service = new KnowledgeService({
      articles: new SeedKnowledgeArticleRepository(),
      store,
      embeddings: { embed: async (texts) => texts.map(deterministicEmbedding) },
      minSimilarity: -1,
    });
    await service.ingest(sampleArticle);
    await service.ingest({ ...sampleArticle, isPublished: false });

    expect(
      await store.search({
        embedding: deterministicEmbedding(sampleArticle.body),
        topK: 5,
        minSimilarity: -1,
      })
    ).toEqual([]);
  });

  it('rejects empty or oversized retrieval queries', async () => {
    const service = new KnowledgeService({
      articles: new SeedKnowledgeArticleRepository(),
      store: new InMemoryKnowledgeStore(),
      embeddings: { embed: async (texts) => texts.map(deterministicEmbedding) },
    });
    await expect(service.search('  ')).rejects.toThrow(
      'A retrieval query is required.'
    );
    await expect(service.search('a'.repeat(1001))).rejects.toThrow(
      'Retrieval query must be 1000 characters or fewer.'
    );
  });
});
