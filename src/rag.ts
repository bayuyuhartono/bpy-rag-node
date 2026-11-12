import { generateAnswer } from './generation/generator.ts';
import { retrieve } from './retrieval/retriever.ts';
import type { RagAnswer } from './types.ts';

/** Pipeline RAG: retrieve -> generate. Tidak nge-print apa pun, jadi bisa dipakai di CLI maupun API. */
export async function askDocs(question: string): Promise<RagAnswer> {
  const sources = await retrieve(question);
  if (sources.length === 0) return { found: false };

  const answer = await generateAnswer(question, sources);
  return { found: true, answer, sources };
}
