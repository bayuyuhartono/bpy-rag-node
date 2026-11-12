import { LocalIndex } from 'vectra';
import { config } from '../config.ts';
import type { ChunkMetadata, RetrievedChunk } from '../types.ts';

const index = new LocalIndex<ChunkMetadata>(config.paths.index);

export async function ensureIndex(): Promise<void> {
  if (!(await index.isIndexCreated())) await index.createIndex();
}

export async function countChunks(): Promise<ChunkMetadata[]> {
  const items = await index.listItems<ChunkMetadata>();
  return items.map((item) => item.metadata);
}

/** Hash file yang sudah ter-index, per nama file sumber. */
export async function indexedFiles(): Promise<Map<string, string | undefined>> {
  const files = new Map<string, string | undefined>();
  for (const item of await index.listItems<ChunkMetadata>()) {
    files.set(item.metadata.source, item.metadata.fileHash);
  }
  return files;
}

/** Ganti semua chunk milik `source` dengan chunk baru (dalam satu kali tulis ke disk). */
export async function replaceSource(
  source: string,
  items: { vector: number[]; metadata: ChunkMetadata }[],
): Promise<void> {
  const old = await index.listItemsByMetadata<ChunkMetadata>({ source: { $eq: source } });

  await index.beginUpdate();
  try {
    await index.deleteItems(old.map((item) => item.id));
    for (const item of items) await index.insertItem(item);
    await index.endUpdate();
  } catch (err) {
    index.cancelUpdate();
    throw err;
  }
}

export async function removeSource(source: string): Promise<void> {
  await replaceSource(source, []);
}

export async function query(vector: number[], text: string, topK: number): Promise<RetrievedChunk[]> {
  const results = await index.queryItems<ChunkMetadata>(vector, text, topK);
  return results.map((r) => ({ ...r.item.metadata, score: r.score }));
}
