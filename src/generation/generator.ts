import { chatCompletion } from '../clients/groq.ts';
import type { RetrievedChunk } from '../types.ts';
import { buildAnswerPrompt } from './prompts.ts';

export async function generateAnswer(question: string, contexts: RetrievedChunk[]): Promise<string> {
  const prompt = buildAnswerPrompt(question, contexts);
  return chatCompletion([{ role: 'user', content: prompt }]);
}
