// src/main.tsx
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import ErrorBoundary from "./ErrorBoundary";
import "./index.css";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("#root が index.html に見つかりません");

createRoot(rootEl).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
