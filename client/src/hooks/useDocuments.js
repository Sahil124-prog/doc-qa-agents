import { useCallback, useEffect, useState } from "react";
import { api } from "../api.js";

const POLL_EVERY_MS = 3000;
const MAX_FILE_MB = 10;

// All document logic in one place: load the list, upload, delete, and poll while processing.
export function useDocuments() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    const data = await api("/documents");
    setDocuments(data.documents);
  }, []);

  // 1. Load the list once when the workspace opens
  useEffect(() => {
    refresh()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [refresh]);

  // 2. While any document is still processing, re-check every 3 seconds
  const hasProcessing = documents.some((doc) => doc.status === "processing");

  useEffect(() => {
    if (!hasProcessing) return;
    const timer = setInterval(() => refresh().catch(() => {}), POLL_EVERY_MS);
    return () => clearInterval(timer); // stop polling when nothing is processing
  }, [hasProcessing, refresh]);

  // 3. Upload one PDF
  async function upload(file) {
    setError("");

    // Quick checks in the browser, so the user gets instant feedback
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Only PDF files can be uploaded.");
      return;
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`That file is over ${MAX_FILE_MB} MB.`);
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file); // "file" must match upload.single("file") on the server
      const data = await api("/documents", { method: "POST", formData });
      setDocuments((current) => [data.document, ...current]);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  // 4. Delete one document (returns true if it worked)
  async function remove(id) {
    setError("");
    try {
      await api(`/documents/${id}`, { method: "DELETE" });
      setDocuments((current) => current.filter((doc) => doc._id !== id));
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  }

  return { documents, loading, uploading, error, upload, remove };
}
