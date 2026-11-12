import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.ts';
import type { ChunkMetadata } from '../types.ts';
import { embedMany } from '../retrieval/embedder.ts';
import { ensureIndex, indexedFiles, removeSource, replaceSource, countChunks } from '../retrieval/vectorStore.ts';
import { chunkText } from './chunker.ts';
import { isSupported, loadFile } from './loaders.ts';

/**
 * Sinkronkan folder dokumen dengan index:
 * - file baru / berubah  -> di-index ulang
 * - file tidak berubah   -> dilewati
 * - file sudah dihapus   -> chunk-nya dibuang dari index
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
    console.log(`Memproses "${file}" -> ${chunks.length} chunks...`);

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
      console.log(`Menghapus "${source}" dari index (file sudah tidak ada)...`);
      await removeSource(source);
      changed++;
    }
  }

  const total = await countChunks();
  console.log(
    changed > 0
      ? `Index diperbarui (${total.length} chunks).\n`
      : `Index dokumen sudah up-to-date (${total.length} chunks).\n`,
  );
}
