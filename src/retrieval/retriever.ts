import { config } from '../config.ts';
import type { RetrievedChunk } from '../types.ts';
import { embed } from './embedder.ts';
import { query, getAllChunks } from './vectorStore.ts';
import { searchBM25, reciprocalRankFusion } from './bm25.ts';
import { rerankChunks } from './reranker.ts';

export async function retrieve(question: string): Promise<RetrievedChunk[]> {
  // Stage 1: cast a wider candidate net with hybrid search
  const [queryVector, allDocs] = await Promise.all([
    embed(question),
    getAllChunks(),
  ]);

  const vectorResults = (await query(queryVector, question, config.retrieval.candidateK))
    .filter((r) => r.score >= config.retrieval.minScore);

  const bm25Results = searchBM25(question, allDocs, config.retrieval.candidateK);
  const fusedCandidates = reciprocalRankFusion(vectorResults, bm25Results, config.retrieval.candidateK);

  // No-rerank option: take topK straight from the RRF results (faster, no Jina API call)
  // return fusedCandidates.slice(0, config.retrieval.topK);

  // Stage 2: re-order with the Jina cross-encoder reranker
  return await rerankChunks(question, fusedCandidates, config.retrieval.topK);
}
