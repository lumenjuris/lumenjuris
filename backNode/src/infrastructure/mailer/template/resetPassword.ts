export const templateResetPassword = (resetLink: string, username?: string) => {
  return `
        <tr>
            <td style="padding:30px; font-family: Arial, sans-serif; color:#1f2937;">

                <h2 style="margin-top:0; margin-bottom:10px;">Bonjour <strong>${username}</strong>.</h2>

                <p style="font-size:14px; line-height:1.6;">
                    Nous avons reçu une demande de réinitialisation du mot de passe associé à votre compte Lumen Juris.<br/>
                    Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe.
                </p>

                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:30px 0;width:100%">
                    <tr>
                        <td align="center">
                            <a href="${resetLink}"
                               style="background-color:#716af9; color:#ffffff; padding:12px 20px; text-decoration:none; border-radius:6px; font-weight:bold; display:inline-block;">
                                Réinitialiser mon mot de passe
                            </a>
                        </td>
                    </tr>
                </table>

                <p style="font-size:13px; color:#6b7280; line-height:1.5;">
                    Si le bouton ne fonctionne pas, vous pouvez également copier et coller le lien suivant dans votre navigateur :
                </p>

                <p style="font-size:12px; word-break:break-all; color:#4b5563;">
                    ${resetLink}
                </p>

                <p style="font-size:13px; color:#6b7280;">
                    Ce lien est valide pendant <strong>30 minutes</strong>. Passé ce délai, vous devrez effectuer une nouvelle demande.
                </p>

                <p style="font-size:13px; color:#6b7280;">
                    Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email. Votre mot de passe actuel restera inchangé.
                </p>

            </td>
        </tr>
    `;
};
