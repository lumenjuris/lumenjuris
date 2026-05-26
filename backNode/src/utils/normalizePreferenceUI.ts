const ALL_VEILLE_TAGS = [
  "Rupture",
  "Temps de travail",
  "Rémunération",
  "Santé/Sécurité",
  "Discipline",
  "Relations collectives",
  "Protection sociale",
  "Recrutement",
] as const;

export function normalizePreferenceUI(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { dyslexicMode: false, veilleActiveTags: [...ALL_VEILLE_TAGS] };
  }
  const candidate = input as {
    dyslexicMode?: unknown;
    veilleActiveTags?: unknown;
  };

  const veilleActiveTags = Array.isArray(candidate.veilleActiveTags)
    ? (candidate.veilleActiveTags as unknown[]).filter(
        (t): t is string =>
          typeof t === "string" &&
          (ALL_VEILLE_TAGS as readonly string[]).includes(t),
      )
    : [...ALL_VEILLE_TAGS];

  return {
    dyslexicMode: Boolean(candidate.dyslexicMode),
    veilleActiveTags,
  };
}
