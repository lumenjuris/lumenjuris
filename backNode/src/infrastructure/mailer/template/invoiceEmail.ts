import type { InvoiceData } from "../../pdf/invoicePDF";

const VAT_RATE = 0.2;

function centToEuro(cents: number): number {
  return cents / 100;
}

function formatEur(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function intervalLabel(interval: string): string {
  return interval === "year" ? "annuel" : "mensuel";
}

export const templateInvoiceEmail = (
  data: InvoiceData,
  username?: string,
) => {
  const ttc = centToEuro(data.amountTTCCents);
  const ht = ttc / (1 + VAT_RATE);
  const tva = ttc - ht;

  return `
    <tr>
      <td style="padding:30px; font-family: Arial, sans-serif; color:#1f2937;">

        <h2 style="margin-top:0; margin-bottom:10px;">
          Bonjour <strong>${username ?? data.customerName}</strong>,
        </h2>

        <p style="font-size:14px; line-height:1.6; margin:0 0 16px;">
          Merci pour votre confiance. Votre abonnement <strong>Lumen Juris – Plan ${data.planName} (${intervalLabel(data.interval)})</strong>
          est maintenant actif.
        </p>

        <p style="font-size:14px; line-height:1.6; margin:0 0 24px;">
          Vous trouverez en pièce jointe la facture correspondant à votre souscription.
          Voici le récapitulatif :
        </p>

        <!-- Récapitulatif facture -->
        <table
          width="100%"
          cellpadding="0"
          cellspacing="0"
          style="border:1px solid #e5e7eb; border-radius:8px; overflow:hidden; margin-bottom:24px;"
        >
          <!-- En-tête -->
          <tr>
            <td
              colspan="2"
              style="background-color:#716af9; padding:12px 16px;
                     font-family:Arial, sans-serif; font-size:13px;
                     font-weight:bold; color:#ffffff; letter-spacing:0.5px;"
            >
              Facture N° ${data.invoiceNumber} — ${formatDate(data.date)}
            </td>
          </tr>

          <!-- Ligne plan -->
          <tr>
            <td style="padding:12px 16px; font-size:13px; color:#374151; border-bottom:1px solid #f3f4f6;">
              Plan ${data.planName} — abonnement ${intervalLabel(data.interval)}
            </td>
            <td
              style="padding:12px 16px; font-size:13px; color:#111827;
                     font-weight:bold; text-align:right; border-bottom:1px solid #f3f4f6;"
            >
              ${formatEur(ttc)} TTC
            </td>
          </tr>

          <!-- Détail HT -->
          <tr>
            <td style="padding:8px 16px; font-size:12px; color:#6b7280; background-color:#f9fafb;">
              Montant HT
            </td>
            <td style="padding:8px 16px; font-size:12px; color:#374151; text-align:right; background-color:#f9fafb;">
              ${formatEur(ht)}
            </td>
          </tr>

          <!-- Détail TVA -->
          <tr>
            <td style="padding:8px 16px; font-size:12px; color:#6b7280; background-color:#f9fafb; border-bottom:1px solid #e5e7eb;">
              TVA (20 %)
            </td>
            <td style="padding:8px 16px; font-size:12px; color:#374151; text-align:right; background-color:#f9fafb; border-bottom:1px solid #e5e7eb;">
              ${formatEur(tva)}
            </td>
          </tr>

          <!-- Total TTC -->
          <tr>
            <td style="padding:14px 16px; font-size:14px; font-weight:bold; color:#111827;">
              Total TTC
            </td>
            <td style="padding:14px 16px; font-size:16px; font-weight:bold; color:#716af9; text-align:right;">
              ${formatEur(ttc)}
            </td>
          </tr>
        </table>

        <p style="font-size:13px; color:#6b7280; line-height:1.6; margin:0 0 8px;">
          La facture complète au format PDF est disponible en pièce jointe de cet email.
          Conservez-la pour vos dossiers comptables.
        </p>

        <p style="font-size:13px; color:#6b7280; line-height:1.6; margin:0;">
          Pour toute question, contactez-nous à
          <a href="mailto:contact@lumenjuris.com"
             style="color:#716af9; text-decoration:none;">contact@lumenjuris.com</a>.
        </p>

      </td>
    </tr>
  `;
};
