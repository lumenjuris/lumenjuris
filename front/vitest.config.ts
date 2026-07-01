import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // On ne cible que les tests co-localisés dans src/ (les scripts legacy de
    // tests/ ne sont pas des suites Vitest).
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    environment: "node",
  },
});
