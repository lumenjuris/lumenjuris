# BackNode


## Backend de l'application LumenJuris en node.js/express/prisma

- Gestion de la base de données


### Demarrage
```bash
cd backNode
npm install
npm run dev
```

## Base de données

Tout les modèles de la base de données sont définis dans schema.prisma
Vous pouvez retrouver la modelisation dans /documentation/schemaConceptuelBdd.loo (logiciel "Looping")

Dans le .env renseigner :
DATABASE_URL="mysql://USER:PASSWORD@localhost:PORT(3306)/lumen_juris_app"

### Initialisation de la base de données
```bash
cd src
npx prisma migrate dev --name init
```
Cette commande :
- crée les fichiers de migration
- applique les migrations à la base de données
- génère automatiquement les tables



### Initialisation du client Prisma
```bash
npx prisma generate
```
Cette commande génère le client Prisma permettant d’interagir avec la base de données dans le code.

### Reset de la base de données

Lors du développement au besoin vous pouvez réinitialiser la base de données avec la commande 

```bash
npx prisma migrate reset
```