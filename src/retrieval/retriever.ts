import { config } from '../config.ts';
import type { RetrievedChunk } from '../types.ts';
import { embed } from './embedder.ts';
import { query, countChunks } from './vectorStore.ts';
import { searchBM25, reciprocalRankFusion } from './bm25.ts';

export async function retrieve(question: string): Promise<RetrievedChunk[]> {
  // 1. Jalankan Vector Search (ambil kandidat lebih banyak, misal topK * 2)
  const queryVector = await embed(question);
  const candidateK = config.retrieval.topK * 2;
  const vectorResults = (await query(queryVector, question, candidateK))
    .filter((r) => r.score >= config.retrieval.minScore);

  // 2. Jalankan Keyword BM25 Search
  const allDocs = await countChunks();
  const bm25Results = searchBM25(question, allDocs, candidateK);

  // 3. Gabungkan dan urutkan ulang dengan RRF
  return reciprocalRankFusion(vectorResults, bm25Results, config.retrieval.topK);
}