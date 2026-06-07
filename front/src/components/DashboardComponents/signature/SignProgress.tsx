interface Props {
  title: string;
  done: number;
  total: number;
  /** Couleur hex de la barre (souvent celle du signataire). */
  color: string;
  /** Si vrai, barre grise désactivée + hint en dessous. */
  muted?: boolean;
  hint?: string;
}

/**
 * Petite barre de progression utilisée dans la sidebar de l'étape "Signer"
 * pour montrer le ratio de champs signés (Vous / Cocontractant).
 */
export function SignProgress({ title, done, total, color, muted, hint }: Props) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className={muted ? "text-gray-400" : "text-gray-700 font-medium"}>{title}</span>
        <span className={muted ? "text-gray-400" : "text-gray-700 font-semibold"}>
          {done}/{total}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full transition-all duration-300"
          style={{ width: `${pct}%`, backgroundColor: muted ? "#e5e7eb" : color }}
        />
      </div>
      {hint && <p className="text-[10px] text-gray-400">{hint}</p>}
    </div>
  );
}
