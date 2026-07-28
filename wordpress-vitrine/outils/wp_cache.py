# -*- coding: utf-8 -*-
"""Ouvre une session admin WordPress et purge les caches Elementor.

La purge des caches Elementor (CSS + cache d'elements) n'est pas exposee par
l'API REST : elle passe par l'ecran « Outils » d'Elementor, protege par un nonce.
Ce script se connecte via wp-login.php avec les identifiants de config.txt, puis
declenche la regeneration.
"""
import http.cookiejar
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import wp_api  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
UA = wp_api.UA


def make_opener():
    jar = http.cookiejar.CookieJar()
    return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar)), jar


def login(opener):
    lines = (ROOT / "config.txt").read_text(encoding="utf-8").splitlines()
    password = lines[1].strip()
    # WordPress exige que le cookie de test soit pose avant l'envoi du formulaire
    opener.open(urllib.request.Request(
        f"{wp_api.SITE}/wp-login.php", headers={"User-Agent": UA}), timeout=60).read()
    data = urllib.parse.urlencode({
        "log": "admin",
        "pwd": password,
        "wp-submit": "Se connecter",
        "redirect_to": f"{wp_api.SITE}/wp-admin/",
        "testcookie": "1",
    }).encode()
    req = urllib.request.Request(
        f"{wp_api.SITE}/wp-login.php", data=data,
        headers={"User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded"})
    with opener.open(req, timeout=60) as r:
        html = r.read().decode("utf-8", "replace")
    if "loginform" in html or "login_error" in html:
        raise SystemExit("Echec de connexion : verifiez le mot de passe de config.txt")
    return html


def get(opener, url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with opener.open(req, timeout=90) as r:
        return r.read().decode("utf-8", "replace")


def post(opener, url, fields):
    data = urllib.parse.urlencode(fields).encode()
    req = urllib.request.Request(
        url, data=data,
        headers={"User-Agent": UA,
                 "Content-Type": "application/x-www-form-urlencoded",
                 "X-Requested-With": "XMLHttpRequest"})
    with opener.open(req, timeout=180) as r:
        return r.read().decode("utf-8", "replace")


def main():
    opener, _ = make_opener()
    login(opener)
    print("Connexion admin : OK")

    tools = get(opener, f"{wp_api.SITE}/wp-admin/admin.php?page=elementor-tools")
    nonce = None
    for pat in (r'"elementor_ajax"[^"]*"([a-f0-9]{10})"',
                r'elementorCommonConfig.*?"nonce":"([a-f0-9]{10})"',
                r'name="_wpnonce"\s+value="([a-f0-9]{10})"',
                r'"nonce":"([a-f0-9]{10})"'):
        m = re.search(pat, tools, re.S)
        if m:
            nonce = m.group(1)
            break
    if not nonce:
        raise SystemExit("Nonce Elementor introuvable sur la page Outils.")
    print(f"Nonce Elementor : {nonce}")

    # Regeneration des fichiers CSS et purge du cache d'elements
    for action in ("elementor_clear_cache", "elementor_reset_element_cache"):
        try:
            res = post(opener, f"{wp_api.SITE}/wp-admin/admin-ajax.php",
                       {"action": action, "_nonce": nonce})
            print(f"{action} -> {res[:120]}")
        except Exception as e:  # noqa: BLE001
            print(f"{action} -> erreur {e}")


if __name__ == "__main__":
    main()
