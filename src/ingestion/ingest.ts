import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.ts';
import type { ChunkMetadata } from '../types.ts';
import { embedMany } from '../retrieval/embedder.ts';
import { ensureIndex, indexedFiles, removeSource, replaceSource, getAllChunks } from '../retrieval/vectorStore.ts';
import { chunkText } from './chunker.ts';
import { isSupported, loadFile } from './loaders.ts';

/**
 * Sync the documents folder with the index:
 * - new / changed file  -> re-indexed
 * - unchanged file      -> skipped
 * - deleted file        -> its chunks are removed from the index
 */
export async function ingestFolder(folderPath: string = config.paths.docs): Promise<void> {
  await ensureIndex();
  const indexed = await indexedFiles();
  const files = (await fs.readdir(folderPath)).filter(isSupported);

  let changed = 0;
  for (const file of files) {
    const { buffer, text } = await loadFile(path.join(folderPath, file));
    const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');

    if (indexed.get(file) === fileHash) continue;

    const chunks = chunkText(text);
    console.log(`Processing "${file}" -> ${chunks.length} chunks...`);

    const vectors = await embedMany(chunks);
    const items = chunks.map((chunk, i) => ({
      vector: vectors[i],
      metadata: { source: file, fileHash, chunkIndex: i + 1, text: chunk } satisfies ChunkMetadata,
    }));
    await replaceSource(file, items);
    changed++;
  }

  for (const source of indexed.keys()) {
    if (!files.includes(source)) {
      console.log(`Removing "${source}" from index (file no longer exists)...`);
      await removeSource(source);
      changed++;
    }
  }

  const total = await getAllChunks();
  console.log(
    changed > 0
      ? `Index updated (${total.length} chunks).\n`
      : `Document index is up to date (${total.length} chunks).\n`,
  );
}
