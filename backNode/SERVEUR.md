# BackNode


## Backend de l'application LumenJuris en node.js/express/prisma

- Gestion de la base de données

---

### Demarrage
```bash
cd backNode
npm install
npm run db:sync
npm run dev
```

---

## Base de données

Tout les modèles de la base de données sont définis dans prisma/schema.prisma

Vous pouvez retrouver la modelisation dans :
     /documentation/schemaConceptuelBdd.loo (logiciel "Looping")

Dans le .env renseigner :
DATABASE_URL="mysql://USER:PASSWORD@localhost:PORT(3306)/lumen_juris_app"

La commande :
```bash
npm run db:sync
```

la commande :
    1. Applique les migrations
    2. Génère le client Prisma

### Reinitialisation de la base de données

En cas de besoin en développement :

```bash
npx prisma migrate reset
```

⚠️ Cette commande supprime toutes les données de la base de données avant de réappliquer les migrations.

---
# Bonus

## Scripts disponible

```md
- `npm run dev` → lance le serveur en mode développement
- `npm run build` → compile le projet TypeScript
- `npm run start` → lance le build compilé
- `npm run db:sync` → synchronise la base de données + Prisma Client
```