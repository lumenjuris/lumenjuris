import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Sparkles } from "lucide-react";
import { Button } from "../ui/Button";
import { cn } from "../../utils/shadcnUtils/cn";

import { useUserStore } from "../../store/userStore";
import type { BillingInterval } from "../../types/subscriptionData";
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
      "Ce qui est inclus :",
      "Génération de contrats illimitée (export avec filigrane)",
      "Signature électronique simple illimitée",
      "3 analyses de contrat par IA / mois",
      "Négociation collaborative incluse",
      "Actualité juridique incluse",
      "Contrathèque : 5 contrats suivis",
    ],
  },
  {
    name: "Starter",
    tagline: "PME sans direction juridique",
    monthly: 49,
    yearly: 39,
    cta: "Choisir Starter",
    features: [
      "Tout le Free, plus :",
      "Export des contrats sans filigrane",
      "30 analyses de contrat par IA / mois",
      "Contrats et modèles illimités",
      "Suivi des échéances illimité + alertes (préavis, loi Chatel)",
      "Tableau de bord des renouvellements",
    ],
  },
  {
    name: "Pro",
    tagline: "PME structurée & ETI",
    monthly: 119,
    yearly: 99,
    highlight: true,
    badge: "Le plus populaire",
    cta: "Choisir Pro",
    features: [
      "Tout le Starter, plus :",
      "Analyses de contrat par IA illimitées",
      "Jurisprudence reliée aux clauses analysées",
      "Workflows d'approbation interne",
      "10 signatures avancées eIDAS / mois (via DocuSign)",
      "Intégrations standards",
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
 *    avec un toggle mensuel / annuel (-20 %). "Pro" est mis en avant
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

  const interval: BillingInterval = yearly ? "yearly" : "monthly";

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
    // Non connecté : on mémorise le plan choisi (persistant à travers l'inscription)
    // puis on envoie vers l'inscription. Au retour authentifié, le checkout reprend.
    if (!userData) {
      sessionStorage.setItem(
        PENDING_CHECKOUT_KEY,
        JSON.stringify({ name: plan.name, interval }),
      );
      navigate("/inscription");
      return;
    }
    // Connecté : on lance directement le paiement Stripe Checkout.
    startCheckout(plan.name, interval);
  };


  // RETOUR DU JSX


  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="flex flex-col mb-2">
        <h3 className="text-3xl font-bold tracking-tight text-blue-primary">Tarifs</h3>
        <p className="mt-1 text-sm text-ink-muted">Tarification adaptée à votre organisation</p>
      </div>
      {/* ── En-tête + toggle mensuel/annuel ── */}
      <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end bg-blue-primary py-4 px-8 rounded-2xl">
        <div className="max-w-xl">
          
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Accéder à nos outils
          </h1>
          <p className="mt-2 text-gray-primary">
            Choisissez l'offre adaptée à votre équipe. Changez ou annulez à tout
            moment.
          </p>
        </div>

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
              -20%
            </span>
          </button>
        </div>
      </div>

      {checkoutError && (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {checkoutError}
        </div>
      )}

      {/* ── Grille des 3 offres principales ── */}
      <div className="mt-12 grid items-stretch gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {PLANS.filter((plan) => !plan.contactOnly).map((plan) => {
          const price = yearly ? plan.yearly : plan.monthly;
          return (
            <div
              key={plan.name}
              className={cn(
                "group relative flex h-full flex-col rounded-2xl border p-6 transition-all duration-300",
                plan.highlight
                  ? "z-10 border-brand/30 bg-blue-primary shadow-[0_20px_45px_-15px_rgba(44,58,94,0.45)] ring-1 ring-brand/20 lg:-translate-y-3 lg:scale-[1.03]"
                  : "border-line shadow-sm hover:-translate-y-1 hover:border-brand/30 hover:shadow-[0_18px_40px_-18px_rgba(44,58,94,0.35)]",
              )}
            >
              {/* Liseré supérieur lumineux sur l'offre mise en avant */}
              {plan.highlight && (
                <span className="absolute inset-x-8 top-0 h-1 rounded-full bg-gradient-to-r from-brand/0 via-brand to-brand/0" />
              )}

              {plan.badge && (
                <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full bg-brand px-3 py-1 text-xs font-semibold text-white shadow-md">
                  <Sparkles className="h-3 w-3" />
                  {plan.badge}
                </span>
              )}

              <div>
                <h3 className={cn("text-lg font-bold ", plan.highlight ? "text-white" : "text-blue-primary")}>{plan.name}</h3>
                <p className={cn("mt-1 text-sm", plan.highlight ? "text-gray-primary" : "text-ink-muted")}>{plan.tagline}</p>
              </div>

              <div className="mt-6 flex items-baseline gap-1">
                <span
                  className={cn(
                    "text-4xl font-extrabold tracking-tight",
                    plan.highlight ? "text-white" : "text-blue-primary",
                  )}
                >
                  {price} €
                </span>
                <span className="text-sm text-ink-subtle">
                  HT / utilisateur / mois
                </span>
              </div>
              <p className="mt-1 text-xs text-ink-subtle">
                {plan.free
                  ? "Gratuit, sans engagement"
                  : yearly
                    ? "Facturé annuellement"
                    : "Facturé mensuellement"}
              </p>

              <Button
                variant={plan.highlight ? "default" : "outline"}
                disabled={checkoutLoadingPlan === plan.name}
                className={cn(
                  "mt-6 w-full",
                  plan.highlight
                    ? "bg-white text-blue-primary shadow-sm hover:bg-gray-300"
                    : "border-blue-primary text-blue-primary hover:bg-brand-light",
                )}
                onClick={() => {
                  if (plan.free) {
                    navigate("/inscription");
                  } else {
                    handlePlanSelect(plan);
                  }
                }}
              >
                {checkoutLoadingPlan === plan.name ? "Redirection…" : plan.cta}
              </Button>

              <div className="border border-t-blue-title-card-sub mt-6"></div>

              <ul className="mt-6 space-y-3 text-sm">
                {plan.features.map((f, i) => {
                  const isHeading = f.endsWith("plus :") || f.endsWith("inclus :");
                  if (isHeading) {
                    return (
                      <li
                        key={f}
                        className="pt-1 text-xs font-semibold uppercase tracking-wide text-blue-title-card-sub"
                      >
                        {f}
                      </li>
                    );
                  }
                  return (
                    <li
                      key={`${plan.name}-${i}`}
                      className="flex items-start gap-2.5"
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
                          plan.highlight
                            ? "bg-blue-card-sub text-blue-primary"
                            : "bg-blue-card-sub text-blue-600",
                        )}
                      >
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                      <span className={cn("text-sm", plan.highlight ? "text-white" : "text-blue-primary")}>{f}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      
      <div className="mt-4">
        <span className="text-3xl font-bold tracking-tight text-blue-primary">
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
  className="mt-2 rounded-2xl border border-brand/20 p-6 shadow-sm transition-shadow hover:shadow-[0_18px_40px_-18px_rgba(44,58,94,0.35)] px-12"
>
  {/* Utilisation d'une grille 3 colonnes sur grands écrans avec un gap-x-8 uniforme */}
  <div className="grid grid-cols-1 gap-y-8 lg:grid-cols-3 lg:items-start">
    
    {/* Colonne 1 : Infos & CTA */}
    <div className="lg:col-span-1">
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
            a: "Oui. Le changement est effectif immédiatement et la facturation est ajustée au prorata.",
          },
          {
            q: "Mes données sont-elles hébergées en France ?",
            a: "Oui, l'ensemble des données est hébergé en France et conforme au RGPD.",
          },
          {
            q: "Proposez-vous une période d'essai ?",
            a: "14 jours d'essai gratuits sur l'offre Pro, sans carte bancaire requise.",
          },
          {
            q: "Comment fonctionne la facturation annuelle ?",
            a: "Vous économisez 20 % en réglant l'année en une fois. Une facture est émise automatiquement.",
          },
          {
            q: "La génération de contrats est-elle vraiment gratuite ?",
            a: "Oui, illimitée sur toutes les formules. En Free, l'export porte un filigrane Lumen Juris ; dès Starter, vos documents s'exportent sans filigrane.",
          },
          {
            q: "Pourquoi l'analyse par IA est-elle limitée en Free ?",
            a: "C'est la fonctionnalité la plus coûteuse à opérer (modèles d'IA, jurisprudence). Le Free inclut 3 analyses par mois ; Starter passe à 30, Pro les rend illimitées.",
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
