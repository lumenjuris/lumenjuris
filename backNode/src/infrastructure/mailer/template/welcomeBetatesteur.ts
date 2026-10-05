// Mail de bienvenue quand un utilisateur vient d'être passé en bêta-testeur
// depuis le monitoring (route admin PATCH /users/:idUser/plan).

// Adresse du tableau de bord (une seule source pour le lien du CTA).
const dashboardUrl = `${process.env.HOST_FRONT ?? "https://app.lumenjuris.com"}/dashboard`;

/**
 * Une ligne « ce qu'on attend de vous » : une pastille navy numérotée, un titre
 * et une courte description. `dernier` retire le trait sous la dernière ligne.
 */
function ligneMission(
  numero: number,
  titre: string,
  description: string,
  dernier = false,
): string {
  return `
    <tr>
      <td valign="top" width="40" style="width:40px; padding:0 14px ${dernier ? "0" : "18px"} 0;">
        <div style="width:28px; height:28px; line-height:28px; border-radius:8px; background-color:#2C3A5E;
                    color:#ffffff; font-family:'Inter',Arial,sans-serif; font-size:13px; font-weight:700;
                    text-align:center;">${numero}</div>
      </td>
      <td valign="top" style="padding:0 0 ${dernier ? "0" : "18px"};
                  border-bottom:${dernier ? "0" : "1px solid #f1f3f7"};">
        <p style="margin:0 0 4px; font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                   font-size:14px; font-weight:600; color:#0A2540; line-height:1.4;">
          ${titre}
        </p>
        <p style="margin:0; font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                   font-size:13px; color:#6b7280; line-height:1.6;">
          ${description}
        </p>
      </td>
    </tr>
  `;
}

/**
 * @param username  prénom de l'utilisateur (facultatif)
 * @param expiresAt date de fin de l'accès bêta-testeur
 */
export const templateWelcomeBetatesteur = (username?: string, expiresAt?: Date) => {
  // Ex : « 1 décembre 2026 »
  const dateFin = expiresAt
    ? expiresAt.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
    : null;

  return `
    <tr>
      <td style="padding: 40px 40px 0;">
        <p style="margin:0 0 10px; font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                   font-size:11px; font-weight:600; color:#059669; letter-spacing:1.5px; text-transform:uppercase;">
          Accès bêta-testeur activé
        </p>
        <h1 style="margin:0 0 20px; font-family:'Newsreader',Georgia,'Times New Roman',serif;
                    font-size:28px; font-weight:400; color:#0A2540; line-height:1.25;">
          Merci de rejoindre l'aventure${username ? `,<br><span style="color:#2C3A5E;">${username}</span>` : ""}
        </h1>
        <p style="margin:0 0 28px; font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                   font-size:15px; line-height:1.7; color:#374151;">
          Vous faites désormais partie des bêta-testeurs de Lumen Juris. Votre compte vient d'être
          crédité : vous pouvez utiliser l'analyse, la génération et la signature de contrats
          gratuitement, et nous aider à construire un outil qui répond vraiment à vos besoins.
        </p>
      </td>
    </tr>

    <tr>
      <td style="padding: 0 40px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0"
               style="background-color:#ecfdf5; border:1px solid #a7f3d0; border-radius:8px;">
          <tr>
            <td style="padding:16px 20px;">
              <p style="margin:0; font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                         font-size:13px; color:#065f46; line-height:1.6;">
                <strong>Votre formule Bêta-testeur est active${dateFin ? ` jusqu'au ${dateFin}` : ""}.</strong>
                Aucun moyen de paiement n'est demandé et rien ne vous sera facturé.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <tr>
      <td style="padding: 0 40px 12px;">
        <p style="margin:0 0 18px; font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                   font-size:11px; font-weight:600; color:#9ca3af; letter-spacing:1.5px; text-transform:uppercase;">
          Comment nous aider
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
          ${ligneMission(
            1,
            "Utilisez Lumen Juris sur vos vrais dossiers",
            "Analysez, générez et faites signer vos contrats du quotidien : c'est en conditions réelles que l'on apprend le plus.",
          )}
          ${ligneMission(
            2,
            "Signalez ce qui coince",
            "Un bug, une explication peu claire, une étape trop longue ? Chaque remarque compte, même la plus petite.",
          )}
          ${ligneMission(
            3,
            "Partagez vos idées",
            "Une fonctionnalité vous manque ? Dites-le-nous : les retours des bêta-testeurs orientent directement nos priorités.",
            true,
          )}
        </table>
      </td>
    </tr>

    <tr>
      <td style="padding: 24px 40px 28px;">
        <table role="presentation" cellpadding="0" cellspacing="0">
          <tr>
            <td style="border-radius:8px; background-color:#2C3A5E;">
              <a href="${dashboardUrl}"
                 style="display:inline-block; padding:14px 32px; font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                         font-size:15px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:8px;">
                Commencer à tester &rarr;
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <tr>
      <td style="padding: 0 40px 32px;">
        <p style="margin:0; font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                   font-size:13px; color:#6b7280; line-height:1.7;">
          Pour tout retour, écrivez-nous à
          <a href="mailto:contact@lumenjuris.com" style="color:#2563EB; text-decoration:none; font-weight:600;">contact@lumenjuris.com</a> —
          une vraie personne de l'équipe vous lit et vous répond.
        </p>
      </td>
    </tr>
  `;
};
