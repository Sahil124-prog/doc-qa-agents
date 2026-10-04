import mongoose from "mongoose";
import { connectDB } from "./src/config/db.js";
import { getVectorStore } from "./src/services/ingestionService.js";

// 1. The question comes from the command, with a default
const question = process.argv[2] || "How many vacation days do I get?";

// 2. Connect to MongoDB
await connectDB();

// 3. Search: embed the question, find the 4 closest chunks of this user
const results = await getVectorStore().similaritySearchWithScore(question, 4, {
  preFilter: { userId: { $eq: "test-user" } },
});

// 4. Print each result with its score and page
console.log(`\nQuestion: ${question}\n`);

results.forEach(([doc, score], i) => {
  console.log(
    `#${i + 1}  score ${score.toFixed(3)}  |  ${doc.metadata.fileName}, page ${doc.metadata.pageNumber}`,
  );
  console.log(
    "    " + doc.pageContent.slice(0, 120).replace(/\n/g, " ") + "...\n",
  );
});

// 5. Close the connection so the script exits
await mongoose.disconnect();
