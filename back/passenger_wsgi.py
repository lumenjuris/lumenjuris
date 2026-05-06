import sys
import os
import traceback

# Fichier de log personnalisé dans le serveur de production (O2Switch)
LOG_FILE = '/home/dxin1098/lumenjurisBackend.dxin1098.odns.fr/passenger_debug.log'

def log_error(message):
    with open(LOG_FILE, 'a') as f:
        f.write(f"{message}\n")

try:
    log_error("=== DEBUT CHARGEMENT ===")
    
    # CORRECTION : Ne pas vérifier l'interpréteur, Passenger gère déjà ça
    # Configuration de l'environnement virtuel via sys.path
    VENV_PATH = "/home/dxin1098/virtualenv/lumenjurisBackend.dxin1098.odns.fr/3.11"
    
    # Ajout des chemins Python du virtualenv
    sys.path.insert(0, os.path.join(VENV_PATH, 'lib', 'python3.11', 'site-packages'))
    
    # Ajout du répertoire de l'application au path
    BASE_DIR = os.path.dirname(__file__)
    sys.path.insert(0, BASE_DIR)
    log_error(f"BASE_DIR: {BASE_DIR}")
    log_error(f"sys.path configuré")
    
    # Chargement des variables d'environnement
    log_error("Chargement .env...")
    from dotenv import load_dotenv
    env_path = os.path.join(BASE_DIR, '.env')
    load_dotenv(env_path)
    log_error(f".env chargé depuis: {env_path}")
    
    # Import de votre app FastAPI
    log_error("Import app.main...")
    from app.main import app as fastapi_app
    log_error("app.main importé avec succès")
    
    # Adaptateur ASGI -> WSGI avec a2wsgi
    log_error("Import a2wsgi...")
    from a2wsgi import ASGIMiddleware
    log_error("Création de l'application WSGI...")
    application = ASGIMiddleware(fastapi_app)
    log_error("=== APPLICATION CHARGEE AVEC SUCCES ===")

except Exception as e:
    log_error(f"ERREUR: {str(e)}")
    log_error(f"TRACEBACK:\n{traceback.format_exc()}")
    
    # Créer une application de fallback pour afficher l'erreur
    def application(environ, start_response):
        status = '500 Internal Server Error'
        response_headers = [('Content-type', 'text/plain')]
        start_response(status, response_headers)
        return [f"Erreur de chargement: {str(e)}\nVoir {LOG_FILE}".encode('utf-8')]