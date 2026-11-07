export type RetrievalSource = {
  id: string;
  title: string;
  sourceName: string;
  content: string;
  similarity: number;
};

export type GroundedAnswerResult = {
  answer: string;
  sources: Array<{
    id: string;
    title: string;
    sourceName: string;
    excerpt: string;
    relevance: number;
  }>;
  confidence: 'high' | 'medium' | 'low';
  status: 'answered' | 'insufficient_context';
};

export function generateGroundedAnswer(
  question: string,
  sources: RetrievalSource[]
): GroundedAnswerResult {
  if (!sources.length) {
    return {
      answer:
        'I could not find enough approved internal guidance to answer that request safely. Please verify the ticket details or ask a supported IT procedure question.',
      sources: [],
      confidence: 'low',
      status: 'insufficient_context',
    };
  }

  const rankedSources = [...sources]
    .sort((left, right) => right.similarity - left.similarity)
    .slice(0, 3);

  const answerBuilder = rankedSources
    .map((source) => `${source.title}: ${source.content.slice(0, 180).trim()}`)
    .join(' ');

  const answer = `Based on approved helpdesk guidance, ${answerBuilder} For this request, follow the documented procedure and escalate if the issue falls outside the approved scope.`;

  const bestSimilarity = rankedSources[0]?.similarity ?? 0;

  return {
    answer: answer.length > 800 ? `${answer.slice(0, 797).trim()}...` : answer,
    sources: rankedSources.map((source) => ({
      id: source.id,
      title: source.title,
      sourceName: source.sourceName,
      excerpt: source.content.slice(0, 180).trim(),
      relevance: Number(source.similarity.toFixed(3)),
    })),
    confidence:
      bestSimilarity >= 0.7
        ? 'high'
        : bestSimilarity >= 0.45
          ? 'medium'
          : 'low',
    status: 'answered',
  };
}

export function extractQuestionTopic(question: string): string {
  return question.trim().replace(/\s+/g, ' ');
}
