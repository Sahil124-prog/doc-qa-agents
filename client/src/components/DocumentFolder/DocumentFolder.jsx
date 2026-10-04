import { motion } from "motion/react";
import "./DocumentFolder.css";

const TAB_LABEL = { ready: "Ready", processing: "Reading…", failed: "Failed" };

function describe(doc) {
  if (doc.status === "ready")
    return `${doc.pageCount} pages, ${doc.chunkCount} passages`;
  if (doc.status === "processing") return "Splitting pages and indexing";
  return doc.errorMessage || "Something went wrong while reading this file.";
}

export default function DocumentFolder({ doc, selected, onSelect }) {
  const canSelect = doc.status === "ready";

  return (
    <motion.button
      type="button"
      layout
      className={`folder folder-${doc.status} ${selected ? "is-selected" : ""}`}
      onClick={canSelect ? onSelect : undefined}
      aria-pressed={canSelect ? selected : undefined}
      aria-disabled={!canSelect}
      title={canSelect ? "Ask questions about this document only" : undefined}
      initial={{ opacity: 0, y: -30, rotate: -3 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
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
      <span className="folder-name">{doc.fileName}</span>
      <span className="folder-meta">{describe(doc)}</span>
    </motion.button>
  );
}
