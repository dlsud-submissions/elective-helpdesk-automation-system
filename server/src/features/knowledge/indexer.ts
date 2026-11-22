import { FileKnowledgeArticleRepository } from './article.repository.js';
import { GeminiEmbeddingProvider } from './gemini-embeddings.js';
import { KnowledgeService } from './knowledge.service.js';
import { SupabaseRestKnowledgeStore } from './knowledge.store.js';

export async function ingestKnowledgeArticles() {
  const service = new KnowledgeService({
    articles: new FileKnowledgeArticleRepository(),
    store: new SupabaseRestKnowledgeStore(),
    embeddings: new GeminiEmbeddingProvider(),
  });
  return service.ingestAll();
}
