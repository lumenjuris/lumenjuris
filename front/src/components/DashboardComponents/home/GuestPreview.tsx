import { ArrowRight } from "lucide-react";

import { useAuthPanelStore } from "../../../store/authPanelStore";

interface Props {
  /** Ce que le bloc contiendra une fois l'utilisateur connecté. */
  description: string;
  /** Deux ou trois exemples concrets, affichés en liste à puces. */
  examples: string[];
}

/**
 * Contenu affiché dans un bloc de l'accueil quand la page est consultée sans
 * compte.
 *
 * Les blocs « À traiter » et « Échéances à venir » ne montrent que des données
 * personnelles : pour un visiteur, on explique à quoi ils servent plutôt que
 * d'afficher une liste vide, et on propose de créer un compte.
 */
export function GuestPreview({ description, examples }: Props) {
  const ouvrirInscription = useAuthPanelStore((state) => state.ouvrirInscription);

  return (
    <div className="flex flex-col gap-3 border-t border-line-subtle px-5 py-4">
      <p className="text-[12.5px] leading-relaxed text-ink-muted">{description}</p>

      <ul className="flex flex-col gap-1.5">
        {examples.map((example) => (
          <li key={example} className="flex items-start gap-2 text-[12.5px] text-ink-subtle">
            <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-blue-primary/50" />
            {example}
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => ouvrirInscription()}
        className="inline-flex w-fit items-center gap-1 text-[12.5px] font-semibold text-blue-primary hover:underline"
      >
        Créer un compte
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
