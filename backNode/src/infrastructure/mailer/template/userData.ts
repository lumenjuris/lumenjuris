export const templateExportData = (username?: string) => {
  return `
    <tr>
      <td style="padding: 40px 40px 0;">
        <p style="margin:0 0 10px; font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                   font-size:11px; font-weight:600; color:#2C3A5E; letter-spacing:1.5px; text-transform:uppercase;">
          Export de vos données
        </p>
        <h1 style="margin:0 0 20px; font-family:'Newsreader',Georgia,'Times New Roman',serif;
                    font-size:28px; font-weight:400; color:#0A2540; line-height:1.25;">
          Bonjour <span style="color:#2C3A5E;">${username || "Abonné"}</span>
        </h1>
        <p style="margin:0 0 20px; font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                   font-size:15px; line-height:1.7; color:#374151;">
          Conformément à votre demande, nous avons préparé l'export complet des données associées
          à votre compte Lumen Juris. Vous le trouverez en pièce jointe.
        </p>
        <p style="margin:0 0 28px; font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                   font-size:15px; line-height:1.7; color:#374151;">
          Le fichier est au format <strong>.json</strong>, un format standardisé et structuré qui vous
          permet de lire vos données de façon transparente ou de les transférer si nécessaire.
        </p>
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
                <strong style="color:#111827;">Sécurité de vos données :</strong> ce fichier contient des
                informations personnelles et confidentielles sur vos activités. Nous vous conseillons de
                le conserver dans un endroit sécurisé et de ne pas le partager.
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
            <td style="padding:14px 18px; background-color:#fef3c7; border-left:3px solid #d97706;
                        border-radius:0 6px 6px 0;">
              <p style="margin:0; font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                         font-size:12px; color:#92400e; line-height:1.6;">
                Si vous n'êtes pas à l'origine de cette demande, une personne a peut-être demandé l'export
                depuis votre espace client. En cas d'activité anormale, modifiez votre mot de passe sans tarder.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
};
