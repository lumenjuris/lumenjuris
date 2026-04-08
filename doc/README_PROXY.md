Legifrance Proxy (Node/Express)

1) Prérequis
- Node 18+
- Installer les dépendances: npm i -D typescript @types/node @types/express @types/cors
- Installer runtime: npm i express cors dotenv undici

2) Variables d'env (server/.env)
- PISTE_CLIENT_ID, PISTE_CLIENT_SECRET (obligatoires)
- PISTE_SCOPE=search (souvent requis)
- PISTE_AUDIENCE= (si votre contrat l'exige)
- PORT=4000 (par défaut)

3) Lancer le proxy
- Depuis la racine du projet:
  - npx ts-node server/index.ts
  ou
  - npx tsc --project server && node dist/server/index.js

4) Routes
- POST /api/legi-token => { access_token, expires_in }
- POST /api/legi-search { query, pageNumber?, pageSize?, sort? } => relai Légifrance (fonds JURI)
- POST /api/legi-consult-juri { textId } => relai consult/juri
- GET  /api/health => ping

5) Front (exemple rapide)
- fetch('http://localhost:4000/api/legi-search', { method: 'POST', body: JSON.stringify({...}), headers:{'Content-Type':'application/json'}})


6) Sécurité
- Ne jamais mettre les secrets côté front.
- Ce proxy rafraîchit le token (client_credentials) et retry sur 401.

