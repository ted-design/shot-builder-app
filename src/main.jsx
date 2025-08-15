import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";

// Optional: global styles if you have any
// import "./index.css";

const rootEl = document.getElementById("root");
createRoot(rootEl).render(<App />);
