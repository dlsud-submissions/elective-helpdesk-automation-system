import type { KnowledgeArticleInput } from './knowledge.types.js';
import { validateArticleInput } from './chunker.js';
import { knowledgeArticles } from '../../shared/knowledge/seed.js';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export interface KnowledgeArticleRepository {
  listPublished(): Promise<KnowledgeArticleInput[]>;
  upsert(article: KnowledgeArticleInput): Promise<void>;
}

export class SeedKnowledgeArticleRepository implements KnowledgeArticleRepository {
  async listPublished(): Promise<KnowledgeArticleInput[]> {
    return knowledgeArticles
      .filter((article) => article.isPublished)
      .map((article) => ({ ...article }));
  }

  async upsert(article: KnowledgeArticleInput): Promise<void> {
    const existingIndex = knowledgeArticles.findIndex(
      (item) => item.id === article.id
    );
    if (existingIndex < 0) {
      knowledgeArticles.push(article);
      return;
    }
    knowledgeArticles[existingIndex] = article;
  }
}

export class FileKnowledgeArticleRepository implements KnowledgeArticleRepository {
  constructor(
    private readonly directory = resolve(process.cwd(), 'data/knowledge')
  ) {}

  async listPublished(): Promise<KnowledgeArticleInput[]> {
    let files: string[];
    try {
      files = (await readdir(this.directory)).filter((file) =>
        file.endsWith('.json')
      );
    } catch (error) {
      throw new Error(
        `Unable to read knowledge corpus directory "${this.directory}": ${
          error instanceof Error ? error.message : 'unknown filesystem error'
        }`
      );
    }

    const articles: KnowledgeArticleInput[] = [];
    for (const file of files.sort()) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(
          await readFile(resolve(this.directory, file), 'utf8')
        );
      } catch (error) {
        throw new Error(
          `Unable to parse knowledge article "${file}": ${
            error instanceof Error ? error.message : 'unknown file error'
          }`
        );
      }
      const article = validateArticleInput(parsed);
      if (article.isPublished) articles.push(article);
    }
    return articles;
  }

  async upsert(): Promise<void> {
    throw new Error(
      'File corpus is read-only. Edit or add a JSON article file.'
    );
  }
}
