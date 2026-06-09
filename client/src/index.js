import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";

import { SocketProvider } from "./contexts/SocketContext";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeModeProvider } from "./contexts/ThemeContext";

//
import App from "./App";
import * as serviceWorker from "./serviceWorker";
import reportWebVitals from "./reportWebVitals";

// ErrorBoundary catches runtime errors in the React tree and displays a fallback UI.
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary] Caught error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100vh",
            background: "#0a0a0a",
            color: "#fff",
            fontFamily: "monospace",
            padding: "2rem",
            textAlign: "center",
          }}
        >
          <h1 style={{ color: "#E50914", fontSize: "2rem", marginBottom: "1rem" }}>
            ⚠ StreamSphere — Runtime Error
          </h1>
          <p style={{ color: "#aaa", marginBottom: "1rem" }}>
            Something crashed while rendering. Check the browser console for details.
          </p>
          <pre
            style={{
              background: "#1a1a1a",
              border: "1px solid #333",
              borderRadius: "8px",
              padding: "1rem",
              maxWidth: "80vw",
              overflowX: "auto",
              color: "#ff6b6b",
              fontSize: "0.85rem",
              textAlign: "left",
            }}
          >
            {this.state.error?.toString()}
          </pre>
          <button
            style={{
              marginTop: "1.5rem",
              padding: "0.75rem 2rem",
              background: "#E50914",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "1rem",
            }}
            onClick={() => window.location.reload()}
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}


const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <ErrorBoundary>
    <HelmetProvider>
      <BrowserRouter>
        <AuthProvider>
          <SocketProvider>
            <ThemeModeProvider>
              <App />
            </ThemeModeProvider>
          </SocketProvider>
        </AuthProvider>
      </BrowserRouter>
    </HelmetProvider>
  </ErrorBoundary>
);

// If you want to enable client cache, register instead.
serviceWorker.unregister();

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
