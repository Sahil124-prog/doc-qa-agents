import path from "node:path";
import { loadAndSplitPdf } from "./src/services/ingestionService.js";

// 1. Which PDF to test: taken from the command, e.g. "node test-ingest.js ./hr-policy.pdf"
const filePath = process.argv[2] || "./sample.pdf";

// 2. Run our ingestion function on that file
const { pageCount, chunks } = await loadAndSplitPdf(filePath, {
  documentId: "test-doc",
  userId: "test-user",
  fileName: path.basename(filePath),
});

// 3. Print a summary
console.log("Pages:", pageCount);
console.log("Chunks:", chunks.length);

// 4. Print the first two chunks so we can check metadata and overlap
console.log("\n--- Chunk 1 ---");
console.log(chunks[0].metadata);
console.log(chunks[0].pageContent);

console.log("\n--- Chunk 2 ---");
console.log(chunks[1]?.metadata);
console.log(chunks[1]?.pageContent);
