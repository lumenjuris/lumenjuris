#!/usr/bin/env python3
"""Test d'envoi d'un e-mail via le SMTP du projet (o2switch par defaut).

Reprend exactement la configuration de
lumenjuris/backNode/src/infrastructure/mailer/classMailer.ts :
MAILER_HOST, MAILER_PORT, MAILER_USER_O2S, MAILER_PASS_O2S.

Exemples :
  python3 scripts/test_envoi.py --to moi@exemple.com --dry-run
  python3 scripts/test_envoi.py --to moi@exemple.com
"""

import argparse
import os
import smtplib
import ssl
import sys
from email.message import EmailMessage
from email.utils import formatdate, make_msgid
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent


def charge_env():
    """Lit les .env du projet sans dependance externe. Ne remplace jamais une
    variable deja definie dans l'environnement."""
    for chemin in (RACINE / ".env", RACINE / "lumenjuris" / "backNode" / ".env"):
        if not chemin.is_file():
            continue
        for ligne in chemin.read_text(encoding="utf-8", errors="replace").splitlines():
            ligne = ligne.strip()
            if not ligne or ligne.startswith("#") or "=" not in ligne:
                continue
            cle, _, valeur = ligne.partition("=")
            cle = cle.strip()
            valeur = valeur.strip().strip('"').strip("'")
            os.environ.setdefault(cle, valeur)


def construis_message(expediteur, destinataire, sujet):
    msg = EmailMessage()
    msg["From"] = expediteur
    msg["To"] = destinataire
    msg["Subject"] = sujet
    msg["Date"] = formatdate(localtime=True)
    msg["Message-ID"] = make_msgid(domain="lumenjuris.com")
    msg.set_content(
        "Ceci est un e-mail de test envoye depuis le serveur d'envoi de Lumen Juris.\n"
        "Si vous le recevez, la configuration SMTP fonctionne.\n"
    )
    return msg


def main():
    p = argparse.ArgumentParser(description="Test d'envoi SMTP Lumen Juris")
    p.add_argument("--to", required=True, help="Adresse destinataire")
    p.add_argument("--from", dest="expediteur", default="contact@lumenjuris.com",
                   help="Adresse expediteur (defaut : contact@lumenjuris.com)")
    p.add_argument("--subject", default="Test d'envoi Lumen Juris", help="Sujet")
    p.add_argument("--dry-run", action="store_true",
                   help="N'envoie rien : affiche la configuration et le message")
    args = p.parse_args()

    charge_env()

    hote = os.environ.get("MAILER_HOST", "mail.lumenjuris.com")
    port = int(os.environ.get("MAILER_PORT", "465"))
    utilisateur = os.environ.get("MAILER_USER_O2S")
    motdepasse = os.environ.get("MAILER_PASS_O2S")

    msg = construis_message(args.expediteur, args.to, args.subject)

    print("=== Configuration SMTP ===")
    print(f"  Serveur      : {hote}:{port} ({'SSL direct' if port == 465 else 'STARTTLS'})")
    print(f"  Identifiant  : {utilisateur or '(MANQUANT : MAILER_USER_O2S)'}")
    print(f"  Mot de passe : {'defini' if motdepasse else '(MANQUANT : MAILER_PASS_O2S)'}")
    print("\n=== Message ===")
    print(f"  De      : {args.expediteur}")
    print(f"  A       : {args.to}")
    print(f"  Sujet   : {args.subject}")
    print(f"\n{msg.get_content()}")

    if args.dry_run:
        print("=== Simulation (--dry-run) : aucun e-mail envoye, aucune connexion ouverte ===")
        if not utilisateur or not motdepasse:
            print("Attention : sans MAILER_USER_O2S et MAILER_PASS_O2S, l'envoi reel echouera.")
        return 0

    if not utilisateur or not motdepasse:
        print("\nErreur : identifiants SMTP absents. Renseignez MAILER_USER_O2S et "
              "MAILER_PASS_O2S dans un fichier .env avant l'envoi reel.", file=sys.stderr)
        return 1

    contexte = ssl.create_default_context()
    try:
        if port == 465:
            serveur = smtplib.SMTP_SSL(hote, port, context=contexte, timeout=10)
        else:
            serveur = smtplib.SMTP(hote, port, timeout=10)
            serveur.starttls(context=contexte)
        with serveur:
            serveur.login(utilisateur, motdepasse)
            serveur.send_message(msg)
    except Exception as err:
        print(f"\nEchec de l'envoi : {type(err).__name__} : {err}", file=sys.stderr)
        return 1

    print("=== E-mail envoye ===")
    return 0


if __name__ == "__main__":
    sys.exit(main())
