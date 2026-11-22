import { ingestKnowledgeArticles } from './indexer.js';

try {
  const result = await ingestKnowledgeArticles();
  console.log(
    `Indexed ${result.chunksIndexed} knowledge chunks from ${result.articles} articles.`
  );
} catch (error) {
  console.error(
    'Knowledge ingestion failed:',
    error instanceof Error ? error.message : 'Unexpected error.'
  );
  process.exitCode = 1;
}
