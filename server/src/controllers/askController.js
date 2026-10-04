import { answerQuestion } from "../services/ragService.js";

const MAX_QUESTION_LENGTH = 1000;

export async function ask(req, res) {
  const question =
    typeof req.body?.question === "string" ? req.body.question.trim() : "";
  const documentId = req.body?.documentId;

  if (!question) {
    return res.status(400).json({ message: "Please provide a question" });
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    return res
      .status(400)
      .json({
        message: `Question must be under ${MAX_QUESTION_LENGTH} characters`,
      });
  }
  if (documentId !== undefined && typeof documentId !== "string") {
    return res.status(400).json({ message: "documentId must be a string" });
  }

  const result = await answerQuestion(question, req.userId, { documentId });
  res.json(result);
}
