export const templateVerifyAccount = (
  verificationLink: string,
  username?: string,
) => {
  return `
    <tr>
      <td style="padding: 40px 40px 0;">
        <p style="margin:0 0 10px; font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                   font-size:11px; font-weight:600; color:#2C3A5E; letter-spacing:1.5px; text-transform:uppercase;">
          Vérification du compte
        </p>
        <h1 style="margin:0 0 20px; font-family:'Newsreader',Georgia,'Times New Roman',serif;
                    font-size:28px; font-weight:400; color:#0A2540; line-height:1.25;">
          Bonjour ${username ? `<span style="color:#2C3A5E;">${username}</span>` : ""}
        </h1>
        <p style="margin:0 0 24px; font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                   font-size:15px; line-height:1.7; color:#374151;">
          Bienvenue sur <strong>Lumen Juris</strong>. Pour activer votre compte et commencer à utiliser la plateforme,
          veuillez confirmer votre adresse email en cliquant sur le bouton ci-dessous.
        </p>
      </td>
    </tr>

    <tr>
      <td style="padding: 0 40px 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0">
          <tr>
            <td style="border-radius:8px; background-color:#2C3A5E;">
              <a href="${verificationLink}"
                 style="display:inline-block; padding:14px 32px; font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                         font-size:15px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:8px;">
                Vérifier mon adresse email &rarr;
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <tr>
      <td style="padding: 0 40px 32px;">
        <table width="100%" cellpadding="0" cellspacing="0"
               style="background-color:#f4f6fa; border:1px solid #e5e7eb; border-radius:8px;">
          <tr>
            <td style="padding:16px 20px;">
              <p style="margin:0 0 6px; font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                         font-size:12px; font-weight:600; color:#6b7280; letter-spacing:0.5px;">
                Le bouton ne fonctionne pas ?
              </p>
              <p style="margin:0; font-family:'Courier New',monospace; font-size:11px; color:#4b5563;
                         word-break:break-all; line-height:1.6;">
                ${verificationLink}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <tr>
      <td style="padding: 0 40px 32px;">
        <table width="100%" cellpadding="0" cellspacing="0"
               style="background-color:#fef3c7; border-left:3px solid #d97706; border-radius:0 6px 6px 0;">
          <tr>
            <td style="padding:12px 16px;">
              <p style="margin:0; font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                         font-size:12px; color:#92400e; line-height:1.6;">
                <strong>Sécurité :</strong> Si vous n'êtes pas à l'origine de cette inscription, ignorez cet email.
                Votre adresse ne sera pas utilisée.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
};
