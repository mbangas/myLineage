/**
 * lib/email.js — Email module for myLineage.
 *
 * Sends invitation and notification emails via SMTP (Nodemailer).
 * Configured through environment variables:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, APP_URL
 *
 * If SMTP_HOST is not set, emails are logged to console instead of sent.
 */

'use strict';

const nodemailer = require('nodemailer');

let _transporter = null;

/**
 * Get or create the Nodemailer transporter.
 * Returns null if SMTP is not configured — emails will be logged instead.
 */
function getTransporter() {
  if (_transporter) return _transporter;

  const host = process.env.SMTP_HOST;
  if (!host) return null;

  const port   = parseInt(process.env.SMTP_PORT, 10) || 587;
  const secure = port === 465;

  _transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: (process.env.SMTP_USER && process.env.SMTP_PASS)
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });

  return _transporter;
}

/**
 * Resolve the "from" address for outgoing emails.
 */
function getFrom() {
  return process.env.SMTP_FROM || 'myLineage <noreply@mylineage.local>';
}

/**
 * Resolve the public-facing application URL (for links in emails).
 */
function getAppUrl() {
  return (process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
}

/**
 * Send an email. Falls back to console.log when SMTP is not configured.
 *
 * @param {{ to: string, subject: string, text: string, html?: string }} opts
 * @returns {Promise<void>}
 */
async function sendMail({ to, subject, text, html, attachments }) {
  const transport = getTransporter();

  if (!transport) {
    console.log('[email] SMTP não configurado — email simulado:');
    console.log(`  To: ${to}\n  Subject: ${subject}\n  Body:\n${text}`);
    return;
  }

  await transport.sendMail({
    from: getFrom(),
    to,
    subject,
    text,
    html: html || undefined,
    attachments: attachments || undefined,
  });
}

/* ── Email templates ───────────────────────────────────────────────────── */

/**
 * Send a tree-invitation email.
 *
 * @param {{ email: string, inviterName: string, treeName: string, role: string, token: string }} opts
 */
async function sendInvitationEmail({ email, inviterName, treeName, role, token }) {
  const appUrl    = getAppUrl();
  const acceptUrl = `${appUrl}/invite.html?token=${encodeURIComponent(token)}`;
  const roleLabel = role === 'writer' ? 'editor' : 'leitor';

  const subject = `${inviterName} convidou-o para a árvore "${treeName}" — myLineage`;

  const text = [
    `Olá,`,
    ``,
    `${inviterName} convidou-o para colaborar na árvore genealógica "${treeName}" como ${roleLabel}.`,
    ``,
    `Para aceitar o convite, abra o seguinte link:`,
    `${acceptUrl}`,
    ``,
    `Se não tem conta, será convidado a registar-se.`,
    ``,
    `Este convite expira em 7 dias.`,
    ``,
    `— myLineage`,
  ].join('\n');

  // Logo como CID PNG inline — PNG funciona em todos os clientes de email (gmail, outlook, apple mail).
  // SVG como CID é bloqueado/tratado como anexo; data: URIs são bloqueados.
  // email-logo.png é gerado por scripts/gen-email-logo.js a partir do favicon.svg.
  const path = require('path');
  const fs   = require('fs');
  const logoPngPath = path.join(__dirname, 'email-logo.png');
  const logoPngBuf  = fs.existsSync(logoPngPath) ? fs.readFileSync(logoPngPath) : null;
  const logoCid     = 'logo@mylineage';

  const logoImgTag = logoPngBuf
    ? `<img src="cid:${logoCid}" width="36" height="36" alt="myLineage" style="display:block;border:0;border-radius:7px;" />`
    : `<span style="display:inline-block;width:36px;height:36px;background:#161b22;border-radius:7px;text-align:center;line-height:36px;font-size:20px;">&#127794;</span>`;

  const logoAttachments = logoPngBuf
    ? [{ filename: 'logo.png', content: logoPngBuf, cid: logoCid, contentType: 'image/png' }]
    : [];

  const logoBlock = `
    <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;"><tr>
      <td style="vertical-align:middle;padding-right:13px;">${logoImgTag}</td>
      <td style="vertical-align:middle;">
        <div style="font-size:1.08rem;font-weight:800;color:#e6edf3;letter-spacing:-0.01em;line-height:1.2;">myLineage</div>
        <div style="font-size:0.7rem;color:#7d8590;margin-top:3px;letter-spacing:0.02em;">Gest&#227;o de &#225;rvores geneal&#243;gicas</div>
      </td>
    </tr></table>`;

  const html = `<!DOCTYPE html>
<html lang="pt-PT">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Arial,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8;padding:36px 16px 48px;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

      <!-- ── Cabeçalho da marca ── -->
      <tr>
        <td style="background:#161b22;border-radius:12px 12px 0 0;padding:20px 28px;">
          ${logoBlock}
        </td>
      </tr>

      <!-- ── Corpo (fundo branco) ── -->
      <tr>
        <td style="background:#ffffff;border-radius:0 0 12px 12px;padding:32px 28px 36px;border:1px solid #dde3ec;border-top:none;">

          <p style="margin:0 0 16px;font-size:0.95rem;color:#1a1a2e;">Ol&#225;,</p>

          <p style="margin:0 0 28px;font-size:0.95rem;color:#444c5c;line-height:1.7;">
            <strong style="color:#1a1a2e;">${escapeHtml(inviterName)}</strong>
            convidou-o para colaborar na &#225;rvore geneal&#243;gica
            <strong style="color:#1a1a2e;">&ldquo;${escapeHtml(treeName)}&rdquo;</strong>
            como <strong style="color:#1a1a2e;">${escapeHtml(roleLabel)}</strong>.
          </p>

          <!-- Bot&#227;o CTA -->
          <table cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
            <tr>
              <td style="border-radius:8px;background:#4493f8;">
                <a href="${escapeHtml(acceptUrl)}"
                   style="display:inline-block;padding:13px 32px;color:#ffffff;font-size:0.95rem;
                          font-weight:700;text-decoration:none;letter-spacing:0.01em;border-radius:8px;">
                  Aceitar convite
                </a>
              </td>
            </tr>
          </table>

          <!-- Separador -->
          <div style="height:1px;background:#e8edf4;margin-bottom:20px;"></div>

          <p style="margin:0 0 6px;font-size:0.8rem;color:#6b7a94;">Se n&#227;o tem conta, ser&#225; convidado a registar-se.</p>
          <p style="margin:0;font-size:0.78rem;color:#99a3b3;">Este convite expira em 7 dias.</p>

        </td>
      </tr>

      <!-- ── Rodap&#233; ── -->
      <tr>
        <td style="padding:20px 4px 0;text-align:center;">
          <span style="font-size:0.7rem;color:#99a3b3;">&copy; ${new Date().getFullYear()} myLineage &mdash; Gest&#227;o de &#225;rvores geneal&#243;gicas</span>
        </td>
      </tr>

    </table>
  </td></tr>
</table>

</body>
</html>`;

  await sendMail({ to: email, subject, text, html, attachments: logoAttachments });
}

/**
 * Send a notification email (generic).
 *
 * @param {{ email: string, subject: string, body: string }}
 */
async function sendNotificationEmail({ email, subject, body }) {
  await sendMail({ to: email, subject, text: body });
}

/* ── Utility ───────────────────────────────────────────────────────────── */

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = {
  sendMail,
  sendInvitationEmail,
  sendNotificationEmail,
  getAppUrl,
};
