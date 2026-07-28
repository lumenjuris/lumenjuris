# Négociation de contrat — audit, recherche et spécification cible

Date : 28/07/2026. Périmètre : application Lumen Juris (`lumenjuris/`).
Statut : **proposition à valider** avant mise en œuvre.

---

## 1. Ce qu'est la négociation de contrat

La négociation est la phase entre la rédaction d'un projet de contrat et sa
signature : chaque partie lit le texte de l'autre, marque ses désaccords,
propose des modifications (le « redlining »), argumente, concède, jusqu'à un
texte commun que les deux parties acceptent de signer.

Dans la pratique des outils de gestion contractuelle (CLM), une négociation
efficace repose sur des invariants bien établis :

1. **Un document unique partagé** — pas d'allers-retours de fichiers Word par
   e-mail, où les versions se perdent. Toutes les parties travaillent sur la
   même source, l'historique est automatique.
2. **Le redlining tracé** — chaque proposition de modification est un objet :
   texte d'origine, texte proposé, auteur, statut (proposée / acceptée /
   rejetée / contre-proposée), horodatage.
3. **La séparation interne / externe** — l'équipe interne doit pouvoir
   discuter sa stratégie dans des commentaires que l'autre partie ne voit
   jamais. C'est une exigence critique des juristes.
4. **La contrepartie sans compte** — l'autre partie accède par un lien
   sécurisé, sans créer de compte ni installer quoi que ce soit. Toute
   friction à cet endroit fait échouer l'usage.
5. **Le versionnage et la comparaison** — chaque cycle produit une version ;
   on compare deux versions clause par clause.
6. **La piste d'audit** — qui a changé quoi, quand : indispensable à la
   traçabilité juridique et à la confiance.
7. **La sortie naturelle vers la signature** — la version validée part en
   signature électronique sans re-saisie ni re-téléversement.

Les outils récents ajoutent : bibliothèque de clauses pré-approuvées pour
répondre vite aux points récurrents, suggestions IA de reformulation, et flux
de relance automatique de la contrepartie.

**Distinction importante que la recherche confirme** : les plateformes de
signature (signNow, Juro, DocuSign…) traitent séparément un second parcours,
le « fill and sign » : la contrepartie ne négocie pas le texte, elle **remplit
les champs qui la concernent puis signe** (état civil, adresse, IBAN, dates…).
C'est un parcours guidé, pas un débat sur les clauses. Les conventions de
stage en sont le cas d'école — avec une particularité française : elles sont
souvent **tripartites** (entreprise, stagiaire, établissement d'enseignement),
donc le parcours doit accepter plusieurs contreparties.

---

## 2. Ce qui existe déjà dans Lumen Juris (audit du 28/07/2026)

Le module est bien plus complet que ce que l'interface laisse voir.

### Côté back (`backNode/src/services/negotiation/`, `route/apiNegotiation.ts`)

| Capacité | État | Référence |
|---|---|---|
| Machine à états DRAFT → IN_NEGOTIATION → VALIDATED / BLOCKED → CLOSED | ✅ | `stateMachine.ts` |
| Versions du texte, version finale validée | ✅ | `NegotiationVersion`, seed automatique depuis le contrat |
| Propositions de modification (redlines) avec statuts | ✅ | PROPOSED / ACCEPTED / REJECTED / COUNTERED |
| Commentaires ancrés au texte, visibilité INTERNAL / EXTERNAL | ✅ | `types.ts` |
| Participants internes/externes, 4 rôles (lecture → validation) | ✅ | READER / COMMENTER / PROPOSER / VALIDATOR |
| Liens invités : jeton UUID, durée de vie 24 h à 30 j, révocation | ✅ | `ShareDialog.tsx`, routes `/guests` |
| Piste d'audit complète | ✅ | `audit.ts` |
| Sortie vers la signature par événement `version.validated` | ✅ | `exitToSignature()` |

### Côté front

- Espace de travail complet : document annotable, redlines par clause, diff de
  versions, panneau participants, partage ([NegotiationWorkspace.tsx](lumenjuris/front/src/components/DashboardComponents/negotiation/NegotiationWorkspace.tsx)).
- Page invitée publique `/negociation-invite/:token` : lecture + surlignage
  pour commenter/proposer ([NegotiationGuest.tsx](lumenjuris/front/src/page/NegotiationGuest.tsx)).
- Deux points d'entrée : fiche contrat de la contrathèque, et le menu « ⋯ » de
  l'éditeur de contrat (`goNegotiation()` dans SmartCddEditor enregistre le
  contrat puis ouvre la négociation — le tunnel technique existe).

### Les manques (qui expliquent exactement votre constat)

1. **Invisibilité.** La sidebar (`MainLayout.tsx`, lignes 50-68) liste
   Contrathèque, Générateur, Signature, Clauses, Analyse, Chat, Veille —
   **pas de Négociation**. Il n'existe aucune page listant les négociations
   en cours ; on n'y accède qu'en connaissant le contrat concerné.
2. **Hors du fil de l'expérience.** À la fin d'une génération, « Ouvrir la
   négociation » est enfoui dans un menu secondaire, au même niveau que
   « Télécharger en PDF ». Rien ne dit que l'étape naturelle après la
   rédaction est de partager à l'autre partie avant de signer.
3. **L'invité ne peut pas remplir.** La page invitée permet de *commenter*,
   pas de **compléter des champs**. Le cas convention de stage (le stagiaire
   remplit ses informations puis signe) est impossible aujourd'hui.
4. **Pas d'enchaînement invité → signature.** Rien ne relie le lien invité au
   module signature.
5. **Lien invité anonyme.** Le lien n'est pas rattaché à un nom/e-mail ; pas
   de notification par e-mail à la création ; pas de relance.
6. **Réassurance absente.** La page invitée n'explique ni la sécurité, ni ce
   que l'invité peut/ne peut pas faire, ni qui voit ses contributions.

---

## 3. Proposition : un geste unique « Partager à l'autre partie », deux parcours

Votre intuition est juste : *« quand je partage une convention de stage, ce
n'est pas vraiment une négociation »*. Ce sont **deux parcours distincts qui
partagent la même infrastructure** (lien sécurisé, audit, versions,
notifications). Les fusionner dans un seul écran de partage évite à
l'utilisateur d'avoir à connaître la différence à l'avance :

> **Partager à l'autre partie** →
> - **Pour compléter et signer** — « l'autre partie remplit les champs qui la
>   concernent, puis signe » *(nouveau : mode complétion guidée)*
> - **Pour négocier** — « l'autre partie commente et propose des
>   modifications du texte » *(existant : mode négociation)*

### 3.1 Le fil de l'expérience dans l'éditeur

Remplacer le menu caché par une **barre d'étapes** persistante en haut de
l'éditeur, qui matérialise le cycle de vie :

```
① Rédiger → ② Compléter mes champs → ③ Partager (compléter / négocier) → ④ Signer
```

- L'étape courante est déduite de l'état réel : variables du créateur
  remplies ? partage actif ? champs de l'autre partie complets ? signature
  lancée ?
- « Signer » directement reste possible (contrat déjà complet) — la barre
  n'impose rien, elle rend le chemin visible.
- Dans la contrathèque, le statut affiché suit le même vocabulaire
  (Brouillon / En complétion / En négociation / Prêt à signer / Signé).

### 3.2 Mode « Compléter et signer » (nouveau)

**Côté créateur :**
1. À la fin de la rédaction, les variables du modèle (déjà typées :
   `VariableDef` du contractEngine) sont **assignées à une partie** : Moi /
   Autre partie / Tiers (établissement). L'IA propose une assignation par
   défaut d'après le libellé (« nom du stagiaire » → stagiaire) ; le créateur
   corrige en un clic.
2. Il saisit nom + e-mail du ou des destinataires (tripartite possible),
   choisit la durée de validité du lien, et une option : « envoyer en
   signature automatiquement quand tout est complété » ou « me laisser
   vérifier d'abord » (défaut : vérifier d'abord).
3. L'invitation part par e-mail avec le lien ; le créateur suit la
   progression (« 4/7 champs remplis ») depuis l'éditeur et la contrathèque ;
   relance en un clic.

**Côté invité (le stagiaire) :**
1. Il ouvre le lien : page épurée aux couleurs Lumen Juris, bandeau de
   réassurance (« Connexion chiffrée · Document hébergé en France · Vous ne
   pouvez modifier que les champs qui vous sont assignés »), son nom affiché.
2. Le contrat s'affiche en entier **en lecture seule**, avec *ses* champs
   surlignés et éditables. Une liste de progression latérale (« Vos
   informations : 3/7 ») permet de sauter de champ en champ. Validation par
   type (date, e-mail, IBAN…), champs requis bloquants.
3. Quand tout est rempli : « Valider mes informations ». Récapitulatif de ce
   qu'il a saisi, puis selon l'option du créateur : passage direct à la
   signature électronique, ou message « [Créateur] va vérifier puis vous
   recevrez le lien de signature ».
4. Chaque saisie est journalisée dans l'audit existant (`FIELD_FILLED`).

**Garde-fous :** l'invité ne voit ni les commentaires internes, ni les autres
fonctions de l'application ; le document porte un filigrane « Projet — avant
signature » ; le lien est nominatif, à durée limitée, révocable (infrastructure
déjà en place) ; option code de vérification à 6 chiffres envoyé par e-mail
pour les documents sensibles.

### 3.3 Mode « Négocier » (existant, à finir de polir)

Le moteur est là. Ce qui manque est de l'ordre de l'expérience :
- lien **nominatif** (nom + e-mail du destinataire) avec envoi d'e-mail
  d'invitation et relances, au lieu du copier-coller manuel ;
- même bandeau de réassurance sur la page invitée ;
- à la validation de la version finale, **bouton visible « Envoyer en
  signature »** qui enchaîne sur le module signature (l'événement
  `version.validated` existe déjà côté back — il n'est juste pas branché à
  une action visible) ;
- notifications au créateur quand l'invité commente ou propose.

---

## 4. Modèle de données (extension, pas de refonte)

Réutiliser `NegotiationSession` en lui ajoutant un **mode**, plutôt que créer
un module parallèle — on hérite ainsi des liens invités, de l'audit, des
versions et de la machine à états :

```prisma
model NegotiationSession {
  // … existant …
  mode            NegotiationMode @default(NEGOTIATION) // NEGOTIATION | COMPLETION
  autoToSignature Boolean         @default(false)
}

model NegotiationField {           // nouveau : champs assignés (mode COMPLETION)
  idField        Int      @id @default(autoincrement())
  externalId     String   @unique
  negotiationId  Int
  variableId     String            // id de VariableDef du contractEngine
  label          String
  type           String            // text | date | email | iban | number
  side           FieldSide         // OWNER | COUNTERPARTY | THIRD_PARTY
  required       Boolean  @default(true)
  value          String?
  filledById     Int?              // participant
  filledAt       DateTime?
}
```

- Rôle invité supplémentaire : `FILLER` (peut écrire `value` de ses champs,
  rien d'autre).
- `GuestAccess` : ajouter `name`, `email`, `verifyCode?` (nominatif).
- Complétion terminée → nouvelle `NegotiationVersion` avec le texte
  interpolé + événement `completion.finished` que le module signature
  consomme (même patron que `version.validated`).

---

## 5. Mise en œuvre proposée, par phases

| Phase | Contenu | Schéma BDD | Effort estimé |
|---|---|---|---|
| **1. Visibilité** | Entrée « Négociation » dans la sidebar + page liste des négociations (statut, contrat lié, dernière activité, liens actifs) + statuts harmonisés dans la contrathèque | aucun | ~1 jour |
| **2. Fil de l'expérience** | Barre d'étapes dans l'éditeur ; écran unique « Partager à l'autre partie » (le mode négociation branché sur l'existant) ; e-mails d'invitation et liens nominatifs | GuestAccess +name/email | ~2 jours |
| **3. Complétion guidée** | Assignation des variables, page invitée mode formulaire, progression, validation, enchaînement signature | mode, NegotiationField, rôle FILLER | ~4-5 jours |
| **4. Finitions** | Code de vérification e-mail, filigrane avant signature, relances automatiques, notifications | mineur | ~2 jours |

Chaque phase est livrable indépendamment ; la phase 1 répond immédiatement à
« on ne la voit pas, on ne sait pas où elle est ».

## 6. Questions à trancher avant la phase 3

1. **Tripartite** : la convention de stage implique souvent l'établissement
   d'enseignement. Confirmer qu'on veut gérer 2+ contreparties dès la v1 du
   mode complétion (recommandé : oui, le modèle proposé le permet).
2. **Signature** : l'enchaînement doit-il créer automatiquement l'enveloppe
   (module signature existant / DocuSign) avec les signataires déduits des
   parties, ou repasser par l'assistant signature ? (Recommandé : enveloppe
   pré-remplie, l'assistant s'ouvre pour vérification.)
3. **Mineurs** : un stagiaire mineur signe avec son représentant légal —
   faut-il un champ « représentant légal » optionnel dans les parties ?
4. Les données saisies par l'invité (état civil…) entrent dans le périmètre
   RGPD déjà décrit : prévoir leur purge avec le contrat (aligné sur la
   politique de conservation publiée sur le site).

## Sources de la recherche

- [Ironclad — Contract Negotiation Software](https://ironcladapp.com/journal/contract-management/contract-negotiation-software) et [Contract Redlining Software](https://ironcladapp.com/journal/contract-management/contract-redlining-software)
- [HyperStart — Contract Collaboration Software](https://www.hyperstart.com/blog/contract-collaboration-software/) et [Redlining Software](https://www.hyperstart.com/blog/redlining-software/)
- [Sirion — Best Redlining Software](https://www.sirion.ai/library/contract-insights/best-redlining-software-contract-review/)
- [Concord — Best contract redlining tools](https://www.concord.app/blog/best-contract-redlining-tools)
- [Zoho Contracts — Redlining best practices](https://www.zoho.com/contracts/impact/contract-redlining.html)
- [Juro — Internship agreement template](https://juro.com/contract-templates/internship-agreement)
- [signNow — Fill and sign internship agreements](https://www.signnow.com/fill-and-sign-pdf-form/377649-an-internship-agreement-or-an-employment-contract)
- [HyperStart — Electronic Contract Signing](https://www.hyperstart.com/blog/electronic-contract-signing/)
