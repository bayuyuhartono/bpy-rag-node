import { GoogleGenAI } from '@google/genai';
import { config } from '../config.ts';

export const gemini = new GoogleGenAI({ apiKey: config.keys.gemini });
