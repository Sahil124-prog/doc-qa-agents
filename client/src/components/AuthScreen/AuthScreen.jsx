import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { api } from "../../api.js";
import Brand from "../Brand/Brand.jsx";
import "./AuthScreen.css";

const HEADLINE = ["Ask your PDFs.", "Get the page", "it came from."];

export default function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState("login"); // "login" or "signup"
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const isSignup = mode === "signup";

  function updateField(event) {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);

    try {
      const body = isSignup
        ? form
        : { email: form.email, password: form.password };
      const session = await api(`/auth/${mode}`, { method: "POST", body });
      onAuth(session);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <div className="auth-brand">
        <Brand />
      </div>

      {/* ---------- Left: headline + animated demo ---------- */}
      <section className="auth-pitch">
        <h1 className="auth-headline">
          {HEADLINE.map((line, i) => (
            <motion.span
              key={line}
              className="auth-headline-line"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: 0.1 + i * 0.12,
                type: "spring",
                stiffness: 120,
                damping: 16,
              }}
            >
              {line}
            </motion.span>
          ))}
        </h1>

        <motion.p
          className="auth-sub"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          Upload handbooks, notes or contracts. Every answer comes with the
          exact page, and you can watch how it was found.
        </motion.p>

        <div className="auth-demo" aria-hidden="true">
          <motion.div
            className="auth-demo-question"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.7 }}
          >
            Can I work from home?
          </motion.div>

          <motion.div
            className="auth-demo-answer"
            initial={{ opacity: 0, y: 24, rotate: -1.5 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{
              delay: 0.95,
              type: "spring",
              stiffness: 140,
              damping: 15,
            }}
          >
            Yes,{" "}
            <motion.span
              className="auth-demo-highlight"
              initial={{ backgroundSize: "0% 45%" }}
              animate={{ backgroundSize: "100% 45%" }}
              transition={{ delay: 1.5, duration: 0.6, ease: "easeOut" }}
            >
              up to 3 days per week
            </motion.span>
            . Tuesdays and Thursdays are office days.
            <span className="auth-demo-cite">p.4</span>
            <div className="auth-demo-steps">
              {["Searched", "Rewrote", "Found on p.4"].map((step, i) => (
                <motion.span
                  key={step}
                  className={`auth-demo-step step-${i}`}
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{
                    delay: 2.1 + i * 0.25,
                    type: "spring",
                    stiffness: 300,
                    damping: 14,
                  }}
                >
                  {step}
                </motion.span>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ---------- Right: login / signup card ---------- */}
      <motion.section
        className="auth-card"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, type: "spring", stiffness: 110, damping: 16 }}
      >
        <div className="auth-toggle" role="tablist">
          {["login", "signup"].map((option) => (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={mode === option}
              className={`auth-toggle-option ${mode === option ? "is-active" : ""}`}
              onClick={() => {
                setMode(option);
                setError("");
              }}
            >
              {/* The black pill slides to whichever option is active */}
              {mode === option && (
                <motion.span
                  layoutId="auth-toggle-pill"
                  className="auth-toggle-pill"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
              <span className="auth-toggle-label">
                {option === "login" ? "Log in" : "Create account"}
              </span>
            </button>
          ))}
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {/* The name field only exists for signup; it grows in and out smoothly */}
          <AnimatePresence initial={false}>
            {isSignup && (
              <motion.div
                key="name"
                className="auth-field"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
              >
                <label htmlFor="name">Name</label>
                <input
                  id="name"
                  name="name"
                  className="input"
                  value={form.name}
                  onChange={updateField}
                  required
                />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="auth-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              className="input"
              value={form.email}
              onChange={updateField}
              required
            />
          </div>

          <div className="auth-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              className="input"
              value={form.password}
              onChange={updateField}
              minLength={isSignup ? 6 : undefined}
              required
            />
          </div>

          <AnimatePresence>
            {error && (
              <motion.p
                className="auth-error"
                role="alert"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: [0, -6, 6, -3, 0] }}
                exit={{ opacity: 0 }}
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <button className="btn auth-submit" disabled={busy}>
            {busy ? "One moment…" : isSignup ? "Create account" : "Log in"}
          </button>
        </form>
      </motion.section>
    </div>
  );
}
