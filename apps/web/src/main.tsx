import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ReferenceReplica as App } from "./app/ReferenceReplica";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
