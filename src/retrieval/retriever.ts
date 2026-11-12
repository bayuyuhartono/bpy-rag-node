import { config } from '../config.ts';
import type { RetrievedChunk } from '../types.ts';
import { embed } from './embedder.ts';
import { query } from './vectorStore.ts';

/** Ambil chunk paling relevan, buang yang skornya di bawah threshold (anti halusinasi). */
export async function retrieve(question: string): Promise<RetrievedChunk[]> {
  const { topK, minScore } = config.retrieval;
  const vector = await embed(question);
  const results = await query(vector, question, topK);
  return results.filter((r) => r.score >= minScore);
}
