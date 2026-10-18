import mongoose from "mongoose";

// One chat in the sidebar. Its messages live in QAHistory (conversationId points here).
const conversationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // The scope picked when the chat started (null = "All documents")
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Document",
      default: null,
    },
    title: { type: String, required: true, maxlength: 120 },
  },
  { timestamps: true }, // updatedAt = last activity, used to sort the sidebar
);

// Sidebar query: "this user's chats, most recently used first"
conversationSchema.index({ userId: 1, updatedAt: -1 });

export default mongoose.model("Conversation", conversationSchema);
