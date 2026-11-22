export type EmbeddingTaskType = 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY';

export interface EmbeddingProvider {
  embed(texts: string[], taskType: EmbeddingTaskType): Promise<number[][]>;
}

type GeminiEmbedResponse = {
  embeddings?: Array<{ values?: number[] }>;
  embedding?: { values?: number[] };
};

export type GeminiEmbeddingOptions = {
  apiKey?: string;
  model?: string;
  dimensions?: number;
  fetcher?: typeof fetch;
  maxBatchSize?: number;
  maxRetries?: number;
};

const MAX_TEXT_CHARACTERS = 8_000;

export class GeminiEmbeddingProvider implements EmbeddingProvider {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly dimensions: number;
  private readonly fetcher: typeof fetch;
  private readonly maxBatchSize: number;
  private readonly maxRetries: number;

  constructor(options: GeminiEmbeddingOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.GEMINI_API_KEY ?? '';
    this.model = options.model ?? process.env.GEMINI_EMBEDDING_MODEL ?? '';
    const configuredDimension =
      options.dimensions ?? Number(process.env.EMBEDDING_DIMENSIONS ?? 0);
    this.dimensions = configuredDimension;
    this.fetcher = options.fetcher ?? fetch;
    this.maxBatchSize = options.maxBatchSize ?? 16;
    this.maxRetries = options.maxRetries ?? 1;
  }

  async embed(
    texts: string[],
    taskType: EmbeddingTaskType
  ): Promise<number[][]> {
    if (texts.length === 0) return [];
    if (!this.apiKey)
      throw new Error('GEMINI_API_KEY is required for embeddings.');
    if (!this.model) throw new Error('GEMINI_EMBEDDING_MODEL is required.');
    if (!Number.isInteger(this.dimensions) || this.dimensions < 1) {
      throw new Error('EMBEDDING_DIMENSIONS must be a positive integer.');
    }
    if (!Number.isInteger(this.maxBatchSize) || this.maxBatchSize < 1) {
      throw new Error('Embedding batch size must be a positive integer.');
    }
    for (const [index, text] of texts.entries()) {
      if (!text.trim()) throw new Error(`Embedding text ${index} is empty.`);
      if (text.length > MAX_TEXT_CHARACTERS) {
        throw new Error(
          `Embedding text ${index} exceeds ${MAX_TEXT_CHARACTERS} characters.`
        );
      }
    }

    const vectors: number[][] = [];
    for (let offset = 0; offset < texts.length; offset += this.maxBatchSize) {
      const batch = texts.slice(offset, offset + this.maxBatchSize);
      const response = await this.requestBatch(batch, taskType);
      if (response.length !== batch.length) {
        throw new Error(
          `Gemini returned ${response.length} embeddings for a batch of ${batch.length}.`
        );
      }
      vectors.push(...response);
    }
    return vectors;
  }

  private async requestBatch(
    texts: string[],
    taskType: EmbeddingTaskType
  ): Promise<number[][]> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:batchEmbedContents`;
    const requests = texts.map((text) => ({
      model: `models/${this.model}`,
      taskType,
      outputDimensionality: this.dimensions,
      content: { parts: [{ text }] },
    }));

    let lastStatus: number | undefined;
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const response = await this.fetcher(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-goog-api-key': this.apiKey,
        },
        body: JSON.stringify({ requests }),
      });

      if (response.ok) {
        const payload = (await response.json()) as GeminiEmbedResponse;
        const vectors =
          payload.embeddings?.map((item) => item.values ?? []) ?? [];
        return vectors.map((vector, index) => {
          if (
            vector.length !== this.dimensions ||
            vector.some((value) => !Number.isFinite(value))
          ) {
            throw new Error(
              `Gemini embedding ${index} has invalid dimensions; expected ${this.dimensions} finite values.`
            );
          }
          return vector;
        });
      }

      lastStatus = response.status;
      if (response.status !== 429 || attempt === this.maxRetries) {
        break;
      }
      await this.delay(retryDelayMs(response.headers.get('retry-after')));
    }

    throw new Error(
      lastStatus === 429
        ? 'Gemini embedding quota exceeded (HTTP 429). Retry after the provider quota resets.'
        : `Gemini embedding request failed with HTTP ${lastStatus ?? 'unknown'}.`
    );
  }

  private delay(milliseconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }
}

function retryDelayMs(header: string | null): number {
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds)) {
      return Math.min(Math.max(seconds * 1000, 0), 5_000);
    }
    const dateDelay = Date.parse(header) - Date.now();
    if (Number.isFinite(dateDelay)) {
      return Math.min(Math.max(dateDelay, 0), 5_000);
    }
  }
  return 500;
}
