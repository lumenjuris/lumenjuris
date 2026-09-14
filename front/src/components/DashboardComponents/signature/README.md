# Module Signature électronique

Module complet de signature électronique : tableau de bord + wizard de
création d'enveloppes (PDF + zones de signature + signataires). Inspiré des
standards DocuSign / Adobe Sign / Yousign.

## Vues

### `SignatureDashboard` — vue par défaut (`/signature`)

- 4 KPIs : Total / En attente / Signés / Brouillons
- Filtre par statut (Tous, Envoyés, Partiellement signés, Signés, Brouillons)
- Liste des enveloppes (nom, cocontractant, date, statut, suppression)
- **Relance manuelle** sur les enveloppes en attente (`SENT`,
  `PARTIALLY_SIGNED`, `EXPIRED`) : bouton « Relancer » → confirmation →
  POST `/api/signature-envelope/resend`. La ligne affiche aussi le délai
  d'attente (« en attente depuis N j », mis en évidence au-delà de 7 jours)
  pour repérer les signatures qui traînent.
- Bouton **"Nouveau contrat"** → ouvre le wizard

### `SignatureWizard` — création d'une enveloppe

L'utilisateur charge un PDF, place des zones de signature/paraphe pour les
deux parties (lui + cocontractant), signe ses propres zones et envoie le
document au cocontractant pour qu'il signe à son tour.

L'envoi par e-mail est branché côté serveur (SMTP via `classMailer`) :
invitation à signer au cocontractant, copie à l'émetteur, confirmation aux
deux parties avec le PDF signé en pièce jointe.

---

## Workflow utilisateur

En interne le wizard a 3 étapes (`prepare` / `place` / `sign`), mais quand le
PDF vient du bouton « Nouveau contrat » (cas normal) l'étape `prepare` est
sautée. Le parcours **visible** est celui décrit par `GUIDE_STEP_LABELS`
(aujourd'hui 3 étapes : placer / signer / envoyer), et c'est ce que
l'utilisateur lit dans le guide : « Étape 1 sur 3 », « Étape 2 sur 3 »…
`GUIDE_STEP_TOTAL` est déduit de ces libellés : ajouter une étape au parcours
se fait en ajoutant un libellé, puis en rattachant les phases concernées à son
numéro dans `getGuideContent`.

```
┌─────────────────┐   ┌──────────────────┐   ┌────────────┐   ┌─────────────┐
│ Document importé│ → │ 1. Placer zones  │ → │ 2. Signer  │ → │ 3. Envoyer  │
└─────────────────┘   └──────────────────┘   └────────────┘   └─────────────┘
   file picker          clic sur le PDF        modale de       destinataire
                                               signature       puis envoi
```

### Guide contextuel de la colonne de gauche

`guide.ts` traduit l'état réel du wizard en une **phase** (`place-self`,
`place-counterparty`, `place-ready`, `sign-self`, `sign-recipient`,
`sign-send`). À chaque phase correspond une seule consigne : étape en cours →
action attendue maintenant → étape suivante.

`GuidePanel.tsx` affiche cette consigne en haut de la colonne de gauche, avec
le bandeau « Étape X sur N » tout en haut (premier point de regard), puis les
blocs secondaires (checklist des zones, options, formulaire destinataire,
boutons d'action) passés en `children`. La colonne est `sticky` : les
instructions restent visibles pendant qu'on descend dans le document.

Conséquence sur l'organisation de l'écran : plus aucun bandeau de consigne
au-dessus du PDF et un en-tête de page réduit à une ligne — le document
occupe le haut de la colonne de droite.

### Préparer (`PrepareStep`) — sauté quand un PDF est déjà fourni

- Drag & drop d'un fichier PDF unique
- Preview du document via `PdfViewer` (mode `preview`)
- Pas de saisie supplémentaire (pas d'email, pas de nom) — focus sur le
  document. Les signataires sont pré-définis ("Vous" + "Cocontractant").

### Étape 1 — Placer (`PlaceStep` + `PlaceToolbar`)

Layout : guide + checklist à gauche (1/4, sticky) + document à droite (3/4).

**Ouverture sur la dernière page** : `PdfViewer` reçoit `initialPage="last"`.
La signature se trouve en fin de contrat dans la quasi-totalité des cas —
l'utilisateur n'a donc rien à chercher.

**Zones pré-placées** : au chargement du PDF, `SignatureWizard` pose d'emblée
les deux zones en bas de la dernière page (à gauche pour l'émetteur, à droite
pour le cocontractant). Ce sont de vraies zones : déplaçables et supprimables.
Rien n'est imposé, l'utilisateur peut aussi cliquer ailleurs pour en ajouter.

**Overlay de mise en avant** (`PdfViewer`, props `spotlight` / `spotlightLabel`) :
la page est grisée sauf autour des zones concernées, et une étiquette rebondit
au-dessus de chacune. Il ne capte aucun clic.
- placement : toutes les zones, étiquette « Glissez pour déplacer », jusqu'au
  premier déplacement ;
- signature : les zones de l'émetteur non signées, étiquette « Cliquez pour
  signer » — utile si la modale de signature ouverte automatiquement a été
  fermée.

**Mécanique de placement** :
1. Le mode placement est toujours armé sur `signature`
2. Un clic sur le PDF dépose un champ centré sur le clic
3. Dès que la zone de l'émetteur est posée, le signataire actif bascule
   automatiquement sur « Cocontractant »
4. Supprimer une zone rebascule le signataire actif sur la partie concernée

Les champs déposés restent déplaçables et supprimables.

**Options** (`PlaceToolbar`) : case "Toutes les pages" (réplique le champ à la
même position sur chaque page) — utile pour parapher un contrat multi-pages.

**Champs déposés** : draggables (mousedown + mousemove global), supprimables
via une corbeille au survol.

### Étapes 2 et 3 — Signer puis Envoyer (`SignStep` + `SignatureModal`)

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
- Une fois que tous les champs "self" sont signés, un mini-formulaire
  **Destinataires** apparaît : nom + email pour soi-même et pour le
  cocontractant (validation regex permissive `\S+@\S+\.\S+`)
- Le document s'ouvre sur la page de la première zone à signer
- La modale de signature s'ouvre **automatiquement** à l'arrivée sur l'étape :
  la seule action attendue est de signer, inutile de demander un clic sur la
  zone au préalable (le clic reste possible si la modale est fermée)
- Signature validée → `RecipientModal` s'ouvre dans la foulée : le destinataire
  est la dernière information manquante, elle est demandée au centre de l'écran
  plutôt que dans un formulaire de la colonne de gauche. Celle-ci n'affiche
  plus qu'un récapitulatif relisible, avec « Modifier »
- Le guide de gauche évolue seul : signature apposée → coordonnées du
  cocontractant → envoi
- Bouton **"Faire signer et envoyer"** actif uniquement quand :
  - tous les champs self sont signés
  - les 4 champs nom/email sont valides
- À l'envoi : POST `/api/signature-envelope` qui :
  - sauvegarde le PDF dans `backNode/signatureenvelopes/{hex}.pdf`
  - chiffre la liste des champs (positions + signatures dataUrl) en
    AES-256-GCM dans `encryptedFields`
  - crée la ligne Prisma `SignatureEnvelope` avec statut `SENT`
  - envoie l'invitation à signer au cocontractant, avec l'émetteur en copie
- Écran de confirmation après succès, qui rappelle que la relance se fait
  depuis la liste des contrats

---

## Structure de fichiers

```
signature/
├── README.md                  ← ce fichier
├── types.ts                   ← types partagés + helpers (formatSignedDate)
│
├── SignatureDashboard.tsx     ← vue tableau de bord (KPIs + liste)
├── SignatureWizard.tsx        ← wizard 3 étapes (état + appels API)
│
├── guide.ts                   ← phases du parcours + consigne de chaque phase
├── GuidePanel.tsx             ← colonne de gauche (bandeau d'étape + consignes)
├── PrepareStep.tsx            ← dépôt du PDF (sauté le plus souvent)
├── PlaceStep.tsx              ← étape 1 (placement + suggestion)
├── PlaceToolbar.tsx           ← options de l'étape de placement
├── SignStep.tsx               ← étapes 2 et 3 (signature, destinataire, envoi)
├── RecipientModal.tsx         ← modale « À qui envoyer le contrat ? »
├── SignProgress.tsx           ← barre de progression "X/Y signés"
│
├── PdfViewer.tsx              ← viewer react-pdf + click-to-place
├── FieldOverlay.tsx           ← rendu d'un champ (drag, supprimer, signer)
└── SignatureModal.tsx         ← modale de capture (dessiner / saisir)
```

Le point d'entrée est `Signature.tsx` (au niveau parent
`DashboardComponents/`), qui commute entre Dashboard et Wizard et
rafraîchit le dashboard quand une nouvelle enveloppe est créée.

## Backend

Le wizard appelle l'API LumenJuris pour persister les enveloppes :

| Endpoint                                    | Méthode | Rôle                                      |
| ------------------------------------------- | ------- | ----------------------------------------- |
| `/api/signature-envelope/stats`             | GET     | KPIs du dashboard + 5 enveloppes récentes |
| `/api/signature-envelope?status=XXX`        | GET     | Liste filtrée par statut                  |
| `/api/signature-envelope`                   | POST    | Création (PDF + champs + signataires)     |
| `/api/signature-envelope/resend`            | POST    | Relance de l'invitation à signer          |
| `/api/signature-envelope/download/:id`      | GET     | PDF aplati (signatures incrustées)        |
| `/api/signature-envelope/public/:token`         | GET/POST | Page publique du cocontractant (lecture / signature) |
| `/api/signature-envelope/public/:token/download`| GET     | PDF signé remis au cocontractant (sans auth) |
| `/api/signature-envelope/:id`               | DELETE  | Suppression définitive                    |

Côté backend :
- Modèle Prisma `SignatureEnvelope` (statut, signataires, dates,
  `documentFilePath`, `encryptedFields`)
- Service `classSignatureEnvelope.ts` (CRUD + stats agrégées)
- Route Express `apiSignature.ts`
- PDF stockés dans `backNode/signatureenvelopes/{hex}.pdf` (ignoré par git)
- Champs chiffrés AES-256-GCM avec la même clé `CONTRACT_ENCRYPTION_KEY`
  que les modèles de contrat

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

type FieldType = "signature";

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

### Qui est l'expéditeur d'une procédure

`selfName` / `selfEmail` de l'enveloppe sont lus sur le **compte connecté**
(`prisma.user` via `req.idUser`) au moment de la création, puis figés en base.
Toutes les notifications s'appuient dessus :

- le cocontractant voit « envoyé par NOM — email » dans l'invitation ;
- cette adresse est en **copie** (`cc`) de l'invitation et des relances ;
- elle sert de **`replyTo`** : une réponse à l'e-mail arrive chez
  l'utilisateur réel et non sur le `no-reply` de la plateforme ;
- l'e-mail de confirmation liste les deux signataires avec leur adresse.

L'adresse d'envoi technique (`From`) reste celle de la plateforme
(`MAILER_FROM`, par défaut `no-reply@lumenjuris.com`) : c'est le domaine
authentifié SPF/DKIM, on ne peut pas usurper l'adresse de l'utilisateur sans
dégrader la délivrabilité.

### Fin de parcours du cocontractant (`SignerPage`)

Après sa signature, `SignedConfirmation` affiche le récapitulatif (document,
les deux signataires, date) et propose **le téléchargement immédiat du contrat
signé** via `GET /public/:token/download` — le PDF y est aplati à la volée,
comme pour le téléchargement authentifié. Le cocontractant n'a pas de compte
sur la plateforme : c'est le seul moment où on peut lui remettre le document
sans dépendre de l'e-mail de confirmation. La route est réservée aux
enveloppes au statut `SIGNED` (409 sinon).
