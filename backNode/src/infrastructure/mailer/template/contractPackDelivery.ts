/** Échappe un texte saisi par l'utilisateur (titre du contrat) avant de l'insérer dans le HTML. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Email de livraison d'un achat unitaire (Pack Contrat) : les documents sont
 * joints (PDF, Word, fiche de synthèse) et restent téléchargeables depuis la
 * contrathèque.
 */
export const templateContractPackDelivery = (opts: {
  username?: string;
  contractTitle: string;
  /** Libellés des pièces jointes, dans l'ordre */
  attachmentLabels: string[];
  contractUrl: string;
}) => {
  const attachmentRows = opts.attachmentLabels
    .map((label) => `
          <tr>
            <td style="padding:10px 20px; font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                        font-size:14px; color:#374151; border-bottom:1px solid #f1f3f7; background:#fff;">
              &#10003;&nbsp; ${escapeHtml(label)}
            </td>
          </tr>`)
    .join("");

  return `
    <tr>
      <td style="padding: 40px 40px 0;">
        <p style="margin:0 0 10px; font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                   font-size:11px; font-weight:600; color:#059669; letter-spacing:1.5px; text-transform:uppercase;">
          Pack Contrat Professionnel
        </p>
        <h1 style="margin:0 0 20px; font-family:'Newsreader',Georgia,'Times New Roman',serif;
                    font-size:28px; font-weight:400; color:#0A2540; line-height:1.25;">
          Vos documents sont prêts
        </h1>
        <p style="margin:0 0 24px; font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                   font-size:15px; line-height:1.7; color:#374151;">
          Bonjour${opts.username ? ` <strong>${escapeHtml(opts.username)}</strong>` : ""},<br>
          Merci pour votre achat. Vous trouverez en pièces jointes les documents de votre contrat
          <strong>${escapeHtml(opts.contractTitle)}</strong>.
        </p>
      </td>
    </tr>

    <tr>
      <td style="padding: 0 40px 28px;">
        <table width="100%" cellpadding="0" cellspacing="0"
               style="border:1px solid #e8ebf3; border-radius:12px; overflow:hidden;">
          <tr>
            <td style="background-color:#2C3A5E; padding:12px 20px; font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                        font-size:13px; font-weight:700; color:#ffffff;">
              Pièces jointes
            </td>
          </tr>
          ${attachmentRows}
        </table>
      </td>
    </tr>

    <tr>
      <td style="padding: 0 40px 28px;">
        <table role="presentation" cellpadding="0" cellspacing="0">
          <tr>
            <td style="border-radius:8px; background-color:#2C3A5E;">
              <a href="${opts.contractUrl}"
                 style="display:inline-block; padding:14px 32px; font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                         font-size:15px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:8px;">
                Retrouver mon contrat &rarr;
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <tr>
      <td style="padding: 0 40px 32px;">
        <p style="margin:0; font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                   font-size:12px; color:#6b7280; line-height:1.6;">
          Ces documents restent disponibles dans votre contrathèque : vous pouvez les retélécharger à tout moment.
          Votre facture vous est envoyée dans un e-mail séparé.
        </p>
      </td>
    </tr>
  `;
};
