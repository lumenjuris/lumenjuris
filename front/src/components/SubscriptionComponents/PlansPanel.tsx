import { useState, useEffect, useCallback, Fragment } from "react";
import { useNavigate } from "react-router-dom";
import {
  Check,
  Sparkles,
  Library,
  FileText,
  Users,
  BarChart3,
  type LucideIcon,
} from "lucide-react";
import { Button } from "../ui/Button";
import { cn } from "../../utils/shadcnUtils/cn";
import { PageBanner } from "../common/PageBanner";

import { useUserStore } from "../../store/userStore";
import { useAuthPanelStore } from "../../store/authPanelStore";
import type { BillingInterval, SubscriptionData } from "../../types/subscriptionData";
import { toCheckoutPlanName, PENDING_CHECKOUT_KEY } from "../../utils/planMapping";
import { fetchProxy } from "../../utils/fetchProxy";

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
 *    L'affichage s'adapte à la largeur : tableau comparatif à partir de `lg`,
 *    cartes empilées (une par offre) en dessous.
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

  // Action du bouton d'une carte d'offre (gratuit -> inscription, payant -> checkout).
  const handlePlanCta = (plan: Plan) => {
    if (plan.free) {
      ouvrirInscription("/dashboard");
      navigate("/dashboard");
    } else {
      handlePlanSelect(plan);
    }
  };

  // Offres comparées dans le tableau / les cartes (Enterprise est à part, en bandeau).
  const comparedPlans = PLANS.filter((plan) => !plan.contactOnly);


  // RETOUR DU JSX


  return (
    <div className="mx-auto w-full max-w-7xl pb-6">
      {/* ── En-tête + toggle mensuel/annuel ── */}
      <PageBanner
        title="Accéder à nos outils"
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

      {/* ── Comparatif des offres ── */}
      {/* Desktop (≥ lg) : tableau ; en dessous : cartes empilées (une par offre). */}
      <PlansTable
        plans={comparedPlans}
        yearly={yearly}
        estActuelle={estActuelle}
        loadingPlan={checkoutLoadingPlan}
        onCta={handlePlanCta}
      />
      <PlansCards
        plans={comparedPlans}
        yearly={yearly}
        estActuelle={estActuelle}
        loadingPlan={checkoutLoadingPlan}
        onCta={handlePlanCta}
      />

      {/* ── Offre Enterprise : bandeau pleine largeur ── */}
      {PLANS.filter((plan) => plan.contactOnly).map((plan) => {
        const heading = plan.features.find((f) => {
          const clean = f.trim().toLowerCase();
          return clean.endsWith("plus :") || clean.endsWith("inclus :");
        });
        const listFeatures = plan.features.filter((f) => f !== heading);

        return (
          <section
            key={plan.name}
            className="relative mt-8 overflow-hidden rounded-[18px] border border-brand-muted bg-white p-7 shadow-card sm:px-9"
          >
            {/* Filet doré fin : signe de qualité sur l'offre haut de gamme. */}
            <span className="absolute inset-x-0 top-0 h-[3px] bg-[#D6B266]" />
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_1.6fr] lg:items-start">
              {/* Colonne 1 : identité + CTA */}
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">
                  Sur mesure
                </span>
                <h3 className="mt-2 font-serif text-2xl font-normal text-ink">{plan.name}</h3>
                <p className="mt-1 text-sm text-ink-muted">{plan.tagline}</p>
                <Button
                  className="mt-4 bg-brand text-white shadow-sm hover:bg-brand-hover"
                  onClick={() => {
                    window.location.href = "mailto:contact@lumenjuris.com";
                  }}
                >
                  {plan.cta}
                </Button>
              </div>

              {/* Colonne 2 : fonctionnalités */}
              <div>
                {heading && (
                  <p className="mb-3.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">
                    {heading}
                  </p>
                )}
                <ul className="grid grid-cols-1 gap-x-7 gap-y-3 sm:grid-cols-2">
                  {listFeatures.map((f, i) => (
                    <li key={`${plan.name}-${i}`} className="flex items-start gap-2.5 text-sm text-ink-secondary">
                      <span className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-brand-light text-blue-primary">
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
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

/** Une ligne de comparaison : un libellé et sa valeur pour chaque offre (Free, Starter, Pro). */
type ComparisonRow = { label: string; hint?: string; values: [Cell, Cell, Cell] };

/** Un groupe de fonctionnalités, avec son icône de section. */
type ComparisonGroup = { group: string; icon: LucideIcon; rows: ComparisonRow[] };

const COMPARISON: ComparisonGroup[] = [
  {
    group: "Contrathèque",
    icon: Library,
    rows: [
      { label: "Contrats suivis", hint: "Import, contrats et échéances", values: ["15", "300", "1 200"] },
    ],
  },
  {
    group: "Génération de contrats",
    icon: FileText,
    rows: [
      { label: "Création de zéro", values: ["5 / mois", "30 / mois", "100 / mois"] },
      { label: "Import de modèle", values: ["10 / mois", "60 / mois", "150 / mois"] },
      { label: "Bibliothèque de modèles", values: [false, "Illimitée", "Illimitée"] },
    ],
  },
  {
    group: "Collaboration",
    icon: Users,
    rows: [
      { label: "Négociation", values: ["Illimitée", "Illimitée", "Illimitée"] },
      { label: "Bibliothèque de clauses", values: ["Illimitée", "Illimitée", "Illimitée"] },
      { label: "Chat juridique", values: [false, "Illimité", "Illimité"] },
    ],
  },
  {
    group: "Analyse",
    icon: BarChart3,
    rows: [
      { label: "Analyse des risques", values: ["3 / mois", "30 / mois", "100 / mois"] },
      { label: "Comprendre ses contrats", values: ["15 / mois", "50 / mois", "500 / mois"] },
      { label: "Analyse playbook", values: ["5 / mois", "60 / mois", "120 / mois"] },
    ],
  },
];

type ComparisonProps = {
  plans: Plan[];
  yearly: boolean;
  estActuelle: (plan: Plan) => boolean;
  loadingPlan: string | null;
  onCta: (plan: Plan) => void;
};

/**
 * Affiche la valeur d'une fonctionnalité pour une offre :
 *  - `false` -> non inclus (tiret discret) ;
 *  - "Illimité(e)" -> pastille (navy plein sur la colonne Pro pour ressortir du
 *    fond teinté, navy clair ailleurs) ;
 *  - une valeur chiffrée "N / mois" -> nombre en gras + unité atténuée.
 */
function ComparisonValue({ value, isPro }: { value: Cell; isPro: boolean }) {
  if (value === false || value === true) {
    return (
      <span className="text-ink-subtle" aria-label="Non inclus">
        —
      </span>
    );
  }
  if (/^illimit/i.test(value)) {
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-full px-3 py-1 text-[12.5px] font-semibold",
          isPro ? "bg-blue-primary text-white" : "bg-brand-light text-blue-primary",
        )}
      >
        {value}
      </span>
    );
  }
  const [count, ...unit] = value.split(" / ");
  if (unit.length > 0) {
    return (
      <span>
        <span className="font-semibold text-ink tabular-nums">{count}</span>{" "}
        <span className="text-ink-muted">/ {unit.join(" / ")}</span>
      </span>
    );
  }
  return <span className="font-semibold text-ink tabular-nums">{value}</span>;
}

/** Pastille au-dessus d'une carte d'offre : formule actuelle, ou badge « populaire ». */
function PlanBadge({ plan, actuelle, center }: { plan: Plan; actuelle: boolean; center?: boolean }) {
  // Hauteur réservée même sans badge, pour aligner le nom des offres entre elles.
  return (
    <div className={cn("flex min-h-[22px] items-center", center && "justify-center")}>
      {actuelle ? (
        <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-emerald-600 px-2.5 py-0.5 text-[11px] font-semibold text-white">
          <Check className="h-3 w-3" /> Votre formule
        </span>
      ) : plan.badge ? (
        <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-brand px-2.5 py-0.5 text-[11px] font-semibold text-white">
          <Sparkles className="h-3 w-3" /> {plan.badge}
        </span>
      ) : null}
    </div>
  );
}

/**
 * En-tête d'une offre : badge, nom, prix et bouton. Format compact facon colonne
 * SaaS classique (prix sur une ligne en baseline, note condensée). Partagé entre
 * le tableau (centré) et les cartes mobile (aligné à gauche).
 */
function PlanHeaderBlock({
  plan,
  yearly,
  actuelle,
  loading,
  onCta,
  center,
}: {
  plan: Plan;
  yearly: boolean;
  actuelle: boolean;
  loading: boolean;
  onCta: () => void;
  center?: boolean;
}) {
  const price = yearly ? plan.yearly : plan.monthly;
  return (
    <div className={cn("flex h-full flex-col", center ? "items-center text-center" : "items-start text-left")}>
      <PlanBadge plan={plan} actuelle={actuelle} center={center} />

      <h3 className="mt-2 text-[17px] font-semibold leading-tight tracking-tight text-brand">
        {plan.name}
      </h3>
      <p className="mt-0.5 text-xs leading-snug text-ink-muted">{plan.tagline}</p>

      {/* Prix sur une ligne : montant + devise + périodicité */}
      <div className={cn("mt-3 flex items-baseline gap-1", center && "justify-center")}>
        <span className="text-[32px] font-bold leading-none tracking-tight text-ink tabular-nums">
          {price}
        </span>
        <span className="text-lg font-semibold text-ink">€</span>
        {!plan.free && <span className="text-sm text-ink-muted">/ mois</span>}
      </div>
      <p className="mt-1 text-[11px] leading-snug text-ink-subtle">
        {plan.free
          ? "Gratuit, sans engagement"
          : `HT / utilisateur · ${yearly ? "facturé annuellement" : "facturé mensuellement"}`}
      </p>

      {/* Pousse le CTA en bas : les boutons restent alignés même si une tagline
          ou la note passe sur deux lignes dans une seule colonne. */}
      <div className="mt-4 flex-1" />

      <Button
        variant={plan.highlight ? "default" : "outline"}
        disabled={loading || actuelle}
        className={cn(
          "h-10 w-full text-sm",
          plan.highlight
            ? "bg-blue-primary text-white hover:bg-blue-primary/90"
            : "border-blue-primary text-blue-primary hover:bg-brand-light",
        )}
        onClick={onCta}
      >
        {actuelle ? "Formule actuelle" : loading ? "Redirection…" : plan.cta}
      </Button>
    </div>
  );
}

// Colonnes de la grille : libellés (étroit) + 3 offres de largeur égale.
const GRID_COLS =
  "grid-cols-[minmax(130px,0.66fr)_repeat(3,minmax(150px,1fr))] gap-x-3.5";

/**
 * Fond d'une colonne d'offre, dessiné en UN seul élément continu derrière la
 * grille : léger dégradé vertical (pour casser l'aspect plat et mono), ombre
 * douce (profondeur) et bordures. La colonne Pro est plus soutenue et surlignée.
 */
function columnPanel(isPro: boolean) {
  return cn(
    "rounded-card shadow-card",
    isPro
      ? "border-2 border-brand-muted bg-gradient-to-b from-brand-light to-[#e2ebfb]"
      : "border border-line bg-gradient-to-b from-white to-surface-subtle",
  );
}

/**
 * Cadre interne (card-in-card) autour du bloc prix/CTA, pour le mettre en valeur.
 * Blanc sur la colonne Pro (ressort du fond bleu), gris clair ailleurs (gris sur
 * blanc, façon carte imbriquée).
 */
function headerFrame(isPro: boolean) {
  return cn(
    "h-full rounded-2xl p-5 shadow-sm",
    isPro ? "border border-brand-muted bg-white" : "border border-line bg-surface-subtle",
  );
}

/**
 * Tableau comparatif (≥ lg). Chaque offre est une bande verticale avec son
 * propre fond ; la colonne Pro est surlignée (fond brand-light + liseré) et
 * réagit au survol de ligne comme les autres.
 */
function PlansTable({ plans, yearly, estActuelle, loadingPlan, onCta }: ComparisonProps) {
  return (
    <section className="mt-8 hidden lg:block">
      <div className="relative">
        {/* Couche arrière : le fond de chaque colonne, en un seul bloc continu
            (dégradé + ombre douce), aligné sur la grille via le même gabarit. */}
        <div
          className={cn("pointer-events-none absolute inset-0 grid grid-rows-1", GRID_COLS)}
          aria-hidden="true"
        >
          <div />
          {plans.map((plan) => (
            <div key={plan.name} className={columnPanel(Boolean(plan.highlight))} />
          ))}
        </div>

        {/* Couche avant : le contenu (transparent, posé sur les fonds). */}
        <div className="relative">
          {/* En-têtes d'offres (prix + bouton) */}
          <div className={cn("grid", GRID_COLS)}>
            <div />
            {plans.map((plan) => (
              <div key={plan.name} className="px-3 pb-4 pt-3">
                <div className={headerFrame(Boolean(plan.highlight))}>
                  <PlanHeaderBlock
                    plan={plan}
                    yearly={yearly}
                    actuelle={estActuelle(plan)}
                    loading={loadingPlan === plan.name}
                    onCta={() => onCta(plan)}
                    center
                  />
                </div>
              </div>
            ))}
          </div>

          {COMPARISON.map((group) => (
            <Fragment key={group.group}>
              {/* Intertitre de groupe */}
              <div className={cn("grid", GRID_COLS)}>
                <div className="flex items-center gap-2 px-0.5 pb-2 pt-4 text-[11px] font-bold uppercase tracking-[0.11em] text-blue-title-card-sub">
                  <group.icon className="h-[15px] w-[15px] opacity-80" strokeWidth={1.75} />
                  {group.group}
                </div>
                {plans.map((plan) => (
                  <div key={plan.name} className="border-t border-line-subtle" />
                ))}
              </div>

              {/* Lignes de fonctionnalités */}
              {group.rows.map((row) => (
                <div key={row.label} className={cn("grid group/row", GRID_COLS)}>
                  <div className="flex flex-col justify-center rounded-lg border-t border-line-subtle px-0.5 py-2.5 transition-colors group-hover/row:bg-ink/[0.03]">
                    <span className="text-[13.5px] font-medium text-ink">{row.label}</span>
                    {row.hint && <span className="text-[11.5px] text-ink-muted">{row.hint}</span>}
                  </div>
                  {row.values.map((value, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-center border-t border-line-subtle px-2.5 py-2.5 text-center text-sm text-ink-secondary transition-colors group-hover/row:bg-ink/[0.03]"
                    >
                      <ComparisonValue value={value} isPro={Boolean(plans[i]?.highlight)} />
                    </div>
                  ))}
                </div>
              ))}
            </Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * Cartes empilées (< lg) : une carte par offre, avec son prix, son bouton et la
 * liste de ses fonctionnalités groupées. La carte Pro est mise en avant.
 */
function PlansCards({ plans, yearly, estActuelle, loadingPlan, onCta }: ComparisonProps) {
  return (
    <section className="mt-8 flex flex-col gap-4 lg:hidden">
      {plans.map((plan, planIndex) => {
        const isPro = Boolean(plan.highlight);
        return (
          <div
            key={plan.name}
            className={cn(
              "rounded-card p-5 shadow-card",
              isPro
                ? "border-2 border-brand-muted bg-gradient-to-b from-brand-light to-[#e2ebfb]"
                : "border border-line bg-gradient-to-b from-white to-surface-subtle",
            )}
          >
            <div className={headerFrame(isPro)}>
              <PlanHeaderBlock
                plan={plan}
                yearly={yearly}
                actuelle={estActuelle(plan)}
                loading={loadingPlan === plan.name}
                onCta={() => onCta(plan)}
              />
            </div>

            {COMPARISON.map((group) => (
              <div key={group.group}>
                <div className="mt-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.11em] text-blue-title-card-sub">
                  <group.icon className="h-[15px] w-[15px] opacity-80" strokeWidth={1.75} />
                  {group.group}
                </div>
                {group.rows.map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between gap-4 border-t border-line-subtle py-2.5"
                  >
                    <div className="min-w-0">
                      <span className="text-[13.5px] text-ink">{row.label}</span>
                      {row.hint && <span className="block text-[11.5px] text-ink-muted">{row.hint}</span>}
                    </div>
                    <div className="shrink-0 text-right text-sm">
                      <ComparisonValue value={row.values[planIndex]} isPro={isPro} />
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        );
      })}
    </section>
  );
}
