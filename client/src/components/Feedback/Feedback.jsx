import { useState } from "react";
import { api } from "../../api.js";
import "./Feedback.css";

// Same values as FEEDBACK_REASONS on the server
const REASONS = [
  { value: "wrong", label: "Wrong answer" },
  { value: "incomplete", label: "Missing something" },
  { value: "wrong_page", label: "Wrong page" },
  { value: "not_found_but_exists", label: "It's in my document" },
];

const EMPTY = { rating: null, reason: null };

export default function Feedback({ historyId, initial }) {
  const [feedback, setFeedback] = useState(initial ?? EMPTY);
  const [error, setError] = useState("");

  // Optimistic: show the choice at once, undo it if the server says no
  async function save(next) {
    const previous = feedback;
    setFeedback(next);
    setError("");
    try {
      await api(`/ask/history/${historyId}/feedback`, {
        method: "PATCH",
        body: next,
      });
    } catch (err) {
      setFeedback(previous);
      setError(err.message);
    }
  }

  // Clicking the same thumb again removes it
  function rate(rating) {
    save({ rating: feedback.rating === rating ? null : rating, reason: null });
  }

  function pickReason(reason) {
    save({ rating: -1, reason: feedback.reason === reason ? null : reason });
  }

  return (
    <div className="feedback">
      <span className="feedback-label">Was this helpful?</span>

      <button
        type="button"
        className={`feedback-btn ${feedback.rating === 1 ? "is-active" : ""}`}
        onClick={() => rate(1)}
        aria-pressed={feedback.rating === 1}
        aria-label="Helpful"
      >
        👍
      </button>
      <button
        type="button"
        className={`feedback-btn ${feedback.rating === -1 ? "is-active" : ""}`}
        onClick={() => rate(-1)}
        aria-pressed={feedback.rating === -1}
        aria-label="Not helpful"
      >
        👎
      </button>

      {feedback.rating === -1 && (
        <div className="feedback-reasons">
          <span className="feedback-label">What went wrong?</span>
          {REASONS.map((r) => (
            <button
              key={r.value}
              type="button"
              className={`feedback-chip ${feedback.reason === r.value ? "is-active" : ""}`}
              onClick={() => pickReason(r.value)}
              aria-pressed={feedback.reason === r.value}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}

      {feedback.rating === 1 && (
        <span className="feedback-thanks">Thanks!</span>
      )}

      {error && (
        <span className="feedback-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
