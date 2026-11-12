import type { ChunkMetadata, RetrievedChunk } from '../types.ts';

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

export function searchBM25(
  query: string,
  documents: ChunkMetadata[],
  topK: number,
  k1 = 1.5,
  b = 0.75
): RetrievedChunk[] {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0 || documents.length === 0) return [];

  const tokenizedDocs = documents.map((doc) => tokenize(doc.text));
  const avgDocLen =
    tokenizedDocs.reduce((sum, tokens) => sum + tokens.length, 0) / documents.length;

  // Compute document frequency (DF) for each term
  const df = new Map<string, number>();
  for (const tokens of tokenizedDocs) {
    const uniqueTokens = new Set(tokens);
    for (const token of uniqueTokens) {
      df.set(token, (df.get(token) ?? 0) + 1);
    }
  }

  const N = documents.length;
  const scored: RetrievedChunk[] = [];

  for (let i = 0; i < documents.length; i++) {
    const docTokens = tokenizedDocs[i];
    const docLen = docTokens.length;
    let score = 0;

    for (const term of queryTokens) {
      const termFreq = docTokens.filter((t) => t === term).length;
      if (termFreq === 0) continue;

      const docFreq = df.get(term) ?? 0;
      const idf = Math.log((N - docFreq + 0.5) / (docFreq + 0.5) + 1);
      const numerator = termFreq * (k1 + 1);
      const denominator = termFreq + k1 * (1 - b + b * (docLen / avgDocLen));
      score += idf * (numerator / denominator);
    }

    if (score > 0) {
      scored.push({ ...documents[i], score });
    }
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, topK);
}

// Merge vector & BM25 rankings using Reciprocal Rank Fusion (RRF)
export function reciprocalRankFusion(
  vectorResults: RetrievedChunk[],
  bm25Results: RetrievedChunk[],
  topK: number,
  k = 60
): RetrievedChunk[] {
  const fused = new Map<string, { chunk: RetrievedChunk; rrfScore: number }>();
  const getKey = (c: RetrievedChunk) => `${c.source}::${c.chunkIndex}`;

  vectorResults.forEach((item, rank) => {
    const key = getKey(item);
    const score = 1 / (k + rank + 1);
    fused.set(key, { chunk: item, rrfScore: score });
  });

  bm25Results.forEach((item, rank) => {
    const key = getKey(item);
    const score = 1 / (k + rank + 1);
    const existing = fused.get(key);
    if (existing) {
      existing.rrfScore += score;
    } else {
      // If it only appears in BM25, give it a base score so it passes minScore
      fused.set(key, { chunk: { ...item, score: 0.7 }, rrfScore: score });
    }
  });

  return Array.from(fused.values())
    .sort((a, b) => b.rrfScore - a.rrfScore)
    .slice(0, topK)
    .map((entry) => entry.chunk);
}