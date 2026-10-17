import {
  AutoTokenizer,
  AutoModelForSequenceClassification,
} from "@huggingface/transformers";

// Small cross-encoder trained on MS MARCO (search question → passage relevance)
const MODEL_ID = "Xenova/ms-marco-MiniLM-L-6-v2";

let loading = null; // one shared load, even if many requests arrive together

function loadModel() {
  if (!loading) {
    loading = Promise.all([
      AutoTokenizer.from_pretrained(MODEL_ID),
      AutoModelForSequenceClassification.from_pretrained(MODEL_ID, {
        dtype: "q8", // quantized: ~4x smaller, a little less precise
      }),
    ]).catch((err) => {
      loading = null; // let the next request try again
      throw err;
    });
  }
  return loading;
}

// Call once when the server starts, so the first user question isn't slow
export function warmUpReranker() {
  return loadModel()
    .then(() => console.log("Reranker ready"))
    .catch((err) => console.error("Reranker failed to load:", err.message));
}

// Score every (question, chunk) pair together and keep the best topK
export async function rerank(question, candidates, topK) {
  if (candidates.length === 0) return [];

  const [tokenizer, model] = await loadModel();

  const inputs = tokenizer(
    candidates.map(() => question), // same question repeated for each chunk
    {
      text_pair: candidates.map((c) => c.text),
      padding: true,
      truncation: true,
    },
  );

  const { logits } = await model(inputs);
  const scores = logits
    .sigmoid()
    .tolist()
    .map((row) => row[0]); // 0..1

  return candidates
    .map((c, i) => ({ ...c, rerankScore: scores[i] }))
    .sort((a, b) => b.rerankScore - a.rerankScore)
    .slice(0, topK);
}
