# 🚀 Comment Démarrer le Serveur PDF

## 🎯 Méthode 1 : Terminal/Invite de Commandes (RECOMMANDÉ)

### Windows
1. **Ouvrez l'invite de commandes :**
   - Appuyez sur `Windows + R`
   - Tapez `cmd` et appuyez sur Entrée

2. **Naviguez vers le dossier du projet :**
   ```cmd
   cd "C:\chemin\vers\votre\projet"
   ```

3. **Installez les dépendances :**
   ```cmd
   pip install -r back\requirements.txt
   ```

4. **Démarrez le serveur :**
   ```cmd
   uvicorn back.app.main:app --host 0.0.0.0 --port 5678
   ```

### Mac/Linux
1. **Ouvrez le terminal**

2. **Naviguez vers le dossier :**
   ```bash
   cd /chemin/vers/votre/projet
   ```

3. **Installez les dépendances :**
   ```bash
   pip3 install -r back/requirements.txt
   ```

4. **Démarrez le serveur :**
   ```bash
   uvicorn back.app.main:app --host 0.0.0.0 --port 5678
   ```

## 🎯 Méthode 2 : Script Automatique

### Windows
1. **Clic droit** sur `start_pdf_server.bat`
2. **Sélectionnez** "Exécuter en tant qu'administrateur"

### Mac/Linux
```bash
chmod +x start_pdf_server.sh
./start_pdf_server.sh
```

## 🎯 Méthode 3 : Visual Studio Code

1. **Ouvrez le projet** dans VS Code
2. **Ouvrez le terminal intégré** (`Ctrl + ù`)
3. **Exécutez :**
   ```bash
   uvicorn back.app.main:app --host 0.0.0.0 --port 5678
   ```

## ✅ Vérification du Fonctionnement

Une fois démarré, vous devriez voir :
```
🚀 SERVEUR D'EXTRACTION PDF (FastAPI)
📄 Extraction haute qualité avec pdfplumber
🌐 Serveur accessible sur: http://localhost:5678
```

## 🧪 Test Rapide

Ouvrez un autre terminal et testez :
```bash
curl -X OPTIONS -m 15 http://localhost:5678/extract-pdf-text
```

Ou ouvrez votre navigateur et allez sur :
```
http://localhost:5678
```

## 🛠️ Résolution des Problèmes

### Problème : "Python n'est pas reconnu"
**Solution :**
1. Installez Python depuis https://python.org
2. ⚠️ **IMPORTANT :** Cochez "Add Python to PATH"
3. Redémarrez votre ordinateur

### Problème : "Port 5678 déjà utilisé"
**Solution :**
```bash
# Windows
netstat -ano | findstr :5678
taskkill /PID [numéro_du_processus] /F

# Mac/Linux
lsof -i :5678
kill -9 [PID]
```

### Problème : "Permission denied"
**Solution :**
- Windows : Exécutez en tant qu'administrateur
- Mac/Linux : Utilisez `sudo` si nécessaire

### Problème : "Module not found"
**Solution :**
```bash
pip install --upgrade pip
pip install -r back/requirements.txt
```

## 🎯 Une Fois Démarré

1. **Gardez le terminal ouvert** - Le serveur doit rester actif
2. **Ouvrez Justiclause** dans votre navigateur
3. **Uploadez un PDF** - Il sera automatiquement traité par votre serveur local
4. **Vérifiez le statut** - L'interface affichera "API Python Active"

## 🔄 Arrêt du Serveur

Pour arrêter le serveur :
- **Windows :** `Ctrl + C` dans le terminal
- **Mac/Linux :** `Ctrl + C` dans le terminal

## 💡 Conseils

- **Démarrez le serveur AVANT** d'utiliser Justiclause
- **Un seul serveur** peut tourner à la fois sur le port 5678
- **Redémarrez** si vous modifiez le code du serveur
- **Vérifiez les logs** pour diagnostiquer les problèmes