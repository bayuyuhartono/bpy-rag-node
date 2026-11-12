import { gemini } from '../clients/gemini.ts';
import { config } from '../config.ts';

export async function embedMany(texts: string[]): Promise<number[][]> {
  const vectors: number[][] = [];
  const { model, batchSize } = config.embedding;

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const res = await gemini.models.embedContent({ model, contents: batch });
    const embeddings = res.embeddings ?? [];
    if (embeddings.length !== batch.length) {
      throw new Error(`Embedding count (${embeddings.length}) does not match input count (${batch.length})`);
    }
    for (const e of embeddings) {
      if (!e.values) throw new Error('Empty embedding from Gemini');
      vectors.push(e.values);
    }
  }
  return vectors;
}

export async function embed(text: string): Promise<number[]> {
  const [vector] = await embedMany([text]);
  return vector;
}
