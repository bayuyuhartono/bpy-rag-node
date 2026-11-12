import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { ingestFolder } from '../ingestion/ingest.ts';
import { askDocs } from '../rag.ts';
import type { ChatMessage } from '../types.ts';

await ingestFolder();

const history: ChatMessage[] = [];
const rl = readline.createInterface({ input, output });
console.log("🤖 Chatbot Dokumen Siap! (Ketik 'reset' untuk hapus memori, 'exit' untuk keluar)\n");

output.write('Kamu: ');
for await (const line of rl) {
  const question = line.trim();
  const cmd = question.toLowerCase();

  if (cmd === 'exit') break;
  if (cmd === 'reset') {
    history.length = 0;
    console.log('🧹 Memori percakapan dibersihkan.\n');
    output.write('Kamu: ');
    continue;
  }
  if (!question) {
    output.write('Kamu: ');
    continue;
  }

  try {
    const result = await askDocs(question, history);
    if (!result.found) {
      console.log('AI: Maaf, informasi tersebut tidak ditemukan di dokumen.\n');
    } else {
      if (result.rewrittenQuery !== question) {
        console.log(`\x1b[90m[Query Rewrite]: "${result.rewrittenQuery}"\x1b[0m`);
      }
      console.log('AI:', result.answer);
      const sources = result.sources.map((s) => `${s.source} #${s.chunkIndex} (${s.score.toFixed(2)})`);
      console.log(`   Sumber: ${sources.join(', ')}\n`);

      // Simpan giliran percakapan agar pertanyaan berikutnya punya konteks
      history.push({ role: 'user', content: question });
      history.push({ role: 'assistant', content: result.answer });
    }
  } catch (err) {
    console.log(`[Error] ${err instanceof Error ? err.message : String(err)}\n`);
  }
  output.write('Kamu: ');
}

rl.close();