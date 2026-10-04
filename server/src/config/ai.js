import { ChatGroq } from "@langchain/groq";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";

// Chat model (answers, grading, rewriting): Groq
export const ANSWER_MODEL = "openai/gpt-oss-120b"; // writes the final answer (quality matters most)
export const FAST_MODEL = "openai/gpt-oss-20b"; // grading and query rewriting (cheap, frequent)



// Embedding model (chunks and questions): Gemini. NEVER change this without re-embedding all chunks.
export const EMBEDDING_MODEL = "gemini-embedding-001";
export const EMBEDDING_DIMENSIONS = 3072;

export const llm = new ChatGroq({
  model: ANSWER_MODEL,
  temperature: 0,
  reasoningEffort: "low",
  apiKey: process.env.GROQ_API_KEY,
});

export const fastLlm = new ChatGroq({
  model: FAST_MODEL,
  temperature: 0,
  reasoningEffort: "low",
  apiKey: process.env.GROQ_API_KEY,
});

export const embeddings = new GoogleGenerativeAIEmbeddings({
  model: EMBEDDING_MODEL,
  apiKey: process.env.GEMINI_API_KEY,
});
