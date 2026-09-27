function formatEur(cents: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/**
 * Email d'information envoyé quand un paiement d'abonnement échoue.
 * Stripe retente automatiquement : on rassure l'utilisateur tout en l'invitant
 * à vérifier son moyen de paiement pour éviter une rétrogradation.
 */
export const templatePaymentFailed = (opts: {
  username?: string;
  planName: string;
  amountCents: number;
  manageBillingUrl: string;
}) => {
  return `
    <tr>
      <td style="padding: 40px 40px 0;">
        <p style="margin:0 0 10px; font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                   font-size:11px; font-weight:600; color:#d97706; letter-spacing:1.5px; text-transform:uppercase;">
          Paiement échoué
        </p>
        <h1 style="margin:0 0 20px; font-family:'Newsreader',Georgia,'Times New Roman',serif;
                    font-size:28px; font-weight:400; color:#0A2540; line-height:1.25;">
          Votre paiement n'a pas abouti
        </h1>
        <p style="margin:0 0 24px; font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                   font-size:15px; line-height:1.7; color:#374151;">
          Bonjour${opts.username ? ` <strong>${opts.username}</strong>` : ""},<br>
          Le paiement de <strong>${formatEur(opts.amountCents)}</strong> pour votre abonnement
          <strong>Lumen Juris — Plan ${opts.planName}</strong> n'a pas pu être encaissé.
          Pas d'inquiétude : le prélèvement sera automatiquement retenté dans les prochains jours.
        </p>
      </td>
    </tr>

    <tr>
      <td style="padding: 0 40px 28px;">
        <table role="presentation" cellpadding="0" cellspacing="0">
          <tr>
            <td style="border-radius:8px; background-color:#2C3A5E;">
              <a href="${opts.manageBillingUrl}"
                 style="display:inline-block; padding:14px 32px; font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                         font-size:15px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:8px;">
                Mettre à jour mon paiement &rarr;
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
              <p style="margin:0 0 6px; font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                         font-size:12px; font-weight:600; color:#6b7280; letter-spacing:0.5px;">
                Le bouton ne fonctionne pas ?
              </p>
              <p style="margin:0; font-family:'Courier New',monospace; font-size:11px; color:#4b5563;
                         word-break:break-all; line-height:1.6;">
                ${opts.manageBillingUrl}
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
                <strong>Pour éviter toute interruption</strong>, vérifiez votre moyen de paiement.
                Si les tentatives suivantes échouent, votre abonnement sera automatiquement
                rétrogradé vers l'offre gratuite.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
};
