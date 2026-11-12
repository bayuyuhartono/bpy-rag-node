import { chatCompletion } from '../clients/groq.ts';
import type { ChatMessage, RetrievedChunk } from '../types.ts';
import { buildRagPrompt, buildRewritePrompt } from './prompts.ts';


export async function rewriteQuery(
  question: string,
  history: ChatMessage[]
): Promise<string> {
  if (history.length === 0) return question;

  const prompt = buildRewritePrompt(question, history);
  const rewritten = await chatCompletion([{ role: 'user', content: prompt }], 0);
  return rewritten.trim() || question;
}

export async function generateAnswer(
  question: string,
  chunks: RetrievedChunk[]
): Promise<string> {
  const prompt = buildRagPrompt(question, chunks);
  return await chatCompletion([{ role: 'user', content: prompt }], 0.2);
}