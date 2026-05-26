export const templateWelcomeFreemium = (username?: string) => {
  return `
        <tr>
            <td style="padding:30px; font-family: Arial, sans-serif; color:#1f2937;">

                <h2 style="margin-top:0; margin-bottom:10px;">
                    Bienvenue sur Lumen Juris${username ? `, <strong>${username}</strong>` : ""} !
                </h2>

                <p style="font-size:14px; line-height:1.6;">
                    Merci pour votre inscription. Pour vous accueillir, nous vous offrons l'accès gratuit à notre formule <strong style="color:#716af9;">Freemium</strong>, activée dès maintenant sur votre compte.
                </p>

                <!-- Tableau des avantages inclus -->
                <table width="100%" cellpadding="0" cellspacing="0"
                       style="margin:24px 0; border:1px solid #e5e7eb; border-radius:8px; overflow:hidden;">

                    <!-- En-tête du tableau -->
                    <tr>
                        <td colspan="2"
                            style="background-color:#716af9; padding:12px 20px;
                                   font-family:Arial, sans-serif; font-size:14px;
                                   font-weight:bold; color:#ffffff; letter-spacing:0.3px;">
                            Ce que votre formule Freemium inclut
                        </td>
                    </tr>

                    <!-- Ligne 1 -->
                    <tr style="background-color:#f9fafb;">
                        <td style="padding:12px 20px; font-family:Arial, sans-serif;
                                   font-size:13px; color:#374151; border-bottom:1px solid #e5e7eb;">
                            📄 Analyse de contrats
                        </td>
                        <td style="padding:12px 20px; font-family:Arial, sans-serif;
                                   font-size:13px; font-weight:bold; color:#716af9;
                                   text-align:right; border-bottom:1px solid #e5e7eb;">
                            500 crédits / mois
                        </td>
                    </tr>

                    <!-- Ligne 2 -->
                    <tr>
                        <td style="padding:12px 20px; font-family:Arial, sans-serif;
                                   font-size:13px; color:#374151; border-bottom:1px solid #e5e7eb;">
                            ✍️ Signature électronique
                        </td>
                        <td style="padding:12px 20px; font-family:Arial, sans-serif;
                                   font-size:13px; font-weight:bold; color:#716af9;
                                   text-align:right; border-bottom:1px solid #e5e7eb;">
                            20 crédits / mois
                        </td>
                    </tr>

                    <!-- Ligne 3 -->
                    <tr style="background-color:#f9fafb;">
                        <td style="padding:12px 20px; font-family:Arial, sans-serif;
                                   font-size:13px; color:#374151;">
                            📝 Génération de documents
                        </td>
                        <td style="padding:12px 20px; font-family:Arial, sans-serif;
                                   font-size:13px; font-weight:bold; color:#716af9;
                                   text-align:right;">
                            30 crédits / mois
                        </td>
                    </tr>

                </table>

                <p style="font-size:14px; line-height:1.6; color:#374151;">
                    Ces crédits sont valables mois. Pour bénéficier de capacités supérieures, vous pouvez à tout moment passer à l'une de nos formules <strong>Starter</strong> ou <strong>Pro</strong> depuis votre tableau de bord.
                </p>

                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0; width:100%;">
                    <tr>
                        <td align="center">
                            <a href="${process.env.HOST_FRONT ?? "https://app.lumenjuris.com"}/analyzer"
                               style="background-color:#716af9; color:#ffffff; padding:12px 24px;
                                      text-decoration:none; border-radius:6px; font-weight:bold;
                                      font-family:Arial, sans-serif; font-size:14px; display:inline-block;">
                                Analyser mon premier contrat
                            </a>
                        </td>
                    </tr>
                </table>

                <p style="font-size:13px; color:#6b7280; line-height:1.5;">
                    Si vous avez la moindre question, notre équipe est disponible à l'adresse
                    <a href="mailto:contact@lumenjuris.com" style="color:#716af9; text-decoration:none;">contact@lumenjuris.com</a>.
                </p>

            </td>
        </tr>
    `;
};
