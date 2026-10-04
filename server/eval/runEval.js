import fs from "node:fs";
import mongoose from "mongoose";
import { connectDB } from "../src/config/db.js";
import User from "../src/models/User.js";
import { answerQuestion } from "../src/services/ragService.js";
import { runAgent } from "../src/agent/qaAgent.js";

// ---------- Setup ----------

const email = process.argv[2];
if (!email) {
  console.error(
    "Usage: node --env-file=.env eval/runEval.js <your-login-email>",
  );
  process.exit(1);
}

const questions = JSON.parse(
  fs.readFileSync(new URL("./questions.json", import.meta.url), "utf8"),
);
const PAUSE_MS = 8000;  // breathing room between calls, to stay under Groq's per-minute limits

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// If we hit the rate limit anyway, wait and try the same call again (up to 3 attempts)
async function withRateLimitRetry(fn) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const rateLimited = err.status === 429 || String(err.message).startsWith("429");
      if (!rateLimited || attempt === 3) throw err;
      console.log("   rate limited, waiting 20 seconds...");
      await sleep(20000);
    }
  }
}


const percent = (part, whole) =>
  whole === 0 ? "n/a" : `${Math.round((part / whole) * 100)}%`;

// Lowercase, and turn special spaces/apostrophes into normal ones, so text comparisons are fair
function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[\u00a0\u202f]/g, " ")
    .replace(/[\u2018\u2019]/g, "'");
}

// ---------- Scoring one result ----------

function score(q, result) {
  const answer = normalize(result.answer);

  // Unanswerable question: the only correct behaviour is to refuse
  if (!q.expect) {
    return { refused: answer.includes("couldn't find this in your documents") };
  }

  const onExpectedPage = (s) =>
    s.fileName === q.expect.file && s.pageNumber === q.expect.page;

  return {
    retrieved: result.sources.some(onExpectedPage), // right page among the passages it read?
    correct: q.expect.anyOf.some((fact) => answer.includes(fact.toLowerCase())), // key fact in the answer?
    cited: result.citations.some(onExpectedPage), // cited the right page?
  };
}

// ---------- Running both systems on every question ----------

const SYSTEMS = {
  rag: (question, userId) => answerQuestion(question, userId), // Phase 3: one search, no checks
  agent: (question, userId) => runAgent(question, userId), // Phase 4: grade, rewrite, retry
};

await connectDB();

const user = await User.findOne({ email: email.toLowerCase() });
if (!user) {
  console.error(`No user found with email ${email}`);
  process.exit(1);
}
const userId = user._id.toString();

console.log(`\nEvaluating ${questions.length} questions for ${email}\n`);

const rows = [];

for (const [i, q] of questions.entries()) {
  const row = {
    id: i + 1,
    question: q.question,
    answerable: Boolean(q.expect),
  };

  for (const [name, run] of Object.entries(SYSTEMS)) {
    const started = Date.now();
    try {
        const result = await withRateLimitRetry(() =>
              run(q.question, userId),
        );
      row[name] = {
        ...score(q, result),
        seconds: (Date.now() - started) / 1000,
        retries: result.retryCount ?? 0,
        answer: result.answer,
      };
    } catch (err) {
      row[name] = {
        error: err.message,
        seconds: (Date.now() - started) / 1000,
      };
    }
    await sleep(PAUSE_MS);
  }

  rows.push(row);

  const mark = (r) =>
    r.error
      ? "ERROR"
      : row.answerable
        ? r.correct
          ? "correct"
          : "wrong"
        : r.refused
          ? "refused"
          : "answered anyway";
  console.log(
    `${String(row.id).padStart(2)}. [rag: ${mark(row.rag)} | agent: ${mark(row.agent)}] ${q.question}`,
  );
}

// ---------- Summary ----------

const answerable = rows.filter((r) => r.answerable);
const unanswerable = rows.filter((r) => !r.answerable);

function summarize(name) {
  const count = (list, key) => list.filter((r) => r[name][key]).length;
  const ok = count(answerable, "correct") + count(unanswerable, "refused");
  const totalSeconds = rows.reduce((sum, r) => sum + r[name].seconds, 0);

  return {
    "Right page retrieved": percent(
      count(answerable, "retrieved"),
      answerable.length,
    ),
    "Correct answer": percent(count(answerable, "correct"), answerable.length),
    "Right page cited": percent(count(answerable, "cited"), answerable.length),
    "Refused when not in docs": percent(
      count(unanswerable, "refused"),
      unanswerable.length,
    ),
    Overall: percent(ok, rows.length),
    "Avg seconds": (totalSeconds / rows.length).toFixed(1),
    Errors: count(rows, "error"),
  };
}

console.log(
  `\nResults (${answerable.length} answerable, ${unanswerable.length} not in the documents)\n`,
);
console.table({ "Plain RAG": summarize("rag"), Agent: summarize("agent") });

const retried = rows.filter((r) => r.agent.retries > 0);
const rescued = answerable.filter((r) => !r.rag.correct && r.agent.correct);
const broken = answerable.filter((r) => r.rag.correct && !r.agent.correct);

console.log(`Agent retried on ${retried.length} of ${rows.length} questions`);
console.log(`Agent got right where plain RAG failed: ${rescued.length}`);
rescued.forEach((r) => console.log(`   + ${r.question}`));
console.log(`Plain RAG got right where the agent failed: ${broken.length}`);
broken.forEach((r) => console.log(`   - ${r.question}`));

// ---------- Save everything for later ----------

fs.mkdirSync(new URL("./results/", import.meta.url), { recursive: true });
const file = new URL(
  `./results/${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
  import.meta.url,
);
fs.writeFileSync(
  file,
  JSON.stringify(
    { summary: { rag: summarize("rag"), agent: summarize("agent") }, rows },
    null,
    2,
  ),
);
console.log(`\nFull results saved to eval/results/`);

await mongoose.disconnect();
