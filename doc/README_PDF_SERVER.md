# 🚀 Serveur PDF Extractor Local

Ce serveur Python local fournit une extraction PDF haute qualité avec **pdfplumber**, remplaçant définitivement le besoin de ngrok ou d'APIs externes.

## ⚡ Démarrage Rapide

### Windows
```bash
# Double-cliquez sur le fichier ou exécutez :
start_pdf_server.bat
```

### Mac/Linux
```bash
# Rendez le script exécutable et lancez :
chmod +x start_pdf_server.sh
./start_pdf_server.sh
```

### Manuel
```bash
# Installation des dépendances
pip install -r requirements.txt

# Démarrage du serveur
python pdf_extractor_server.py
```

## 🌐 Accès

- **Serveur :** http://localhost:5678
- **Extraction :** http://localhost:5678/extract-pdf-text
- **Santé :** http://localhost:5678/health

## 🧪 Tests

```bash
# Test de connectivité
curl -X OPTIONS -m 15 http://localhost:5678/extract-pdf-text

# Test d'extraction
curl -X POST -F "file=@votre_document.pdf" -m 15 http://localhost:5678/extract-pdf-text

# Vérification de santé
curl -m 15 http://localhost:5678/health
```

## ✅ Avantages

- **🆓 100% Gratuit** - Aucun coût, aucune limite
- **🔒 Privé** - Vos documents restent sur votre machine
- **⚡ Rapide** - Extraction locale instantanée
- **🎯 Précis** - pdfplumber = meilleure qualité d'extraction
- **🔄 Permanent** - Fonctionne tant que le serveur tourne

## 🔧 Configuration

Le serveur est pré-configuré pour :
- **Port :** 5678
- **CORS :** Activé pour l'application web
- **Taille max :** 10MB par fichier
- **Formats :** PDF uniquement

## 🔄 Intégration Automatique

L'application web Justiclause :
1. **Détecte automatiquement** le serveur local
2. **L'utilise en priorité** si disponible
3. **Bascule vers PDF.js** si le serveur est arrêté

## 📊 Qualité d'Extraction

- **Excellent :** > 1000 caractères
- **Good :** 500-1000 caractères  
- **Poor :** 100-500 caractères
- **Failed :** < 100 caractères

## 🛠️ Dépannage

### Erreur "Port déjà utilisé"
```bash
# Trouvez le processus utilisant le port 5678
netstat -ano | findstr :5678  # Windows
lsof -i :5678                 # Mac/Linux

# Arrêtez le processus ou changez le port dans pdf_extractor_server.py
```

### Erreur "Module non trouvé"
```bash
# Réinstallez les dépendances
pip install --upgrade pip
pip install -r requirements.txt
```

### PDF protégé/chiffré
- pdfplumber ne peut pas extraire les PDFs protégés
- L'application basculera automatiquement vers PDF.js
- Déchiffrez le PDF ou utilisez une version non protégée

## 🔒 Sécurité

- ✅ Validation des types de fichiers
- ✅ Limitation de taille (10MB)
- ✅ Nettoyage des noms de fichiers
- ✅ Gestion sécurisée des erreurs
- ✅ Logs détaillés pour le debugging

## 📝 Logs

Le serveur affiche en temps réel :
- 📤 Fichiers reçus
- 📄 Pages traitées  
- ✅ Succès d'extraction
- ❌ Erreurs détaillées

## 🚀 Utilisation en Production

Pour un usage permanent :

### Service Windows (NSSM)
```bash
# Téléchargez NSSM et installez le service
nssm install PDFExtractor "C:\Python\python.exe" "C:\chemin\vers\pdf_extractor_server.py"
nssm start PDFExtractor
```

### Service Linux (systemd)
```bash
# Créez un fichier service
sudo nano /etc/systemd/system/pdf-extractor.service

# Activez et démarrez
sudo systemctl enable pdf-extractor
sudo systemctl start pdf-extractor
```

## 💡 Conseils

1. **Gardez le serveur actif** pendant l'utilisation de Justiclause
2. **Redémarrez** si vous rencontrez des problèmes
3. **Vérifiez les logs** en cas d'erreur d'extraction
4. **Utilisez des PDFs non protégés** pour de meilleurs résultats

---

**🎯 Résultat :** Extraction PDF locale, gratuite et permanente pour Justiclause !