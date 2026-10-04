import mongoose from "mongoose";                                   // NEW
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Document } from "@langchain/core/documents";
import { MongoDBAtlasVectorSearch } from "@langchain/mongodb";        // NEW
import { embeddings } from "../config/ai.js";                         // NEW

// ---------- Part 1: PDF → chunks (unchanged) ----------

import fs from "node:fs/promises";
import DocumentModel from "../models/Document.js";


const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 800,
  chunkOverlap: 150,
});

export async function loadAndSplitPdf(filePath, { documentId, userId, fileName }) {
  const loader = new PDFLoader(filePath);
  const pages = await loader.load();

  const cleanPages = pages
    .filter((page) => page.pageContent.trim().length > 0)
    .map(
      (page) =>
        new Document({
          pageContent: page.pageContent,
          metadata: {
            documentId,
            userId,
            fileName,
            pageNumber: page.metadata.loc.pageNumber,
          },
        })
    );

  const chunks = await splitter.splitDocuments(cleanPages);

  return { pageCount: pages.length, chunks };
}

// ---------- Part 2: chunks → vectors → MongoDB (NEW) ----------

export const VECTOR_INDEX_NAME = "vector_index";

export function getChunksCollection() {
  return mongoose.connection.db.collection("chunks");
}

export function getVectorStore() {
  return new MongoDBAtlasVectorSearch(embeddings, {
    collection: getChunksCollection(),
    indexName: VECTOR_INDEX_NAME,
    textKey: "text",
    embeddingKey: "embedding",
  });
}

export async function embedAndStoreChunks(chunks) {
  await getVectorStore().addDocuments(chunks);
}


// ---------- Part 3: the full pipeline for one uploaded document ----------

export async function processDocument(doc, filePath) {
  const documentId = doc._id.toString();

  try {
    const { pageCount, chunks } = await loadAndSplitPdf(filePath, {
      documentId,
      userId: doc.userId.toString(),
      fileName: doc.fileName,
    });

    if (chunks.length === 0) {
      throw new Error("No readable text found in this PDF. It may be a scanned image.");
    }

    await embedAndStoreChunks(chunks);

    await DocumentModel.findByIdAndUpdate(doc._id, {
      status: "ready",
      pageCount,
      chunkCount: chunks.length,
    });
    console.log(`Document ${documentId} ready: ${chunks.length} chunks`);
  } catch (err) {
    console.error(`Document ${documentId} failed:`, err.message);

    await getChunksCollection().deleteMany({ documentId });

    await DocumentModel.findByIdAndUpdate(doc._id, {
      status: "failed",
      errorMessage: err.message,
    });
  } finally {
    await fs.unlink(filePath).catch(() => {});
  }
}