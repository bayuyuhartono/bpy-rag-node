import type { RetrievedChunk , ChatMessage } from '../types.ts';

export function buildAnswerPrompt(question: string, contexts: RetrievedChunk[]): string {
  const konteks = contexts.map((c) => c.text).join('\n\n');

  return `
Jawab pertanyaan berikut secara singkat, padat, dan langsung ke inti (maksimal 2-3 kalimat) HANYA berdasarkan konteks di bawah ini.

Konteks:
${konteks}

Pertanyaan: ${question}
`.trim();
}

export function buildRewritePrompt(question: string, history: ChatMessage[]): string {
  const formattedHistory = history
    .slice(-4) // Keep only the last 2 Q&A pairs to save tokens
    .map((m) => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`)
    .join('\n');

  return `Tugasmu adalah menulis ulang pertanyaan terakhir dari User menjadi pertanyaan mandiri (standalone question) yang lengkap dan jelas berdasarkan riwayat percakapan di bawah.
- Ganti kata ganti seperti "dia", "mereka", "itu", "tersebut" dengan subjek spesifik dari riwayat percakapan.
- Jika pertanyaan sudah mandiri dan tidak bergantung pada riwayat, kembalikan pertanyaan aslinya tanpa perubahan.
- Keluarkan HANYA kalimat pertanyaannya saja, tanpa penjelasan atau tanda kutip.

Riwayat Percakapan:
${formattedHistory}

Pertanyaan Terakhir User: ${question}
Pertanyaan Mandiri:`;
}

export function buildRagPrompt(question: string, chunks: RetrievedChunk[]): string {
  const context = chunks.map((c) => c.text).join('\n\n');

  return `Jawab pertanyaan berikut secara singkat, padat, dan langsung ke inti (maksimal 2-3 kalimat) HANYA berdasarkan konteks di bawah ini. Jika informasi tidak ada di konteks, katakan "Maaf, informasi tersebut tidak ditemukan di dokumen."

Konteks:
${context}

Pertanyaan: ${question}`;
}