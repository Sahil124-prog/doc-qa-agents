import { runAgent, streamAgent } from "../agent/qaAgent.js";
import { checkQuestion, classifyQuestion } from "../services/questionGuard.js";
import QAHistory, { FEEDBACK_REASONS } from "../models/QAHistory.js";
import Conversation from "../models/Conversation.js";

import mongoose from "mongoose";

const MAX_QUESTION_LENGTH = 1000;
const NOT_FOUND_MESSAGE = "I couldn't find this in your documents.";

// ---------- Shared helpers (used by /ask and /ask/stream) ----------

// Returns { error } or { question, documentId, conversationId, chatHistory }
function parseAskRequest(req) {
  const question =
    typeof req.body?.question === "string" ? req.body.question.trim() : "";
  const documentId = req.body?.documentId;
  const rawHistory = req.body?.chatHistory;

  const conversationId = req.body?.conversationId ?? null; // ← add

  if (!question) return { error: "Please provide a question" };
  if (question.length > MAX_QUESTION_LENGTH) {
    return {
      error: `Question must be under ${MAX_QUESTION_LENGTH} characters`,
    };
  }

  if (documentId !== undefined && typeof documentId !== "string") {
    return { error: "documentId must be a string" };
  }
  if (
    conversationId !== null &&
    (typeof conversationId !== "string" ||
      !mongoose.isValidObjectId(conversationId))
  ) {
    return { error: "Invalid conversationId" };
  }

  // Only real chat turns reach the LLM: a fake { role: "system" } could override our rules
  const chatHistory = Array.isArray(rawHistory)
    ? rawHistory
        .filter(
          (m) =>
            (m?.role === "user" || m?.role === "assistant") &&
            typeof m.content === "string",
        )
        .slice(-4) // last 2 turns = 4 messages max
        .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }))
    : [];

  return { question, documentId, conversationId, chatHistory };
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

// Feature 10: an existing chat must belong to this user.
// Returns the chat, null (a new chat) or false (not found / not yours).
async function findConversation(req, conversationId) {
  if (!conversationId) return null;
  const conversation = await Conversation.findOne({
    _id: conversationId,
    userId: req.userId,
  }).lean();
  return conversation ?? false;
}

// Sidebar title from the first question: one line, at most 60 characters
function makeTitle(question) {
  const oneLine = question.replace(/\s+/g, " ").trim();
  return oneLine.length > 60 ? `${oneLine.slice(0, 57)}...` : oneLine;
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

function finishAnswer(req, { question, documentId }, result, conversation) {
  const confidence = getConfidence(result);

  // Feature 9: make the id now, so the reply can carry it before the save finishes
  const historyId = new mongoose.Types.ObjectId();

  // Feature 10: lazy creation. A new chat is saved only now, once it has a real answer.
  const conversationId = conversation?._id ?? new mongoose.Types.ObjectId();
  if (conversation) {
    Conversation.updateOne(
      { _id: conversationId },
      { $set: { updatedAt: new Date() } }, // moves this chat to the top of the sidebar
    ).catch((err) => console.error("Chat update failed:", err.message));
  } else {
    Conversation.create({
      _id: conversationId,
      userId: req.userId,
      documentId: documentId || null,
      title: makeTitle(question),
    }).catch((err) => console.error("Chat save failed:", err.message));
  }

  // Feature 6: Q&A ko history mein save karo (background mein)
  QAHistory.create({
    _id: historyId,
    userId: req.userId,
    documentId: documentId || null,
    conversationId,
    question,
    answer: result.answer,
    citations: result.citations,
    confidence,
    // Feature 9: snapshot of what the agent saw (pages and scores, not the full text)
    sources: result.sources.map((s) => ({
      fileName: s.fileName,
      pageNumber: s.pageNumber,
      score: s.score,
      rerankScore: s.rerankScore,
    })),
    searchQueries: result.searchQueries ?? [],
    retries: result.retryCount ?? 0,
  }).catch((err) => console.error("History save failed:", err.message));

  return {
    historyId, // Feature 9: the frontend sends feedback for this id
    conversationId, // Feature 10: the frontend sends this with the next question
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

  const conversation = await findConversation(req, input.conversationId);
  if (conversation === false) {
    return res
      .status(404)
      .json({ message: "This chat no longer exists. Start a new one." });
  }
  if (conversation) input.documentId = conversation.documentId?.toString(); // the chat's scope wins

  const guard = await runGuard(input.question);

  if (!guard.allowed) return res.json(guardReply(guard));

  const result = await runAgent(input.question, req.userId, {
    documentId: input.documentId,
    chatHistory: input.chatHistory,
  });

  res.json(finishAnswer(req, input, result, conversation));
}

// ---------- POST /api/ask/stream (Server-Sent Events) ----------

export async function askStream(req, res) {
  const input = parseAskRequest(req);
  if (input.error) return res.status(400).json({ message: input.error });

  // Checked before the stream starts, so these can still be normal JSON errors
  const conversation = await findConversation(req, input.conversationId);
  if (conversation === false) {
    return res
      .status(404)
      .json({ message: "This chat no longer exists. Start a new one." });
  }
  if (conversation) input.documentId = conversation.documentId?.toString(); // the chat's scope wins

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
      else if (event.type === "token") send("token", { text: event.text });
      else if (event.type === "reset") send("reset", {});
      else result = event.state;
    }

    send("done", finishAnswer(req, input, result, conversation));
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

// Feature 9: thumbs up / down on one answer
// Body: { rating: 1 | -1 | null, reason?: one of FEEDBACK_REASONS (only with -1) }
export async function setFeedback(req, res) {
  const { id } = req.params;
  const { rating, reason = null } = req.body ?? {};

  if (!mongoose.isValidObjectId(id)) {
    return res.status(404).json({ message: "Answer not found" });
  }
  if (![1, -1, null].includes(rating)) {
    return res.status(400).json({ message: "rating must be 1, -1 or null" });
  }
  if (
    reason !== null &&
    (rating !== -1 || !FEEDBACK_REASONS.includes(reason))
  ) {
    return res.status(400).json({ message: "Invalid reason" });
  }

  const updated = await QAHistory.findOneAndUpdate(
    { _id: id, userId: req.userId }, // only your own answers
    { feedback: { rating, reason, at: rating === null ? null : new Date() } },
    {
      returnDocument: "after",
      runValidators: true,
      projection: { feedback: 1 },
    },
  ).lean();

  if (!updated) {
    // Rare: clicked before the background save finished (see Feature 9 notes)
    return res
      .status(404)
      .json({ message: "Couldn't save your feedback. Please try again." });
  }

  res.json({ feedback: updated.feedback });
}
