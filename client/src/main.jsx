import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// Fonts (installed from npm, so no external font server is needed)
import "@fontsource/syne/700.css";
import "@fontsource/syne/800.css";
import "@fontsource/bricolage-grotesque/400.css";
import "@fontsource/bricolage-grotesque/500.css";
import "@fontsource/bricolage-grotesque/700.css";

// Design system first, then page-wide defaults
import "./styles/tokens.css";
import "./styles/base.css";

import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
