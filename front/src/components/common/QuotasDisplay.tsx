import {
  CheckCircle2,
  FileSearch,
  Library,
  PenLine,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import {
  BOOLEAN_FEATURES,
  NUMERIC_FEATURES,
  readQuotaValue,
  type PlanQuotas,
  type QuotaValue,
} from "../../types/quotas";

/** Icône affichée sur la carte de chaque feature à valeur. */
const FEATURE_ICONS: Partial<Record<keyof PlanQuotas, LucideIcon>> = {
  analyzer: FileSearch,
  signatureEnhanced: PenLine,
  contrathequeLimit: Library,
};

/** En dessous de ce pourcentage restant, le quota est signalé « bientôt épuisé ». */
const LOW_QUOTA_PERCENT = 20;

/**
 * Affiche les quotas d'un utilisateur par feature :
 *  - features à valeur : une carte par feature (solde restant, jauge, état) ;
 *  - features booléennes : liste des fonctionnalités incluses ou non.
 *
 * @param quotas     Quotas restants de l'utilisateur.
 * @param planQuotas Quotas pleins du plan (référence pour la jauge).
 */
export function QuotasDisplay({
  quotas,
  planQuotas,
}: {
  quotas: PlanQuotas;
  planQuotas: PlanQuotas;
}) {
  return (
    <div className="space-y-6">
      {/* Features à valeur : une carte par feature */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {NUMERIC_FEATURES.map(({ key, label }) => (
          <QuotaCard
            key={key}
            label={label}
            icon={FEATURE_ICONS[key] ?? FileSearch}
            planQuota={readQuotaValue(planQuotas?.[key] as never)}
            remainingQuota={readQuotaValue(quotas?.[key] as never)}
          />
        ))}
      </div>

      {/* Features booléennes (droits d'accès) */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          Fonctionnalités de votre formule
        </p>
        <ul className="grid grid-cols-1 gap-x-6 gap-y-2 lg:grid-cols-2">
          {BOOLEAN_FEATURES.map(({ key, label }) => {
            const feature = planQuotas?.[key] as
              { enabled: boolean } | undefined;
            const isIncluded = feature?.enabled === true;
            return (
              <li key={key} className="flex items-center gap-2 text-sm">
                {isIncluded ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 shrink-0 text-gray-300" />
                )}
                <span
                  className={isIncluded ? "text-gray-800" : "text-gray-400"}
                >
                  {label}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/**
 * Carte d'une feature à valeur. Trois cas :
 *  - non incluse dans le plan → carte grisée ;
 *  - illimitée → mention « Illimité » ;
 *  - quota fini → solde restant, jauge et état (disponible / bientôt épuisé / épuisé).
 */
function QuotaCard({
  label,
  icon: Icon,
  planQuota,
  remainingQuota,
}: {
  label: string;
  icon: LucideIcon;
  planQuota: QuotaValue;
  remainingQuota: QuotaValue;
}) {
  // Cas 1 : feature non incluse dans la formule
  if (planQuota.kind === "disabled") {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4">
        <CardTitle label={label} icon={Icon} isMuted />
        <p className="text-sm font-medium text-gray-400">Non inclus</p>
        <p className="text-xs text-gray-400">
          Disponible avec une formule supérieure.
        </p>
      </div>
    );
  }

  // Cas 2 : quota illimité
  if (planQuota.kind === "unlimited") {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4">
        <CardTitle label={label} icon={Icon} />
        <p className="text-2xl font-semibold text-gray-900">Illimité</p>
        <p className="text-xs text-gray-500">
          Aucune limite sur votre formule.
        </p>
      </div>
    );
  }

  // Cas 3 : quota fini
  const planTotal = planQuota.value;
  const remaining = remainingQuota.kind === "finite" ? remainingQuota.value : 0;
  // Des crédits ajoutés peuvent faire dépasser le total de la formule
  const extraCredits = Math.max(0, remaining - planTotal);

  let remainingPercent = 0;
  if (planTotal > 0) {
    remainingPercent = Math.min(100, Math.round((remaining / planTotal) * 100));
  } else if (remaining > 0) {
    remainingPercent = 100;
  }

  const isEmpty = remaining === 0;
  const isLow = !isEmpty && remainingPercent <= LOW_QUOTA_PERCENT;

  let barColor = "bg-blue-primary";
  let borderColor = "border-gray-200";
  if (isEmpty) {
    barColor = "bg-red-500";
    borderColor = "border-red-200";
  } else if (isLow) {
    barColor = "bg-amber-500";
    borderColor = "border-amber-200";
  }

  return (
    <div
      className={`flex flex-col gap-3 rounded-xl border bg-white p-4 ${borderColor}`}
    >
      <div className="flex items-start justify-between gap-2">
        <CardTitle label={label} icon={Icon} />
        {isEmpty && (
          <StatusPill className="bg-red-50 text-red-700">Épuisé</StatusPill>
        )}
        {isLow && (
          <StatusPill className="bg-amber-50 text-amber-700">
            Bientôt épuisé
          </StatusPill>
        )}
      </div>

      <div>
        <p className="flex items-baseline gap-1">
          <span
            className={`text-2xl font-semibold ${isEmpty ? "text-red-600" : "text-gray-900"}`}
          >
            {remaining}
          </span>
          <span className="text-sm text-gray-400">/ {planTotal}</span>
        </p>
        <p className="text-xs text-gray-500">
          {remaining > 1 ? "restants" : "restant"}
          {extraCredits > 0 && (
            <span className="font-medium text-blue-primary">
              {" "}
              · dont +{extraCredits} ajouté{extraCredits > 1 ? "s" : ""}
            </span>
          )}
        </p>
      </div>

      <div
        className="h-2 w-full overflow-hidden rounded-full bg-gray-100"
        role="progressbar"
        aria-label={`${label} : ${remaining} restants sur ${planTotal}`}
        aria-valuenow={remainingPercent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${remainingPercent}%` }}
        />
      </div>
    </div>
  );
}

/** Icône + libellé en haut d'une carte de quota. */
function CardTitle({
  label,
  icon: Icon,
  isMuted = false,
}: {
  label: string;
  icon: LucideIcon;
  isMuted?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
          isMuted
            ? "bg-gray-100 text-gray-400"
            : "bg-blue-primary/10 text-blue-primary"
        }`}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span
        className={`text-sm font-medium ${isMuted ? "text-gray-400" : "text-gray-700"}`}
      >
        {label}
      </span>
    </div>
  );
}

/** Petite pastille d'état (Épuisé, Bientôt épuisé). */
function StatusPill({
  className,
  children,
}: {
  className: string;
  children: string;
}) {
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${className}`}
    >
      {children}
    </span>
  );
}
