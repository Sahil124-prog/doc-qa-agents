import mongoose from "mongoose";
import { connectDB } from "./src/config/db.js";
import { runAgent } from "./src/agent/qaAgent.js";

const USER_ID = "6ac1ebbd87ee97b45f080036"; // your real account (sahil@test.com)
const question = process.argv[2] || "How many vacation days do I get?";

await connectDB();

const result = await runAgent(question, USER_ID);

console.log(`\nQuestion: ${question}`);
console.log("\nTrace:");
result.trace.forEach((line, i) => console.log(`  ${i + 1}. ${line}`));

console.log("\nSearch queries:", result.searchQueries.join("  →  "));
console.log(
  "Final sources:",
  result.sources.map((s) => `[${s.label}] p.${s.pageNumber}`).join("  "),
);


console.log(`\nAnswer:\n${result.answer}`);
console.log(
  "\nCited:",
  result.citations.map((c) => `[${c.label}] p.${c.pageNumber}`).join("  ") ||
    "none",
);

await mongoose.disconnect();
