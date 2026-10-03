import DocumentModel from "../models/Document.js";

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

  res.status(201).json({ document: doc });
}
