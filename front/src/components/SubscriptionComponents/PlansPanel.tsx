import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Check, Sparkles } from "lucide-react";
import { Button } from "../ui/Button";
import { cn } from "../../utils/shadcnUtils/cn";

import { useUserStore } from "../../store/userStore";
import { BillingStripePanel } from "./BillingStripePanel";

type BillingInterval = "month" | "year";

type Plan = {
  name: string;
  tagline: string;
  monthly: number;
  yearly: number;
  highlight?: boolean;
  badge?: string;
  features: string[];
  cta: string;
  contactOnly?: boolean;
};

const PLANS: Plan[] = [
  {
    name: "Starter",
    tagline: "Pour les petites équipes RH qui démarrent",
    monthly: 29,
    yearly: 24,
    cta: "Choisir Starter",
    features: [
      "Jusqu'à 10 contrats actifs",
      "Générateur CDI & CDD",
      "Analyse de conformité (5/mois)",
      "Chat juridique RH (50 questions)",
      "Support par email",
    ],
  },
  {
    name: "Pro",
    tagline: "L'essentiel pour piloter votre conformité",
    monthly: 79,
    yearly: 65,
    highlight: true,
    badge: "Le plus populaire",
    cta: "Choisir Pro",
    features: [
      "Contrats illimités",
      "Tous les modèles juridiques",
      "Analyse de conformité illimitée",
      "Chat juridique RH illimité",
      "Calculateur juridique",
      "Veille information temps réel",
      "Support prioritaire",
    ],
  },
  {
    name: "Enterprise",
    tagline: "Pour les organisations exigeantes",
    monthly: 199,
    yearly: 169,
    cta: "Contacter l'équipe",
    contactOnly: true,
    features: [
      "Tout ce qui est inclus dans Pro",
      "Multi-utilisateurs & rôles",
      "API & intégrations SIRH",
      "Signature électronique avancée",
      "Audit de conformité dédié",
      "Account manager dédié",
      "SLA 99,9 %",
    ],
  },
];

type SelectedPlan = {
  name: string;
  price: number;
  interval: BillingInterval;
};

export function PlansPanel() {
  const [yearly, setYearly] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<SelectedPlan | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const userData = useUserStore((s) => s.userData);

  useEffect(() => {
    const state = location.state as { plan?: SelectedPlan } | null;
    if (state?.plan) {
      setSelectedPlan(state.plan);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, []);

  const interval: BillingInterval = yearly ? "year" : "month";

  const handlePlanSelect = (plan: Plan) => {
    if (!userData) {
      const priceEuros = yearly ? plan.yearly : plan.monthly;
      navigate("/inscription", {
        state: {
          plan: { name: plan.name, price: priceEuros * 100, interval },
        },
      });
      return;
    }
    const priceEuros = yearly ? plan.yearly : plan.monthly;
    setSelectedPlan({
      name: plan.name,
      price: priceEuros * 100,
      interval,
    });
  };

  if (paymentSuccess) {
    return (
      <div className="mx-auto max-w-6xl rounded-md bg-white px-4 py-6">
        <div className="flex flex-col items-center rounded-2xl border border-green-200 bg-green-50 px-6 py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
            <Check className="h-7 w-7 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">
            Abonnement activé !
          </h2>
          <p className="mt-2 max-w-sm text-sm text-gray-500">
            Votre paiement a été accepté. Vous avez maintenant accès à toutes
            les fonctionnalités LumenJuris.
          </p>
          <Button
            type="button"
            className="mt-6 bg-lumenjuris text-white hover:bg-lumenjuris/90"
            onClick={() => {
              setPaymentSuccess(false);
              setSelectedPlan(null);
              navigate("/dashboard");
            }}
          >
            Aller sur mon tableau de bord
          </Button>
        </div>
      </div>
    );
  }

  if (selectedPlan) {
    return (
      <div className="mx-auto max-w-lg rounded-md bg-white px-6 py-6">
        <BillingStripePanel
          planName={selectedPlan.name}
          price={selectedPlan.price}
          interval={selectedPlan.interval}
          onBack={() => setSelectedPlan(null)}
          onSuccess={() => setPaymentSuccess(true)}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl rounded-md bg-white px-4 py-6">
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Accéder à nos outils
          </h1>
          <p className="mt-1 text-muted-foreground">
            Choisissez l'offre adaptée à votre équipe. Changez ou annulez à tout
            moment.
          </p>
        </div>
        <div className="inline-flex items-center gap-1 rounded-full border border-border bg-card p-1 text-sm">
          <button
            onClick={() => setYearly(false)}
            className={cn(
              "rounded-full px-4 py-1.5 transition-colors",
              !yearly
                ? "bg-primary text-gray-50"
                : "text-muted_foreground hover:text-gray-700",
            )}
          >
            Mensuel
          </button>
          <button
            onClick={() => setYearly(true)}
            className={cn(
              "flex items-center gap-2 rounded-full px-4 py-1.5 transition-colors",
              yearly
                ? "bg-primary text-gray-50"
                : "text-muted_foreground hover:text-gray-700",
            )}
          >
            Annuel
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                yearly
                  ? "bg-gray-500/50 text-gray-100"
                  : "bg-emerald-500/10 text-emerald-600",
              )}
            >
              -20%
            </span>
          </button>
        </div>
      </div>

      {/* Plans */}
      <div className="mt-8 grid gap-6 md:grid-cols-3">
        {PLANS.map((plan) => {
          const price = yearly ? plan.yearly : plan.monthly;
          return (
            <div
              key={plan.name}
              className={cn(
                "relative flex flex-col rounded-2xl border bg-card p-6 shadow-sm transition-shadow",
                plan.highlight
                  ? "border-primary shadow-lg ring-1 ring-primary/20"
                  : "border-border hover:shadow-md",
              )}
            >
              {plan.badge && (
                <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-gray-50">
                  <Sparkles className="h-3 w-3" />
                  {plan.badge}
                </span>
              )}
              <div>
                <h3 className="text-lg font-semibold">{plan.name}</h3>
                <p className="mt-1 text-sm text-muted_foreground">
                  {plan.tagline}
                </p>
              </div>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-bold tracking-tight">
                  {price} €
                </span>
                <span className="text-sm text-muted-foreground">
                  / utilisateur / mois
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {yearly ? "Facturé annuellement" : "Facturé mensuellement"}
              </p>

              <Button
                variant={plan.highlight ? "default" : "outline"}
                className={`mt-6 w-full ${plan.highlight ? "" : "border-lumenjuris/50 hover:bg-gray-100"}`}
                onClick={() =>
                  plan.contactOnly
                    ? (window.location.href = "mailto:contact@lumenjuris.com")
                    : handlePlanSelect(plan)
                }
              >
                {plan.cta}
              </Button>

              <ul className="mt-6 space-y-3 text-sm">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check
                      className={cn(
                        "mt-0.5 h-4 w-4 shrink-0",
                        plan.highlight ? "text-primary" : "text-emerald-600",
                      )}
                    />
                    <span className="text-foreground/80">{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* FAQ */}
      <div className="mt-10 grid gap-4 md:grid-cols-2">
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
        ].map((item) => (
          <div
            key={item.q}
            className="rounded-xl border border-border bg-card p-5"
          >
            <div className="font-medium">{item.q}</div>
            <p className="mt-1 text-sm text-muted-foreground">{item.a}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
