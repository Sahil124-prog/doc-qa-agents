import { motion, useReducedMotion } from "motion/react";
import "./Background.css";

// Three soft colour fields that drift slowly behind the whole app.
const FIELDS = [
  {
    className: "field field-lavender",
    drift: { x: [0, -60, 0], y: [0, 50, 0] },
    seconds: 26,
  },
  {
    className: "field field-marigold",
    drift: { x: [0, 80, 0], y: [0, -40, 0] },
    seconds: 32,
  },
  {
    className: "field field-mint",
    drift: { x: [0, 50, 0], y: [0, 70, 0] },
    seconds: 29,
  },
];

export default function Background() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="background" aria-hidden="true">
      {FIELDS.map((field) => (
        <motion.div
          key={field.className}
          className={field.className}
          animate={reduceMotion ? undefined : field.drift}
          transition={{
            duration: field.seconds,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}
