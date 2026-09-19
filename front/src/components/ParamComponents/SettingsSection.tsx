import type { ReactNode } from "react";

/**
 * Carte d'une section de la page Paramètres : en-tête (icône + titre +
 * description, avec une action facultative à droite) puis contenu.
 * Les blocs enfants sont séparés par une fine ligne grise.
 */
export function SettingsSection({
  icon,
  title,
  description,
  action,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  // Élément affiché à droite de l'en-tête (bouton, recherche…)
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <header className="flex flex-col gap-3 border-b border-gray-100 bg-gray-50/60 px-5 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-primary/10 text-blue-primary">
            {icon}
          </span>
          <div className="flex flex-col gap-0.5">
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
            <p className="text-xs leading-relaxed text-gray-500">
              {description}
            </p>
          </div>
        </div>
        {action}
      </header>
      <div className="divide-y divide-gray-100">{children}</div>
    </section>
  );
}
