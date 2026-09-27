# Charte graphique — Lumen Juris

Référence unique du design system pour tout travail UI. Objectif : ne plus avoir
à re-parcourir le code pour retrouver couleurs, polices, rayons et conventions.

> **Source de vérité technique** : [`front/tailwind.config.js`](../front/tailwind.config.js)
> et [`front/src/index.css`](../front/src/index.css). Ce document en est le résumé
> lisible ; en cas de doute, le `tailwind.config.js` fait foi.

---

## 1. Identité

Lumen Juris est une **legalTech** : rédaction,
négociation, signature et analyse de risques des contrats. Le ton visuel est
**sérieux, éditorial et rassurant** — un outil juridique de confiance, pas un SaaS
tape-à-l'œil. Navy profond + un filet doré discret comme signe de qualité.

**Logo** : composant [`LumenJurisLogo`](../front/src/components/common/LumenJurisLogo.tsx)
(`variant="light"` sur fond clair, `variant="dark"` sur fond sombre). La marque =
un anneau/point bleu (`#2563EB`) + le mot-symbole. Ne jamais recréer le logo à la
main, toujours passer par le composant.

---

## 2. Couleurs

### Marque (navy)
| Rôle | Hex | Token Tailwind |
|---|---|---|
| Navy principal (CTA, icônes) | `#2C3A5E` | `brand` / `primary` / `lumenjuris` |
| Navy hover | `#24304d` | `brand-hover` |
| Navy actif | `#1a2238` | `brand-active` / `lumenjuris-dark` |
| Navy clair (fond de survol, pastilles) | `#eef1fa` | `brand-light` |
| Navy sidebar (fond du menu latéral) | `#213957` | `blue-primary` |
| Navy logo texte (fond clair) | `#0A2540` | — |

> ⚠️ Deux navy coexistent : `#2C3A5E` (`brand`, éléments d'action) et `#213957`
> (`blue-primary`, **fond du menu latéral uniquement**). Ne pas les confondre.

### Accent doré (signature « qualité »)
| Rôle | Valeur |
|---|---|
| Filet / halo doré (hero, cartes premium) | `#D6B266` / `rgba(214,178,102,…)` |

Usage **parcimonieux** : un filet fin en haut d'une carte sombre, un halo radial
très dilué. Jamais en aplat, jamais sur du texte courant.

### Bleu marque (logo / liens / info)
| Rôle | Hex |
|---|---|
| Bleu logo & accent | `#2563EB` |
| Bleu info sémantique | `#2563eb` (`info`) |

### Surfaces & bordures
| Rôle | Hex | Token |
|---|---|---|
| Fond page / surface de base | `#ffffff` | `surface` |
| Surface légère (survol, skeleton) | `#f4f6fa` | `surface-subtle` / `lumenjuris-background` |
| Surface atténuée | `#eaecf2` | `surface-muted` |
| Bordure standard | `#e5e7eb` | `line` |
| Bordure discrète (séparateurs de cartes) | `#f1f3f7` | `line-subtle` |
| Bordure de carte (accueil) | `#e8ebf3` | — |

### Encre (texte)
| Rôle | Hex | Token |
|---|---|---|
| Texte principal | `#111827` | `ink` |
| Texte secondaire | `#374151` | `ink-secondary` |
| Texte atténué (descriptions) | `#6b7280` | `ink-muted` |
| Texte discret (légendes) | `#9ca3af` | `ink-subtle` |
| Texte sur fond sombre | `#ffffff` | `ink-inverse` |

### Sémantiques (light / DEFAULT / dark)
| Intention | Light | DEFAULT | Dark |
|---|---|---|---|
| `success` | `#d1fae5` | `#059669` | `#065f46` |
| `warning` | `#fef3c7` | `#d97706` | `#92400e` |
| `danger` | `#fee2e2` | `#dc2626` | `#991b1b` |
| `info` | `#dbeafe` | `#2563eb` | `#1e40af` |

### Niveaux de risque (surlignement contrats)
Faible (risk 1-2) → vert `#22c55e` · Moyen (risk 3) → ambre `#f59e0b` ·
Élevé (risk 4-5) → rouge `#ef4444`. Voir `.ultra-highlight` dans `index.css`.

---

## 3. Typographie

| Usage | Police | Classe | Import |
|---|---|---|---|
| Corps de texte, UI | **Inter Variable** | `font-sans` (défaut) | `@fontsource-variable/inter` |
| Titres éditoriaux (salutations, titres de cartes) | **Newsreader** (serif) | `font-serif` | Google Fonts |
| Mode dyslexie | Lexend / Atkinson Hyperlegible / OpenDyslexic | `.dyslexic-font` | Google Fonts |

**Règle** : les grands titres de section et les salutations passent en `font-serif`
(Newsreader), en `font-normal` (pas de gras) pour le côté éditorial. Tout le reste
est en Inter. Les *eyebrows* (sur-titres) sont en majuscules, `tracking` large,
petit, `ink-subtle`.

Taille custom : `text-2xs` = 10px (pastilles, eyebrows).

---

## 4. Rayons, ombres, espacements

### Rayons (`borderRadius`)
| Token | Valeur | Usage |
|---|---|---|
| `rounded-card` | 16px | cartes |
| `rounded-panel` | 12px | panneaux internes |
| `rounded-chip` | 6px | badges compacts |
| *(accueil)* | 20–24px | grandes cartes de section / hero |

Boutons : `rounded-md`. Pastilles KPI / CTA arrondis : `rounded-full`.

### Ombres (`boxShadow`)
| Token | Usage |
|---|---|
| `shadow-card` | carte au repos (très légère) |
| `shadow-card-md` | carte survolée / élevée |
| `shadow-panel` | panneau avec anneau 1px |
| `shadow-ring-brand` | anneau de focus navy |

Style d'ombre maison : **diffuse et basse** (ex. `0 18px 40px -28px rgba(16,24,40,0.35)`),
jamais dure. On privilégie la profondeur douce à la bordure marquée.

---

## 5. Composants & patterns de référence

| Pattern | Fichier | À réutiliser pour |
|---|---|---|
| Coquille de carte de section (eyebrow + titre serif) | [`SectionCard`](../front/src/components/DashboardComponents/home/SectionCard.tsx) | tout bloc de contenu du dashboard |
| Squelette de chargement | `SectionSkeleton` (même fichier) | état loading |
| Hero navy dégradé + filet doré + halos | [`HeroHeader`](../front/src/components/DashboardComponents/home/HeroHeader.tsx) | en-têtes premium |
| Grille de modules (tuiles à filets `gap-px`) | [`ModulesSection`](../front/src/components/DashboardComponents/home/ModulesSection.tsx) | listes de fonctionnalités |
| Bloc « aperçu visiteur » (non connecté) | [`GuestPreview`](../front/src/components/DashboardComponents/home/GuestPreview.tsx) | contenus réservés aux comptes |
| Bouton (variants cva) | [`Button`](../front/src/components/ui/Button.tsx) | tous les boutons |
| Carte KPI simple | [`KpiCard`](../front/src/components/ui/kpiCard.tsx) | indicateurs chiffrés |
| Menu latéral (sections CONTRATS / PILOTAGE) | [`MainLayout`](../front/src/components/DashboardComponents/MainLayout.tsx) | navigation |

### Boutons — variants disponibles (`Button.tsx`)
`default` (navy plein), `outline`, `secondary`, `ghost`, `destructive` (rouge doux),
`link`. Tailles : `xs / sm / default / lg / icon…`. Effet maison : les fonds pleins
navy prennent une ombre interne basse au survol (voir `.bg-brand:hover` dans `index.css`).

### Icônes
**lucide-react**, `strokeWidth={1.75}`, taille 4 (16px) dans l'UI. Bibliothèque
secondaire dispo : `react-icons`.

---

## 6. Animations

Bibliothèque : **framer-motion** (déjà installée) + quelques keyframes CSS maison.

Principe : **discrètes et utiles**, jamais gratuites. Répertoire de ce qui existe :
- Flèches `ArrowRight` qui glissent de 2px au survol (`group-hover:translate-x-0.5`).
- Ombre interne basse sur CTA navy au survol.
- `highlightFadeIn` : apparition des surlignements de risque.
- `templateAddedPulse` / `templateAddedFade` : pastille de notification (voir `MainLayout`).
- Halos radiaux fixes (profondeur), pas d'animation permanente en boucle.
- `scroll-behavior: smooth` global.

**À éviter** : animations en boucle infinie sur du contenu de lecture, parallax
lourds, transitions > 300ms sur des éléments d'action.

---

## 7. États connecté / non connecté

L'app suit le modèle **« connexion à la demande »** (branche `featureSmartConnexion`) :
l'accueil et la vitrine sont **publics**, la connexion n'est demandée qu'au moment
d'agir (enregistrer, ouvrir un module).

- Détection : `isGuest` (issu de `useDashboardData` / `authStatus`).
- Ouvrir le panneau d'auth : `useAuthPanelStore` → `ouvrirConnexion()` / `ouvrirInscription()`.
- Différer une navigation protégée : `useDemandeConnexion()` (retient la destination,
  ouvre le panneau, reprend après connexion).
- Pour un visiteur, un bloc de données personnelles affiche un `GuestPreview`
  (description + exemples + CTA « Créer un compte ») plutôt qu'une liste vide.

**Visiteur** = vitrine qui donne envie de s'inscrire. **Connecté** = poste de
travail : actions en attente, échéances, file du jour, raccourcis modules.

---

## 8. Règles d'or

1. **Navy + blanc + un filet doré** : la sobriété est la marque. L'or est un
   assaisonnement, pas un ingrédient.
2. Titres importants en **Newsreader `font-normal`**, corps en **Inter**.
3. Réutiliser `SectionCard` plutôt que recopier les classes d'une carte.
4. Ombres douces et basses, bordures `line-subtle` : profondeur sans dureté.
5. Icônes lucide `strokeWidth 1.75`.
6. Animations légères, jamais en boucle sur du contenu de lecture.
7. Code lisible par un junior : noms de tokens explicites, pas d'astuce obscure.
