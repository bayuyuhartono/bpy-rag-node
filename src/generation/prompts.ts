import type { RetrievedChunk } from '../types.ts';

export function buildAnswerPrompt(question: string, contexts: RetrievedChunk[]): string {
  const konteks = contexts.map((c) => c.text).join('\n\n');

  return `
Jawab pertanyaan berikut secara singkat, padat, dan langsung ke inti (maksimal 2-3 kalimat) HANYA berdasarkan konteks di bawah ini.

Konteks:
${konteks}

Pertanyaan: ${question}
`.trim();
}
