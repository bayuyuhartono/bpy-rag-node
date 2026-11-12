import { config } from '../config.ts';

/**
 * Pecah teks per kalimat, lalu gabungkan sampai ~chunkSize karakter.
 * Overlap diambil dari kalimat-kalimat terakhir chunk sebelumnya,
 * jadi tidak ada kata/kalimat yang terpotong di tengah.
 */
export function chunkText(
  text: string,
  chunkSize: number = config.chunk.size,
  overlap: number = config.chunk.overlap,
): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];

  const sentences = clean.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) ?? [clean];
  const chunks: string[] = [];
  let current: string[] = [];
  let length = 0;

  for (const raw of sentences) {
    // Kalimat super panjang (mis. tabel PDF) tetap dipotong paksa
    const pieces = raw.length > chunkSize ? hardSplit(raw, chunkSize) : [raw];

    for (const sentence of pieces) {
      if (length + sentence.length > chunkSize && current.length > 0) {
        chunks.push(current.join('').trim());

        // Bawa kalimat terakhir sebagai overlap
        const carry: string[] = [];
        let carryLen = 0;
        for (let i = current.length - 1; i >= 0 && carryLen + current[i].length <= overlap; i--) {
          carry.unshift(current[i]);
          carryLen += current[i].length;
        }
        current = carry;
        length = carryLen;
      }
      current.push(sentence);
      length += sentence.length;
    }
  }

  if (current.length > 0) chunks.push(current.join('').trim());
  return chunks;
}

function hardSplit(text: string, size: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
  return out;
}
