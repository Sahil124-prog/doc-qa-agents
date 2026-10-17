

import { getChunksCollection } from "./ingestionService.js";

import { createRequire } from "module";
const require = createRequire(import.meta.url);
const BM25 = require("wink-bm25-text-search");




// wink-bm25 needs a "prepare" function that tokenizes + normalizes text
function prepareText(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

// One engine per userId+documentId combo — stored here
const indexCache = new Map();

function cacheKey(userId, documentId) {
  return `${userId}::${documentId ?? "all"}`;
}

/**
 * Build (or return cached) BM25 index for a user's document scope.
 * chunks: [{ _id, text, metadata }]
 */
function buildIndex(chunks, userId, documentId) {
  const key = cacheKey(userId, documentId);

  const engine = BM25();
  engine.defineConfig({ fldWeights: { text: 1 } });
  engine.definePrepTasks([prepareText]);

  chunks.forEach((chunk, i) => {
    engine.addDoc({ text: chunk.text }, i);
  });

  engine.consolidate();
  indexCache.set(key, { engine, chunks });
  return { engine, chunks };
}

/**
 * Load chunks from MongoDB and build BM25 index.
 * Call this before searching if index not cached.
 */
export async function loadBM25Index(userId, documentId) {
  const key = cacheKey(userId, documentId);
  if (indexCache.has(key)) return indexCache.get(key);

  const col = getChunksCollection();
  const filter = { userId };
  if (documentId) filter.documentId = documentId;

  const chunks = await col
    .find(filter, {
      projection: { text: 1, fileName: 1, pageNumber: 1, documentId: 1 },
    })
    
    .toArray();

  if (chunks.length === 0) return { engine: null, chunks: [] };

  return buildIndex(chunks, userId, documentId);
}

/**
 * Invalidate cache when new document uploaded — so fresh index builds next query.
 */
export function invalidateBM25Cache(userId, documentId) {
  indexCache.delete(cacheKey(userId, documentId));
  indexCache.delete(cacheKey(userId, null)); // also clear "all docs" scope
}

/**
 * Run BM25 search. Returns array of { chunk, rank } sorted best-first.
 * topK: how many results to return
 */
export async function bm25Search(query, userId, documentId, topK = 10) {
  const { engine, chunks } = await loadBM25Index(userId, documentId);

  if (!engine) return [];

  const results = engine.search(query); // [[index, score], ...]

  return results.slice(0, topK).map(([idx, _score], rank) => ({
    chunk: chunks[idx],
    rank, // 0-based, best = 0
  }));
}
