import { config } from '../config.ts';

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

type GroqResponse = {
  choices?: { message: { content: string } }[];
  error?: { message: string };
};

export async function chatCompletion(messages: ChatMessage[], temperature: number): Promise<string> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.keys.groq}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.llm.model,
      messages,
      temperature: config.llm.temperature,
    }),
  });

  const data = (await res.json()) as GroqResponse;
  if (!res.ok || !data.choices?.length) {
    throw new Error(`Groq ${res.status}: ${data.error?.message ?? 'Gagal memanggil API'}`);
  }
  return data.choices[0].message.content;
}
