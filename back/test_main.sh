#!/bin/bash
# Chemin vers ton Python virtuel
VENV="/home/dxin1098/virtualenv/lumenjurisBackend.dxin1098.odns.fr/3.11/bin/python"

# Racine du projet
PROJECT_ROOT="$(pwd)"

echo "==> Test des imports et démarrage de main.py"
echo "Project root: $PROJECT_ROOT"
echo "Python: $VENV"

# Ajouter le projet au PYTHONPATH
export PYTHONPATH="$PROJECT_ROOT:$PYTHONPATH"
echo "PYTHONPATH=$PYTHONPATH"

# Test import app.main
echo "==> Test import app.main"
$VENV -c "import sys; import os; sys.path.insert(0, '$PROJECT_ROOT'); from app.main import app; print('✅ app.main import OK'); print('app =', app)"

# Test import services.pdf_processing
echo "==> Test import services.pdf_processing"
$VENV -c "import sys; import os; sys.path.insert(0, '$PROJECT_ROOT'); from services.pdf_processing import allowed_file, corriger_espaces; print('✅ services.pdf_processing import OK')"

#Teste import legal_watch
echo "==> Test import legal_watch.router"
$VENV -c "import sys; sys.path.insert(0, '$PROJECT_ROOT'); from legal_watch.router import router; print('✅ legal_watch.router import OK')"

echo "==> Test terminé"
