import './utils/logger';
import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import "./theme.css";
// Pose data-theme sur <html> dès le chargement (quadrillage du fond, thème sombre) :
// les écrans étant chargés à la demande, ce module ne doit pas dépendre de l'un d'eux.
import "./store/themeStore";
import { App } from "./router";
import { ErrorBoundary } from "./components/ContractAnalysis/ErrorBoundary";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { BrowserRouter } from "react-router-dom";



ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </BrowserRouter>
  </React.StrictMode>,
);


