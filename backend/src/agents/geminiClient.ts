import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '../config/env';

const genAI = new GoogleGenerativeAI(env.geminiApiKey);

// Use Gemini 2.5 Flash for all agents.
// If you see 404s, ensure your GEMINI_API_KEY is from Google AI Studio
// with access to this model on the current API version.
const MODEL_NAME = 'gemini-2.5-flash';

export const getPlanningModel = () =>
  genAI.getGenerativeModel({ model: MODEL_NAME });

export const getSessionModel = () =>
  genAI.getGenerativeModel({ model: MODEL_NAME });

export const getInterruptModel = () =>
  genAI.getGenerativeModel({ model: MODEL_NAME });
