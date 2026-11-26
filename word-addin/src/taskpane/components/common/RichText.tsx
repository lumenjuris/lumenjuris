import * as React from "react";

/**
 * Rend le texte renvoyé par l'IA en respectant sa mise en forme.
 *
 * Les modèles répondent en Markdown (titres `###`, gras `**`, listes, citations).
 * Affiché brut, cela donne du texte parsemé d'astérisques et de dièses, illisible
 * dans un volet Word étroit.
 *
 * On ne rend que le sous-ensemble réellement produit par nos prompts. Le texte
 * est converti en éléments React — jamais en HTML injecté — donc aucun contenu
 * renvoyé par le modèle ne peut être interprété comme du code.
 */

type Bloc =
  | { type: "titre"; niveau: 1 | 2 | 3; texte: string }
  | { type: "paragraphe"; texte: string }
  | { type: "citation"; lignes: string[] }
  | { type: "liste"; ordonnee: boolean; items: string[] }
  | { type: "separateur" };

/** Découpe le texte en blocs logiques, ligne par ligne. */
function decouper(source: string): Bloc[] {
  const lignes = source.replace(/\r\n/g, "\n").split("\n");
  const blocs: Bloc[] = [];
  let paragraphe: string[] = [];

  const viderParagraphe = () => {
    if (paragraphe.length > 0) {
      blocs.push({ type: "paragraphe", texte: paragraphe.join(" ") });
      paragraphe = [];
    }
  };

  for (let i = 0; i < lignes.length; i++) {
    const ligne = lignes[i];
    const nue = ligne.trim();

    if (nue === "") {
      viderParagraphe();
      continue;
    }

    if (/^-{3,}$|^\*{3,}$|^_{3,}$/.test(nue)) {
      viderParagraphe();
      blocs.push({ type: "separateur" });
      continue;
    }

    const titre = /^(#{1,6})\s+(.*)$/.exec(nue);
    if (titre) {
      viderParagraphe();
      const niveau = Math.min(titre[1].length, 3) as 1 | 2 | 3;
      blocs.push({ type: "titre", niveau, texte: titre[2].trim() });
      continue;
    }

    if (/^>\s?/.test(nue)) {
      viderParagraphe();
      const lignesCitation: string[] = [];
      while (i < lignes.length && /^>\s?/.test(lignes[i].trim())) {
        lignesCitation.push(lignes[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      i--;
      blocs.push({ type: "citation", lignes: lignesCitation });
      continue;
    }

    const puce = /^[-*+]\s+(.*)$/.exec(nue);
    const numero = /^\d+[.)]\s+(.*)$/.exec(nue);
    if (puce || numero) {
      viderParagraphe();
      const ordonnee = Boolean(numero);
      const items: string[] = [];
      while (i < lignes.length) {
        const courante = lignes[i].trim();
        const p = /^[-*+]\s+(.*)$/.exec(courante);
        const n = /^\d+[.)]\s+(.*)$/.exec(courante);
        if (ordonnee && n) items.push(n[1]);
        else if (!ordonnee && p) items.push(p[1]);
        else break;
        i++;
      }
      i--;
      blocs.push({ type: "liste", ordonnee, items });
      continue;
    }

    paragraphe.push(nue);
  }

  viderParagraphe();
  return blocs;
}

/** Applique le gras, l'italique et le code sur une ligne. */
function enrichir(texte: string, cle: string): React.ReactNode[] {
  // Un seul passage : on capture les trois marqueurs dans l'ordre de priorité.
  const motif = /(\*\*[^*]+\*\*|`[^`]+`|(?<![*\w])\*[^*\n]+\*(?!\*))/g;
  const morceaux: React.ReactNode[] = [];
  let curseur = 0;
  let trouve: RegExpExecArray | null;
  let n = 0;

  while ((trouve = motif.exec(texte)) !== null) {
    if (trouve.index > curseur) morceaux.push(texte.slice(curseur, trouve.index));
    const brut = trouve[0];
    const k = `${cle}-${n++}`;
    if (brut.startsWith("**")) {
      morceaux.push(<strong key={k}>{brut.slice(2, -2)}</strong>);
    } else if (brut.startsWith("`")) {
      morceaux.push(
        <code key={k} style={{ background: "rgba(0,0,0,.05)", padding: "0 3px", borderRadius: 3 }}>
          {brut.slice(1, -1)}
        </code>,
      );
    } else {
      morceaux.push(<em key={k}>{brut.slice(1, -1)}</em>);
    }
    curseur = trouve.index + brut.length;
  }
  if (curseur < texte.length) morceaux.push(texte.slice(curseur));
  return morceaux;
}

const TAILLES: Record<1 | 2 | 3, number> = { 1: 15, 2: 14, 3: 13 };

const RichText: React.FC<{ children: string }> = ({ children }) => {
  const blocs = React.useMemo(() => decouper(children ?? ""), [children]);

  return (
    <div style={{ lineHeight: 1.55 }}>
      {blocs.map((bloc, i) => {
        switch (bloc.type) {
          case "titre":
            return (
              <div
                key={i}
                style={{
                  fontWeight: 600,
                  fontSize: TAILLES[bloc.niveau],
                  margin: i === 0 ? "0 0 4px" : "12px 0 4px",
                }}
              >
                {enrichir(bloc.texte, `t${i}`)}
              </div>
            );
          case "separateur":
            return <hr key={i} style={{ border: 0, borderTop: "1px solid rgba(0,0,0,.1)", margin: "10px 0" }} />;
          case "citation":
            return (
              <blockquote
                key={i}
                style={{
                  margin: "8px 0",
                  padding: "6px 10px",
                  borderLeft: "3px solid rgba(0,0,0,.15)",
                  background: "rgba(0,0,0,.03)",
                  borderRadius: "0 4px 4px 0",
                }}
              >
                {bloc.lignes.map((l, j) => (
                  <div key={j}>{enrichir(l, `c${i}-${j}`)}</div>
                ))}
              </blockquote>
            );
          case "liste": {
            const Balise = bloc.ordonnee ? "ol" : "ul";
            return (
              <Balise key={i} style={{ margin: "6px 0", paddingLeft: 20 }}>
                {bloc.items.map((item, j) => (
                  <li key={j} style={{ margin: "2px 0" }}>
                    {enrichir(item, `l${i}-${j}`)}
                  </li>
                ))}
              </Balise>
            );
          }
          default:
            return (
              <p key={i} style={{ margin: i === 0 ? "0 0 6px" : "6px 0" }}>
                {enrichir(bloc.texte, `p${i}`)}
              </p>
            );
        }
      })}
    </div>
  );
};

export default RichText;
