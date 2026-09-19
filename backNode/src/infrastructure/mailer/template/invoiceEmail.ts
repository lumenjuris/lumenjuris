import type { InvoiceData } from "../../pdf/invoicePDF.js";
import { PlanInterval } from "@prisma/client";

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

function intervalLabel(interval:string): string {
  return interval === PlanInterval.yearly ? "annuel" : "mensuel";
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
      <td style="padding: 40px 40px 0;">
        <p style="margin:0 0 6px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                   font-size:12px; font-weight:600; color:#10b981; letter-spacing:1px; text-transform:uppercase;">
          Paiement confirmé
        </p>
        <h1 style="margin:0 0 20px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                    font-size:26px; font-weight:700; color:#111827; line-height:1.2;">
          Votre facture est disponible
        </h1>
        <p style="margin:0 0 28px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                   font-size:15px; line-height:1.7; color:#374151;">
          Bonjour <strong>${username ?? data.customerName}</strong>,<br>
          Merci pour votre confiance. Votre abonnement
          <strong>Lumen Juris — Plan ${data.planName} (${intervalLabel(data.interval)})</strong>
          est actif. Retrouvez votre facture en pièce jointe.
        </p>
      </td>
    </tr>

    <tr>
      <td style="padding: 0 40px 32px;">
        <table width="100%" cellpadding="0" cellspacing="0"
               style="border:1px solid #ede9fe; border-radius:10px; overflow:hidden;">

          <tr>
            <td colspan="2"
                style="background:linear-gradient(135deg,#5b52f0,#9b8fff); padding:14px 20px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                                  font-size:13px; font-weight:700; color:#ffffff;">
                      Facture N° ${data.invoiceNumber}
                    </span>
                  </td>
                  <td style="text-align:right;">
                    <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                                  font-size:12px; color:rgba(255,255,255,0.8);">
                      ${formatDate(data.date)}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:14px 20px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                        font-size:14px; color:#374151; border-bottom:1px solid #f3f4f6; background:#fff;">
              Plan ${data.planName} — ${intervalLabel(data.interval)}
            </td>
            <td style="padding:14px 20px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                        font-size:14px; font-weight:700; color:#111827; text-align:right;
                        border-bottom:1px solid #f3f4f6; background:#fff; white-space:nowrap;">
              ${formatEur(ttc)} TTC
            </td>
          </tr>

          <tr>
            <td style="padding:10px 20px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                        font-size:12px; color:#6b7280; border-bottom:1px solid #f3f4f6; background:#fafafa;">
              Montant HT
            </td>
            <td style="padding:10px 20px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                        font-size:12px; color:#374151; text-align:right;
                        border-bottom:1px solid #f3f4f6; background:#fafafa;">
              ${formatEur(ht)}
            </td>
          </tr>

          <tr>
            <td style="padding:10px 20px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                        font-size:12px; color:#6b7280; border-bottom:1px solid #ede9fe; background:#fafafa;">
              TVA (20 %)
            </td>
            <td style="padding:10px 20px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                        font-size:12px; color:#374151; text-align:right;
                        border-bottom:1px solid #ede9fe; background:#fafafa;">
              ${formatEur(tva)}
            </td>
          </tr>

          <tr>
            <td style="padding:16px 20px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                        font-size:15px; font-weight:700; color:#111827; background:#f8f7ff;">
              Total TTC
            </td>
            <td style="padding:16px 20px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                        font-size:18px; font-weight:800; color:#716af9; text-align:right;
                        background:#f8f7ff;">
              ${formatEur(ttc)}
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <tr>
      <td style="padding: 0 40px 32px;">
        <table width="100%" cellpadding="0" cellspacing="0"
               style="background-color:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px;">
          <tr>
            <td style="padding:14px 18px;">
              <p style="margin:0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                         font-size:13px; color:#166534; line-height:1.6;">
                La facture PDF est disponible en pièce jointe. Conservez-la pour votre comptabilité.
                Pour toute question : <a href="mailto:contact@lumenjuris.com"
                style="color:#716af9; text-decoration:none; font-weight:600;">contact@lumenjuris.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
};
