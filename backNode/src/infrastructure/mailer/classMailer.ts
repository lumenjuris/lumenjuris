import nodemailer from "nodemailer";
import { templateVerifyAccount } from "./template/verifyAccount";
import { templateResetPassword } from "./template/resetPassword";
import { templateTwoFactor } from "./template/twoFactor";
import { templateInvoiceEmail } from "./template/invoiceEmail";
import { templateWelcomeFreemium } from "./template/welcomeFreemium";
import { generateInvoicePDF, type InvoiceData } from "../pdf/invoicePDF";
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.MAILER_USER,
    pass: process.env.MAILER_PASS,
  },
});

export class Mailer {
  private email: string;

  constructor(email: string) {
    if (!process.env.MAILER_USER || !process.env.MAILER_PASS) {
      throw new Error("Configuration SMTP manquante");
    }

    this.email = email;
  }

  private errorCatching(err: unknown) {
    console.error(
      `Une erreur est survenu lors d'un envoie d'un email' error : ${err}`,
    );
    return {
      success: false,
      message:
        "Erreur avec le serveur est survenue lors de l'envoie d'un email.",
      error: err,
    };
  }

  private createOption(
    html: string,
    subject: string,
    attachments?: Array<{ filename: string; content: Buffer; contentType: string }>,
  ) {
    const textBrutFallback = html.replace(/<[^>]*>/g, "");
    return {
      from: '"Lumen Juris" <no-reply@lumenjuris.com>',
      to: this.email,
      subject,
      text: textBrutFallback,
      html,
      ...(attachments?.length ? { attachments } : {}),
    };
  }

  private createHtmlHeader() {
    return `
        <tr>
            <td align="center" style="background-color:#716af9; padding:24px;">
                <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%;">
                    <tr>
                        <td style="text-align:center;">
                            <span style="color:#ffffff; font-family:Arial, sans-serif; font-size:22px; font-weight:bold; letter-spacing:0.5px;">
                                Lumen Juris
                            </span>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>

        <!-- petite séparation clean -->
        <tr>
            <td style="background-color:#ffffff; height:1px; line-height:1px; font-size:0;"></td>
        </tr>
    `;
  }

  private createHtmlFooter() {
    const date = new Date();
    const year = date.getFullYear();

    return `
        <tr>
            <td style="padding: 30px 30px 10px 30px; font-family: Arial, sans-serif; font-size:14px; color:#1f2937;">
                Cordialement,<br>
                <strong style="color:#111827;">L'équipe Lumen Juris</strong>
            </td>
        </tr>

        <!-- séparation -->
        <tr>
            <td style="padding:0 30px;">
                <hr style="border:none; border-top:1px solid #e5e7eb;">
            </td>
        </tr>

        <!-- footer bas -->
        <tr>
            <td style="background-color:#f9fafb; padding:20px; text-align:center;
                       font-family: Arial, sans-serif; font-size:12px; color:#6b7280;">
                
                <div style="margin-bottom:8px;">
                    &copy; ${year} Lumen Juris. Tous droits réservés.
                </div>

                <div>
                    <a href="https://lumenjuris.com" 
                       style="color:#716af9; text-decoration:none; font-weight:500;">
                        lumenjuris.com
                    </a>
                </div>

            </td>
        </tr>
    `;
  }

  private createHtmlFullContent(htmlContent: string) {
    return `
            <body style="margin:0;padding:0;">
                <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6; padding:20px 0;">
                    <tr>
                        <td align="center">
                            <table width="600" cellpadding="0" cellspacing="0" 
                                style="background-color:#ffffff; border:1px solid #b3b7be; border-radius:8px;overflow:hidden;">
                                
                                ${this.createHtmlHeader()}
                                ${htmlContent}
                                ${this.createHtmlFooter()}
                                
                            </table>
                        </td>
                    </tr>
                </table>
            </body>`;
  }

  async sendVerifyAccount(verificationLink: string, username: string) {
    try {
      const html = this.createHtmlFullContent(
        templateVerifyAccount(verificationLink, username),
      );
      const mailOptions = this.createOption(
        html,
        "Activez votre compte Lumen Juris",
      );
      const sending = await transporter.sendMail(mailOptions);

      if (!sending.messageId) {
        throw new Error(
          `Echec lors de l'envoie d'un email, id indisponible de retour indisponible.\n ${sending}`,
        );
      }
      return {
        success: !!sending.messageId,
        message: sending.messageId
          ? `Un email a été envoyé à votre adresse ${this.email}, veuillez consulter votre boîte de réception pour valider votre inscription.`
          : "Une erreur est survenue avec le serveur nous n'avons pas pu envoyer votre email.",
      };
    } catch (err) {
      return this.errorCatching(err);
    }
  }

  async sendResetPassword(resetLink: string, username?: string) {
    try {
      const html = this.createHtmlFullContent(
        templateResetPassword(resetLink, username),
      );
      const mailOptions = this.createOption(
        html,
        "Réinitialisation de votre mot de passe Lumen Juris",
      );
      const sending = await transporter.sendMail(mailOptions);

      if (!sending.messageId) {
        throw new Error(
          `Echec lors de l'envoie d'un email, id indisponible de retour indisponible.\n ${sending}`,
        );
      }
      return {
        success: !!sending.messageId,
        message: sending.messageId
          ? `Un email a été envoyé à votre adresse ${this.email}, veuillez consulter votre boîte de réception pour réinitialiser votre mot de passe.`
          : "Une erreur est survenue avec le serveur nous n'avons pas pu envoyer votre email.",
      };
    } catch (err) {
      return this.errorCatching(err);
    }
  }

  async sendTwoFactor(code: string, username?: string) {
    try {
      const html = this.createHtmlFullContent(
        templateTwoFactor(code, username),
      );
      const mailOptions = this.createOption(
        html,
        "Votre code de vérification Lumen Juris",
      );
      const sending = await transporter.sendMail(mailOptions);

      if (!sending.messageId) {
        throw new Error(
          `Echec lors de l'envoie du code 2FA, messageId indisponible.\n ${sending}`,
        );
      }
      return {
        success: true,
        message: `Un code de vérification a été envoyé à ${this.email}. Il est valide 15 minutes.`,
      };
    } catch (err) {
      return this.errorCatching(err);
    }
  }

  async sendWelcomeFreemium(username?: string) {
    try {
      const html = this.createHtmlFullContent(templateWelcomeFreemium(username));
      const mailOptions = this.createOption(
        html,
        "Bienvenue sur Lumen Juris — votre formule Freemium est activée",
      );
      const sending = await transporter.sendMail(mailOptions);

      if (!sending.messageId) {
        throw new Error(
          `Echec lors de l'envoi du mail de bienvenue, messageId indisponible.\n ${sending}`,
        );
      }
      return { success: true };
    } catch (err) {
      return this.errorCatching(err);
    }
  }

  async sendInvoice(invoiceData: InvoiceData, username?: string) {
    try {
      const pdfBuffer = await generateInvoicePDF(invoiceData);
      const html = this.createHtmlFullContent(
        templateInvoiceEmail(invoiceData, username),
      );
      const mailOptions = this.createOption(
        html,
        `Votre facture Lumen Juris — ${invoiceData.invoiceNumber}`,
        [
          {
            filename: `facture-${invoiceData.invoiceNumber}.pdf`,
            content: pdfBuffer,
            contentType: "application/pdf",
          },
        ],
      );
      const sending = await transporter.sendMail(mailOptions);

      if (!sending.messageId) {
        throw new Error(
          `Echec lors de l'envoi de la facture, messageId indisponible.\n ${sending}`,
        );
      }
      return {
        success: true,
        message: `La facture ${invoiceData.invoiceNumber} a été envoyée à ${this.email}.`,
      };
    } catch (err) {
      return this.errorCatching(err);
    }
  }
}
