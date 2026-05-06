import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/geist";
import App from "./App";

// Dark only — matches athion design system. ThemeToggle is removed in Phase 1.
document.documentElement.classList.add("dark");

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
