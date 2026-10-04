import mongoose from "mongoose";
import DocumentModel from "../models/Document.js";
import {
  processDocument,
  getChunksCollection,
} from "../services/ingestionService.js";

export async function uploadDocument(req, res) {
  if (!req.file) {
    return res
      .status(400)
      .json({ message: "Please upload a PDF in the 'file' field" });
  }

  const doc = await DocumentModel.create({
    userId: req.userId,
    fileName: req.file.originalname,
  });

  // Start ingestion in the background. We do NOT await it.
  processDocument(doc, req.file.path).catch((err) =>
    console.error("Background processing crashed:", err),
  );

  res.status(201).json({ document: doc });
}

export async function listDocuments(req, res) {
  const documents = await DocumentModel.find({ userId: req.userId }).sort({
    createdAt: -1,
  });
  res.json({ documents });
}


export async function deleteDocument(req, res) {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(404).json({ message: "Document not found" });
  }

  // Only find it if it belongs to this user
  const doc = await DocumentModel.findOne({ _id: id, userId: req.userId });
  if (!doc) {
    return res.status(404).json({ message: "Document not found" });
  }

  if (doc.status === "processing") {
    return res
      .status(409)
      .json({
        message:
          "This document is still being processed. Try again in a moment.",
      });
  }

  // Chunks first, so a failure can never leave searchable chunks behind
  await getChunksCollection().deleteMany({
    documentId: id,
    userId: req.userId,
  });
  await DocumentModel.deleteOne({ _id: id });

  res.json({ deleted: id });
}
