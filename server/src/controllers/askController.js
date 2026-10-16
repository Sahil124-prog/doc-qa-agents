import { runAgent } from "../agent/qaAgent.js";
import { checkQuestion, classifyQuestion } from "../services/questionGuard.js";

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
  });
}
