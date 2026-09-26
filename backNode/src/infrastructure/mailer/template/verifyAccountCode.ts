export const templateVerifyAccountCode = (code: string, username?: string) => {
  return `
    <tr>
      <td style="padding: 40px 40px 0;">
        <p style="margin:0 0 6px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                   font-size:12px; font-weight:600; color:#716af9; letter-spacing:1px; text-transform:uppercase;">
          Activation du compte
        </p>
        <h1 style="margin:0 0 20px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                    font-size:26px; font-weight:700; color:#111827; line-height:1.2;">
          Votre code d'activation
        </h1>
        <p style="margin:0 0 32px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                   font-size:15px; line-height:1.7; color:#374151;">
          Bonjour${username ? ` <strong>${username}</strong>` : ""},<br>
          Saisissez le code ci-dessous dans le formulaire pour activer votre compte Lumen Juris.
        </p>
      </td>
    </tr>

    <tr>
      <td style="padding: 0 40px 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">
          <tr>
            <td align="center"
                style="background: linear-gradient(135deg, #f8f7ff 0%, #ede9fe 100%);
                        border: 2px solid #716af9; border-radius:12px; padding: 28px 40px;">
              <p style="margin:0 0 8px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                         font-size:11px; font-weight:600; color:#6b7280; letter-spacing:2px; text-transform:uppercase;">
                Code d'activation
              </p>
              <span style="font-family:'Courier New','Lucida Console',monospace; font-size:42px;
                            font-weight:700; letter-spacing:12px; color:#111827; display:block;">
                ${code}
              </span>
              <p style="margin:12px 0 0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                         font-size:12px; color:#9b8fff;">
                Valide pendant <strong>15 minutes</strong>
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
            <td style="padding:14px 18px; background-color:#fff1f2; border-left:3px solid #ef4444;
                        border-radius:0 6px 6px 0;">
              <p style="margin:0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                         font-size:12px; color:#991b1b; line-height:1.6;">
                <strong>Ne partagez jamais ce code.</strong> Si vous n'êtes pas à l'origine de cette
                inscription, ignorez cet e-mail.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
};
