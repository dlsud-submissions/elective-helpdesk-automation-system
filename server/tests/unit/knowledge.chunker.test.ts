import { describe, expect, it } from 'vitest';
import {
  chunkArticle,
  normalizeArticleText,
  validateArticleInput,
} from '../../src/features/knowledge/chunker.js';

const article = {
  id: 'kb-vpn',
  title: 'Demo VPN reconnection',
  sourceName: 'Fictional IT Handbook',
  category: 'network',
  body: '  Open the demo VPN client.  \r\n\r\nSelect reconnect and verify status.  ',
  isPublished: true,
};

describe('knowledge article chunking', () => {
  it('normalizes whitespace and paragraph breaks', () => {
    expect(normalizeArticleText(' Alpha\t beta \r\n\r\n\r\n gamma ')).toBe(
      'Alpha beta\n\ngamma'
    );
  });

  it('validates required article metadata and fictional body input shape', () => {
    expect(validateArticleInput(article)).toEqual({
      ...article,
      body: 'Open the demo VPN client.\n\nSelect reconnect and verify status.',
    });
    expect(() => validateArticleInput({ ...article, title: ' ' })).toThrow(
      'Knowledge article title is required.'
    );
    expect(() =>
      validateArticleInput({ ...article, isPublished: 'yes' })
    ).toThrow('Knowledge article isPublished must be a boolean.');
  });

  it('preserves stable article/source metadata on bounded chunks', () => {
    const longBody = Array.from(
      { length: 8 },
      (_, index) =>
        `Step ${index + 1}: reconnect the fictional demo VPN client safely.`
    ).join(' ');
    const chunks = chunkArticle(
      { ...article, body: longBody },
      {
        maxCharacters: 70,
        overlapCharacters: 12,
      }
    );

    expect(chunks.length).toBeGreaterThan(1);
    for (const [index, chunk] of chunks.entries()) {
      expect(chunk).toMatchObject({
        articleId: 'kb-vpn',
        articleTitle: 'Demo VPN reconnection',
        sourceName: 'Fictional IT Handbook',
        category: 'network',
        ordinal: index,
      });
      expect(chunk.content.length).toBeLessThanOrEqual(70);
    }
    expect(chunks[0]?.content).toContain('Step 1');
    expect(chunks.at(-1)?.content).toContain('Step 8');
  });

  it('rejects invalid chunk limits and empty content', () => {
    expect(() =>
      chunkArticle(article, { maxCharacters: 10, overlapCharacters: 10 })
    ).toThrow(
      'overlapCharacters must be non-negative and smaller than maxCharacters.'
    );
    expect(() => chunkArticle({ ...article, body: '  ' })).toThrow(
      'Knowledge article "kb-vpn" has no body content.'
    );
  });
});
