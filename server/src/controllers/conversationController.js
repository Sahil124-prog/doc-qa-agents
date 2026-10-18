import mongoose from "mongoose";
import Conversation from "../models/Conversation.js";
import QAHistory from "../models/QAHistory.js";

// Sidebar: this user's chats, most recently used first
export async function listConversations(req, res) {
  const conversations = await Conversation.find({ userId: req.userId })
    .sort({ updatedAt: -1 })
    .limit(50)
    .select({ title: 1, documentId: 1, updatedAt: 1 })
    .lean();

  res.json({ conversations });
}

// Opening a chat: the chat itself and all its messages, oldest first
export async function getConversation(req, res) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(404).json({ message: "Chat not found" });
  }

  const conversation = await Conversation.findOne({
    _id: id,
    userId: req.userId,
  }).lean();
  if (!conversation) {
    return res.status(404).json({ message: "Chat not found" });
  }

  const messages = await QAHistory.find({
    conversationId: id,
    userId: req.userId,
  })
    .sort({ createdAt: 1 })
    .select({
      question: 1,
      answer: 1,
      citations: 1,
      confidence: 1,
      feedback: 1,
      createdAt: 1,
    })
    .lean();

  res.json({ conversation, messages });
}

// Deleting a chat removes its messages too
export async function deleteConversation(req, res) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(404).json({ message: "Chat not found" });
  }

  const conversation = await Conversation.findOne({
    _id: id,
    userId: req.userId,
  });
  if (!conversation) {
    return res.status(404).json({ message: "Chat not found" });
  }

  // Messages first, then the chat, so a crash never leaves messages pointing at nothing
  await QAHistory.deleteMany({ conversationId: id, userId: req.userId });
  await Conversation.deleteOne({ _id: id });

  res.json({ deleted: id });
}
