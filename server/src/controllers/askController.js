import { runAgent } from "../agent/qaAgent.js";
import { checkQuestion, classifyQuestion } from "../services/questionGuard.js";
import QAHistory from "../models/QAHistory.js";
import mongoose from "mongoose";


const MAX_QUESTION_LENGTH = 1000;

export async function ask(req, res) {
  const question =
    typeof req.body?.question === "string" ? req.body.question.trim() : "";
  const documentId = req.body?.documentId;
  const rawHistory = req.body?.chatHistory;

  if (!question) {
    return res.status(400).json({ message: "Please provide a question" });
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    return res.status(400).json({
      message: `Question must be under ${MAX_QUESTION_LENGTH} characters`,
    });
  }
  if (documentId !== undefined && typeof documentId !== "string") {
    return res.status(400).json({ message: "documentId must be a string" });
  }

  let guard = checkQuestion(question);
  if (guard.allowed) guard = await classifyQuestion(question);
  if (!guard.allowed) {
    return res.json({
      kind: "guard",
      answer: guard.message,
      citations: [],
      sources: [],
      searchQueries: [],
      retries: 0,
      trace: [`guard: ${guard.reason}`],
    });
  }

  const chatHistory = Array.isArray(rawHistory)
    ? rawHistory.slice(-4) // last 2 turns = 4 messages max
    : [];

  const result = await runAgent(question, req.userId, {
    documentId,
    chatHistory,
  });

  // Feature 7: confidence from the reranker's best score (falls back to RRF)
  let confidence = null;
  const found =
    result.sources?.length &&
    result.answer !== "I couldn't find this in your documents.";

  if (found) {
    const topRerank = result.sources[0].rerankScore;

    if (topRerank !== undefined) {
      confidence =
        topRerank >= 0.5 ? "high" : topRerank >= 0.1 ? "medium" : "low";
    } else {
      // Reranker failed and RRF order was used: keep the old rule
      const avgScore =
        result.sources.reduce((sum, s) => sum + (s.score ?? 0), 0) /
        result.sources.length;
      confidence =
        avgScore > 0.015 ? "high" : avgScore > 0.012 ? "medium" : "low";
    }
  }

  // Feature 6: Q&A ko history mein save karo (background mein)
  QAHistory.create({
    userId: req.userId,
    documentId: documentId || null,
    question,
    answer: result.answer,
    citations: result.citations,
    confidence,
  }).catch((err) => console.error("History save failed:", err.message));

  res.json({
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
  });
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
