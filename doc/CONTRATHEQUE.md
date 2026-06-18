# Contrathèque — documentation technique

Repository central des contrats : liste, fiche détaillée, import IA avec revue
humaine obligatoire. Principe directeur : **« l'IA suggère, le système garde-fou,
l'humain décide »** (trust but verify).

État : **Étapes 0 → 5 livrées** — nav, modèle de données, extraction Python,
API Node, **UI complète** (liste / fiche / wizard d'import) et **tests
d'intégration**.

## Architecture

```
Front (Vite/React)
  │  fetchProxy  (cookie JWT)
  ▼
Proxy (3000)  ── proxyAuthMiddleware → injecte x-user-id / x-user-role
  ├── /api/contract/extract ─────────────► Python (5678)  /extract-contract-metadata
  │                                          (OCR + extraction IA, AUCUNE écriture base)
  └── /api/contract/** ──────────────────► backNode (3020)  /contract/**
                                             (Prisma + MariaDB, PDF chiffré sur FS)
```

Flux d'import (le PDF ne s'écrit en base **qu'après** la revue humaine) :

1. Front envoie le fichier → `POST /api/contract/extract` → Python renvoie
   `{ fields:[{field_key,value,confidence_score}], ocr_text }`.
2. **Revue humaine** : l'utilisateur valide/corrige chaque champ (UI étape 4).
3. Front envoie les champs validés + PDF base64 → `POST /api/contract` → backNode
   chiffre le PDF (AES-256-GCM), écrit `Contract` + `ContractMetadataField` + `AuditLog`.

## Modèle de données (Prisma)

`Contract` (agrégat central) ─┬─ `ContractMetadataField` (valeur IA + score + état validation)
                              ├─ `Amendment` (avenants)
                              ├─ `ContractVersion` (versions)
                              ├─ `ContractTag` ↔ `Tag` (labels colorés M2M)
                              └─ `AuditLog` (journal horodaté)
`Folder` (arborescence self-relation) ◄─ `Contract.folderId`

**Stockage hybride** : métadonnées validées en colonnes claires (filtres/tri/KPI) ;
le détail IA (score + statut + qui/quand) dans `ContractMetadataField` ; le PDF
chiffré sur le filesystem (`backNode/contracts/{hex}.pdf.enc`).

Enums : `ContractStatus` (DRAFT, IN_NEGOTIATION, ACTIVE, TACIT_RENEWAL, EXPIRED,
TERMINATED), `RenewalType` (NONE, TACIT, EXPRESS), `FieldValidationStatus`
(AI_SUGGESTED, HUMAN_VALIDATED, HUMAN_CORRECTED), `AuditAction`.

Migration : `prisma/migrations/20260612120000_add_contratheque`.
Seed de démo : `npm run seed:contratheque` (6 contrats couvrant tous les cas KPI).

## API

Toutes les routes passent par le proxy sous `/api/contract` (cookie JWT requis).

| Méthode | Endpoint | Rôle min. | Description |
| --- | --- | --- | --- |
| POST | `/api/contract/extract` | éditeur | Extraction IA (multipart, Python). Pas d'écriture. |
| GET | `/api/contract/stats` | lecteur | KPIs : total, échéance <90j, tacite, sans date de fin |
| GET | `/api/contract` | lecteur | Liste filtrée/triée/paginée |
| POST | `/api/contract` | éditeur | Création (après revue humaine) |
| GET | `/api/contract/:id` | lecteur | Fiche détaillée (champs, avenants, versions, audit) |
| GET | `/api/contract/:id/document` | lecteur | PDF déchiffré (accès tracé) |
| PATCH | `/api/contract/:id` | éditeur | Édition métadonnées |
| POST | `/api/contract/:id/validate-field` | éditeur | Valide/corrige un champ IA |
| POST | `/api/contract/:id/amendment` | éditeur | Ajoute un avenant |
| POST | `/api/contract/:id/version` | éditeur | Ajoute une version |
| POST | `/api/contract/:id/archive` | éditeur | Archive / désarchive |
| DELETE | `/api/contract/:id` | **admin** | Suppression définitive |
| GET | `/api/contract/:id/audit` | lecteur | Journal d'audit |
| GET/POST/DELETE | `/api/contract/tags[...]` | lecteur/éditeur | Tags |
| GET/POST/DELETE | `/api/contract/folders[...]` | lecteur/éditeur | Dossiers |
| GET | `/api/contract/export.csv` | éditeur | Export CSV (BOM Excel) |

**Filtres de liste** (query string) : `status`, `type`, `counterparty`,
`responsible`, `folder`, `tags` (csv), `isB2C`, `q` (full-text titre+OCR),
`signedFrom/To`, `endFrom/To`, `includeArchived`, `sortBy`, `sortDir`, `page`,
`pageSize`.

### RBAC

`Role` enum global enrichi : `ADMIN`, `JURISTE`, `LECTEUR` (+ `USER` legacy = éditeur).
- **LECTEUR** : lecture seule (toute mutation → 403).
- **JURISTE / USER** : import, validation IA, édition, avenants/versions, export.
- **ADMIN** : tout, y compris suppression.

Garde-fous : middlewares `requireEditor` / `requireAdmin` dans `apiContract.ts`.

## Spécificité française — B2B / B2C (différenciateur)

Le booléen `Contract.isB2C` pilote la logique d'alerte de renouvellement :
- **B2B** (`isB2C=false`) : pas d'obligation légale d'information (art. 1215 C. civ.).
- **B2C** (`isB2C=true`) : **loi Chatel** — obligation d'information du consommateur
  avant échéance.

L'extraction IA le détecte (`is_b2c`) ; la valeur est **confirmée par l'humain**
avant de déclencher la logique d'alerte (briques d'échéances en V2).

## RGPD by design — registre des traitements (cette feature)

| Élément | Mise en œuvre |
| --- | --- |
| **Finalité** | Gestion du cycle de vie des contrats d'une direction juridique |
| **Base légale** | Intérêt légitime / exécution contractuelle |
| **Données** | Métadonnées contractuelles + PDF ; minimisation (seuls les champs utiles) |
| **Hébergement** | France / UE (MariaDB + FS locaux ; cible prod UE) |
| **Chiffrement** | PDF chiffrés AES-256-GCM sur le filesystem (`cryptoFile.ts`) |
| **Journalisation** | Tout accès document + mutation tracés dans `AuditLog` (auteur, horodatage, payload avant/après) |
| **Conservation** | `Contract.retentionUntil` paramétrable par contrat (purge à brancher) |
| **Accès** | RBAC 3 rôles, cloisonnement par `userId` |
| **Sous-traitant** | **OpenAI** (extraction) — ⚠️ transfert hors-UE. À documenter au registre / encadrer (DPA, anonymisation, ou modèle UE) avant production. |

> Point d'attention production : l'extraction repose sur l'API OpenAI (hors UE).
> Pour une conformité stricte, prévoir un DPA OpenAI, un modèle hébergé UE, ou une
> anonymisation préalable du texte envoyé.

## Gestion des échéances (alertes de renouvellement + calendrier)

Calculée à la volée depuis les contrats (pas de table dédiée) — endpoint
`GET /api/contract/deadlines?horizonDays=`. Pour chaque contrat actif daté :

| Événement | Date | Déclencheur |
| --- | --- | --- |
| `END_DATE` | date d'échéance | tout contrat daté |
| `NOTICE_DEADLINE` | échéance − préavis | renouvellement `TACIT` + `noticePeriodDays` |
| `CHATEL_INFO` | dénonciation − 1 mois | `isB2C` + `TACIT` (loi Chatel) |

La distinction **B2B / B2C** est ici l'élément différenciant : un contrat B2C en
tacite reconduction génère une **alerte Chatel anticipée** (information du
consommateur) que les contrats B2B n'ont pas.

UI (onglet « Échéances » de la contrathèque) :
- 4 cartes d'alerte : préavis < 30 j, alertes Chatel B2C, échéances < 90 j, en retard ;
- **vue liste** triée par date avec sévérité colorée (en retard / urgent / bientôt / à venir) ;
- **vue calendrier mensuel** (`CalendarMonth`) navigable, pastilles par type
  d'échéance, clic sur un jour → détail, clic → ouverture du contrat.

> Hors scope (V2) : **synchronisation vers un calendrier externe** (Google /
> Outlook / export ICS) et notifications e-mail automatiques. Le calendrier
> actuel est une vue in-app.

## Frontend (étape 4)

Module `front/src/components/DashboardComponents/contratheque/` :

- **Écran 1 — liste** (`ContrathequeList`) : bandeau KPI, arborescence de
  dossiers + tags colorés (`Sidebar`), recherche full-text, filtres (statut,
  B2B/B2C), tableau triable avec badges de statut et indicateur d'urgence
  d'échéance (`ContractTable`), pagination, boutons Importer / Exporter CSV.
- **Écran 2 — fiche** (`ContractDetail`) : 3 colonnes (viewer PDF + panneau
  métadonnées + résumé), chaque champ affiche **score de confiance** et **état
  de validation** avec actions valider/corriger (`MetadataPanel`), chronologie
  avenants + versions + journal d'audit, actions archiver / supprimer (admin).
- **Wizard d'import** (`ImportWizard`) 4 étapes : upload masse → extraction IA →
  **revue humaine obligatoire** (champs éditables + scores) → confirmation.

Accès via les routes `/contratheque` et `/contratheque/:externalId`.

## Tests (étape 5)

Test d'intégration auto-portant (sans framework, `node:assert` + tsx) :
`backNode/tests/contract.integration.ts` — `npm run test:contract`.

Couvre : KPI, création, détail, **validation de champ (trust but verify +
reflet colonne)**, RBAC (LECTEUR 403 / JURISTE 403 delete / ADMIN ok), avenant,
filtre B2C. **10/10 verts.** Auto-nettoyant.

Vérifs additionnelles : `tsc --noEmit` (front + backNode + proxy) et `vite build`
passent ; extraction IA testée sur un vrai PDF.

## Hors scope V1 (anticipé dans le modèle, non implémenté)

Chat RAG, recherche sémantique/embeddings, dashboards analytiques avancés,
archivage NF Z42-013, **synchronisation vers calendrier externe / notifications
e-mail** (la gestion d'échéances in-app, elle, est livrée). Les hooks
`signatureEnvelopeExternalId`, `templateExternalId` et `retentionUntil` sont
déjà présents pour la suite.

## Fichiers

```
back/app/main.py                          ← endpoint /extract-contract-metadata (étape 2)
backNode/prisma/schema.prisma             ← modèles Contrathèque (étape 1)
backNode/prisma/seedContratheque.ts       ← seed de démo
backNode/src/services/cryptoFile.ts       ← chiffrement AES des PDF
backNode/src/services/classContract.ts    ← service métier (étape 3)
backNode/src/route/apiContract.ts         ← routes Express + RBAC (étape 3)
proxy/index.ts                            ← relais /api/contract/** (étape 3)
backNode/tests/contract.integration.ts    ← tests d'intégration (étape 5)
front/src/components/DashboardComponents/Contratheque.tsx       ← orchestrateur
front/src/components/DashboardComponents/contratheque/          ← module UI (étape 4)
  ├── types.ts / api.ts
  ├── ContrathequeList.tsx / KpiBar / Sidebar / ContractTable / StatusBadge
  ├── ContractDetail.tsx / MetadataPanel
  └── ImportWizard.tsx
```
