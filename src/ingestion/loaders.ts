import fs from 'node:fs/promises';
import path from 'node:path';
import { PDFParse } from 'pdf-parse';

type Loader = (buffer: Buffer) => Promise<string>;

const loaders: Record<string, Loader> = {
  '.pdf': async (buffer) => {
    const parser = new PDFParse({ data: buffer });
    try {
      return (await parser.getText()).text;
    } finally {
      await parser.destroy();
    }
  },
  '.txt': async (buffer) => buffer.toString('utf-8'),
  '.md': async (buffer) => buffer.toString('utf-8'),
};

export function isSupported(file: string): boolean {
  return path.extname(file).toLowerCase() in loaders;
}

export async function loadFile(filePath: string): Promise<{ buffer: Buffer; text: string }> {
  const loader = loaders[path.extname(filePath).toLowerCase()];
  if (!loader) throw new Error(`Unsupported file format: ${filePath}`);
  const buffer = await fs.readFile(filePath);
  return { buffer, text: await loader(buffer) };
}
