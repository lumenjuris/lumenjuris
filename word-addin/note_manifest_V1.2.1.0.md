# Notes de certification — Lumen Juris (Word add-in) — manifeste v1.2.1.0

> Notes destinées à l'équipe de validation Microsoft (Partner Center, page « Notes de certification »).
> Version anglaise en premier (lue par les validateurs), résumé français ensuite.

---

## 1. Summary of this submission (v1.2.1.0)

This version fixes the sign-in failure reported during the previous validation (browser error:
"blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource"
on `POST https://app.proxy.lumenjuris.com/api/addin/login`).

Changes made:

1. **Authentication route renamed**: the add-in now calls `POST /api/addin/session` instead of
   `/api/addin/login`. The previous route was no longer served as expected in production, and the
   response did not come from our application (so it carried no CORS headers).
2. **Hosting domain unified**: all add-in resources are now served from `https://app.lumenjuris.com/word-addin/`
   (the former `beta.lumenjuris.com` host has been removed from the manifest).
3. **Manifest version** bumped to `1.2.1.0` (same add-in `Id`: `dff4ac01-0254-41df-ac65-ab59529fc77d`).
4. **API CORS configuration verified**: the API explicitly allows the origin `https://app.lumenjuris.com`
   (preflight `OPTIONS` returns `204` with `Access-Control-Allow-Origin: https://app.lumenjuris.com`,
   and the header is also returned on `401` / `500` error responses).
5. The add-in was tested end to end in **Word on the web** and in the browser: sign-in, analysis,
   highlighting, clause detail, case-law search and "apply as tracked change".

## 2. Hosting and architecture

| Element | URL |
|---|---|
| Task pane | `https://app.lumenjuris.com/word-addin/taskpane.html` |
| Commands | `https://app.lumenjuris.com/word-addin/commands.html` |
| API (backend) | `https://app.proxy.lumenjuris.com` |

Origin of all requests made by the task pane: `https://app.lumenjuris.com`.
Authentication uses a Bearer token (no third-party cookies required).

## 3. How to test the add-in

**Test account** (created for Microsoft validation):

- Email: `appsource.test@lumenjuris.com`
- Password: `ConnexionMicrosoft2026#`

**Steps:**

1. Open a Word document containing a contract (at least 100 characters). A sample contract is provided
   in the screenshots package: `Contrat-prestation-demo.docx` (fictitious companies).
2. On the **Home** tab, click **LumenJuris** (group "Lumen Juris") to open the task pane.
3. Sign in with the test account above.
4. Fill in (or accept the AI pre-filled) contract type, then click **Analyser le document**.
5. Risky clauses are detected and highlighted in the document. Click a clause to see the issues,
   recommendations, case law and to ask a question about it.
6. Click **Appliquer dans le document (révision)**: the rewrite is inserted as a **tracked change**
   (Review tab), which can be accepted or rejected.

Note: the first request after a period of inactivity may take a few seconds while our server wakes up.
Please allow up to 15 seconds before retrying.

## 4. Permissions

`ReadWriteDocument`: required to read the contract text for analysis, highlight risky clauses with
content controls, and insert suggested rewrites as tracked changes. Document content is sent only to
our API (hosted in France) for the requested analysis and is not used to train models.

## 5. IMPORTANT — If you encounter a CORS error during validation

Our API sends the CORS headers for the origin `https://app.lumenjuris.com` on every response, including
error responses. If you still see a CORS-type error (for example "No 'Access-Control-Allow-Origin' header"),
it most likely means the request was stopped **before** reaching our application (network filtering,
firewall, or server restart), not a configuration error on the add-in side.

**To let us analyse it, please send us, together with the rejection:**

1. **The exact date and time of the failed test, with time zone (UTC preferred)**, to the second.
2. **The failing request**: full URL, HTTP method (e.g. `POST /api/addin/session`), HTTP status code,
   and the request / response headers (a HAR export or a screenshot of the browser Network tab).
3. **The public IP address** (or region) from which the test was run, if available.
4. The **exact error message** shown in the browser console.
5. The platform used for the test (Word on the web, Windows, Mac) and the browser/version.

With the timestamp and the request, we can retrieve the matching entry in our server and hosting logs
and fix the issue quickly.

**Support contact:** https://www.lumenjuris.com/contactez-nous/

---

## Résumé en français

**Version 1.2.1.0 — corrections apportées**

1. Route d'authentification renommée : `/api/addin/login` devient `/api/addin/session`.
2. Hébergement unifié sur `https://app.lumenjuris.com/word-addin/` (plus de `beta.lumenjuris.com`).
3. Version du manifeste passée à `1.2.1.0` (même `Id`).
4. CORS vérifié : l'origine `https://app.lumenjuris.com` est autorisée, y compris sur les réponses d'erreur.
5. Complément testé de bout en bout dans Word en ligne.

**En cas d'erreur CORS pendant la validation**, demander à Microsoft : l'**horodatage exact** (avec fuseau, à la seconde),
la **requête** en cause (URL, méthode, code HTTP, en-têtes, export HAR ou capture de l'onglet Réseau), l'**IP ou la région**
du test, le **message d'erreur** exact et la plateforme utilisée. Cela permet de retrouver la requête dans les logs du
serveur et de l'hébergeur (o2switch).

