
### Packages responsables du style dans le frontend

    Tailwind CSS (tailwindcss, postcss, autoprefixer) — génération/utilisation de classes utilitaires et post-traitement du CSS

    Chakra UI (@chakra-ui/react) — bibliothèque de composants design system

    Emotion (@emotion/react, @emotion/styled) — moteur CSS‑in‑JS utilisé par Chakra

    Framer Motion (framer-motion) — animations et transitions

    Lucide React (lucide-react) — icônes vectorielles

    React Hot Toast (react-hot-toast) — notifications stylisées

    Recharts (recharts) — graphiques interactifs avec styles intégrés



### process

1.Initialisation des services IA et OCR
  - Au chargement du module, le backend instancie un client OpenAI (pour la compréhension des clauses) et prépare, si possible, un client Google Cloud Vision pour l’OCR des PDF scannés
  code : back/services/pdf_processing.py 105

Endpoint d’analyse
L’API FastAPI expose POST /extract-pdf-text. Elle vérifie d’abord l’extension du fichier via allowed_file, lit son contenu puis enchaîne les étapes d’extraction de texte, correction, détection de clauses et génération de mots‑clés avant de renvoyer un objet JSON

.

Extraction du texte
_extract_text_from_pdf_content tente successivement trois méthodes :

    extraction rapide avec PyMuPDF,

    fallback pdfminer si le texte est insuffisant,

    OCR Google Vision en ultime recours.
    Cette fonction retourne le texte brut du PDF et lève une erreur si aucune méthode ne réussit

    .

Nettoyage minimal du texte
corriger_espaces ajoute les espaces manquants entre ponctuation et majuscules et réduit les doubles espaces pour stabiliser l’analyse ultérieure

.

Détection des clauses

    Approche IA : extract_clauses_ia_robuste envoie le texte à OpenAI avec un prompt structuré, puis recale chaque clause retournée sur le texte original via difflib pour obtenir les positions exactes.

    Fallback : en cas d’indisponibilité ou d’échec de l’IA, extract_clauses_with_positions applique plusieurs expressions régulières ciblant les structures contractuelles typiques (articles, clauses numérotées, résiliation, etc.)

    .

Extraction de mots‑clés
_extract_keywords_basic normalise le texte des clauses détectées, filtre les stopwords et certains “bruits”, calcule des fréquences pondérées par un bonus juridique, puis renvoie les termes les plus représentatifs du contrat
.
