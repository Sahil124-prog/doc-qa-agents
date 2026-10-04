import { useEffect, useState } from "react";
import { api } from "./api.js";
import Background from "./components/Background/Background.jsx";
import Brand from "./components/Brand/Brand.jsx";

export default function App() {
  const [status, setStatus] = useState("checking…");

  useEffect(() => {
    api("/health")
      .then((data) => setStatus(data.status))
      .catch((err) => setStatus(`error: ${err.message}`));
  }, []);

  return (
    <>
      <Background />
      <div style={{ padding: 40 }}>
        <Brand />
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 48,
            marginTop: 40,
          }}
        >
          Backend: {status}
        </h1>
      </div>
    </>
  );
}
