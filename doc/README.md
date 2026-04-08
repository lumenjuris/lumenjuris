# 🤖 JustiClause - Analyseur IA de Contrats

## 🎯 Description

JustiClause est un outil intelligent d'analyse de contrats PDF qui utilise l'IA pour :
-  **Fournir des recommandations** personnalisées
- ⚖️ **Proposer des alternatives** juridiquement solides

## 🚀 Fonctionnalités

### 📄 Extraction PDF
- Support PDF natifs et scannés (OCR)
- Serveur local Python pour extraction optimisée
- Fallback automatique vers PDF.js si nécessaire

### 🧠 Analyse IA
- Analyse contextuelle personnalisée selon votre rôle
- Détection de clauses : responsabilité, résiliation, pénalités, etc.
- Scoring de risque automatique (1-5)
- Recommandations adaptées au droit français

### 🎨 Interface Utilisateur
- Surlignage intelligent des clauses
- Dashboard des risques en temps réel
- Détail enrichi pour chaque clause
- Export des rapports et alternatives

## 🛠️ Installation

### Prérequis
- Node.js 18+

### Proxy Légifrance (optionnel mais recommandé)
- Un proxy Node/Express est fourni dans `server/` pour appeler l'API Légifrance via PISTE sans exposer vos secrets côté front.
- Configurez `server/.env` à partir de `server/.env.example` puis démarrez le proxy (port 4000 par défaut).
- Le front tentera ce proxy en fallback si l'API Flask ne renvoie aucune décision valide.
- Python 3.8+
- Clé API OpenAI (optionnelle, pour analyse avancée)

### 1. Installation des dépendances

```bash
# Frontend (React/TypeScript)
npm install

# Backend (Serveur PDF Python)
pip install -r requirements.txt
```

### 2. Configuration

Créez un fichier `.env` :

```env
VITE_OPENAI_API_KEY=votre_cle_openai_ici
```

### 3. Démarrage

```bash
# Terminal 1 : Serveur PDF (optionnel mais recommandé)
python pdf_extractor_server.py

# Terminal 2 : Application Web
npm run dev
```

## 📁 Structure du Projet

```
├── src/
│   ├── components/          # Composants React
│   │   ├── TextViewer.tsx        # Viewer principal avec surlignage
│   │   ├── SmartTextViewer.tsx   # Système de highlighting stable
│   │   └── EnhancedClauseDetail.tsx # Détail des clauses
│   ├── utils/
│   │   ├── aiAnalyzer.ts         # Analyseur IA principal
│   │   ├── aiPrompts.ts          # Prompts contextuels
│   │   └── stableMatching.ts     # Algorithme de matching
│   ├── hooks/
│   │   └── useContractAnalysis.ts # Logique métier principale
│   └── types/               # Définitions TypeScript
├── pdf_extractor_server.py  # Serveur d'extraction PDF local
└── public/                  # Assets statiques
```

## 🔧 Configuration Avancée

### OCR pour PDF Scannés
```bash
# Installation moteurs OCR (optionnel)
pip install easyocr paddlepaddle paddleocr pytesseract
```

### Serveur PDF Local
Le serveur Python améliore significativement l'extraction :
- Meilleure qualité d'extraction
- Support OCR intégré
- Traitement local (sécurisé)

## 🎮 Utilisation

1. **Upload** : Glissez votre PDF ou collez le texte
2. **Contexte** : Renseignez votre rôle et type de contrat
3. **Analyse** : L'IA détecte et analyse les clauses
4. **Review** : Consultez les recommandations et alternatives
5. **Export** : Téléchargez votre rapport d'analyse

## ⚡ Performances

- **Extraction PDF** : < 2s pour documents standards
- **Analyse IA** : 10-30s selon la complexité
- **Surlignage** : Temps réel avec algorithme optimisé

## 🔒 Sécurité

- Traitement local des documents sensibles
- Chiffrement des communications API
- Aucun stockage permanent des données

## 📞 Support

Pour toute question ou problème :
1. Vérifiez que le serveur PDF est démarré
2. Consultez les logs dans la console
3. Redémarrez les services si nécessaire

---

**🎯 JustiClause** - Votre assistant IA pour l'analyse juridique intelligente
