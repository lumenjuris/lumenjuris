import { memo, useEffect, useMemo, useRef, useState } from "react";
import { FileText } from "lucide-react";

interface Props {
  text: string;
  /** Le texte du document est encore en cours de lecture. */
  loading: boolean;
  file: File;
  /**
   * Passages à surligner (valeur du champ que l'utilisateur regarde). Le parent
   * ne les change qu'au changement de champ : le contrat n'est donc pas
   * redessiné pendant la frappe.
   */
  highlightTerms: string[];
}

type PreviewMode = "text" | "original";

/**
 * Colonne principale de l'import : le contrat, présenté comme une page.
 * Pour un PDF, on peut aussi afficher le document original (fichier local,
 * aucun appel serveur).
 *
 * Mémoïsé : un contrat peut faire plusieurs milliers de lignes, il ne doit pas
 * être redessiné à chaque caractère saisi dans le panneau de droite.
 */
export const ContractTextPreview = memo(function ContractTextPreview({ text, loading, file, highlightTerms }: Props) {
  const [mode, setMode] = useState<PreviewMode>("text");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

  // URL locale du fichier, libérée quand on change de document.
  useEffect(() => {
    if (!isPdf) return;
    const url = URL.createObjectURL(file);
    setPdfUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file, isPdf]);

  // Clé stable des termes : évite de reconstruire la regex (et de refaire
  // défiler le contrat) alors que les passages cherchés n'ont pas changé.
  const highlightKey = highlightTerms.join("|");
  const highlightRegex = useMemo(() => buildHighlightRegex(highlightTerms), [highlightKey]);

  // Amène le premier passage surligné au centre de la colonne, uniquement
  // quand l'utilisateur change de champ.
  useEffect(() => {
    if (!highlightRegex || mode !== "text") return;
    const container = scrollContainerRef.current;
    const firstMark = container?.querySelector("mark");
    if (!container || !firstMark) return;
    // On fait défiler la colonne elle-même plutôt que d'utiliser scrollIntoView,
    // qui entraîne aussi la page entière : très visible sur mobile, où le contrat
    // et les champs sont empilés.
    const positionDuPassage = container.scrollTop
      + (firstMark.getBoundingClientRect().top - container.getBoundingClientRect().top);
    container.scrollTo({ top: Math.max(0, positionDuPassage - container.clientHeight / 2), behavior: "smooth" });
  }, [highlightKey, mode]);

  const lines = useMemo(() => text.split("\n"), [text]);

  return (
    <div className="flex flex-col min-h-0 h-[55vh] lg:h-full bg-white rounded-card border border-line shadow-card overflow-hidden">
      {isPdf && (
        <div className="flex items-center justify-end gap-1 px-4 py-2 border-b border-line-subtle shrink-0">
          <ModeButton active={mode === "text"} onClick={() => setMode("text")}>Texte</ModeButton>
          <ModeButton active={mode === "original"} onClick={() => setMode("original")}>Document original</ModeButton>
        </div>
      )}

      {mode === "original" && pdfUrl ? (
        <iframe src={pdfUrl} title={file.name} className="flex-1 w-full min-h-[320px]" />
      ) : (
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-6 sm:px-10 py-8">
          {loading ? (
            <TextSkeleton />
          ) : text.trim() ? (
            <article aria-label="Texte du contrat" className="max-w-3xl mx-auto font-serif text-[15px] leading-7 text-ink-secondary">
              {lines.map((line, index) => (
                <ContractLine key={index} line={line} highlightRegex={highlightRegex} />
              ))}
            </article>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-16">
              <FileText className="w-8 h-8 text-ink-placeholder" />
              <p className="text-sm text-ink-subtle">Aucun texte n'a pu être lu dans ce document.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

function ContractLine({ line, highlightRegex }: { line: string; highlightRegex: RegExp | null }) {
  if (line.trim() === "") return <div className="h-3" />;
  const content = renderWithHighlights(line, highlightRegex);
  if (isHeadingLine(line)) {
    return <p className="font-sans font-semibold text-ink text-sm mt-5 mb-1">{content}</p>;
  }
  return <p>{content}</p>;
}

/** Titre d'article (« Article 3 – Durée ») ou ligne entièrement en majuscules. */
function isHeadingLine(line: string): boolean {
  const trimmed = line.trim();
  if (/^(article|art\.)\s*\d+/i.test(trimmed)) return true;
  const hasLetters = /[a-zà-ÿ]/i.test(trimmed);
  const isUppercase = trimmed === trimmed.toUpperCase();
  return hasLetters && isUppercase && trimmed.length < 90;
}

/**
 * Regex qui trouve n'importe lequel des termes, sans tenir compte de la casse
 * ni du nombre d'espaces entre les mots. Null s'il n'y a rien à chercher.
 */
function buildHighlightRegex(terms: string[]): RegExp | null {
  const usableTerms = terms.filter((term) => term.trim().length > 0);
  if (usableTerms.length === 0) return null;

  const patterns = usableTerms.map((term) => {
    const escaped = term.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Le contrat écrit souvent « d’apporteur » avec une apostrophe
    // typographique, un tiret long ou une espace insécable, là où l'IA renvoie
    // les caractères simples : sans ça, la valeur ne serait jamais retrouvée.
    return escaped
      .replace(/\s+/g, "\\s+")
      .replace(/['’]/g, "['’]")
      .replace(/-/g, "[-–—]");
  });
  return new RegExp(`(${patterns.join("|")})`, "gi");
}

/** Découpe la ligne et entoure de <mark> les passages trouvés. */
function renderWithHighlights(line: string, highlightRegex: RegExp | null): React.ReactNode {
  if (!highlightRegex) return line;
  // Avec un groupe capturant, split() garde les passages trouvés aux index impairs.
  const parts = line.split(highlightRegex);
  return parts.map((part, index) =>
    index % 2 === 1 ? (
      <mark key={index} className="bg-warning-light text-ink rounded px-0.5">{part}</mark>
    ) : (
      part
    ),
  );
}

function TextSkeleton() {
  const widths = ["w-1/2 mx-auto", "w-full", "w-11/12", "w-full", "w-3/4", "w-1/3", "w-full", "w-10/12", "w-full", "w-2/3"];
  return (
    <div className="max-w-3xl mx-auto space-y-3 animate-pulse">
      {widths.map((width, index) => (
        <div key={index} className={`h-3.5 rounded bg-surface-muted ${width}`} />
      ))}
    </div>
  );
}

function ModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
        active ? "bg-surface-muted text-ink" : "text-ink-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
