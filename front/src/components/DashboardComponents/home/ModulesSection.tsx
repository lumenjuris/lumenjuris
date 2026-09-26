import { Link } from "react-router-dom";
import {
  ArrowRight,
  Eye,
  FileText,
  Library,
  Lock,
  MessageSquare,
  MessagesSquare,
  PenTool,
  ScrollText,
  ShieldCheck,
} from "lucide-react";

import { SectionCard } from "./SectionCard";
import { useAuthPanelStore } from "../../../store/authPanelStore";
import { useDemandeConnexion } from "../../auth/useDemandeConnexion";

interface Module {
  icon: React.ElementType;
  label: string;
  /** Une phrase : ce que le module permet de faire, sans jargon. */
  description: string;
  /** Même chemin que dans le menu latéral, pour ne pas avoir deux vérités. */
  path: string;
}

const MODULES: Module[] = [
  {
    icon: Library,
    label: "Contrathèque",
    description: "Tous vos contrats au même endroit, avec leurs dates clés.",
    path: "/contratheque",
  },
  {
    icon: FileText,
    label: "Génération de contrat",
    description: "Rédigez de zéro, depuis un modèle ou un document importé.",
    path: "/generateur",
  },
  {
    icon: MessagesSquare,
    label: "Négociation",
    description: "Échangez les versions avec le cocontractant et suivez les modifications.",
    path: "/negociations",
  },
  {
    icon: ShieldCheck,
    label: "Analyse des risques",
    description: "Vérifiez la conformité juridique de vos documents.",
    path: "/conformite",
  },
  {
    icon: PenTool,
    label: "Signature",
    description: "Envoyez un contrat à signer et suivez où en sont les signataires.",
    path: "/signature",
  },
  {
    icon: ScrollText,
    label: "Bibliothèque de clauses",
    description: "Gardez vos clauses types et réutilisez-les d'un contrat à l'autre.",
    path: "/clauses",
  },
  {
    icon: Eye,
    label: "Comprendre ses contrats",
    description: "Obtenez le résumé et les obligations d'un contrat en langage clair.",
    path: "/comprendre-contrat",
  },
  {
    icon: MessageSquare,
    label: "Chat juridique",
    description: "Posez vos questions juridiques au fil de votre travail.",
    path: "/chatjuridique",
  },
];

interface Props {
  /** Vrai quand la page est consultée sans compte. */
  isGuest: boolean;
}

/**
 * Les fonctionnalités de l'outil, présentées en tuiles depuis l'accueil.
 *
 * Un visiteur peut les parcourir librement : c'est la vitrine du produit. En
 * revanche l'ouverture d'un module demande un compte — le clic n'emmène pas
 * sur une page qui rejetterait l'utilisateur, il ouvre le panneau de connexion
 * en mémorisant la destination, et la navigation reprend après la connexion.
 *
 * Les routes restent protégées de leur côté par `RequireAuth` : ce blocage-ci
 * est un confort de navigation, pas une mesure de sécurité.
 */
export function ModulesSection({ isGuest }: Props) {
  const ouvrirInscription = useAuthPanelStore((state) => state.ouvrirInscription);
  // Les tuiles restent de vrais liens : l'URL est visible et le clic du milieu
  // fonctionne. Pour un visiteur, la navigation est seulement retenue le temps
  // de la connexion.
  const demanderConnexion = useDemandeConnexion();

  return (
    <SectionCard
      eyebrow="Ce que fait Lumen Juris"
      title="Modules"
      headerRight={
        isGuest ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-ink-subtle">
            <Lock className="h-3 w-3" />
            Un compte est demandé à l'ouverture
          </span>
        ) : undefined
      }
    >
      <div className="grid grid-cols-1 gap-px border-t border-line-subtle bg-line-subtle sm:grid-cols-2 lg:grid-cols-4">
        {MODULES.map((module) => (
          <Link
            key={module.path}
            to={module.path}
            onClick={(event) => demanderConnexion(event, module.path)}
            className="group flex flex-col gap-2 bg-white px-5 py-4 transition-colors hover:bg-surface-subtle"
          >
            <span className="flex items-center gap-2">
              <module.icon className="h-4 w-4 shrink-0 text-brand" strokeWidth={1.75} />
              <span className="text-[13.5px] font-semibold text-ink">{module.label}</span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-ink-subtle opacity-0 transition-opacity group-hover:opacity-100" />
            </span>

            <span className="text-[12.5px] leading-relaxed text-ink-muted">
              {module.description}
            </span>
          </Link>
        ))}
      </div>

      {isGuest && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line-subtle px-5 py-3.5">
          <p className="text-[12.5px] text-ink-muted">
            Créez un compte pour ouvrir ces modules et enregistrer votre travail.
          </p>

          <button
            type="button"
            onClick={() => ouvrirInscription()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-hover"
          >
            Créer un compte
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </SectionCard>
  );
}
