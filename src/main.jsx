import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";

// Import the global Tailwind stylesheet so utility classes and your custom
// palette are included in the Vite bundle. Without this import, classes
// like `bg-primary` or `rounded-xl` have no corresponding CSS and the UI
// appears unstyled.
import "./index.css";

const rootEl = document.getElementById("root");
createRoot(rootEl).render(<App />);