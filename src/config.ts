import path from 'node:path';
import 'dotenv/config';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Environment variable ${name} belum di-set (cek file .env)`);
  return value;
}

export const config = {
  paths: {
    docs: path.join(process.cwd(), 'data', 'docs'),
    index: path.join(process.cwd(), 'data', 'index'),
  },
  chunk: { size: 500, overlap: 100 },
  retrieval: { topK: 3, minScore: 0.65 },
  embedding: { model: 'gemini-embedding-001', batchSize: 50 },
  llm: { model: 'openai/gpt-oss-20b', temperature: 0.2 },
  keys: {
    get gemini() { return requireEnv('GEMINI_API_KEY'); },
    get groq() { return requireEnv('GROQ_API_KEY'); },
  },
} as const;
