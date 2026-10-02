import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Sparkles } from "lucide-react";
import { Button } from "../ui/Button";
import { cn } from "../../utils/shadcnUtils/cn";
import { PageBanner } from "../common/PageBanner";

import { useUserStore } from "../../store/userStore";
import { useAuthPanelStore } from "../../store/authPanelStore";
import type { BillingInterval, SubscriptionData } from "../../types/subscriptionData";
import { toCheckoutPlanName, PENDING_CHECKOUT_KEY } from "../../utils/planMapping";
import { fetchProxy } from "../../utils/fetchProxy";

//type PlanName = "Freemium" | "Betatesteur" | "Starter_mensuel" | "Starter_annuel" | "Pro_mensuel" | "Pro_annuel"

type Plan = {
  name: string;
  tagline: string;
  monthly: number;
  yearly: number;
  highlight?: boolean;
  badge?: string;
  features: string[];
  cta: string;
  /** Offre gratuite : inscription directe, sans paiement. */
  free?: boolean;
  /** Offre sur devis : déclenche un contact au lieu d'un paiement. */
  contactOnly?: boolean;
};

const PLANS: Plan[] = [
  {
    name: "Free",
    tagline: "Indépendants & TPE",
    monthly: 0,
    yearly: 0,
    free: true,
    cta: "Commencer gratuitement",
    features: [
      "Pour découvrir l'outil :",
      "Contrathèque : 15 contrats suivis",
      "5 contrats générés / mois",
      "3 analyses des risques / mois",
      "Négociation et bibliothèque de clauses illimitées",
    ],
  },
  {
    name: "Starter",
    tagline: "PME sans direction juridique",
    monthly: 49,
    yearly: 42,
    cta: "Choisir Starter",
    features: [
      "Tout le Free, plus :",
      "Contrathèque : 300 contrats suivis",
      "30 contrats générés / mois",
      "30 analyses des risques / mois",
      "Bibliothèque de modèles",
    ],
  },
  {
    name: "Pro",
    tagline: "PME structurée & ETI",
    monthly: 119,
    yearly: 101,
    highlight: true,
    badge: "Le plus populaire",
    cta: "Choisir Pro",
    features: [
      "Tout le Starter, plus :",
      "Contrathèque : 1 200 contrats suivis",
      "Génération de contrats illimitée",
      "100 analyses des risques / mois",
      "120 analyses playbook / mois",
    ],
  },
  {
    name: "Enterprise",
    tagline: "ETI de plus de 250 salariés",
    monthly: 0,
    yearly: 0,
    cta: "Nous contacter",
    contactOnly: true,
    features: [
      "Tout le Pro, plus :",
      "RBAC avancé & espaces de travail multiples",
      "Signatures avancées en volume (sur mesure)",
      "API & intégrations métier sur mesure",
      "Module d'audit & conformité RGPD renforcé",
      "SSO (authentification unique)",
      "SLA, support dédié & accompagnement",
    ],
  },
];

/**
 * Panneau de sélection des offres LumenJuris + démarrage du paiement Stripe.
 *
 * Workflow :
 * 1. **Grille des plans** — affiche les offres (Free, Starter, Pro, Enterprise)
 *    avec un toggle mensuel / annuel (-15 %). "Pro" est mis en avant
 *    (`highlight`), "Enterprise" déclenche un `mailto:`, "Free" envoie vers
 *    l'inscription. Une FAQ statique est affichée en bas de page.
 *
 * 2. **Démarrage du paiement** — au clic sur un plan payant, on appelle
 *    `POST /billing/create-checkout` (via `startCheckout`) puis on redirige le
 *    navigateur vers la page Stripe Checkout hébergée (`window.location.href`).
 *    Utilisateur non connecté : le plan est mémorisé, on passe par l'inscription,
 *    puis `startCheckout` est relancé automatiquement au retour (`useEffect`).
 *
 * 3. **Retour** — Stripe redirige vers `/subscription/success` ou
 *    `/subscription/failed`. L'abonnement est réellement activé côté webhook
 *    (stripe.service : onCheckoutCompleted / onPaymentSucceeded), pas ici.
 *
 * NB : le nom d'offre affiché ("Starter", "Pro") est traduit en `PlanName`
 * backend par `toCheckoutPlanName`.
 */
export function PlansPanel() {
  const [yearly, setYearly] = useState(true);
  // Nom d'offre (ex: "Pro") en cours de redirection vers Stripe, pour l'état du bouton.
  const [checkoutLoadingPlan, setCheckoutLoadingPlan] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const navigate = useNavigate();
  const userData = useUserStore((s) => s.userData);
  const ouvrirConnexion = useAuthPanelStore((s) => s.ouvrirConnexion);
  const ouvrirInscription = useAuthPanelStore((s) => s.ouvrirInscription);

  const interval: BillingInterval = yearly ? "yearly" : "monthly";

  // Formule en cours de l'utilisateur connecté : repérée dans le bandeau et
  // sur la carte de l'offre correspondante.
  const [formule, setFormule] = useState<SubscriptionData | null>(null);
  useEffect(() => {
    if (!userData) return;
    fetchProxy("/api/billing/subscription", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        const sub = (body?.success ? body.data?.subscription : null) as SubscriptionData | null;
        if (!sub) return;
        setFormule(sub);
        // On ouvre la grille sur la périodicité de l'abonnement en cours.
        if (sub.interval) setYearly(sub.interval === "yearly");
      })
      .catch(() => undefined);
  }, [userData]);
  // "Pro_annuel" -> carte "Pro" ; "Freemium" -> carte "Free".
  const carteActuelle = formule
    ? formule.planName === "Freemium"
      ? "Free"
      : formule.planName.split("_")[0]
    : null;
  const libelleFormule = formule
    ? formule.planName === "Freemium"
      ? "Free"
      : formule.planName === "Betatesteur"
        ? "Bêta-testeur"
        : formule.planName.replace("_", " · ")
    : null;
  const estActuelle = (plan: Plan) =>
    carteActuelle === plan.name && (plan.free || formule?.interval === interval);

  /**
   * Démarre un paiement : demande une session Stripe Checkout au backend puis
   * redirige vers la page hébergée par Stripe. L'activation de l'abonnement se
   * fait ensuite côté webhook (voir SubscriptionSuccess).
   */
  const startCheckout = useCallback(
    async (uiName: string, billingInterval: BillingInterval) => {
      const planName = toCheckoutPlanName(uiName, billingInterval);
      // Free / Enterprise ne passent pas par Checkout — garde-fou.
      if (!planName) return;

      setCheckoutError(null);
      setCheckoutLoadingPlan(uiName);
      try {
        const res = await fetchProxy("/api/billing/create-checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ planName }),
        });
        const data = await res.json();
        const url = data?.data?.url;
        if (data.success && url) {
          window.location.href = url; // redirection vers Stripe Checkout
          return;
        }
        // Message précis renvoyé par le backend (ex : abonnement déjà actif),
        // sinon message générique.
        setCheckoutError(
          typeof data?.message === "string"
            ? data.message
            : "Impossible de démarrer le paiement. Réessayez.",
        );
      } catch (err) {
        console.error("Erreur create-checkout:", err);
        setCheckoutError("Une erreur est survenue. Réessayez.");
      }
      setCheckoutLoadingPlan(null);
    },
    [],
  );

  // Reprise après inscription : un plan mémorisé (sessionStorage) avant la
  // création du compte relance directement le checkout au retour sur la page.
  useEffect(() => {
    const pending = sessionStorage.getItem(PENDING_CHECKOUT_KEY);
    if (!pending) return;
    sessionStorage.removeItem(PENDING_CHECKOUT_KEY);
    try {
      const plan = JSON.parse(pending) as { name: string; interval: BillingInterval };
      startCheckout(plan.name, plan.interval);
    } catch {
      // Valeur corrompue — on ignore.
    }
  }, [startCheckout]);

  const handlePlanSelect = (plan: Plan) => {
    // Non connecté : on mémorise le plan choisi (persistant à travers la
    // connexion) puis on ouvre le panneau de connexion par-dessus la page des
    // formules — sans quitter la page, pour garder le contexte des offres. Le
    // panneau retient `/souscription` comme destination : au retour authentifié,
    // le checkout mémorisé reprend automatiquement.
    if (!userData) {
      sessionStorage.setItem(
        PENDING_CHECKOUT_KEY,
        JSON.stringify({ name: plan.name, interval }),
      );
      ouvrirConnexion("/souscription");
      return;
    }
    // Connecté : on lance directement le paiement Stripe Checkout.
    startCheckout(plan.name, interval);
  };


  // RETOUR DU JSX


  return (
    <div className="mx-auto w-full max-w-7xl pb-6">
      {/* ── En-tête + toggle mensuel/annuel ── */}
      <PageBanner
        title="Accéder à nos outils"
        subtitle="Choisissez l'offre adaptée à votre équipe. Changez ou annulez à tout moment."
        badges={
          libelleFormule && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-200 ring-1 ring-emerald-300/30">
              <Check className="h-3.5 w-3.5" /> Votre formule : {libelleFormule}
              {formule?.status && formule.status !== "ACTIVE" ? " (inactive)" : ""}
            </span>
          )
        }
        actions={
          <div className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-subtle p-1 text-sm shadow-sm">
            <button
              onClick={() => setYearly(false)}
              className={cn(
                "rounded-full px-4 py-1.5 font-medium transition-all",
                !yearly
                  ? "bg-brand text-white shadow-sm"
                  : "text-ink-muted hover:text-ink",
              )}
            >
              Mensuel
            </button>
            <button
              onClick={() => setYearly(true)}
              className={cn(
                "flex items-center gap-2 rounded-full px-4 py-1.5 font-medium transition-all",
                yearly
                  ? "bg-brand text-white shadow-sm"
                  : "text-ink-muted hover:text-ink",
              )}
            >
              Annuel
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-bold",
                  yearly
                    ? "bg-white/20 text-white"
                    : "bg-emerald-500/10 text-emerald-600",
                )}
              >
                -15%
              </span>
            </button>
          </div>
        }
      />

      {checkoutError && (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {checkoutError}
        </div>
      )}

      {/* ── Tableau des offres : prix, bouton de paiement et contenu, colonne par colonne ── */}
      <PlansComparison
        renderHeader={(plan) => {
          const price = yearly ? plan.yearly : plan.monthly;
          const actuelle = estActuelle(plan);
          return (
            <div className="flex h-full flex-col items-center gap-1 text-center">
              {actuelle ? (
                <span className="mb-1 inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-emerald-600 px-2.5 py-0.5 text-[11px] font-semibold text-white">
                  <Check className="h-3 w-3" /> Votre formule
                </span>
              ) : plan.badge ? (
                <span className="mb-1 inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-brand px-2.5 py-0.5 text-[11px] font-semibold text-white">
                  <Sparkles className="h-3 w-3" /> {plan.badge}
                </span>
              ) : (
                <span className="mb-1 h-[22px]" />
              )}
              <span className="text-lg font-bold text-blue-primary">{plan.name}</span>
              <span className="text-xs font-normal text-ink-muted">{plan.tagline}</span>
              <span className="mt-2 text-3xl font-extrabold tracking-tight text-blue-primary">{price} €</span>
              <span className="text-[11px] font-normal text-ink-subtle">
                HT / utilisateur / mois
                <br />
                {plan.free ? "Gratuit, sans engagement" : yearly ? "Facturé annuellement" : "Facturé mensuellement"}
              </span>
              <Button
                variant={plan.highlight ? "default" : "outline"}
                disabled={checkoutLoadingPlan === plan.name || actuelle}
                className={cn(
                  "mt-3 w-full",
                  plan.highlight
                    ? "bg-blue-primary text-white hover:bg-blue-primary/90"
                    : "border-blue-primary text-blue-primary hover:bg-brand-light",
                )}
                onClick={() => {
                  if (plan.free) {
                    // Offre gratuite : il suffit de créer un compte.
                    ouvrirInscription("/dashboard");
                    navigate("/dashboard");
                  } else {
                    handlePlanSelect(plan);
                  }
                }}
              >
                {actuelle ? "Formule actuelle" : checkoutLoadingPlan === plan.name ? "Redirection…" : plan.cta}
              </Button>
            </div>
          );
        }}
      />

      <div className="mt-4">
        <span className="text-3xl font-bold tracking-tight text-blue-primary ">
          Sur devis
        </span>
        <p className="mt-1 text-sm text-ink-muted">
          Tarification adaptée à votre organisation
        </p>
      </div>

      {/* ── Offre Enterprise : bandeau pleine largeur ── */}
      {PLANS.filter((plan) => plan.contactOnly).map((plan) => {
        const heading = plan.features.find((f) => {
          const clean = f.trim().toLowerCase();
          return clean.endsWith("plus :") || clean.endsWith("inclus :");
        });

        const listFeatures = plan.features.filter((f) => f !== heading);

        return (
          <div
            key={plan.name}
            className="bg-white mt-2 rounded-2xl border border-brand/20 p-6 shadow-sm transition-shadow hover:shadow-[0_18px_40px_-18px_rgba(44,58,94,0.35)] px-12"
          >
            {/* Utilisation d'une grille 3 colonnes sur grands écrans avec un gap-x-8 uniforme */}
            <div className="grid grid-cols-1 gap-y-8 lg:grid-cols-3 lg:items-start ">

              {/* Colonne 1 : Infos & CTA */}
              <div className="lg:col-span-1 ">
                <span className="text-xs font-semibold uppercase tracking-wide text-blue-title-card-sub">
                  sur mesure :
                </span>
                <h3 className="mt-2 text-xl font-bold text-ink">{plan.name}</h3>
                <p className="mt-1 text-sm text-ink-muted">{plan.tagline}</p>
                <Button
                  className="mt-5 w-full bg-brand text-white shadow-sm hover:bg-brand-hover sm:w-auto"
                  onClick={() => {
                    window.location.href = "mailto:contact@lumenjuris.com";
                  }}
                >
                  {plan.cta}
                </Button>
              </div>

              {/* Colonnes 2 et 3 : Fonctionnalités */}
              <div className="lg:col-span-2">
                {heading && (
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-blue-title-card-sub">
                    {heading}
                  </p>
                )}

                {/* Grille interne à 2 colonnes réutilisant exactement le même gap-x-8 */}
                <ul className="grid grid-cols-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
                  {listFeatures.map((f, i) => (
                    <li key={`${plan.name}-${i}`} className="flex items-start gap-2.5">
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-card-sub text-blue-primary">
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                      <span className="text-ink-secondary">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

            </div>
          </div>
        );
      })}


      {/* ── FAQ ── */}
      <div className="flex flex-col mb-2 mt-6">
        <h3 className="text-3xl font-bold tracking-tight text-blue-primary">Questions fréquentes</h3>
        <p className="mt-1 text-sm text-ink-muted">Vos questions les plus posées</p>
      </div>
      <div className="mt-2 grid gap-4 md:grid-cols-2">
        {[
          {
            q: "Puis-je changer d'offre à tout moment ?",
            a: "Oui. Le changement prend effet immédiatement. Chaque période payée vous engage jusqu'à son terme : le mois en cours pour un abonnement mensuel, l'année en cours pour un abonnement annuel. Vous pouvez arrêter ou changer d'offre pour la période suivante, sans frais.",
          },
          {
            q: "Mes données sont-elles hébergées en France ?",
            a: "Oui, l'ensemble des données est hébergé en France et conforme au RGPD.",
          },
          {
            q: "Proposez-vous une période d'essai ?",
            a: "L'offre Free vous permet d'essayer l'outil gratuitement, sans limite de durée. Une offre payante souscrite engage pour la période en cours, qui n'est pas remboursée en cas d'arrêt, sauf erreur de facturation justifiée.",
          },
          {
            q: "Comment fonctionne la facturation annuelle ?",
            a: "Vous économisez 15 % en réglant l'année en une fois. Une facture est émise automatiquement.",
          },
        ].map((item) => (
          <div
            key={item.q}
            className="rounded-xl border border-line bg-white p-5 transition-colors hover:border-brand/30"
          >
            <div className="font-semibold text-ink">{item.q}</div>
            <p className="mt-1 text-sm text-ink-muted">{item.a}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Comparatif des formules ─────────────────────────────────────────────────

type Cell = string | boolean;

const COMPARISON: { group: string; rows: { label: string; hint?: string; values: [Cell, Cell, Cell] }[] }[] = [
  {
    group: "Contrathèque",
    rows: [
      { label: "Contrats suivis", hint: "Import, contrats et échéances", values: ["15", "300", "1 200"] },
    ],
  },
  {
    group: "Génération de contrats",
    rows: [
      { label: "Création de zéro", values: ["5 / mois", "30 / mois", "Illimitée"] },
      { label: "Import de modèle", values: ["10 / mois", "60 / mois", "150 / mois"] },
      { label: "Bibliothèque de modèles", values: [false, "Illimitée", "Illimitée"] },
    ],
  },
  {
    group: "Collaboration",
    rows: [
      { label: "Négociation", values: ["Illimitée", "Illimitée", "Illimitée"] },
      { label: "Bibliothèque de clauses", values: ["Illimitée", "Illimitée", "Illimitée"] },
      { label: "Chat juridique", values: [false, "Illimité", "Illimité"] },
    ],
  },
  {
    group: "Analyse",
    rows: [
      { label: "Analyse des risques", values: ["3 / mois", "30 / mois", "100 / mois"] },
      { label: "Comprendre ses contrats", values: ["15 / mois", "50 / mois", "50 / mois"] },
      { label: "Analyse playbook", values: ["5 / mois", "60 / mois", "120 / mois"] },
    ],
  },
];

function ComparisonCell({ value, highlight }: { value: Cell; highlight: boolean }) {
  if (value === false || value === true) {
    return <span className="text-ink-subtle" aria-label="Non inclus">—</span>;
  }
  const unlimited = /^illimit/i.test(value);
  return (
    <span
      className={cn(
        "inline-flex min-w-[88px] justify-center rounded-full px-3 py-1 text-[13px] font-semibold",
        unlimited
          ? highlight ? "bg-blue-primary text-white" : "bg-brand-light text-blue-primary"
          : highlight ? "text-blue-primary" : "text-ink",
      )}
    >
      {value}
    </span>
  );
}

/**
 * Tableau des offres : en tête de chaque colonne le prix et le bouton de paiement
 * de la formule, puis une ligne par fonctionnalité. Les colonnes suivent l'ordre
 * de PLANS (Free, Starter, Pro) comme les valeurs de COMPARISON.
 */
function PlansComparison({ renderHeader }: { renderHeader: (plan: Plan) => React.ReactNode }) {
  const plans = PLANS.filter((plan) => !plan.contactOnly);
  return (
    <section className="mt-8 overflow-x-auto">
      <table className="w-full min-w-[720px] table-fixed border-separate border-spacing-0 text-sm">
        <colgroup>
          <col />
          {plans.map((plan) => <col key={plan.name} className="w-[23%]" />)}
        </colgroup>
        <thead>
          <tr className="align-top">
            <th className="px-2 pb-6 pt-6 text-left align-bottom font-normal">
              <p className="text-2xl font-bold leading-tight tracking-tight text-blue-primary">
                Le juridique de votre entreprise, sous contrôle
              </p>
              <p className="mt-2 text-sm text-ink-muted">
                Commencez gratuitement, puis passez à la formule qui suit votre activité.
              </p>
              <ul className="mt-4 space-y-2 text-sm text-ink-secondary">
                {["Données hébergées en France (RGPD)", "Changement de formule à tout moment", "Paiement sécurisé par Stripe"].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-card-sub text-blue-primary">
                      <Check className="h-2.5 w-2.5" strokeWidth={3} />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </th>
            {plans.map((plan) => (
              <th
                key={plan.name}
                className={cn(
                  "px-4 pb-6 pt-6 font-normal",
                  plan.highlight
                    ? "rounded-t-3xl bg-gradient-to-b from-brand-light to-blue-card-sub/40 ring-1 ring-brand/20"
                    : "",
                )}
              >
                {renderHeader(plan)}
              </th>
            ))}
          </tr>
        </thead>
        {COMPARISON.map(({ group, rows }, groupIndex) => (
          <tbody key={group}>
            <tr>
              <td className="px-2 pb-2 pt-7 text-[11px] font-bold uppercase tracking-[0.12em] text-blue-title-card-sub">{group}</td>
              {plans.map((plan) => (
                <td key={plan.name} className={cn(plan.highlight && "bg-blue-card-sub/40")} />
              ))}
            </tr>
            {rows.map((row, rowIndex) => {
              const last = groupIndex === COMPARISON.length - 1 && rowIndex === rows.length - 1;
              return (
                <tr key={row.label} className="group/row">
                  <td className="rounded-l-xl px-2 py-3 text-ink-secondary transition-colors group-hover/row:bg-surface-subtle">
                    <span className="font-medium text-ink">{row.label}</span>
                    {row.hint && <span className="block text-xs text-ink-muted">{row.hint}</span>}
                  </td>
                  {row.values.map((value, i) => (
                    <td
                      key={i}
                      className={cn(
                        "px-4 py-3 text-center transition-colors",
                        plans[i]?.highlight ? "bg-blue-card-sub/40" : "group-hover/row:bg-surface-subtle",
                        plans[i]?.highlight && last && "rounded-b-3xl pb-6",
                      )}
                    >
                      <ComparisonCell value={value} highlight={Boolean(plans[i]?.highlight)} />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        ))}
      </table>
    </section>
  );
}
