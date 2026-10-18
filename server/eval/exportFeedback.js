import fs from "node:fs";
import mongoose from "mongoose";
import { connectDB } from "../src/config/db.js";
import User from "../src/models/User.js";
import QAHistory from "../src/models/QAHistory.js";

// Feature 9: turn thumbs up/down into things you can act on.
// Usage: node --env-file=.env eval/exportFeedback.js <your-login-email>

const email = process.argv[2];
if (!email) {
  console.error(
    "Usage: node --env-file=.env eval/exportFeedback.js <your-login-email>",
  );
  process.exit(1);
}

const percent = (part, whole) =>
  whole === 0 ? "n/a" : `${Math.round((part / whole) * 100)}%`;

// Count documents where feedback.rating equals a value (used inside $group)
const countRating = (value) => ({
  $sum: { $cond: [{ $eq: ["$feedback.rating", value] }, 1, 0] },
});

await connectDB();

const user = await User.findOne({ email: email.toLowerCase() });
if (!user) {
  console.error(`No user found with email ${email}`);
  process.exit(1);
}

// aggregate() does NOT turn strings into ObjectIds like find() does, so pass the real ObjectId
const mine = { userId: user._id };

// ---------- 1. Overview ----------

const [overview = { answers: 0, up: 0, down: 0 }] = await QAHistory.aggregate([
  { $match: mine },
  {
    $group: {
      _id: null,
      answers: { $sum: 1 },
      up: countRating(1),
      down: countRating(-1),
    },
  },
]);
const rated = overview.up + overview.down;

console.log(`\nFeedback for ${email}\n`);
console.table({
  Answers: overview.answers,
  "Got feedback": `${rated} (${percent(rated, overview.answers)})`,
  "Thumbs up": overview.up,
  "Thumbs down": overview.down,
  Satisfaction: percent(overview.up, rated),
});

// ---------- 2. Calibration: does the confidence badge match what users say? ----------

const byConfidence = await QAHistory.aggregate([
  { $match: { ...mine, "feedback.rating": { $in: [1, -1] } } },
  { $group: { _id: "$confidence", rated: { $sum: 1 }, up: countRating(1) } },
  { $sort: { _id: 1 } },
]);

console.log("Confidence badge vs thumbs up (they should go together)");
console.table(
  Object.fromEntries(
    byConfidence.map((g) => [
      g._id ?? "none",
      {
        Rated: g.rated,
        "Thumbs up": g.up,
        "Thumbs up %": percent(g.up, g.rated),
      },
    ]),
  ),
);

// ---------- 3. Why answers got a thumbs down ----------

const byReason = await QAHistory.aggregate([
  { $match: { ...mine, "feedback.rating": -1 } },
  { $group: { _id: "$feedback.reason", count: { $sum: 1 } } },
  { $sort: { count: -1 } },
]);

console.log("Thumbs down reasons");
console.table(
  Object.fromEntries(
    byReason.map((r) => [r._id ?? "no reason given", r.count]),
  ),
);

// ---------- 4. Every thumbs down, with what the agent saw ----------

const downs = await QAHistory.find({ ...mine, "feedback.rating": -1 })
  .sort({ "feedback.at": -1 })
  .lean();

if (downs.length === 0) {
  console.log("No thumbs down yet. Nothing to review.");
}

for (const [i, d] of downs.entries()) {
  console.log(`\n${i + 1}. ${d.question}`);
  console.log(
    `   reason: ${d.feedback.reason ?? "none"} | confidence: ${d.confidence ?? "none"} | retries: ${d.retries ?? 0}`,
  );
  if (d.searchQueries?.length > 1) {
    console.log(
      `   searched for: ${d.searchQueries.map((q) => `"${q}"`).join(" → ")}`,
    );
  }
  console.log(`   answer: ${d.answer.replace(/\s+/g, " ").slice(0, 160)}`);
  for (const s of d.sources ?? []) {
    console.log(
      `   - p.${s.pageNumber} ${s.fileName}  rrf ${s.score?.toFixed(4) ?? "-"}  rerank ${s.rerankScore?.toFixed(3) ?? "-"}`,
    );
  }
}

// ---------- 5. Draft eval cases from the thumbs down ----------

// One case per question, even if it was asked (and disliked) several times
const unique = new Map();
for (const d of downs) {
  const key = d.question.trim().toLowerCase();
  if (!unique.has(key)) unique.set(key, d);
}

const drafts = [...unique.values()].map((d) => ({
  question: d.question,
  // Fill these in by reading the document, then copy the case into questions.json.
  // If the answer truly is not in the documents, delete "expect" (it becomes a refusal test).
  expect: {
    file: d.sources?.[0]?.fileName ?? "TODO",
    page: "TODO",
    anyOf: ["TODO"],
  },
  reason: d.feedback.reason,
}));

if (drafts.length > 0) {
  fs.mkdirSync(new URL("./results/", import.meta.url), { recursive: true });
  const file = new URL(
    `./results/feedback-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
    import.meta.url,
  );
  fs.writeFileSync(file, JSON.stringify(drafts, null, 2));
  console.log(
    `\n${drafts.length} draft eval case(s) saved to eval/results/. Fill in the TODOs, then add them to questions.json.`,
  );
}

await mongoose.disconnect();
