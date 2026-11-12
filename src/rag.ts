import { generateAnswer, rewriteQuery } from './generation/generator.ts';
import { retrieve } from './retrieval/retriever.ts';
import type { ChatMessage, RagAnswer } from './types.ts';

/** Pipeline RAG: retrieve -> generate. Tidak nge-print apa pun, jadi bisa dipakai di CLI maupun API. */
export async function askDocs(question: string, history: ChatMessage[] = []): Promise<RagAnswer> {
  const standaloneQuery = await rewriteQuery(question, history);
  const sources = await retrieve(question);

  if (sources.length === 0) {

  return { 
    found: true, 
    answer: 'Maaf, informasi tersebut tidak ditemukan di dokumen.',
    sources, 
    rewrittenQuery: standaloneQuery
  };

  }

  if (sources.length === 0) return { found: false };

  const answer = await generateAnswer(question, sources);
  return { found: true, answer, sources, rewrittenQuery: standaloneQuery };
}
