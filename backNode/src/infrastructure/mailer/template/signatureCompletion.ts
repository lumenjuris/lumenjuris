/**
 * Contenu de l'email de confirmation envoyé aux deux parties une fois le
 * document signé. Renvoie les lignes `<tr>` injectées dans le gabarit brandé
 * de la classe Mailer (header/footer ajoutés par `createHtmlFullContent`).
 */
export const templateSignatureCompletion = (opts: {
  recipientName: string;
  documentName: string;
  /** Nom (ou e-mail à défaut) du titulaire du compte émetteur. */
  selfLabel: string;
  /** E-mail du titulaire du compte à l'origine de la procédure. */
  selfEmail?: string;
  counterpartyName: string;
  counterpartyEmail?: string;
  signedDate: string;
  hasPdf: boolean;
}) => {
  const {
    recipientName, documentName, selfLabel, selfEmail,
    counterpartyName, counterpartyEmail, signedDate, hasPdf,
  } = opts;

  return `
    <tr>
      <td style="padding: 40px 40px 0;">
        <p style="margin:0 0 6px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                   font-size:12px; font-weight:600; color:#10b981; letter-spacing:1px; text-transform:uppercase;">
          Document signé
        </p>
        <h1 style="margin:0 0 20px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                    font-size:26px; font-weight:700; color:#111827; line-height:1.2;">
          Bonjour ${recipientName ? `<span style="color:#716af9;">${recipientName}</span>` : ""}
        </h1>
        <p style="margin:0 0 24px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                   font-size:15px; line-height:1.7; color:#374151;">
          Le document <strong>«&nbsp;${documentName}&nbsp;»</strong> a été signé par les deux parties
          le <strong>${signedDate}</strong>.
        </p>
      </td>
    </tr>

    <tr>
      <td style="padding: 0 40px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0"
               style="background-color:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px;">
          <tr>
            <td style="padding:16px 20px;">
              <p style="margin:0 0 8px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                         font-size:13px; font-weight:700; color:#166534;">
                Signataires
              </p>
              <p style="margin:0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                         font-size:13px; color:#166534; line-height:1.7;">
                &bull; <strong>${selfLabel}</strong> (émetteur)${selfEmail ? ` &mdash; ${selfEmail}` : ""}<br>
                &bull; <strong>${counterpartyName}</strong> (cocontractant)${counterpartyEmail ? ` &mdash; ${counterpartyEmail}` : ""}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
${hasPdf
      ? `
    <tr>
      <td style="padding: 0 40px 32px;">
        <table width="100%" cellpadding="0" cellspacing="0"
               style="background-color:#f8f7ff; border:1px solid #ede9fe; border-radius:8px;">
          <tr>
            <td style="padding:14px 18px;">
              <p style="margin:0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                         font-size:13px; color:#4b5563; line-height:1.6;">
                Le document signé est joint en pièce jointe (PDF). Conservez-le comme preuve de signature.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>`
      : ""}
  `;
};
