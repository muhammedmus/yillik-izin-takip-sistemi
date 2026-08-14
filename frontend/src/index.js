import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@/index.css";
import App from "@/App";

// Suppress benign "ResizeObserver loop completed with undelivered notifications"
// warning that triggers CRA dev-server error overlay in preview builds.
const RO_MSG = "ResizeObserver loop";
window.addEventListener("error", (e) => {
  if (e.message && e.message.includes(RO_MSG)) { e.stopImmediatePropagation(); }
});
window.addEventListener("unhandledrejection", (e) => {
  if (e.reason && String(e.reason).includes(RO_MSG)) { e.stopImmediatePropagation(); }
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);
