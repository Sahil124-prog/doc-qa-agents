import mongoose from "mongoose";
import { connectDB } from "./src/config/db.js";
import { answerQuestion, extractCitations } from "./src/services/ragService.js";

const USER_ID = "6ac1ebbd87ee97b45f080036"; // your real account (sahil@test.com)
const question = process.argv[2] || "Can I work from home?";

await connectDB();

// 1. The full pipeline: retrieve → generate → citations
const result = await answerQuestion(question, USER_ID);

console.log(`\nQuestion: ${question}`);
console.log(`\nAnswer:\n${result.answer}`);
console.log("\nCitations:");
console.table(result.citations);

// 2. Test the citation parser by itself with a made-up answer
const fake = "Fact one [2]. Two facts [1, 2]. Repeat [2]. Invented [7].";
console.log("Parser test on:", fake);
console.table(extractCitations(fake, result.sources));

await mongoose.disconnect();
