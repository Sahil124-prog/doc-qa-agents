import path from "node:path";
import mongoose from "mongoose";
import { connectDB } from "./src/config/db.js";
import {
  loadAndSplitPdf,
  embedAndStoreChunks,
  getChunksCollection,
} from "./src/services/ingestionService.js";

const filePath = process.argv[2] || "./sample.pdf";
const fileName = path.basename(filePath);

// 1. Connect to MongoDB (the vector store needs it)
await connectDB();

// 2. Delete chunks from earlier test runs, so re-running doesn't create duplicates
await getChunksCollection().deleteMany({ documentId: "test-doc" });

// 3. PDF → chunks (same as before)
const { pageCount, chunks } = await loadAndSplitPdf(filePath, {
  documentId: "test-doc",
  userId: "test-user",
  fileName,
});
console.log("Pages:", pageCount, "| Chunks:", chunks.length);

// 4. Chunks → embeddings → MongoDB
console.log("Embedding and saving...");
await embedAndStoreChunks(chunks);

// 5. Read one back to check what was actually saved
const collection = getChunksCollection();
const count = await collection.countDocuments({ documentId: "test-doc" });
const saved = await collection.findOne({ documentId: "test-doc" });

console.log("Saved chunks:", count);
console.log("Fields in a saved chunk:", Object.keys(saved));
console.log("Embedding length:", saved.embedding.length);

// 6. Close the DB connection so the script exits
await mongoose.disconnect();
