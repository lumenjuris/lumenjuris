# Extracteur PDF avec pdfplumber

Ce serveur Flask fournit une API d'extraction de texte PDF utilisant pdfplumber, remplaçant l'utilisation de ngrok par un serveur local.

## 🚀 Installation

1. **Installer les dépendances Python :**
```bash
pip install -r requirements.txt
```

2. **Démarrer le serveur :**
```bash
python pdf_extractor_server.py
```

Le serveur sera accessible sur `http://localhost:5678`

## 📡 Endpoints

### POST /extract-pdf-text
Extrait le texte d'un fichier PDF

**Paramètres :**
- `file` : Fichier PDF (multipart/form-data)

**Réponse :**
```json
{
  "success": true,
  "text": "Texte extrait du PDF...",
  "filename": "document.pdf",
  "metadata": {
    "pages": 5,
    "characters": 2500,
    "words": 450,
    "extraction_method": "pdfplumber",
    "quality": "high"
  }
}
```

### GET /health
Vérification de l'état du serveur

### OPTIONS /extract-pdf-text
Support CORS pour les requêtes cross-origin

## 🧪 Test manuel

```bash
# Test de connectivité
curl -X OPTIONS -m 15 http://localhost:5678/extract-pdf-text

# Test d'extraction
curl -X POST -F "file=@votre_document.pdf" -m 15 http://localhost:5678/extract-pdf-text
```

## 🔧 Configuration

- **Port :** 5678 (configurable dans le code)
- **Taille max :** 10MB par fichier
- **Formats supportés :** PDF uniquement
- **CORS :** Activé pour toutes les origines

## 📊 Qualité d'extraction

- **High :** > 500 caractères extraits
- **Medium :** 100-500 caractères
- **Low :** < 100 caractères
- **Failed :** Erreur d'extraction

## 🛠️ Dépannage

1. **Port déjà utilisé :**
   - Changer le port dans `pdf_extractor_server.py`
   - Ou arrêter le processus utilisant le port 5678

2. **Erreur d'installation pdfplumber :**
   ```bash
   pip install --upgrade pip
   pip install pdfplumber
   ```

3. **Problème CORS :**
   - Le serveur inclut les headers CORS automatiquement
   - Vérifiez que le serveur est bien démarré

4. **PDF protégé :**
   - pdfplumber ne peut pas extraire les PDF chiffrés
   - L'application basculera automatiquement vers PDF.js

## 🔄 Intégration avec l'application

L'application web détecte automatiquement la disponibilité du serveur :

1. **Test de connectivité** au démarrage
2. **Utilisation automatique** si disponible
3. **Fallback vers PDF.js** si indisponible

## 📝 Logs

Le serveur affiche des logs détaillés :
- 📤 Fichiers reçus
- 📄 Pages traitées
- ✅ Succès d'extraction
- ❌ Erreurs rencontrées

## 🔒 Sécurité

- Validation des extensions de fichiers
- Limitation de la taille des fichiers
- Nettoyage des noms de fichiers
- Gestion des erreurs sécurisée