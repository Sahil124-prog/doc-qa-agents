import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import "./AnswerSheet.css";

const CITATION = /\[(\d+(?:\s*,\s*\d+)*)\]/g; // [1] or [1, 3]
// Key facts to highlight: an amount with a unit ("60 days", "3 years") or a currency amount ("INR 1,200")
const KEY_FACT =
  /((?:INR|USD|Rs\.?|₹|\$)\s?\d[\d,.]*|\d[\d,.]*\s?(?:%|minutes?|days?|weeks?|months?|years?|hours?)\b)/g;

// "You get 18 days [1]." → [{ type: "text", value: "You get 18 days " }, { type: "cite", labels: [1] }, ...]
function splitAnswer(answer) {
  const parts = [];
  let last = 0;

  for (const match of answer.matchAll(CITATION)) {
    parts.push({ type: "text", value: answer.slice(last, match.index) });
    const labels = match[1].split(",").map((n) => Number(n.trim()));
    parts.push({ type: "cite", labels });
    last = match.index + match[0].length;
  }
  parts.push({ type: "text", value: answer.slice(last) });

  return parts;
}

export default function AnswerSheet({ answer, citations, sources }) {
  const [openLabel, setOpenLabel] = useState(null);

  const found = citations.length > 0;
  const openSource = sources.find((s) => s.label === openLabel);
  let factIndex = 0;

  // Text pieces: numbers get a highlighter sweep, one after another
  function renderText(text, key) {
    return text.split(KEY_FACT).map((piece, i) => {
      if (i % 2 === 0) return <span key={`${key}-${i}`}>{piece}</span>;
      const delay = 0.45 + factIndex++ * 0.2;
      return (
        <motion.mark
          key={`${key}-${i}`}
          className="answer-fact"
          initial={{ backgroundSize: "0% 42%" }}
          animate={{ backgroundSize: "100% 42%" }}
          transition={{ delay, duration: 0.5, ease: "easeOut" }}
        >
          {piece}
        </motion.mark>
      );
    });
  }

  return (
    <motion.article
      className={`sheet ${found ? "" : "is-empty"}`}
      initial={{ opacity: 0, y: 30, rotate: -1 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ type: "spring", stiffness: 150, damping: 17 }}
    >
      {!found && <h4 className="sheet-empty-title">Not in your documents</h4>}

      <p className="sheet-answer">
        {splitAnswer(answer).map((part, i) =>
          part.type === "text"
            ? renderText(part.value, i)
            : part.labels.map((label) => {
                const citation = citations.find((c) => c.label === label);
                if (!citation) return null; // the model cited a source that doesn't exist
                return (
                  <button
                    key={`${i}-${label}`}
                    type="button"
                    className={`cite ${openLabel === label ? "is-open" : ""}`}
                    onClick={() =>
                      setOpenLabel(openLabel === label ? null : label)
                    }
                    aria-expanded={openLabel === label}
                    title={`${citation.fileName}, page ${citation.pageNumber}`}
                  >
                    p.{citation.pageNumber}
                  </button>
                );
              }),
        )}
      </p>

      {!found && (
        <p className="sheet-hint">
          Try asking with different words, or upload the document that covers
          this.
        </p>
      )}

      {/* The source excerpt opens under the answer when a citation is clicked */}
      <AnimatePresence initial={false}>
        {openSource && (
          <motion.div
            key={openSource.label}
            className="sheet-source"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 28 }}
          >
            <div className="sheet-source-inner">
              <span className="sheet-source-label">
                {openSource.fileName}, page {openSource.pageNumber}
              </span>
              <p>“{openSource.preview.replace(/\s+/g, " ").trim()}…”</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}
