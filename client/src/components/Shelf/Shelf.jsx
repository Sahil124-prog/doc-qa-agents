import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import DocumentFolder from "../DocumentFolder/DocumentFolder.jsx";
import "./Shelf.css";

export default function Shelf({
  documents,
  loading,
  uploading,
  uploadError,
  onUpload,
  scopeId,
  onSelect,
}) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  function handleFiles(fileList) {
    const file = fileList?.[0];
    if (file) onUpload(file);
  }

  function handleDrop(event) {
    event.preventDefault();
    setDragging(false);
    handleFiles(event.dataTransfer.files);
  }

  return (
    <section className="shelf">
      <h2 className="shelf-title">Your shelf</h2>

      {/* Drop zone: click to choose a file, or drag a PDF onto it */}
      <motion.button
        type="button"
        className={`shelf-drop ${dragging ? "is-dragging" : ""}`}
        onClick={() => inputRef.current.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        disabled={uploading}
        whileHover={{ scale: 1.015 }}
        whileTap={{ scale: 0.98 }}
      >
        <motion.span
          className="shelf-drop-icon"
          animate={uploading ? { rotate: 360 } : { rotate: 0 }}
          transition={
            uploading ? { repeat: Infinity, duration: 1, ease: "linear" } : {}
          }
          aria-hidden="true"
        >
          +
        </motion.span>
        <span>
          <strong>{uploading ? "Uploading…" : "Drop a PDF here"}</strong>
          <span className="shelf-drop-hint">
            or click to choose, up to 10 MB
          </span>
        </span>
      </motion.button>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        hidden
        onChange={(event) => {
          handleFiles(event.target.files);
          event.target.value = ""; // allows choosing the same file again
        }}
      />

      <AnimatePresence>
        {uploadError && (
          <motion.p
            className="shelf-error"
            role="alert"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            {uploadError}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="shelf-list">
        {!loading && documents.length === 0 && (
          <p className="shelf-empty">
            Nothing here yet. Upload a handbook, policy or set of notes to start
            asking questions.
          </p>
        )}

        {/* layout = folders glide to their new position when one is added */}
        <AnimatePresence initial={false}>
          {documents.map((doc) => (
            <DocumentFolder
              key={doc._id}
              doc={doc}
              selected={scopeId === doc._id}
              onSelect={() => onSelect(scopeId === doc._id ? "" : doc._id)}
            />
          ))}
        </AnimatePresence>
      </div>
    </section>
  );
}
