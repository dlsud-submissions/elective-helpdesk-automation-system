import { describe, expect, it, vi } from 'vitest';
import {
  GeminiEmbeddingProvider,
  type GeminiEmbeddingOptions,
} from '../../src/features/knowledge/gemini-embeddings.js';
import { SupabaseRestKnowledgeStore } from '../../src/features/knowledge/knowledge.store.js';
import type { KnowledgeArticleInput } from '../../src/features/knowledge/knowledge.types.js';

const article: KnowledgeArticleInput = {
  id: 'article-fixture-vpn',
  title: 'Fictional VPN reset',
  sourceName: 'Demo IT Guide',
  category: 'network',
  body: 'Reset the fictional demo VPN client profile.',
  isPublished: true,
};

describe('Gemini embedding provider boundary', () => {
  it('requests bounded batches with the configured model and dimension', async () => {
    const fetcher = vi.fn<typeof fetch>(async (_input, init) => {
      const requestBody = JSON.parse(String(init?.body)) as {
        requests: Array<Record<string, unknown>>;
      };
      return Response.json({
        embeddings: requestBody.requests.map(() => ({
          values: [0.1, 0.2, 0.3],
        })),
      });
    });
    const provider = new GeminiEmbeddingProvider({
      apiKey: 'fixture-key',
      model: 'gemini-embedding-001',
      dimensions: 3,
      fetcher,
      maxBatchSize: 2,
    } satisfies GeminiEmbeddingOptions);

    const vectors = await provider.embed(
      [
        'first fictional document',
        'second fictional document',
        'third fictional document',
      ],
      'RETRIEVAL_DOCUMENT'
    );

    expect(vectors).toHaveLength(3);
    expect(fetcher).toHaveBeenCalledTimes(2);
    const firstInit = fetcher.mock.calls[0]?.[1];
    expect(firstInit?.headers).toMatchObject({
      'x-goog-api-key': 'fixture-key',
    });
    expect(JSON.parse(String(firstInit?.body))).toMatchObject({
      requests: [
        {
          model: 'models/gemini-embedding-001',
          taskType: 'RETRIEVAL_DOCUMENT',
          outputDimensionality: 3,
        },
        {
          model: 'models/gemini-embedding-001',
          taskType: 'RETRIEVAL_DOCUMENT',
          outputDimensionality: 3,
        },
      ],
    });
  });

  it('retries one 429 response and rejects dimensions that do not match configuration', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('quota', { status: 429 }))
      .mockResolvedValueOnce(
        Response.json({ embeddings: [{ values: [1, 2] }] })
      );
    const provider = new GeminiEmbeddingProvider({
      apiKey: 'fixture-key',
      model: 'gemini-embedding-001',
      dimensions: 3,
      fetcher,
      maxRetries: 1,
    });

    await expect(
      provider.embed(['fictional doc'], 'RETRIEVAL_DOCUMENT')
    ).rejects.toThrow('Gemini embedding 0 has invalid dimensions');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

describe('Supabase knowledge REST adapter boundary', () => {
  it('upserts the article, replaces its chunks, and invokes bounded vector search', async () => {
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.includes('/rpc/match_chunks')) {
        return Response.json([
          {
            chunk_id: 'chunk-1',
            article_id: article.id,
            title: article.title,
            source_name: article.sourceName,
            chunk_text: article.body,
            similarity: 0.91,
          },
        ]);
      }
      return new Response(null, { status: 204 });
    });
    const store = new SupabaseRestKnowledgeStore({
      url: 'https://project.supabase.co',
      serviceRoleKey: 'service-role-fixture',
      dimensions: 3,
      fetcher,
    });

    await store.replaceArticleChunks(
      article,
      [
        {
          articleId: article.id,
          articleTitle: article.title,
          sourceName: article.sourceName,
          category: article.category,
          content: article.body,
          ordinal: 0,
        },
      ],
      [[0.1, 0.2, 0.3]]
    );
    const results = await store.search({
      embedding: [0.1, 0.2, 0.3],
      topK: 5,
      minSimilarity: 0.5,
    });

    expect(results[0]).toMatchObject({
      chunkId: 'chunk-1',
      articleId: article.id,
      title: article.title,
      similarity: 0.91,
    });
    expect(fetcher.mock.calls.map(([url]) => String(url))).toEqual([
      'https://project.supabase.co/rest/v1/knowledge_articles?on_conflict=id',
      'https://project.supabase.co/rest/v1/rpc/replace_knowledge_chunks',
      'https://project.supabase.co/rest/v1/rpc/match_chunks',
    ]);
    const replaceRequest = fetcher.mock.calls[1]?.[1];
    const replaceBody = JSON.parse(String(replaceRequest?.body)) as {
      chunk_rows: Array<{ embedding: string }>;
    };
    expect(replaceBody.chunk_rows[0]?.embedding).toBe('[0.1,0.2,0.3]');
    expect(fetcher.mock.calls.at(-1)?.[1]?.headers).toMatchObject({
      authorization: 'Bearer service-role-fixture',
    });
    expect(
      JSON.parse(String(fetcher.mock.calls.at(-1)?.[1]?.body))
    ).toMatchObject({
      match_count: 5,
      min_similarity: 0.5,
    });
  });

  it('rejects malformed vectors and missing provider configuration', async () => {
    const store = new SupabaseRestKnowledgeStore({
      url: 'https://project.supabase.co',
      serviceRoleKey: 'fixture',
      dimensions: 3,
      fetcher: vi.fn(),
    });
    await expect(
      store.search({ embedding: [1, 2], topK: 5, minSimilarity: 0.5 })
    ).rejects.toThrow(
      'query embedding must contain exactly 3 finite dimensions.'
    );
    await expect(
      new SupabaseRestKnowledgeStore({
        url: '',
        serviceRoleKey: '',
        dimensions: 3,
      }).search({ embedding: [1, 2, 3], topK: 5, minSimilarity: 0.5 })
    ).rejects.toThrow(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required'
    );
  });
});
