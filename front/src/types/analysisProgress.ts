export type AnalysisProgressMode = "direct" | "fallback" | "cached";
export type AnalysisProgressState = "running" | "completed" | "error";

export interface AnalysisProgress {
  mode: AnalysisProgressMode;
  state: AnalysisProgressState;
  currentAttempt: number;
  totalAttempts: number;
  totalChunks: number;
  completedChunks: number;
  successfulChunks: number;
  failedChunks: number;
  message: string;
}
