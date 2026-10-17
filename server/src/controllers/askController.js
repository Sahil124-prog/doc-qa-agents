import { runAgent,streamAgent } from "../agent/qaAgent.js";
import { checkQuestion, classifyQuestion } from "../services/questionGuard.js";
import QAHistory from "../models/QAHistory.js";
import mongoose from "mongoose";


const MAX_QUESTION_LENGTH = 1000;
const NOT_FOUND_MESSAGE = "I couldn't find this in your documents.";

// ---------- Shared helpers (used by /ask and /ask/stream) ----------

// Returns { error } or { question, documentId, chatHistory }
function parseAskRequest(req) {
  const question =
    typeof req.body?.question === "string" ? req.body.question.trim() : "";
  const documentId = req.body?.documentId;
  const rawHistory = req.body?.chatHistory;

  if (!question) return { error: "Please provide a question" };
  if (question.length > MAX_QUESTION_LENGTH) {
    return {
      error: `Question must be under ${MAX_QUESTION_LENGTH} characters`,
    };
  }
  if (documentId !== undefined && typeof documentId !== "string") {
    return { error: "documentId must be a string" };
  }

  const chatHistory = Array.isArray(rawHistory)
    ? rawHistory.slice(-4) // last 2 turns = 4 messages max
    : [];

  return { question, documentId, chatHistory };
}

async function runGuard(question) {
  let guard = checkQuestion(question);
  if (guard.allowed) guard = await classifyQuestion(question);
  return guard;
}

function guardReply(guard) {
  return {
    kind: "guard",
    answer: guard.message,
    citations: [],
    sources: [],
    searchQueries: [],
    retries: 0,
    trace: [`guard: ${guard.reason}`],
  };
}

// Feature 7: confidence from the reranker's best score (falls back to RRF)
function getConfidence(result) {
  const found = result.sources?.length && result.answer !== NOT_FOUND_MESSAGE;
  if (!found) return null;

  const topRerank = result.sources[0].rerankScore;
  if (topRerank !== undefined) {
    return topRerank >= 0.5 ? "high" : topRerank >= 0.1 ? "medium" : "low";
  }

  // Reranker failed and RRF order was used: keep the old rule
  const avgScore =
    result.sources.reduce((sum, s) => sum + (s.score ?? 0), 0) /
    result.sources.length;
  return avgScore > 0.015 ? "high" : avgScore > 0.012 ? "medium" : "low";
}

// Saves history in the background and builds the reply the frontend expects
function finishAnswer(req, { question, documentId }, result) {
  const confidence = getConfidence(result);

  // Feature 6: Q&A ko history mein save karo (background mein)
  QAHistory.create({
    userId: req.userId,
    documentId: documentId || null,
    question,
    answer: result.answer,
    citations: result.citations,
    confidence,
  }).catch((err) => console.error("History save failed:", err.message));

  return {
    answer: result.answer,
    citations: result.citations,
    sources: result.sources.map(({ text, ...rest }) => ({
      ...rest,
      preview: text.slice(0, 150),
    })),
    searchQueries: result.searchQueries,
    retries: result.retryCount,
    trace: result.trace,
    confidence,
  };
}

// ---------- POST /api/ask (one JSON reply) ----------

export async function ask(req, res) {
  const input = parseAskRequest(req);
  if (input.error) return res.status(400).json({ message: input.error });

  const guard = await runGuard(input.question);
  if (!guard.allowed) return res.json(guardReply(guard));

  const result = await runAgent(input.question, req.userId, {
    documentId: input.documentId,
    chatHistory: input.chatHistory,
  });

  res.json(finishAnswer(req, input, result));
}

// ---------- POST /api/ask/stream (Server-Sent Events) ----------

export async function askStream(req, res) {
  const input = parseAskRequest(req);
  if (input.error) return res.status(400).json({ message: input.error });

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no", // tell proxies like Nginx not to buffer
  });

  const send = (event, data) => {
    if (res.writableEnded || res.destroyed) return; // client already gone
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // Stop the agent if the user closes the tab (saves LLM calls).
  // Use res "close", not req "close": req fires as soon as the body is read.
  const controller = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) controller.abort();
  });

  try {
    const guard = await runGuard(input.question);
    if (!guard.allowed) {
      send("done", guardReply(guard));
      return res.end();
    }

    let result;
    for await (const event of streamAgent(input.question, req.userId, {
      documentId: input.documentId,
      chatHistory: input.chatHistory,
      signal: controller.signal,
    })) {
      if (event.type === "step") send("step", { text: event.text });
      else result = event.state;
    }

    send("done", finishAnswer(req, input, result));
  } catch (err) {
    if (controller.signal.aborted) return; // user left, nothing to send
    console.error("Stream failed:", err);
    send("error", {
      message:
        err.status === 429
          ? "The AI service is busy right now. Please try again in a minute."
          : "Something went wrong",
    });
  }

  res.end();
}



// Feature 6: ek document ki (ya "All documents" ki) history lao
export async function getHistory(req, res) {
  const { documentId } = req.query;

  if (documentId && !mongoose.isValidObjectId(documentId)) {
    return res.status(400).json({ message: "Invalid documentId" });
  }

  const history = await QAHistory.find({
    userId: req.userId,
    documentId: documentId || null,
  })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  res.json(history);
}
