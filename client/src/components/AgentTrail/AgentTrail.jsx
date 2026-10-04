import { motion } from "motion/react";
import { traceToSteps } from "../../utils/traceToSteps.js";
import "./AgentTrail.css";

// Each step appears one after another, replaying what the agent did.
const list = {
  hidden: {},
  shown: { transition: { delayChildren: 0.5, staggerChildren: 0.28 } },
};

const step = {
  hidden: { opacity: 0, x: 12 },
  shown: { opacity: 1, x: 0 },
};

const dot = {
  hidden: { scale: 0 },
  shown: {
    scale: 1,
    transition: { type: "spring", stiffness: 500, damping: 15 },
  },
};

export default function AgentTrail({ trace, citations }) {
  const steps = traceToSteps(trace, citations);

  return (
    <aside className="trail">
      <h3 className="trail-title">Behind this answer</h3>
      <motion.ol
        className="trail-list"
        variants={list}
        initial="hidden"
        animate="shown"
      >
        {steps.map((s, i) => (
          <motion.li
            key={i}
            className={`trail-step trail-${s.kind}`}
            variants={step}
          >
            <motion.span className="trail-dot" variants={dot} />
            <span className="trail-step-title">{s.title}</span>
            {s.detail && <span className="trail-step-detail">{s.detail}</span>}
          </motion.li>
        ))}
      </motion.ol>
    </aside>
  );
}
