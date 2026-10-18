import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { api, apiStream } from "../../api.js";
import AnswerSheet from "../AnswerSheet/AnswerSheet.jsx";
import AgentTrail from "../AgentTrail/AgentTrail.jsx";
import "./Desk.css";

export default function Desk({
  readyDocuments,
  scopeId,
  onScopeChange,
  chatId,
  onChatStarted,
  onChatActivity,
  onChatMissing,
}) {
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

  // Remembers a chat this Desk just created, so opening it doesn't reload the feed
  const ownChatRef = useRef(null);

  // Feature 10: a new chat starts with a clean desk; an old chat loads its messages
  useEffect(() => {
    if (chatId && chatId === ownChatRef.current) {
      ownChatRef.current = null; // already on screen: we just asked its first question
      return;
    }

    setExchanges([]);
    setChatHistory([]);
    if (!chatId) return;

    let ignore = false;
    api(`/conversations/${chatId}`)
      .then(({ messages }) => {
        if (ignore) return; // the user opened another chat meanwhile
        setExchanges(
          messages.map((m) => ({
            id: m._id,
            question: m.question,
            status: "done",
            fromHistory: true,
            askedAt: m.createdAt,
            result: {
              answer: m.answer,
              citations: m.citations,
              sources: [],
              confidence: m.confidence,
              historyId: m._id, // Feature 9
              feedback: m.feedback,
            },
          })),
        );
        // Carry on the conversation: the LLM gets the last 2 turns as memory
        setChatHistory(
          messages.slice(-2).flatMap((m) => [
            { role: "user", content: m.question },
            { role: "assistant", content: m.answer },
          ]),
        );
      })
      .catch(() => {
        if (ignore) return;
        setExchanges([]);
        onChatMissing(); // the saved chat was deleted (or isn't yours): start a new one
      });

    return () => {
      ignore = true;
    };
  }, [chatId]);

  function updateExchange(id, changes) {
    setExchanges((current) =>
      current.map((ex) => (ex.id === id ? { ...ex, ...changes } : ex)),
    );
  }

  // Change one exchange based on its latest value (safe for many quick updates)
  function patchExchange(id, change) {
    setExchanges((current) =>
      current.map((ex) => (ex.id === id ? { ...ex, ...change(ex) } : ex)),
    );
  }

  async function handleAsk(event) {
    event.preventDefault();
    const text = question.trim();
    if (!text || asking) return;

    const id = Date.now();
    setExchanges((current) => [
      ...current,
      { id, question: text, status: "loading", steps: [], draft: "" },
    ]);
    setQuestion("");

    try {
      const result = await apiStream("/ask/stream", {
        body: {
          question: text,
          documentId: scopeId || undefined,
          conversationId: chatId || undefined,
          chatHistory,
        },
        // Feature 8: steps and answer tokens show up the moment the server sends them
        onStep: (line) =>
          patchExchange(id, (ex) => ({ steps: [...ex.steps, line] })),
        onToken: (piece) =>
          patchExchange(id, (ex) => ({ draft: ex.draft + piece })),
        onReset: () => patchExchange(id, () => ({ draft: "" })),
      });

      updateExchange(id, { status: "done", result });

      // Feature 10: the first answer of a new chat created it; later answers move it to the top
      if (result.conversationId && !chatId) {
        ownChatRef.current = result.conversationId;
        onChatStarted(result.conversationId);
      } else if (result.conversationId) {
        onChatActivity();
      }

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

              {ex.status === "error" && (
                <p className="desk-error">{ex.error}</p>
              )}

              {ex.status !== "error" && (
                <div className="desk-answer">
                  {ex.status === "loading" ? (
                    ex.draft ? (
                      <DraftSheet text={ex.draft} />
                    ) : (
                      <Thinking />
                    )
                  ) : (
                    <AnswerSheet
                      answer={ex.result.answer}
                      citations={ex.result.citations}
                      sources={ex.result.sources}
                      isGuard={ex.result.kind === "guard"}
                      confidence={ex.result.confidence}
                      historyId={ex.result.historyId}
                      feedback={ex.result.feedback}
                    />
                  )}

                  {/* Same spot while loading and after: React keeps it, so steps don't replay */}
                  {(ex.status === "loading"
                    ? ex.steps.length > 0
                    : ex.result.kind !== "guard" && !ex.fromHistory) && (
                    <AgentTrail
                      trace={
                        ex.status === "loading" ? ex.steps : ex.result.trace
                      }
                      citations={
                        ex.status === "loading" ? [] : ex.result.citations
                      }
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

// Feature 8: the answer while it is still being written.
// Citation markers are hidden here; the final answer (from "done") shows them as page badges.
function DraftSheet({ text }) {
  const clean = text
    .replace(/【[^】]*】?/g, "") // gpt-oss style 【1†L1-L3】, even half-written
    .replace(/\[[\d,\s]*\]?/g, "") // [1] or [1, 2], even half-written
    .replace(/\*\*/g, ""); // Markdown bold markers

  return (
    <article className="sheet">
      <p className="sheet-answer">
        {clean}
        <span className="draft-cursor" aria-hidden="true">
          ▍
        </span>
      </p>
    </article>
  );
}
