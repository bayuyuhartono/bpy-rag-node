import { generateAnswer, rewriteQuery } from './generation/generator.ts';
import { retrieve } from './retrieval/retriever.ts';
import type { ChatMessage, RagAnswer } from './types.ts';

/** RAG pipeline: rewrite query -> retrieve -> generate. Prints nothing, so it can be used from the CLI or an API. */
export async function askDocs(question: string, history: ChatMessage[] = []): Promise<RagAnswer> {
  const standaloneQuery = await rewriteQuery(question, history);
  const sources = await retrieve(standaloneQuery);
  if (sources.length === 0) return { found: false };

  const answer = await generateAnswer(standaloneQuery, sources);
  return { found: true, answer, sources, rewrittenQuery: standaloneQuery };
}
