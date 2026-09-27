export const templateTwoFactor = (code: string, username?: string) => {
  return `
    <tr>
      <td style="padding: 40px 40px 0;">
        <p style="margin:0 0 10px; font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                   font-size:11px; font-weight:600; color:#2C3A5E; letter-spacing:1.5px; text-transform:uppercase;">
          Authentification à deux facteurs
        </p>
        <h1 style="margin:0 0 20px; font-family:'Newsreader',Georgia,'Times New Roman',serif;
                    font-size:28px; font-weight:400; color:#0A2540; line-height:1.25;">
          Votre code de connexion
        </h1>
        <p style="margin:0 0 32px; font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                   font-size:15px; line-height:1.7; color:#374151;">
          Bonjour${username ? ` <strong>${username}</strong>` : ""},<br>
          Utilisez le code ci-dessous pour finaliser votre connexion à Lumen Juris.
        </p>
      </td>
    </tr>

    <tr>
      <td style="padding: 0 40px 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">
          <tr>
            <td align="center"
                style="background-color:#eef1fa; border:1.5px solid #2C3A5E; border-radius:12px; padding: 28px 40px;">
              <p style="margin:0 0 8px; font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                         font-size:11px; font-weight:600; color:#6b7280; letter-spacing:2px; text-transform:uppercase;">
                Code de vérification
              </p>
              <span style="font-family:'Courier New','Lucida Console',monospace; font-size:42px;
                            font-weight:700; letter-spacing:12px; color:#0A2540; display:block;">
                ${code}
              </span>
              <p style="margin:12px 0 0; font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                         font-size:12px; color:#6b7280;">
                Valide pendant <strong style="color:#2C3A5E;">15 minutes</strong>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <tr>
      <td style="padding: 0 40px 32px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:14px 18px; background-color:#fee2e2; border-left:3px solid #dc2626;
                        border-radius:0 6px 6px 0;">
              <p style="margin:0; font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                         font-size:12px; color:#991b1b; line-height:1.6;">
                <strong>Ne partagez jamais ce code.</strong> L'équipe Lumen Juris ne vous demandera jamais votre code 2FA.
                Si vous n'avez pas tenté de vous connecter, sécurisez votre compte immédiatement.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
};
