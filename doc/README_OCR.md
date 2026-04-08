# 🚀 Installation OCR pour PDF Scannés

## 📋 Résumé
Le serveur supporte maintenant les **PDF scannés** avec 3 moteurs OCR :

1. **EasyOCR** ⚡ - Le plus rapide et précis (recommandé)
2. **PaddleOCR** 🚀 - Alternative rapide 
3. **Tesseract** 📄 - Standard (plus lent)

## 🔧 Installation rapide

### Option 1 : Script automatique
```batch
# Exécutez simplement :
install_ocr.bat
```

### Option 2 : Installation manuelle
```bash
# Dépendances Python
pip install easyocr paddleocr pdf2image Pillow pytesseract

# Tesseract (optionnel)
# Télécharger depuis : https://github.com/UB-Mannheim/tesseract/wiki
# Installer dans : C:\Program Files\Tesseract-OCR\

# Poppler pour PDF2Image (requis)
# Télécharger depuis : https://github.com/oschwartz10612/poppler-windows/releases/
# Extraire dans : C:\poppler\
# Ajouter au PATH : C:\poppler\Library\bin\
```

## ⚡ Performance

| OCR Engine | Vitesse | Précision | GPU | Taille |
|------------|---------|-----------|-----|--------|
| EasyOCR    | ⚡⚡⚡    | 🎯🎯🎯    | Opt | ~500MB |
| PaddleOCR  | ⚡⚡     | 🎯🎯     | Opt | ~200MB |
| Tesseract  | ⚡       | 🎯🎯     | Non | ~100MB |

## 🔄 Workflow automatique

1. **PDF normal** → `pdfplumber` (instantané)
2. **PDF scanné détecté** → Utilise le meilleur OCR disponible
3. **Fallback intelligent** → Si un OCR échoue, essaie le suivant
4. **Extraction rapide pour questions** → Texte brut pour pré-remplissage
5. **Mistral pour analyse finale** → Texte parfait pour l'IA

## ✅ Test
```bash
# Redémarrez le serveur après installation
python pdf_extractor_server.py

# Logs au démarrage montreront :
# ✅ EasyOCR disponible (rapide)
# 🚀 EasyOCR initialisé (mode rapide)
```

## 🎯 Avantages
- **Pas de coût** pour l'extraction OCR (local)
- **Compatible** tous types de PDF
- **Rapide** - optimisé pour vitesse
- **Robust** - fallback automatique
- **Questions pré-remplies** même avec PDF scannés
- **Double extraction** (rapide + Mistral qualité)
