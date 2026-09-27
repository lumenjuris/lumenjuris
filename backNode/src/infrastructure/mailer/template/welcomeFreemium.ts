// Adresse du tableau de bord (une seule source pour le lien du CTA).
const dashboardUrl = `${process.env.HOST_FRONT ?? "https://app.lumenjuris.com"}/dashboard`;

/**
 * Une étape « premiers pas » : un numéro dans une pastille navy, un titre et
 * une courte description orientée bénéfice. `dernier` retire le trait de
 * séparation sous la dernière étape.
 */
function etapePremierPas(
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

export const templateWelcomeFreemium = (username?: string) => {
  return `
    <tr>
      <td style="padding: 40px 40px 0;">
        <p style="margin:0 0 10px; font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                   font-size:11px; font-weight:600; color:#059669; letter-spacing:1.5px; text-transform:uppercase;">
          Bienvenue
        </p>
        <h1 style="margin:0 0 20px; font-family:'Newsreader',Georgia,'Times New Roman',serif;
                    font-size:28px; font-weight:400; color:#0A2540; line-height:1.25;">
          Bienvenue sur Lumen Juris${username ? `,<br><span style="color:#2C3A5E;">${username}</span>` : ""}
        </h1>
        <p style="margin:0 0 28px; font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                   font-size:15px; line-height:1.7; color:#374151;">
          Votre poste de travail juridique est prêt. Rédigez, analysez, négociez et faites signer
          vos contrats au même endroit — avec des explications en clair, sans jargon inutile.
        </p>
      </td>
    </tr>

    <tr>
      <td style="padding: 0 40px 12px;">
        <p style="margin:0 0 18px; font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                   font-size:11px; font-weight:600; color:#9ca3af; letter-spacing:1.5px; text-transform:uppercase;">
          Vos premiers pas
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
          ${etapePremierPas(
            1,
            "Analysez un contrat existant",
            "Importez un document et repérez en quelques secondes les clauses à risque, expliquées une à une.",
          )}
          ${etapePremierPas(
            2,
            "Générez un contrat sur mesure",
            "Décrivez votre besoin : Lumen Juris rédige un document prêt à l'emploi, que vous gardez la main de modifier.",
          )}
          ${etapePremierPas(
            3,
            "Envoyez à la signature",
            "Faites signer vos documents électroniquement et suivez leur avancement, du premier envoi à la signature finale.",
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
                Ouvrir mon tableau de bord &rarr;
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <tr>
      <td style="padding: 0 40px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0"
               style="background-color:#f4f6fa; border:1px solid #e5e7eb; border-radius:8px;">
          <tr>
            <td style="padding:16px 20px;">
              <p style="margin:0; font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                         font-size:13px; color:#4b5563; line-height:1.6;">
                <strong style="color:#0A2540;">Votre formule Freemium est active.</strong>
                Elle inclut des crédits d'analyse, de génération et de signature, renouvelés chaque mois.
                Retrouvez leur détail et vos options d'évolution depuis votre tableau de bord.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <tr>
      <td style="padding: 0 40px 32px;">
        <p style="margin:0; font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                   font-size:13px; color:#6b7280; line-height:1.7;">
          Une question pour bien démarrer ? Écrivez-nous à
          <a href="mailto:contact@lumenjuris.com" style="color:#2563EB; text-decoration:none; font-weight:600;">contact@lumenjuris.com</a> —
          une vraie personne vous répond.
        </p>
      </td>
    </tr>
  `;
};
