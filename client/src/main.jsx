import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { queryClient } from "./lib/queryClient.js";
import "@fontsource/fraunces/600.css";
import "@fontsource/fraunces/700.css";
import "@fontsource/fraunces/900.css";
import "./index.css";

class ErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "system-ui", color: "var(--color-heading)", background: "var(--color-bg)", gap: 16 }}>
          <div style={{ fontSize: 32 }}>⚠️</div>
          <h2 style={{ margin: 0, fontSize: 18 }}>Something went wrong</h2>
          <p style={{ margin: 0, fontSize: 13, color: "var(--color-muted)" }}>{this.state.error?.message}</p>
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop: 8, background: "var(--color-primary)", color: "#fff", border: "none", borderRadius: 8, padding: "10px 24px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// This app uses HashRouter, so in-app navigation (including the browser's own
// back/forward buttons) never triggers a real page load — the same JS keeps
// running for as long as the tab stays open. The one case that *can* still
// serve genuinely stale code is the browser restoring a full page from
// bfcache (e.g. after the OS suspends the tab, or navigating away and back
// past the app entirely) — that resumes the exact in-memory JS from before,
// silently skipping any deploy that happened since. Forcing a reload in that
// one case is the standard mitigation.
window.addEventListener("pageshow", (event) => {
  if (event.persisted) window.location.reload();
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <HashRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </HashRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
