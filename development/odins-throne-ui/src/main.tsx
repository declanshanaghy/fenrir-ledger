import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles/index.css";

// FOIT prevention: apply saved theme before first paint to avoid flash
const _savedTheme = localStorage.getItem("fenrir-monitor-theme");
if (_savedTheme === "light") {
  document.documentElement.dataset.theme = "light";
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
