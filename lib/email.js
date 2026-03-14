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
async function sendMail({ to, subject, text, html }) {
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

  // Inline SVG tree icon (matches favicon.svg — works without external image loading)
  const treeIconSvg = `<img src="${escapeHtml(appUrl)}/favicon.svg" width="36" height="36" alt="" style="display:block;border:0;" />`;

  const html = `<!DOCTYPE html>
<html lang="pt-PT">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0d1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Arial,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#0d1117;padding:36px 16px 48px;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

      <!-- ── Cabeçalho (estilo landing topbar) ── -->
      <tr>
        <td style="background:#161b22;border-radius:12px 12px 0 0;padding:22px 28px;border:1px solid #30363d;border-bottom:none;">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="padding-right:13px;vertical-align:middle;">${treeIconSvg}</td>
            <td style="vertical-align:middle;">
              <div style="font-size:1.08rem;font-weight:800;color:#e6edf3;letter-spacing:-0.01em;line-height:1.2;">myLineage</div>
              <div style="font-size:0.7rem;color:#7d8590;margin-top:3px;letter-spacing:0.02em;">Gestão de árvores genealógicas</div>
            </td>
          </tr></table>
        </td>
      </tr>

      <!-- ── Separador ── -->
      <tr>
        <td style="background:#161b22;border-left:1px solid #30363d;border-right:1px solid #30363d;">
          <div style="height:1px;background:#21262d;margin:0 28px;"></div>
        </td>
      </tr>

      <!-- ── Corpo do email (caixa) ── -->
      <tr>
        <td style="background:#161b22;border-radius:0 0 12px 12px;padding:28px 28px 32px;border:1px solid #30363d;border-top:none;">

          <p style="margin:0 0 14px;font-size:0.93rem;color:#e6edf3;">Olá,</p>

          <p style="margin:0 0 24px;font-size:0.93rem;color:#c9d1d9;line-height:1.6;">
            <strong style="color:#e6edf3;">${escapeHtml(inviterName)}</strong>
            convidou-o para colaborar na árvore genealógica
            <strong style="color:#e6edf3;">&ldquo;${escapeHtml(treeName)}&rdquo;</strong>
            como <strong style="color:#e6edf3;">${escapeHtml(roleLabel)}</strong>.
          </p>

          <!-- Botão -->
          <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
            <tr>
              <td style="border-radius:8px;background:#4493f8;">
                <a href="${escapeHtml(acceptUrl)}"
                   style="display:inline-block;padding:13px 30px;color:#ffffff;font-size:0.93rem;
                          font-weight:700;text-decoration:none;letter-spacing:0.01em;border-radius:8px;">
                  Aceitar convite
                </a>
              </td>
            </tr>
          </table>

          <!-- Notas rodapé da caixa -->
          <p style="margin:0 0 6px;font-size:0.78rem;color:#7d8590;">Se não tem conta, será convidado a registar-se.</p>
          <p style="margin:0;font-size:0.75rem;color:#484f58;">Este convite expira em 7 dias.</p>

        </td>
      </tr>

      <!-- ── Rodapé do email ── -->
      <tr>
        <td style="padding:20px 4px 0;text-align:center;">
          <span style="font-size:0.7rem;color:#484f58;">&copy; ${new Date().getFullYear()} myLineage &mdash; Gestão de árvores genealógicas</span>
        </td>
      </tr>

    </table>
  </td></tr>
</table>

</body>
</html>`;

  await sendMail({ to: email, subject, text, html });
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
