import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { api } from "../../api.js";
import AnswerSheet from "../AnswerSheet/AnswerSheet.jsx";
import AgentTrail from "../AgentTrail/AgentTrail.jsx";
import "./Desk.css";

export default function Desk({ readyDocuments, scopeId, onScopeChange }) {
  const [question, setQuestion] = useState("");
  const [exchanges, setExchanges] = useState([]); // [{ id, question, status, result, error }]
  const endRef = useRef(null);

  const [chatHistory, setChatHistory] = useState([]);
  const asking = exchanges.some((ex) => ex.status === "loading");
  const hasDocuments = readyDocuments.length > 0;

  // Keep the newest exchange in view
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [exchanges]);

  // Feature 6: document change hone pe us document ki history load karo
  useEffect(() => {
    let ignore = false;
    const query = scopeId ? `?documentId=${scopeId}` : "";

    api(`/ask/history${query}`)
      .then((items) => {
        if (ignore) return; // user ne beech mein doosra document select kar liya
        setExchanges(
          items.reverse().map((item) => ({
            id: item._id,
            question: item.question,
            status: "done",
            fromHistory: true,
            askedAt: item.createdAt,
            result: {
              answer: item.answer,
              citations: item.citations,
              sources: [],
              confidence: item.confidence,
            },
          })),
        );
        setChatHistory([]); // naya document = nayi conversation
      })
      .catch(() => {
        if (!ignore) setExchanges([]);
      });

    return () => {
      ignore = true;
    };
  }, [scopeId]);

  function updateExchange(id, changes) {
    setExchanges((current) =>
      current.map((ex) => (ex.id === id ? { ...ex, ...changes } : ex)),
    );
  }

  async function handleAsk(event) {
    event.preventDefault();
    const text = question.trim();
    if (!text || asking) return;

    const id = Date.now();
    setExchanges((current) => [
      ...current,
      { id, question: text, status: "loading" },
    ]);
    setQuestion("");

    try {
      const result = await api("/ask", {
        method: "POST",
        body: { question: text, documentId: scopeId || undefined, chatHistory },
      });
      updateExchange(id, { status: "done", result });
      setChatHistory((prev) => [
        ...prev,
        { role: "user", content: text },
        { role: "assistant", content: result.answer },
      ]);
    } catch (err) {
      updateExchange(id, { status: "error", error: err.message });
    }
  }

  return (
    <section className="desk">
      <div className="desk-scope">
        <label htmlFor="scope">Searching in</label>
        <select
          id="scope"
          value={scopeId}
          onChange={(event) => onScopeChange(event.target.value)}
        >
          <option value="">All documents</option>
          {readyDocuments.map((doc) => (
            <option key={doc._id} value={doc._id}>
              {doc.fileName}
            </option>
          ))}
        </select>
      </div>

      <div className="desk-feed">
        {exchanges.length === 0 && (
          <motion.div
            className="desk-empty"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h2>What do you want to know?</h2>
            <p>
              {hasDocuments
                ? "Ask in your own words. Every answer links to the page it came from."
                : "Upload a PDF on the left. Once it shows Ready, ask anything about it here."}
            </p>
          </motion.div>
        )}

        <AnimatePresence initial={false}>
          {exchanges.map((ex) => (
            <motion.div
              key={ex.id}
              className="desk-exchange"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {ex.fromHistory && (
                <span className="desk-earlier">
                  Earlier ·{" "}
                  {new Date(ex.askedAt).toLocaleString(undefined, {
                    day: "numeric",
                    month: "short",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              )}
              <h3 className="desk-question">{ex.question}</h3>

              {ex.status === "loading" && <Thinking />}

              {ex.status === "error" && (
                <p className="desk-error">{ex.error}</p>
              )}

              {ex.status === "done" && (
                <div className="desk-answer">
                  <AnswerSheet
                    answer={ex.result.answer}
                    citations={ex.result.citations}
                    sources={ex.result.sources}
                    isGuard={ex.result.kind === "guard"}
                    confidence={ex.result.confidence}
                  />
                  {ex.result.kind !== "guard" && !ex.fromHistory && (
                    <AgentTrail
                      trace={ex.result.trace}
                      citations={ex.result.citations}
                    />
                  )}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={endRef} />
      </div>

      <form className="desk-ask" onSubmit={handleAsk}>
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask anything about your documents"
          maxLength={1000}
          aria-label="Your question"
        />
        <button className="btn" disabled={asking || !question.trim()}>
          {asking ? "Thinking…" : "Ask"}
        </button>
      </form>
    </section>
  );
}

// Three bouncing dots while the agent works
function Thinking() {
  return (
    <div className="thinking" role="status">
      <span className="thinking-dots" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            animate={{ y: [0, -7, 0] }}
            transition={{ repeat: Infinity, duration: 0.7, delay: i * 0.12 }}
          />
        ))}
      </span>
      Searching your documents…
    </div>
  );
}
