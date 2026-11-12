import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { ingestFolder } from '../ingestion/ingest.ts';
import { askDocs } from '../rag.ts';

await ingestFolder();

const rl = readline.createInterface({ input, output });
console.log("🤖 Chatbot Dokumen Siap! Ketik pertanyaanmu (atau ketik 'exit' untuk keluar).\n");

// Async iterator readline aman untuk Ctrl+D / input dari pipe (loop berhenti saat stdin habis)
output.write('Kamu: ');
for await (const line of rl) {
  const question = line.trim();
  if (question.toLowerCase() === 'exit') break;
  if (!question) {
    output.write('Kamu: ');
    continue;
  }

  try {
    const result = await askDocs(question);
    if (!result.found) {
      console.log('AI: Maaf, informasi tersebut tidak ditemukan di dokumen.\n');
    } else {
      console.log('AI:', result.answer);
      const sources = result.sources.map((s) => `${s.source} #${s.chunkIndex} (${s.score.toFixed(2)})`);
      console.log(`   Sumber: ${sources.join(', ')}\n`);
    }
  } catch (err) {
    console.log(`[Error] ${err instanceof Error ? err.message : String(err)}\n`);
  }
  output.write('Kamu: ');
}

rl.close();
