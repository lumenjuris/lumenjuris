#!/usr/bin/env node
/**
 * Garde-fou serveur o2switch.
 *
 * Inspecte chaque commande avant execution. Si la commande touche au serveur
 * (ssh / scp / rsync / sftp), elle n'est autorisee que si TOUS les dossiers
 * qu'elle mentionne appartiennent a Lumen Juris.
 *
 * Principe : liste d'autorisation, pas liste noire. Un site ajoute plus tard
 * sur le meme hebergement est protege sans rien modifier ici.
 *
 * Les commandes qui ne touchent pas au serveur ne sont pas concernees.
 */

const DOSSIERS_AUTORISES = new Set([
  // application beta
  "lumenjurisFront",
  "lumenjurisfront.dxin1098.odns.fr",
  "lumenjurisproxy.lumenjuris.com",
  "lumenjurisbackendnodejs.lumenjuris.com",
  "lumenjurisBackendNodejs.lumenjuris.com",
  "backendNodeJs.lumenjuris.com",
  "lumenjurisBackend.dxin1098.odns.fr",
  "backend.python.lumenjuris.com",
  // site vitrine
  "lumenjuris.com",
  // dossiers de travail crees pour les deploiements
  "sauvegardes-deploiement",
]);

const UTILISATEUR = "dxin1098";

function refuser(raison) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: raison,
      },
    }),
  );
  process.exit(0);
}

function laisserPasser() {
  process.exit(0);
}

let entree = "";
process.stdin.on("data", (bloc) => (entree += bloc));
process.stdin.on("end", () => {
  let commande = "";
  try {
    commande = JSON.parse(entree)?.tool_input?.command ?? "";
  } catch {
    laisserPasser();
  }
  if (!commande) laisserPasser();

  // La commande touche-t-elle au serveur ?
  if (!/\b(ssh|scp|rsync|sftp)\b/.test(commande)) laisserPasser();

  // Un script envoye au serveur par un canal indirect echappe a l'inspection
  // ci-dessous : son contenu n'est pas dans la commande. On refuse.
  const scriptIndirect =
    /\b(ssh|sftp)\b[^|;&]*\b(bash|sh|zsh|python\d?|perl|node)\b\s+-(?:\S*s\S*)?(?=[\s"'`;|&]|$)/;
  if (scriptIndirect.test(commande)) {
    refuser(
      "Cette commande enverrait un script au serveur sans que son contenu soit verifiable. " +
        "Ecrire les commandes en clair pour qu'elles puissent etre controlees.",
    );
  }

  // Destructions massives, quel que soit le dossier vise.
  const finDeCible = `(?=["'\`\\s;&|)]|$)`;
  const destructionsInterdites = [
    // suppression visant la racine du compte, le disque, ou le dossier maison
    new RegExp(
      `\\brm\\s+(-\\S+\\s+)*(~/?|/|/home/${UTILISATEUR}/?)${finDeCible}`,
    ),
    // suppression avec joker : la cible reelle n'est pas verifiable
    /\brm\s+(-\S+\s+)*[^\s;&|]*\*/,
  ];
  for (const motif of destructionsInterdites) {
    if (motif.test(commande)) {
      refuser(
        "Suppression trop large sur le serveur o2switch (racine du compte ou joker). " +
          "Viser un dossier Lumen Juris precis, ou demander a Geoff de le faire lui-meme.",
      );
    }
  }

  // Tous les dossiers du compte mentionnes doivent appartenir a Lumen Juris.
  const motifsChemin = [
    new RegExp(`/home/${UTILISATEUR}/([^/\\s'"\`;&|)]+)`, "g"),
    /~\/([^/\s'"`;&|)]+)/g,
  ];

  const interdits = new Set();
  for (const motif of motifsChemin) {
    for (const trouve of commande.matchAll(motif)) {
      const dossier = trouve[1];
      // chemins locaux au poste de travail : hors sujet
      if (dossier === ".ssh") continue;
      if (!DOSSIERS_AUTORISES.has(dossier)) interdits.add(dossier);
    }
  }

  if (interdits.size > 0) {
    refuser(
      `Cette commande touche des dossiers du serveur qui n'appartiennent pas a Lumen Juris : ` +
        `${[...interdits].join(", ")}. ` +
        `Seuls les dossiers Lumen Juris sont autorises (${[...DOSSIERS_AUTORISES].join(", ")}). ` +
        `Si l'acces est reellement necessaire, en parler a Geoff plutot que de contourner.`,
    );
  }

  laisserPasser();
});
