## 1. Ajouter un flux RSS

**Fichier :** `backNode/src/route/apiVeille.ts`

Ajouter une entrée dans le tableau `RSS_FEEDS` :

```ts
const RSS_FEEDS: FeedConfig[] = [
  // ... flux existants ...

  // Flux sans filtre — tous les articles sont envoyés à GPT pour classification
  { url: "https://exemple.fr/rss.xml", label: "Nom affiché" },

  // Flux avec filtre — seuls les articles contenant au moins un keyword sont retenus
  // (à utiliser pour les flux généralistes comme le Sénat, l'AN, Juricaf)
  {
    url: "https://exemple.fr/rss-general.xml",
    label: "Nom affiché",
    filterKeywords: ["travail", "emploi", "salarié"],
  },
];
```

**Règle :** n'utiliser `filterKeywords` que pour les sources généralistes dont le flux mélange tout (parlement, juridictions générales). Pour les sources déjà ciblées RH/travail, laisser sans filtre.

### Flux encodé en ISO-8859-15 (ex : Sénat)

Si le flux renvoie des caractères illisibles, c'est un problème d'encodage. Ajouter l'URL dans le `Set` `ISO_FEEDS` (juste au-dessus de `fetchFeedRaw`) :

```ts
const ISO_FEEDS = new Set([
  "https://www.senat.fr/rss/textes.rss",
  "https://nouvelle-source.fr/feed.rss",  // ← ajouter ici
]);
```

---

## 2. Ajouter ou renommer une catégorie

Trois endroits à modifier en cohérence :

**A. `backNode/src/route/apiVeille.ts`** — déclarer la catégorie et son message d'impact

```ts
export type VeilleTag =
  | "Rupture"
  | "MaNouvelleCategorie"  // ← ajouter ici
  | ...;

const ALL_TAGS: VeilleTag[] = [
  "Rupture",
  "MaNouvelleCategorie",  // ← ajouter ici
  ...
];

const IMPACT_BY_TAG: Record<VeilleTag, string> = {
  "MaNouvelleCategorie": "Message affiché sous chaque article de cette catégorie.",
  ...
};
```

**B. `back/app/main.py`** — l'ajouter dans la liste envoyée à GPT

```python
_VEILLE_TAGS = [
    "Rupture", "Temps de travail", "Rémunération", "Santé/Sécurité",
    "Discipline", "Relations collectives", "Protection sociale", "Recrutement",
    "MaNouvelleCategorie",  # ← ajouter ici
]
```

**C. `front/src/components/DashboardComponents/Veille.tsx`** — affichage et couleur

```ts
type Tag = "Tous" | ... | "MaNouvelleCategorie";

const TAGS: Tag[] = ["Tous", ..., "MaNouvelleCategorie"];

const TAG_COLORS: Record<string, string> = {
  "MaNouvelleCategorie": "bg-pink-100 text-pink-700",
  ...
};
```

---

## 3. Modifier le prompt de classification (GPT-4o-mini)

**Fichier :** `back/app/main.py` — fonction `classify_veille` (~ligne 184)

```python
prompt = (
    f"Tu es un expert RH et droit du travail français.\n"
    f"Classe chaque actualité dans l'une de ces catégories : {tag_list}.\n"
    f"Réponds \"null\" si l'actualité n'est pas directement liée au droit du travail ou aux RH, "
    f"OU si elle ne s'applique pas concrètement à un employeur ou un service RH "
    f"(ex : politique étrangère, défense, environnement, textes sans impact employeur).\n"
    ...
)
```

Exemples de modifications utiles :

- **Être plus strict** : ajouter des exemples de cas à rejeter dans la ligne `OU si elle ne s'applique pas...`
- **Être plus large** : retirer des exclusions
- **Changer le modèle** : modifier `model="gpt-4o-mini"` (ex : `"gpt-4o"` pour plus de précision, plus cher)

Le format de réponse attendu (`1. <catégorie ou null>`) **ne doit pas changer** — le parsing en dépend.

---

## 4. Réglages divers

| Paramètre | Fichier | Valeur actuelle | Effet |
|---|---|---|---|
| Taille d'un batch GPT | `apiVeille.ts` | `BATCH_SIZE = 30` | Articles envoyés par appel GPT |
| Nombre max d'articles renvoyés | `apiVeille.ts` | `.slice(0, 120)` | Limite finale après classification |
| Durée du cache | `apiVeille.ts` | `CACHE_TTL_MS = 30 * 60 * 1000` | 30 min — forcer le refresh avec `?nocache=1` |
| Longueur de la description envoyée à GPT | `apiVeille.ts` | `.slice(0, 400)` | Tronque la description avant classification |

---













## 5. Liste de flux a titre indicatif

Quelques flux identifiés pour suivre l'évolution du droit du travail.

---


## Legifrss — miroir RSS de Légifrance
https://legifrss.org/latest

Légifrance, le site officiel des textes de loi français, ne propose pas de flux RSS nativement. Legifrss est un outil open source non officiel qui comble ce manque. Il renvoie les mêmes données.

Filtrage par URL. On peut construire exactement le flux dont on a besoin :

```
# Toutes les nouvelles lois
https://legifrss.org/latest?nature=loi

# Lois qui mentionnent "salarié"
https://legifrss.org/latest?nature=loi&q=salarié

# Lois qui mentionnent "emploi"
https://legifrss.org/latest?nature=loi&q=emploi
```

Le paramètre `nature=` accepte aussi `decret`, `ordonnance`, etc. Le paramètre `q=` filtre par mot-clé dans le titre du texte.

---

## Sénat — derniers textes
https://www.senat.fr/rss/textes.rss

Flux officiel du Sénat. Il liste les propositions de loi, projets et rapports au fil de leur dépôt ou adoption. Couvre toutes les matières sans distinction, donc il faut filtrer côté agrégateur avec des mots-clés comme `travail`, `emploi`, `licenciement`, `retraite`, etc.

L'intérêt principal est de repérer les textes en cours d'examen, avant qu'ils ne soient adoptés, utile pour anticiper les évolutions à venir.

---

## Assemblée nationale — documents parlementaires
http://www2.assemblee-nationale.fr/feeds/detail/documents-parlementaires

Même logique que le Sénat, mais pour  l'Assemblée nationale. Volume est plus élevé (projets, propositions, amendements, rapports…). Les deux flux ensemble donnent une vision complète du processus de réforme du droit du travail.

---

## Juricaf — jurisprudence francophone
https://juricaf.org/recherche/+/facet_pays:France?format=rss

Base de jurisprudence gérée par l'association des hautes juridictions de cassation des pays francophones. On affine ses filtres sur le site (pays, juridiction, mots-clés), puis on génère le flux RSS directement depuis le site.

---

## Légavox
https://www.legavox.fr/rss/

Portail juridique communautaire avec un flux dédié au droit du travail. Flux semblant cassé, à surveiller.

---

## Legisocial
https://www.legisocial.fr/

Le seul flux payant de la liste Legisocial est une plateforme spécialisée en droit social : contrats de travail, paie, RH, hygiène et sécurité. Le contenu est rédigé et commenté par des professionnels, c'est ce qui justifie l'abonnement. À voir selon l'usage.

---
