# Rapport d'audit orthographique et typographique — Lumen Juris

**Date :** 31 juillet 2026
**Périmètre :** textes destinés aux utilisateurs dans `front/`, `backNode/`, `proxy/`, `word-addin/`
**Exclus :** `node_modules`, `dist`, `build`, `back/` (ancien backend Python), `doc/` (documentation développeur), commentaires de code, noms de variables/fonctions, clés techniques, `console.log`/`logger.*`.

> Aucune modification n'a été apportée au code. Ce rapport recense uniquement les corrections proposées.

---

## 1. Synthèse

| Indicateur | Valeur |
|---|---|
| **Fautes / anomalies confirmées (visibles utilisateur)** | **29** |
| Fichiers concernés | 15 |
| Incohérences transversales | 4 (marque, e-mail, « Veille », salutations e-mails) |

### Répartition par gravité

- 🔴 **Critique (marque / phrase cassée)** : 6
- 🟠 **Grammaire / accord / conjugaison** : 12
- 🟡 **Typographie / espace / ponctuation** : 3
- 🔵 **Page en chantier (placeholder livrable)** : 5
- ⚪ **Anomalie de contenu (variable erronée)** : 1
- 🔁 **Incohérences transversales** : 4

### Erreurs récurrentes (patterns)

1. **Participe passé avec « avoir » accordé à tort** : `a échouée`, `réussie`, `ont été récupéré` (4 occurrences dans 3 fichiers).
2. **« veuillez réessayez »** au lieu de « veuillez réessayer » + **« tentative »** au singulier (rate limiter, 3 occurrences).
3. **Nom de marque incohérent** : `Justiclause` / `JustiClause` (ancien nom), `LumenJuris` (collé) vs `Lumen Juris` (forme canonique).
4. **`email` / `e-mail` / `mail`** employés indifféremment.

---

## 2. Fautes critiques 🔴

### Ancien nom de marque encore présent (« Justiclause »)

| Fichier | Ligne | Texte actuel | Correction |
|---|---|---|---|
| [Header.tsx](front/src/components/ContractAnalysis/Header.tsx:27) | 27 | `<h1>Justiclause</h1>` | `Lumen Juris` |
| [AccountSettingsPanel.tsx](front/src/components/ParamComponents/AccountSettingsPanel.tsx:160) | 160 | « Votre mot de passe **JustiClause** a bien été créé. » | « Votre mot de passe **Lumen Juris** a bien été créé. » |

> **Header.tsx:27** est un **titre `<h1>` visible** dans l'en-tête de l'analyse de contrat : l'ancien nom du produit s'affiche à l'écran.
> *(Les occurrences `justiclause-ai-cache-v3` dans `aiStore.ts` et `recoStore.ts` sont des clés `localStorage` techniques — non visibles, hors périmètre.)*

### E-mail de suppression de compte cassé

Fichier : [backNode/src/infrastructure/mailer/template/deleteAccount.ts](backNode/src/infrastructure/mailer/template/deleteAccount.ts)

| Ligne | Texte actuel | Correction |
|---|---|---|
| 10 | « Cliquez sur le bouton ci-dessous pour **choisir supprimer votre.** » | « Cliquez sur le bouton ci-dessous pour **confirmer la suppression de votre compte.** » |
| 37 | « Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email. **Votre mot de passe actuel restera inchangé.** » | Remplacer par : « …vous pouvez ignorer cet email. **Votre compte ne sera pas supprimé.** » |

> Ligne 10 : phrase grammaticalement incomplète (« choisir supprimer votre »).
> Ligne 37 : formulation copiée de l'e-mail de réinitialisation de mot de passe — hors sujet dans un e-mail de **suppression de compte**.

### Double point d'exclamation dans l'e-mail de bienvenue

Fichier : [welcomeFreemium.ts](backNode/src/infrastructure/mailer/template/welcomeFreemium.ts:11)

| Ligne | Problème | Correction |
|---|---|---|
| 11 | Sans prénom, le titre rend « Bienvenue sur Lumen Juris **! !** » (le `" !"` de repli et le `!` final se cumulent) | Retirer le `!` du cas de repli : `${username ? ... : ""} !` |

---

## 3. Grammaire, accord et conjugaison 🟠

### Frontend

| Fichier | Ligne | Texte actuel | Correction | Explication |
|---|---|---|---|---|
| [LoginForm.tsx](front/src/components/auth/LoginForm.tsx:270) | 270 | « **Trop de requête !** » | « Trop de **requêtes** ! » | Pluriel après « trop de ». |
| [LoginForm.tsx](front/src/components/auth/LoginForm.tsx:392) | 392 | Label `Password` | `Mot de passe` | Libellé en anglais dans un formulaire francophone (le placeholder juste en dessous est bien en français). |
| [ContextualAnalysisForm.tsx](front/src/components/ContractAnalysis/ContextualAnalysisForm.tsx:160) | 160 | « Le fichier que vous avez **analyser** n'a aucun rapport avec le droit. » | « …que vous avez **analysé**… » | Participe passé, pas l'infinitif. |
| [LegalWatchSettings.tsx](front/src/components/DashboardComponents/veille/LegalWatchSettings.tsx:253) | 253 | « La demande **a échouée** » | « La demande **a échoué** » | Avec « avoir » sans COD antéposé, le participe reste invariable. |
| [LegalWatchSettings.tsx](front/src/components/DashboardComponents/veille/LegalWatchSettings.tsx:255) | 255 | « L'envoi de la demande d'ajout de convention collective **a échouée**, veuillez réessayer. » | « …**a échoué**, veuillez réessayer. » | Idem. |
| [LegalWatchSection.tsx](front/src/components/MonitoringComponents/LegalWatchSection.tsx:66) | 66 | « **Ajout** de la convention collective **réussie** » | « Ajout … **réussi** » | Accord avec « Ajout » (masculin). Alternative : « Convention collective ajoutée avec succès ». |

### Backend

| Fichier | Ligne | Texte actuel | Correction | Explication |
|---|---|---|---|---|
| [apiLegalWatch.ts](backNode/src/route/apiLegalWatch.ts:118) | 118 | « L'ajout de la convention **a échouée** » | « L'ajout de la convention **a échoué** » | Participe invariable avec « avoir ». |
| [apiContract.ts](backNode/src/route/apiContract.ts:178) | 178 | « Les données sont **éronnées** ou n'ont pas été remplies. » | « Les données sont **erronées**… » | Orthographe : *erroné* (deux « r », un « n »). |
| [apiBilling.ts](backNode/src/route/apiBilling.ts:263) | 263 | « L'ajout de crédit **doit-être** défini par un nombre entier positif. » | « …**doit être** défini… » | Pas de trait d'union entre « doit » et « être ». |
| [apiBilling.ts](backNode/src/route/apiBilling.ts:284) | 284 | « Le retrait de crédit **doit-être** défini par un nombre entier positif. » | « …**doit être** défini… » | Idem. |
| [classGoogle.ts](backNode/src/services/classGoogle.ts:48) | 48 | « Les données **utisateurs** de l'authProvider Google **ont été récupéré** avec succès. » | « Les données **utilisateurs** … **ont été récupérées** … » | Faute de frappe « utisateurs » + accord au féminin pluriel (« données »). |

### Rate limiter — messages affichés à l'utilisateur bloqué

Fichier : [backNode/src/securite/limiter.ts](backNode/src/securite/limiter.ts)

| Ligne | Texte actuel | Correction |
|---|---|---|
| 13 | « Trop de **tentative** de communication, veuillez **réessayez** plus tard␣» | « Trop de **tentatives** de communication, veuillez **réessayer** plus tard. » (+ espace finale à supprimer) |
| 20 | « Trop de **tentative** de connexion, veuillez **réessayez** plus tard » | « Trop de **tentatives** de connexion, veuillez **réessayer** plus tard. » |
| 49 | « **Envoie** de feedback trop important, veuillez **réessayez** plus tard » | « **Envoi** de feedback trop important, veuillez **réessayer** plus tard. » |

> Récurrent : « tentative » → **tentatives** (pluriel) ; « veuillez réessayez » → **veuillez réessayer** (infinitif). Les lignes 29 et 40 du même fichier sont correctes — s'en inspirer pour homogénéiser.

---

## 4. Typographie et ponctuation 🟡

| Fichier | Ligne | Texte actuel | Correction | Explication |
|---|---|---|---|---|
| [authMiddleware.ts](backNode/src/middleware/authMiddleware.ts:34) | 34 | « Votre compte a été suspendu. Contactez l'administrateur **␣.** » | « …Contactez l'administrateur**.** » | Espace parasite avant le point final. |
| [limiter.ts](backNode/src/securite/limiter.ts:13) | 13 | « …plus tard␣» (espace en fin de chaîne) | Supprimer l'espace finale | — |
| E-mails (`userData.ts`, `deleteAccount.ts`) | — | « Bonjour <strong>X</strong>**.** » | « Bonjour <strong>X</strong>**,** » | Après une salutation, la virgule est d'usage (les autres e-mails n'ont pas de ponctuation ou une virgule). Voir §6. |

---

## 5. Page en chantier livrée en l'état 🔵

Fichier : [ClusterEnterprise.tsx](front/src/page/ClusterEnterprise.tsx) — cette page contient des notes de conception affichées telles quelles à l'écran (ex. ligne 27 : « Liste de chose qu'il faut integrer dans la page »). Elle devrait probablement être masquée ou finalisée avant mise en production. Fautes relevées dans le texte visible :

| Ligne | Texte actuel | Correction |
|---|---|---|
| 14 | « Retrouvez **tout les** membres de votre cluster » | « Retrouvez **tous les** membres… » |
| 27 | « Liste de **chose** qu'il faut **integrer** dans la page » | note de dev — à retirer (sinon : « choses », « intégrer ») |
| 31 | « Voir l'utilisation des **credits** de chaque membre » | « …des **crédits**… » |
| 32 | « …aux Fn pour **chaque membres** » | « …pour **chaque membre** » (singulier) + éviter l'abréviation « Fn » |
| 33 | « Réunir **tout les** dossiers et **analyse** d'un **meme** cluster et les partager **ensembles** » | « Réunir **tous les** dossiers et **analyses** d'un **même** cluster et les partager **ensemble** » |

---

## 6. Incohérences transversales 🔁

### 6.1 Nom de marque

Trois graphies coexistent dans le texte utilisateur :

- **`Lumen Juris`** (deux mots) — forme **canonique** : logo e-mail, objets d'e-mails, facture PDF, FAQ des offres. ~29 occurrences.
- **`LumenJuris`** (collé) — ~57 occurrences, notamment [AccountSettingsPanel.tsx](front/src/components/ParamComponents/AccountSettingsPanel.tsx) (l.211, 215, 216, 525, 526), [CompanySearchField.tsx](front/src/components/common/CompanySearchField.tsx:23), [SmartCddEditor.tsx](front/src/components/DashboardComponents/cdd/smart/SmartCddEditor.tsx:925), [LoginScreen.tsx (word-addin)](word-addin/src/taskpane/components/LoginScreen.tsx:58).
- **`Justiclause` / `JustiClause`** — ancien nom (voir §2).

👉 **Recommandation :** retenir **« Lumen Juris »** partout dans le texte visible.

### 6.2 « email » / « e-mail » / « mail »

Les trois formes cohabitent, parfois dans un même fichier :

- [apiUser.ts](backNode/src/route/apiUser.ts) : « L'**e-mail** de vérification a bien été envoyé » (l.121) mais « Le **mail** de vérification n'a pas pu être envoyé » (l.122) et « Le **mail** de suppression » (l.153).
- [TwoFactorCodeModal.tsx](front/src/components/ui/TwoFactorCodeModal.tsx) : « **E-mail** envoyé ! » (l.181) mais « envoyé par **mail** » (l.183) et « Renvoyer un **mail** » (l.247).
- Front majoritairement « **email** » (≈411 occ.) contre « e-mail » (≈29).

👉 **Recommandation :** choisir une seule forme (« **e-mail** » est le plus correct en français ; « email » est acceptable si vraiment homogène) et proscrire « mail » seul.

### 6.3 « Veille » vs « Legal Watch » vs « Actualités juridiques »

- [Monitoring.tsx](front/src/page/Monitoring.tsx:24) : label « **Legal Watch** » (anglais).
- [Veille.tsx](front/src/components/DashboardComponents/Veille.tsx:22) : « **Actualités juridiques** » et menu « **Veille** ».

👉 Uniformiser sur « **Veille juridique** » dans l'interface francophone.

### 6.4 Salutation des e-mails

Trois styles d'accroche : « Bonjour **X** » (sans ponctuation, `verifyAccount`), « Bonjour **X,** » (virgule, `resetPassword`, `twoFactor`), « Bonjour **X.** » (point, `userData`, `deleteAccount`). 👉 Standardiser sur « Bonjour **X,** ».

---

## 7. Anomalie de contenu (hors orthographe) ⚪

| Fichier | Ligne | Problème |
|---|---|---|
| [templateContratCDI.ts](backNode/ressources/templateContratCDI.ts:90) | 90 | « immatriculée à l'Urssaf/MSA sous le numéro `${enterpriseData.ADRESS_ENTERPRISE}` » : le numéro d'immatriculation affiche la **variable d'adresse** au lieu d'un numéro. À corriger côté données (le texte français, lui, est correct). |

*Signalé car cela produit un document contractuel incohérent, même si ce n'est pas une faute de langue.*

---

## 8. Zones auditées et jugées correctes ✅

- **E-mails** `verifyAccount`, `resetPassword`, `twoFactor`, `invoiceEmail`, `signatureInvite`, `signatureCompletion`, `userData` : français soigné, bonne typographie (« 20 % » avec espace, « &nbsp; » dans les « … »).
- **Facture PDF** ([invoicePDF.ts](backNode/src/infrastructure/pdf/invoicePDF.ts)) : libellés impeccables.
- **Template CDI** : texte juridique correct, apostrophes typographiques (’) et guillemets français (« ») bien utilisés.
- Gros des pages `Dashboard`, `Subscription/PlansPanel` (FAQ), `Monitoring` (sections), `negotiation`, `signature`, `contratheque` : globalement propres.

---

### Annexe — Fichiers contenant au moins une correction

1. `front/src/components/ContractAnalysis/Header.tsx`
2. `front/src/components/ParamComponents/AccountSettingsPanel.tsx`
3. `front/src/components/auth/LoginForm.tsx`
4. `front/src/components/ContractAnalysis/ContextualAnalysisForm.tsx`
5. `front/src/components/DashboardComponents/veille/LegalWatchSettings.tsx`
6. `front/src/components/MonitoringComponents/LegalWatchSection.tsx`
7. `front/src/page/ClusterEnterprise.tsx`
8. `backNode/src/infrastructure/mailer/template/deleteAccount.ts`
9. `backNode/src/infrastructure/mailer/template/welcomeFreemium.ts`
10. `backNode/src/route/apiLegalWatch.ts`
11. `backNode/src/route/apiContract.ts`
12. `backNode/src/route/apiBilling.ts`
13. `backNode/src/services/classGoogle.ts`
14. `backNode/src/middleware/authMiddleware.ts`
15. `backNode/src/securite/limiter.ts`
16. `backNode/ressources/templateContratCDI.ts` *(anomalie de contenu)*
