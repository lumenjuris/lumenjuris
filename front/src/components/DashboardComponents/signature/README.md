# Module Signature électronique

Wizard de signature électronique d'un contrat PDF, inspiré des standards
DocuSign / Adobe Sign / Yousign.

L'utilisateur charge un PDF, place des zones de signature/paraphe pour les
deux parties (lui + cocontractant), signe ses propres zones et envoie le
document au cocontractant pour qu'il signe à son tour.

> ℹ️ L'envoi par email n'est pas branché côté serveur — c'est une UI
> pleinement fonctionnelle côté front, prête à être connectée à un service
> de e-signature (Yousign API, DocuSign API, etc.).

---

## Workflow utilisateur (3 étapes)

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ 1. Préparer │ →  │  2. Placer  │ →  │  3. Signer  │
└─────────────┘    └─────────────┘    └─────────────┘
   Upload PDF        Zones DnD          Sign + Send
```

### 1. Préparer (`PrepareStep`)

- Drag & drop d'un fichier PDF unique
- Preview du document via `PdfViewer` (mode `preview`)
- Pas de saisie supplémentaire (pas d'email, pas de nom) — focus sur le
  document. Les signataires sont pré-définis ("Vous" + "Cocontractant").

### 2. Placer (`PlaceStep` + `PlaceToolbar`)

Layout : toolbar à gauche (1/4) + viewer à droite (3/4).

**Toolbar** :
- Choix du signataire (Vous / Cocontractant) → définit la couleur du
  prochain champ
- Choix du type de champ : `Signature` ou `Paraphe`
- Option "Toutes les pages" (réplique le champ à la même position sur
  chaque page) — utile pour parapher un contrat multi-pages

**Mécanique de placement** :
1. L'utilisateur clique sur un type de champ → le mode est **"armé"**
2. Il clique sur le PDF → un champ est déposé centré sur le clic
3. Le mode est **automatiquement désarmé** → pas de placement en cascade

Cette désactivation après chaque dépôt évite les ajouts accidentels et
oblige à un geste explicite pour ajouter un autre champ.

**Champs déposés** : draggables (mousedown + mousemove global), supprimables
via une corbeille au survol.

### 3. Signer (`SignStep` + `SignatureModal`)

- Le viewer passe en mode `sign` : seuls les champs "self" sont cliquables
- Au clic sur un champ vide, la modale `SignatureModal` s'ouvre :
  - **Dessiner** : canvas avec stylo (souris/touch)
  - **Saisir** : tape ton nom → 4 polices cursives (Caveat, Dancing Script,
    Great Vibes, Satisfy) rendues sur canvas pour produire une image PNG
- La signature est convertie en data URL PNG et :
  - appliquée au champ cliqué
  - propagée automatiquement aux autres champs vides du même signataire
    et du même type (gain de temps quand on a plusieurs paraphes)
- Une date de signature (`signedAt`, ISO) est attachée à chaque champ
  signé et affichée en petit sous l'image de signature ("Signé le JJ/MM/AAAA")
- Bouton **"Envoyer au cocontractant"** activé quand tous les champs "self"
  sont remplis → écran de confirmation factice (pas d'envoi réel)

---

## Structure de fichiers

```
signature/
├── README.md              ← ce fichier
├── types.ts               ← types partagés + helpers (formatSignedDate)
│
├── Stepper.tsx            ← indicateur 3 étapes
├── PrepareStep.tsx        ← étape 1
├── PlaceStep.tsx          ← étape 2 (orchestrateur)
├── PlaceToolbar.tsx       ← sidebar de l'étape 2
├── SignStep.tsx           ← étape 3 (signature + envoi)
├── SignProgress.tsx       ← barre de progression "X/Y signés"
│
├── PdfViewer.tsx          ← viewer react-pdf + click-to-place
├── FieldOverlay.tsx       ← rendu d'un champ (drag, supprimer, signer)
└── SignatureModal.tsx     ← modale de capture (dessiner / saisir)
```

Le point d'entrée est `Signature.tsx` (au niveau parent
`DashboardComponents/`), qui orchestre toutes les étapes et garde l'état
du wizard.

---

## Modèle de données (voir `types.ts`)

```ts
type SignerRole = "self" | "counterparty";

interface Signer {
  role: SignerRole;
  name: string;     // "Vous" / "Cocontractant"
  color: string;    // nom Tailwind
  hex: string;      // valeur hex pour styles inline
}

type FieldType = "signature" | "initial";

interface Field {
  id: string;
  type: FieldType;
  signer: SignerRole;
  page: number;            // 0-based
  xPct, yPct: number;      // 0..1 — position en % de la page
  widthPct, heightPct: number;
  value?: string;          // dataUrl PNG une fois signé
  signedAt?: string;       // ISO date au moment de la signature
  replicateAllPages?: boolean;
}

interface CapturedSignature {
  type: "drawn" | "typed";
  dataUrl: string;
  text?: string;
  font?: string;
}
```

---

## Choix de design importants

### Coordonnées en pourcentage

Les positions des champs sont stockées en **% de la page** (0..1) et non en
pixels absolus. Bénéfice : le placement reste correct quelle que soit la
largeur de rendu du PDF (responsive, zoom, écrans différents).

### Capture unique par signataire

Quand l'utilisateur signe un champ, on capture une seule fois sa signature
puis on l'**applique automatiquement** à tous ses autres champs vides du
même type. Évite de redessiner sa signature 10 fois sur un contrat à
plusieurs paraphes/signatures.

### Date automatique

Pas de champ "Date" à placer manuellement. Au moment de la signature, la
date du jour est captée dans `signedAt` et affichée en petit sous la
signature ("Signé le 07/06/2026"). C'est la pratique standard sur les
plateformes de e-signature.

### Mode placement "armé/désarmé"

Le mode placement de l'étape 2 est explicitement armé via un bouton de la
toolbar et **désarmé après chaque dépôt**. Ça évite les clics accidentels
qui ajouteraient des champs en cascade.

### Worker PDF.js via CDN

`pdf.worker.min.js` est chargé depuis cdnjs (configuration dans
`PdfViewer.tsx`). Évite la configuration custom de Vite pour le bundle du
worker tout en gardant un déploiement simple.

---

## Limitations actuelles / TODO

- **Envoi par email** : actuellement un écran de confirmation factice.
  Brancher Yousign / DocuSign / API maison.
- **Persistance** : l'état du wizard est uniquement en mémoire React.
  À sauvegarder côté backend si on veut reprendre une enveloppe en cours.
- **Redimensionnement des champs** : drag uniquement, pas de poignées de
  resize. Les tailles par défaut (`DEFAULT_SIZES` dans PdfViewer.tsx)
  conviennent à la plupart des cas.
- **Validation des champs cocontractant** : on suppose qu'il signera après
  envoi. L'écran de signature côté destinataire n'est pas implémenté
  (reviendrait à monter une page publique avec token).
- **Touch drag des champs** : drag souris uniquement. Le canvas de la
  modale supporte le touch ; les champs eux-mêmes pourraient bénéficier
  d'un support touch en mode mobile.
