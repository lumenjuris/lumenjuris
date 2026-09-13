/**
 * Contenu de l'email d'invitation à signer un document (envoyé au
 * cocontractant). Renvoie les lignes `<tr>` injectées dans le gabarit brandé
 * de la classe Mailer (header/footer ajoutés par `createHtmlFullContent`).
 */
export const templateSignatureInvite = (opts: {
  counterpartyName: string;
  documentName: string;
  signingLink: string;
  /** Nom du titulaire du compte à l'origine de la procédure. */
  senderName?: string;
  /**
   * E-mail du titulaire du compte à l'origine de la procédure. Affiché au
   * cocontractant pour qu'il sache à qui il a affaire : l'expéditeur technique
   * (no-reply de la plateforme) n'est jamais l'interlocuteur.
   */
  senderEmail?: string;
  /** Vrai quand il s'agit d'une relance et non du premier envoi. */
  isReminder?: boolean;
}) => {
  const { counterpartyName, documentName, signingLink, senderName, senderEmail, isReminder } = opts;
  const senderLabel = senderName || senderEmail || "";

  return `
    <tr>
      <td style="padding: 40px 40px 0;">
        <p style="margin:0 0 6px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                   font-size:12px; font-weight:600; color:#716af9; letter-spacing:1px; text-transform:uppercase;">
          ${isReminder ? "Rappel — Signature électronique" : "Signature électronique"}
        </p>
        <h1 style="margin:0 0 20px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                    font-size:26px; font-weight:700; color:#111827; line-height:1.2;">
          Bonjour ${counterpartyName ? `<span style="color:#716af9;">${counterpartyName}</span>` : ""}
        </h1>
        <p style="margin:0 0 24px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                   font-size:15px; line-height:1.7; color:#374151;">
          ${isReminder
            ? `Ce document attend toujours votre signature :`
            : `Vous avez reçu un document pour signature via la plateforme <strong>Lumen Juris</strong> :`}
          <strong>«&nbsp;${documentName}&nbsp;»</strong>${senderLabel ? `, envoyé par <strong>${senderLabel}</strong>` : ""}.
          Cliquez sur le bouton ci-dessous pour le consulter et le signer.
        </p>
      </td>
    </tr>

    <tr>
      <td style="padding: 0 40px 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0">
          <tr>
            <td style="border-radius:8px; background:linear-gradient(135deg,#5b52f0,#9b8fff);">
              <a href="${signingLink}"
                 style="display:inline-block; padding:14px 32px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                         font-size:15px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:8px;">
                Signer le document &rarr;
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
${senderEmail
      ? `
    <tr>
      <td style="padding: 0 40px 32px;">
        <table width="100%" cellpadding="0" cellspacing="0"
               style="background-color:#f7f9fc; border:1px solid #e8edf5; border-radius:8px;">
          <tr>
            <td style="padding:16px 20px;">
              <p style="margin:0 0 4px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                         font-size:12px; font-weight:600; color:#6b7280; letter-spacing:0.5px;">
                Votre interlocuteur
              </p>
              <p style="margin:0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                         font-size:13px; color:#374151; line-height:1.6;">
                ${senderLabel ? `<strong>${senderLabel}</strong><br>` : ""}
                <a href="mailto:${senderEmail}" style="color:#0D6EFD; text-decoration:none;">${senderEmail}</a><br>
                <span style="color:#6b7280; font-size:12px;">
                  Une question sur ce document ? Répondez à cet e-mail, la réponse lui sera adressée directement.
                </span>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>`
      : ""}

    <tr>
      <td style="padding: 0 40px 32px;">
        <table width="100%" cellpadding="0" cellspacing="0"
               style="background-color:#f8f7ff; border:1px solid #ede9fe; border-radius:8px;">
          <tr>
            <td style="padding:16px 20px;">
              <p style="margin:0 0 6px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                         font-size:12px; font-weight:600; color:#6b7280; letter-spacing:0.5px;">
                Le bouton ne fonctionne pas ?
              </p>
              <p style="margin:0; font-family:'Courier New',monospace; font-size:11px; color:#4b5563;
                         word-break:break-all; line-height:1.6;">
                ${signingLink}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <tr>
      <td style="padding: 0 40px 32px;">
        <table width="100%" cellpadding="0" cellspacing="0"
               style="background-color:#fffbeb; border-left:3px solid #f59e0b; border-radius:0 6px 6px 0;">
          <tr>
            <td style="padding:12px 16px;">
              <p style="margin:0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                         font-size:12px; color:#92400e; line-height:1.6;">
                <strong>Sécurité :</strong> Si vous n'attendiez pas ce message, vous pouvez l'ignorer.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
};
