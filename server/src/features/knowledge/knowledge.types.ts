export type KnowledgeArticleInput = {
  id: string;
  title: string;
  sourceName: string;
  category: string;
  body: string;
  isPublished: boolean;
};

export type KnowledgeChunk = {
  articleId: string;
  articleTitle: string;
  sourceName: string;
  category: string;
  content: string;
  ordinal: number;
};

export type KnowledgeEmbedding = KnowledgeChunk & {
  embedding: number[];
};

export type KnowledgeSearchResult = {
  chunkId: string;
  articleId: string;
  title: string;
  sourceName: string;
  content: string;
  similarity: number;
};

export type KnowledgeStore = {
  replaceArticleChunks(
    article: KnowledgeArticleInput,
    chunks: KnowledgeChunk[],
    embeddings: number[][]
  ): Promise<void>;
  search(input: {
    embedding: number[];
    topK: number;
    minSimilarity: number;
  }): Promise<KnowledgeSearchResult[]>;
};
