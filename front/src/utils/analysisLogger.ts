// Journal automatique post-analyse
export class AnalysisLogger {
  private static instance: AnalysisLogger;
  private logEntries: Array<{
    timestamp: string;
    type: "analysis" | "highlighting" | "error" | "success";
    summary: string;
    details: any;
  }> = [];

  static getInstance(): AnalysisLogger {
    if (!AnalysisLogger.instance) {
      AnalysisLogger.instance = new AnalysisLogger();
    }
    return AnalysisLogger.instance;
  }

  // 📝 Enregistrer une analyse complète
  logAnalysisComplete(results: {
    documentName: string;
    clausesDetected: number;
    clausesHighlighted: number;
    riskDistribution: { critical: number; high: number; moderate: number };
    analysisTime: number;
    methods: string[];
    confidence: number;
  }) {
    const entry = {
      timestamp: new Date().toISOString(),
      type: "analysis" as const,
      summary: `Analyse complète: ${results.documentName}`,
      details: {
        ...results,
        status:
          results.clausesDetected === results.clausesHighlighted
            ? "perfect"
            : "partial",
        efficiency: Math.round(
          (results.clausesHighlighted / results.clausesDetected) * 100,
        ),
      },
    };

    this.logEntries.push(entry);
    this.generateJournalReport(entry);
  }

  // 📊 Générer un rapport de journal (silencieux pour les performances)
  private generateJournalReport(_entry: any) {
    // Journal silencieux - logs supprimés pour de meilleures performances
    // Les données sont stockées dans this.logEntries pour consultation ultérieure
  }

  // 📜 Obtenir l'historique complet
  getHistory() {
    return this.logEntries;
  }

  // 🧹 Nettoyer l'historique ancien
  clearOldEntries(daysToKeep: number = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    this.logEntries = this.logEntries.filter(
      (entry) => new Date(entry.timestamp) > cutoffDate,
    );
  }
}

// 🎯 Fonction utilitaire pour déclencher le journal automatiquement
export function triggerPostAnalysisJournal(analysisResults: any) {
  const logger = AnalysisLogger.getInstance();

  // Calculer les métriques
  const riskDistribution = {
    critical:
      analysisResults.clauses?.filter((c: any) => c.riskScore >= 4).length || 0,
    high:
      analysisResults.clauses?.filter((c: any) => c.riskScore === 3).length ||
      0,
    moderate:
      analysisResults.clauses?.filter((c: any) => c.riskScore < 3).length || 0,
  };

  const methods = Array.from(
    new Set(
      analysisResults.clauses?.map((c: any) => String(c.method || "regex")) ||
        [],
    ),
  ) as string[];

  const averageConfidence =
    analysisResults.clauses?.length > 0
      ? analysisResults.clauses.reduce(
          (sum: number, c: any) => sum + (c.confidence || 0.8),
          0,
        ) / analysisResults.clauses.length
      : 0;

  // Enregistrer le journal
  logger.logAnalysisComplete({
    documentName: analysisResults.documentName || "Document sans nom",
    clausesDetected: analysisResults.clauses?.length || 0,
    clausesHighlighted: analysisResults.highlightedCount || 0,
    riskDistribution,
    analysisTime: analysisResults.analysisTime || 0,
    methods,
    confidence: averageConfidence,
  });
}
