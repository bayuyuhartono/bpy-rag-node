import { config } from '../config.ts';
import type { RetrievedChunk } from '../types.ts';

interface JinaRerankResponse {
  results: Array<{
    index: number;
    relevance_score: number;
  }>;
}

export async function rerankChunks(
  query: string,
  candidates: RetrievedChunk[],
  topN: number = config.retrieval.topK
): Promise<RetrievedChunk[]> {
  if (candidates.length === 0) return [];
  if (!config.keys.jina) {
    return candidates.slice(0, topN);
  }

  try {
    const res = await fetch('https://api.jina.ai/v1/rerank', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.keys.jina}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.rerank.model,
        query,
        top_n: topN,
        documents: candidates.map((c) => c.text), // Adjust if the text lives in c.metadata.text
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[Warn Reranker ${res.status}]: ${errText} — falling back to hybrid scores.`);
      return candidates.slice(0, topN);
    }

    const data = (await res.json()) as JinaRerankResponse;

    // Re-map the order and replace scores with Jina's relevance_score
    return data.results.map((r) => ({
      ...candidates[r.index],
      score: r.relevance_score,
    }));
  } catch (err) {
    console.warn('[Warn Reranker]: Failed to reach Jina, falling back to hybrid scores.');
    return candidates.slice(0, topN);
  }
}