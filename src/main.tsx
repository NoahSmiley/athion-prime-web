import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AuthProvider } from "@/components/AuthProvider";
import { applyTheme, loadSettings } from "@/lib/settings";

// Dark only — matches athion design system.
document.documentElement.classList.add("dark");

// Apply the persisted theme synchronously before first paint so the user
// never sees a Hybrid → Spare flash on reload.
applyTheme(loadSettings().theme);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
);
