import * as React from "react";

export type StatusKind = "ok" | "warn" | "err";

export interface Status {
  kind: StatusKind;
  text: string;
}

export const TRACKED_OK: Status = {
  kind: "ok",
  text: "Insérée en révision — à accepter/rejeter dans l'onglet Révision.",
};

export const TRACKED_UNSUPPORTED: Status = {
  kind: "warn",
  text: "Word trop ancien pour le suivi automatique (WordApi 1.4) : insertion faite SANS révision.",
};

const StatusMessage: React.FC<{ status: Status | null }> = ({ status }) =>
  status ? <div className={`lj-status ${status.kind}`}>{status.text}</div> : null;

export default StatusMessage;
