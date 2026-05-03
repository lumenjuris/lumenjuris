## Serveur proxy

### Utilisation

Le serveur proxy sert d'intermédiaire entre le front-end et les divers serveurs back-end necessaire à l'application.

Le serveur proxy se demarre via les commandes 
```bash
cd proxy
npm run dev
```

Veuillez renseigner les variables d'environnements suivantes pour le bon fonctionnement du proxy

BACKEND_URL="url du serveur Python"
BACKNODE_URL="url du serveur NodeJs"
PORT="Port sur lequel tourne le serveur proxy"
NODE_ENV="environnement ou production"

