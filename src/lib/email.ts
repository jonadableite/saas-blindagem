// src/lib/email.ts
import nodemailer from "nodemailer";

// Configurações do SMTP a partir das variáveis de ambiente
const smtpConfig = {
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || "587", 10),
  secure: process.env.SMTP_PORT === "465",
  auth: {
    user: process.env.SMTP_USERNAME,
    pass: process.env.SMTP_PASSWORD,
  },
};

// Cria o transportador Nodemailer
const transporter = nodemailer.createTransport(smtpConfig);

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string; // Conteúdo HTML do e-mail
  from?: string; // Remetente, opcional, usará SMTP_SENDER_EMAIL por padrão
}

export async function sendEmail({ to, subject, html, from }: SendEmailOptions) {
  try {
    await transporter.sendMail({
      from: from || process.env.SMTP_SENDER_EMAIL,
      to,
      subject,
      html,
    });
    console.log(`Email sent to ${to} with subject: ${subject}`);
  } catch (error) {
    console.error(`Error sending email to ${to}:`, error);
    throw error;
  }
}

// Função específica para convite de organização
interface SendOrganizationInvitationOptions {
  email: string;
  invitedByUsername: string;
  invitedByEmail: string;
  teamName: string;
  inviteLink: string;
}

export async function sendOrganizationInvitationEmail({
  email,
  invitedByUsername,
  invitedByEmail,
  teamName,
  inviteLink,
}: SendOrganizationInvitationOptions) {
  const subject = `Você foi convidado para a organização ${teamName} no WhatLead!`;

  // Cores:
  // Primária: #3278fb
  // Secundária: #1e1b4a

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>Convite para Organização WhatLead</title>
    <style type="text/css">
        /* Estilos específicos para clientes de e-mail */
        body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
        table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
        img { -ms-interpolation-mode: bicubic; }

        /* Resets */
        img { border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
        table { border-collapse: collapse !important; }
        body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; }

        /* Links azuis do iOS */
        a[x-apple-data-detectors] {
            color: inherit !important;
            text-decoration: none !important;
            font-size: inherit !important;
            font-family: inherit !important;
            font-weight: inherit !important;
            line-height: inherit !important;
        }

        /* Estilos responsivos */
        @media screen and (max-width: 600px) {
            .email-container {
                width: 100% !important;
            }
            .content-padding {
                padding: 20px !important;
            }
            .button {
                padding: 12px 25px !important;
                font-size: 16px !important;
            }
        }
    </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4;">
    <center style="width: 100%; background-color: #f4f4f4;">
        <!-- Wrapper principal do e-mail -->
        <table align="center" border="0" cellpadding="0" cellspacing="0" height="100%" width="100%" style="border-collapse: collapse; max-width: 600px;">
            <tr>
                <td align="center" valign="top" style="padding: 0;">
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px;">
                        <!-- Cabeçalho -->
                        <tr>
                            <td style="padding: 20px 0; text-align: center; background-color: #1e1b4a;">
                                <h1 style="margin: 0; font-family: sans-serif; font-size: 28px; line-height: 30px; color: #ffffff;">WhatLead</h1>
                            </td>
                        </tr>

                        <!-- Corpo do Conteúdo -->
                        <tr>
                            <td align="center" valign="top" style="background-color: #ffffff; padding: 40px 30px; border-radius: 8px;">
                                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                    <tr>
                                        <td style="font-family: sans-serif; font-size: 16px; line-height: 24px; color: #333333;">
                                            <p style="margin: 0 0 15px;">Olá,</p>
                                            <p style="margin: 0 0 15px;">Você foi convidado por <strong>${invitedByUsername} (${invitedByEmail})</strong> para se juntar à organização <strong>${teamName}</strong> no WhatLead.</p>
                                            <p style="margin: 0 0 25px;">Para aceitar o convite e se juntar à equipe, clique no botão abaixo:</p>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td align="center" style="padding-bottom: 30px;">
                                            <!-- Botão de Ação -->
                                            <table border="0" cellspacing="0" cellpadding="0">
                                                <tr>
                                                    <td align="center" style="border-radius: 5px; background-color: #3278fb;">
                                                        <a href="${inviteLink}" target="_blank" style="font-size: 18px; font-family: sans-serif; color: #ffffff; text-decoration: none; border-radius: 5px; padding: 15px 30px; border: 1px solid #3278fb; display: inline-block; font-weight: bold;">Aceitar Convite</a>
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="font-family: sans-serif; font-size: 16px; line-height: 24px; color: #333333;">
                                            <p style="margin: 0 0 15px;">Se você não esperava este convite, pode ignorar este e-mail.</p>
                                            <p style="margin: 0;">Atenciosamente,<br>A equipe WhatLead</p>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>


                        <tr>
                            <td style="padding: 30px; text-align: center; font-family: sans-serif; font-size: 14px; line-height: 20px; color: #666666;">
                                <p style="margin: 0 0 5px;">${process.env.SMTP_SENDER_EMAIL}</p>
                                <p style="margin: 0;">&copy; ${new Date().getFullYear()} WhatLead. Todos os direitos reservados.</p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </center>
</body>
</html>
`;

  await sendEmail({
    to: email,
    subject,
    html: htmlContent,
  });
}
