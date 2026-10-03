import {
  ChatGoogleGenerativeAI,
  GoogleGenerativeAIEmbeddings,
} from "@langchain/google-genai";

export const LLM_MODEL = "gemini-3.8-flash";
export const EMBEDDING_MODEL = "gemini-embedding-001";
export const EMBEDDING_DIMENSIONS = 3072;

export const llm = new ChatGoogleGenerativeAI({
  model: LLM_MODEL,
  temperature: 0,
  apiKey: process.env.GEMINI_API_KEY,
});

export const embeddings = new GoogleGenerativeAIEmbeddings({
  model: EMBEDDING_MODEL,
  apiKey: process.env.GEMINI_API_KEY,
});
