import { useEffect, useState } from "react";
import { motion } from "motion/react";
import "./DocumentFolder.css";

const TAB_LABEL = { ready: "Ready", processing: "Reading…", failed: "Failed" };

function describe(doc) {
  if (doc.status === "ready")
    return `${doc.pageCount} pages, ${doc.chunkCount} passages`;
  if (doc.status === "processing") return "Splitting pages and indexing";
  return doc.errorMessage || "Something went wrong while reading this file.";
}

export default function DocumentFolder({ doc, selected, onSelect, onDelete }) {
  const canSelect = doc.status === "ready";
  const canDelete = doc.status !== "processing"; // never delete while chunks are being written
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // "Delete?" waits 3 seconds for the second click, then goes back to "×"
  useEffect(() => {
    if (!confirming) return;
    const timer = setTimeout(() => setConfirming(false), 3000);
    return () => clearTimeout(timer);
  }, [confirming]);

  async function handleDeleteClick() {
    if (!confirming) {
      setConfirming(true); // first click only asks
      return;
    }
    setDeleting(true); // second click deletes
    const deleted = await onDelete();
    if (!deleted) {
      setDeleting(false);
      setConfirming(false);
    }
  }

  return (
    <motion.div
      layout
      className={`folder folder-${doc.status} ${selected ? "is-selected" : ""}`}
      initial={{ opacity: 0, y: -30, rotate: -3 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      exit={{ opacity: 0, x: -40, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
      whileHover={canSelect ? { x: 3, y: -3 } : undefined}
    >
      {/* key = status, so the tab re-animates (flips) whenever the status changes */}
      <motion.span
        key={doc.status}
        className="folder-tab"
        initial={{ rotateX: 90 }}
        animate={{ rotateX: 0 }}
        transition={{ duration: 0.35 }}
      >
        {TAB_LABEL[doc.status]}
      </motion.span>

      <button
        type="button"
        className="folder-body"
        onClick={canSelect ? onSelect : undefined}
        aria-pressed={canSelect ? selected : undefined}
        aria-disabled={!canSelect}
        title={canSelect ? "Ask questions about this document only" : undefined}
      >
        <span className="folder-name">{doc.fileName}</span>
        <span className="folder-meta">{describe(doc)}</span>
      </button>

      {canDelete && (
        <button
          type="button"
          className={`folder-delete ${confirming ? "is-confirming" : ""}`}
          onClick={handleDeleteClick}
          disabled={deleting}
          aria-label={
            confirming
              ? `Confirm deleting ${doc.fileName}`
              : `Delete ${doc.fileName}`
          }
        >
          {deleting ? "Deleting…" : confirming ? "Delete?" : "×"}
        </button>
      )}
    </motion.div>
  );
}
