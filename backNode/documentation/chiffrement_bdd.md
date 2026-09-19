# Chiffrement des données sensibles en base

Les données sensibles (contenu des contrats, négociations, synthèses, chat juridique…) sont **chiffrées par l'application** avant d'être écrites dans MariaDB, en AES-256-GCM.

La base n'est donc jamais chiffrée « côté MariaDB » : sur l'hébergement mutualisé o2switch, on n'a pas la main sur le chiffrement du SGBD, et il ne protégerait de toute façon que contre le vol physique du disque.

---

## 1. Architecture

Trois fichiers :

| Fichier | Rôle |
|---|---|
| `src/services/encryption.ts` | Le **seul** module de chiffrement de l'application : champs en base (`encryptValue` / `decryptValue`), fichiers (`encryptBuffer` / `decryptBuffer`) et empreinte des jetons (`hashToken`). |
| `prisma/encryptedFields.ts` | La **liste des champs chiffrés**, par modèle Prisma. C'est le seul fichier à modifier pour chiffrer un nouveau champ. |
| `prisma/encryptionExtension.ts` | L'**extension Prisma** branchée dans `singletonPrisma.ts`. Elle intercepte toutes les requêtes. |

### Ce que fait l'extension

- **À l'écriture** (`create`, `update`, `upsert`, `createMany`…) : elle chiffre les champs listés dans `encryptedFields.ts`, y compris dans les écritures imbriquées (ex. créer un contrat avec ses versions).
- **À la lecture** : elle déchiffre ces champs dans le résultat, y compris dans les relations chargées avec `include`.
- **Garde-fou** : un `where` ou un `orderBy` sur un champ chiffré lève une erreur explicite. Sans cela, la requête renverrait silencieusement zéro résultat.
- **Au démarrage** : si un champ de `encryptedFields.ts` n'existe pas dans le schéma (faute de frappe), l'application refuse de démarrer.

**Les services manipulent toujours des valeurs en clair.** Ils ne voient jamais le texte chiffré et n'appellent aucune fonction de chiffrement.

### Format stocké

```
enc:v1:<iv>:<tag>:<données>
    ^^
    version de la clé utilisée
```

- `iv` : vecteur d'initialisation aléatoire (deux chiffrements du même texte donnent deux résultats différents).
- `tag` : tag d'authentification GCM. Toute modification de la valeur en base est détectée au déchiffrement.
- La valeur est convertie en JSON avant chiffrement : un texte redevient un texte, un objet redevient un objet. Le même mécanisme sert donc pour les champs `String` et `Json`.

Pour les PDF sur disque : `[version de clé (2 octets)][IV (12)][tag (16)][données chiffrées]`.

---

## 2. Champs chiffrés

| Modèle | Champs |
|---|---|
| Contract | `title`, `counterpartyName`, `responsibleName`, `ocrText`, `approvalNote` |
| ContractMetadataField | `value` |
| Amendment | `title`, `summary` |
| ContractVersion | `contentText`, `note` |
| ContractComment | `body` |
| AuditLog | `payloadBefore`, `payloadAfter` |
| ContractSummary | tous les champs du résumé, `duree`, `fileName`, `rawText` |
| NegotiationVersion | `contentText`, `structuredJson` |
| NegotiationField | `value` |
| ClauseProposal | `originalText`, `proposedText` |
| NegotiationComment | `body`, `quote`, `proposedText` |
| NegotiationAudit | `payload` |
| Clause | `body`, `notes` |
| ChatHistory | `conversations` |
| ContractHistory | `snapshot` |
| ContractTemplate | `structure` |
| GenerationLog | `output` |
| SignatureEnvelope | `envelopeFields`, `selfName`, `selfEmail`, `counterpartyName`, `counterpartyEmail`, `signingToken` |
| User | `nom`, `prenom` |
| GuestAccess | `name`, `email`, `token` |
| NegotiationParticipant | `name`, `email` |

Restent volontairement en clair : `User.email` (sert à la connexion et porte un `@unique`), dates, statuts, `contractType`, `currency`, `amount`, noms de tags et de dossiers, identifiants. On en a besoin pour filtrer et trier en SQL, et ils ne révèlent pas le contenu des contrats.

---

## 3. Règles à respecter pour un champ chiffré

1. **Type de colonne** : `String @db.Text`, `String @db.LongText` ou `Json`. Un `String` sans `@db.*` est un VARCHAR(191), trop court : la valeur chiffrée fait environ 1,4 fois la taille du texte, plus une soixantaine de caractères.
2. **Pas de `where`, pas d'`orderBy`, pas de `@unique`** sur ce champ : la base ne voit que du texte chiffré. Il faut charger les lignes puis filtrer ou trier en mémoire. Exemples :
   - `ContractService.list` (recherche et tri par titre de la contrathèque) ;
   - `ClauseService.list` (recherche dans la bibliothèque de clauses) ;
   - la fonction `includesText` de `src/utils/searchText.ts` fait une recherche « contient » insensible à la casse et aux accents, comme MariaDB.
   - Exception : tester l'absence de valeur (`champ: null`) reste possible.
3. **Transactions** : pour typer le `tx` de `prisma.$transaction(async (tx) => …)`, utiliser le type `TransactionClient` exporté par `singletonPrisma.ts`, et non `Prisma.TransactionClient` (qui ne connaît pas l'extension).
4. **Éviter de charger un gros champ chiffré inutilement** : il sera déchiffré à chaque lecture. Utiliser `select` ou `omit` (exemple : les listes d'enveloppes de signature omettent `envelopeFields`).

### Ajouter un champ chiffré

1. Vérifier son type dans `schema.prisma` (règle 1) et créer la migration si besoin.
2. L'ajouter dans `prisma/encryptedFields.ts`.
3. Vérifier qu'aucun `where` / `orderBy` ne l'utilise (l'extension lèvera une erreur sinon).
4. Si la base contient déjà des lignes en clair pour ce champ, les chiffrer avec un script de migration : l'extension refuse de lire une valeur non chiffrée dans un champ censé l'être.

---

## 4. La clé de chiffrement

- Variable d'environnement : `CONTRACT_ENCRYPTION_KEY` (64 caractères hexadécimaux = 32 octets).
- Génération :

  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

- ⚠️ **Perdre la clé = perdre toutes les données chiffrées.** La sauvegarder hors du serveur (gestionnaire de mots de passe de l'équipe, par exemple).
- ⚠️ **Ne jamais committer le `.env`**, ni envoyer la clé par email ou messagerie.

---

## 5. Changer de clé (rotation)

> État actuel : seule la version `v1` est gérée. La procédure ci-dessous décrit ce qu'il faudra faire le jour venu (la préparation de `getKey` et le script de rechiffrement restent à écrire).

Le principe : **l'ancienne et la nouvelle clé cohabitent le temps de la transition.** Comme chaque valeur indique la version de la clé qui l'a chiffrée, l'application sait lire les deux.

### Procédure

1. **Générer une nouvelle clé** et l'ajouter dans une nouvelle variable d'environnement (`CONTRACT_ENCRYPTION_KEY_V2`). L'ancienne reste en place.
2. **Dans `encryption.ts`** :
   - `getKey` associe chaque version à sa variable (`v1` → ancienne clé, `v2` → nouvelle) ;
   - passer `CURRENT_KEY_VERSION = "v2"`.

   Dès le redémarrage, toutes les nouvelles écritures sont chiffrées en v2, et les valeurs en v1 restent lisibles.
3. **Lancer le script de rechiffrement.** Pour chaque modèle de `ENCRYPTED_FIELDS`, il lit les lignes et les réécrit. L'extension déchiffre avec v1 et rechiffre avec v2 toute seule. Traiter par lots. Faire de même pour les PDF sur disque.
   - ⚠️ Prisma met à jour `updatedAt` automatiquement : le script doit repasser explicitement la valeur existante de `updatedAt`, sinon tous les contrats apparaîtront « modifiés » à la date de la rotation.
4. **Vérifier qu'il ne reste aucune valeur en v1**, avec une requête SQL `LIKE 'enc:v1:%'` sur chaque colonne chiffrée, et vérifier les PDF.
5. **Seulement ensuite, supprimer l'ancienne clé** de l'environnement. Si elle est supprimée trop tôt, les données encore en v1 sont perdues définitivement.

L'application reste en service pendant toute l'opération.

> Point à corriger avant d'atteindre `v10` : dans les PDF, la version de clé est stockée sur 2 octets.

### Quand changer de clé

**Immédiatement**, si la clé a pu fuiter :

- le `.env` a été commité, envoyé par email, collé dans un message ou un ticket ;
- le serveur ou le compte o2switch a été compromis ;
- une personne qui avait accès à la clé quitte le projet.

**Périodiquement** : une rotation annuelle est une pratique courante (ce n'est pas une obligation légale). Elle limite la quantité de données exposées par une clé qui aurait fuité sans qu'on le sache. Pour un petit SaaS, la rotation sur événement compte davantage que le calendrier.

**Pas pour une raison technique** : AES-256-GCM avec IV aléatoire ne pose de problème qu'au-delà de plusieurs milliards de chiffrements avec la même clé, très loin de notre volume.

---

## 6. Ce que ce chiffrement protège, et ce qu'il ne protège pas

La clé est dans le `.env`, sur le même serveur que la base.

**Protégé** :

- un dump de base ou une sauvegarde qui fuite ;
- une injection SQL ;
- un accès direct à MariaDB.

Ce sont les fuites les plus courantes.

**Non protégé** : un attaquant qui contrôle entièrement le serveur peut lire le `.env` en même temps que la base. S'en protéger demanderait un service de gestion de clés (KMS) extérieur au serveur, hors de portée sur un hébergement mutualisé.

---

## 7. Tests

```bash
npm run test:encryption
```

Le script (`tests/encryption.integration.ts`) vérifie :

- le module de chiffrement (aller-retour, IV aléatoire, falsification détectée, PDF) ;
- sur la vraie base, par une requête SQL brute, que les colonnes sont bien chiffrées ;
- que Prisma renvoie les valeurs en clair, y compris avec `include` et dans les écritures imbriquées ;
- que les champs `Json` sont relus comme des objets ;
- que `where` / `orderBy` sur un champ chiffré lèvent une erreur.

Prérequis : base migrée avec le schéma à jour et au moins un utilisateur. Le script nettoie ses données de test.

---

## 8. Jetons secrets (liens et codes)

Les jetons ne sont jamais stockés en clair. On stocke leur **empreinte SHA-256** (`hashToken` dans `encryption.ts`) : pour retrouver une ligne à partir du jeton reçu dans l'URL, on recalcule l'empreinte.

```ts
prisma.guestAccess.findUnique({ where: { tokenHash: hashToken(token) } })
```

| Jeton | Stockage | Pourquoi |
|---|---|---|
| `Token.tokenHash` (vérification de compte, mot de passe oublié, 2FA, suppression de compte) | empreinte seule | le jeton part dans l'email et n'est jamais relu |
| `SignatureEnvelope.signingTokenHash` + `signingToken` | empreinte + copie chiffrée | la relance renvoie le même lien de signature |
| `GuestAccess.tokenHash` + `token` | empreinte + copie chiffrée | « Copier le lien » et la relance réaffichent le même lien invité |

La copie chiffrée est gérée par l'extension, comme les autres champs chiffrés. Un dump de la base sans la clé ne donne donc aucun lien exploitable.

⚠️ Ne jamais faire `where: { token }` sur `GuestAccess` ni `where: { signingToken }` sur `SignatureEnvelope` : ces colonnes sont chiffrées (l'extension lève une erreur). Toujours passer par l'empreinte.

---

## 9. Fichiers chiffrés sur le disque

Tous les fichiers sont chiffrés avec `encryptBuffer` et portent l'extension `.enc`. Pour en relire un : `decryptBuffer(await fs.readFile(chemin))`.

| Fichier | Dossier | Écrit par |
|---|---|---|
| PDF des contrats | `contracts/` | `src/route/apiContract.ts` |
| PDF à signer | `signatureenvelopes/` | `src/route/apiSignature.ts` |
| Fichier source d'un modèle importé | `templatesources/` | `src/route/apiTemplate.ts` |
| Archive des factures | `facture/<mois>_<année>/` | `src/infrastructure/pdf/invoicePDF.ts` |

Les factures envoyées par email, téléchargées ou exportées en ZIP sont **régénérées à partir de la base** à chaque fois. La copie sur disque ne sert que d'archive : elle est réécrite à chaque génération, et une erreur d'écriture est journalisée sans bloquer l'envoi.

---

## 10. Reste à faire

- **Historique des migrations Prisma cassé** (indépendant du chiffrement) : plusieurs migrations `init` se chevauchent, et l'historique ne se rejoue plus sur une base vide. `migrate dev` et `migrate reset` échouent donc. À corriger avant de générer la migration du chiffrement.
- Noms de fichiers et de modèles en clair : `ContractHistory.fileName`, `ContractTemplate.name`, `SignatureEnvelope.documentName`.
- `.env.production` : ajouter `CONTRACT_ENCRYPTION_KEY`.
- Rotation de clé : préparer `getKey` et écrire le script de rechiffrement (voir section 5).
