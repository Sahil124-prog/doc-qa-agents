import mongoose from "mongoose";

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
  },
  { timestamps: true }, // createdAt / updatedAt automatic
);

// Fast lookup: "is user ki, is document ki history, latest pehle"
qaHistorySchema.index({ userId: 1, documentId: 1, createdAt: -1 });

export default mongoose.model("QAHistory", qaHistorySchema);
