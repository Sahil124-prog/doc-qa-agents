import mongoose from "mongoose";

// Feature 9: why an answer got a thumbs down (each points to a different fix)
export const FEEDBACK_REASONS = [
  "wrong", // the answer itself is wrong
  "incomplete", // right, but something is missing
  "wrong_page", // the page badge points to the wrong place
  "not_found_but_exists", // said "not found" but the document has it
];

const qaHistorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Document",
      default: null, // null = "All documents" wala question
    },
    question: { type: String, required: true },
    answer: { type: String, required: true },
    citations: { type: Array, default: [] },
    confidence: { type: String, default: null },

    // Feature 9: snapshot of what the agent saw, to debug a thumbs down later
    sources: { type: Array, default: [] }, // [{ fileName, pageNumber, score, rerankScore }]
    searchQueries: { type: [String], default: [] },
    retries: { type: Number, default: 0 },

    // Feature 9: the user's verdict on this answer
    feedback: {
      rating: { type: Number, enum: [1, -1], default: null }, // 1 = 👍, -1 = 👎, null = none
      reason: { type: String, enum: FEEDBACK_REASONS, default: null },
      at: { type: Date, default: null },
    },
  },
  { timestamps: true }, // createdAt / updatedAt automatic
);

// Fast lookup: "is user ki, is document ki history, latest pehle"
qaHistorySchema.index({ userId: 1, documentId: 1, createdAt: -1 });

export default mongoose.model("QAHistory", qaHistorySchema);
