import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { App } from "./router";
import { ErrorBoundary } from "./components/ContractAnalysis/ErrorBoundary";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { BrowserRouter } from "react-router-dom";
import { AuthContextProvider } from "./context/AuthContext";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <ErrorBoundary>
        <AuthContextProvider>
          <App />
        </AuthContextProvider>
      </ErrorBoundary>
    </BrowserRouter>
  </React.StrictMode>,
);
