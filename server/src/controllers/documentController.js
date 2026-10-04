import DocumentModel from "../models/Document.js";
import { processDocument } from "../services/ingestionService.js";

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
