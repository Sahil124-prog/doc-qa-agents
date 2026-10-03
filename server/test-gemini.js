import {
  ChatGoogleGenerativeAI,
  GoogleGenerativeAIEmbeddings,
} from "@langchain/google-genai";

const apiKey = process.env.GEMINI_API_KEY;

const llm = new ChatGoogleGenerativeAI({
  model: "gemini-3.8-flash",
  temperature: 0,
  apiKey,
});


const embeddings = new GoogleGenerativeAIEmbeddings({
  model: "gemini-embedding-001",
  apiKey,
});

// Test 1: does the LLM reply?
const reply = await llm.invoke("Reply with exactly: Gemini is working");
console.log("LLM reply:", reply.content);

// Test 2: what does an embedding look like?
const vector = await embeddings.embedQuery("How many vacation days do I get?");
console.log("Vector length:", vector.length);
console.log("First 5 numbers:", vector.slice(0, 5));

// Test 3: does meaning-based similarity actually work? (Concept 4, for real)
const [leave, server] = await embeddings.embedDocuments([
  "Employees are entitled to 18 days of annual leave per year.",
  "The server crashed at 2am due to a memory leak.",
]);

function cosine(a, b) {
  let dot = 0,
    lenA = 0,
    lenB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    lenA += a[i] * a[i];
    lenB += b[i] * b[i];
  }
  return dot / (Math.sqrt(lenA) * Math.sqrt(lenB));
}

console.log("Question vs leave sentence: ", cosine(vector, leave).toFixed(3));
console.log("Question vs server sentence:", cosine(vector, server).toFixed(3));
