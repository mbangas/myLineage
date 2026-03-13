/**
 * routes/auth.js — Authentication API routes for myLineage.
 *
 * Endpoints:
 *   POST /api/auth/register        — create account
 *   POST /api/auth/login           — email + password → tokens (or TOTP step)
 *   POST /api/auth/login/totp      — verify TOTP code → tokens
 *   POST /api/auth/refresh         — refresh access token
 *   POST /api/auth/logout          — (client-side token removal)
 *   GET  /api/auth/me              — current user profile
 *   PUT  /api/auth/me              — update name / email
 *   PUT  /api/auth/me/password     — change password
 *   POST /api/auth/totp/setup      — generate TOTP secret + QR URI
 *   POST /api/auth/totp/verify     — confirm first TOTP code
 *   DELETE /api/auth/totp          — disable 2FA
 */

'use strict';

const express = require('express');
const crypto  = require('crypto');
const {
  hashPassword,
  verifyPassword,
  generateTokens,
  verifyRefreshToken,
  authMiddleware,
} = require('../lib/auth-middleware');
const { query } = require('../lib/db');

const router = express.Router();

/* ── helpers ──────────────────────────────────────────────────────────── */

function base32Encode(buf) {
  const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0, val = 0, out = '';
  for (let i = 0; i < buf.length; i++) {
    val = (val << 8) | buf[i];
    bits += 8;
    while (bits >= 5) { out += ALPHA[(val >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += ALPHA[(val << (5 - bits)) & 31];
  return out;
}

function generateTotpSecret() {
  return base32Encode(crypto.randomBytes(20));
}

function totpUri(email, secret) {
  const label = encodeURIComponent('myLineage:' + email);
  return 'otpauth://totp/' + label +
    '?secret=' + secret +
    '&issuer=myLineage' +
    '&algorithm=SHA1&digits=6&period=30';
}

/** Compute TOTP code for a given secret and optional time offset. */
function computeTotp(secret, offset) {
  const counter = Math.floor(Date.now() / 30000) + (offset || 0);
  const keyBytes = base32Decode(secret);
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(0, 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  const hmac = crypto.createHmac('sha1', keyBytes).update(buf).digest();
  const off = hmac[hmac.length - 1] & 0xf;
  const bin = ((hmac[off] & 0x7f) << 24) | (hmac[off + 1] << 16) | (hmac[off + 2] << 8) | hmac[off + 3];
  return String(bin % 1000000).padStart(6, '0');
}

function base32Decode(str) {
  const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const s = str.toUpperCase().replace(/=+$/, '').replace(/[^A-Z2-7]/g, '');
  const bytes = [];
  let bits = 0, val = 0;
  for (let i = 0; i < s.length; i++) {
    const idx = ALPHA.indexOf(s[i]);
    if (idx < 0) continue;
    val = (val << 5) | idx;
    bits += 5;
    if (bits >= 8) { bytes.push((val >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  return Buffer.from(bytes);
}

/** Verify a TOTP code allowing ±1 window drift. */
function verifyTotp(secret, code) {
  const c = String(code).replace(/\s/g, '');
  for (const off of [0, -1, 1]) {
    if (computeTotp(secret, off) === c) return true;
  }
  return false;
}

/** Record a login attempt in login_audit. */
async function auditLogin(userId, ip, userAgent, success) {
  await query(
    'INSERT INTO login_audit (user_id, ip, user_agent, success) VALUES ($1, $2, $3, $4)',
    [userId, (ip || '').slice(0, 45), (userAgent || '').slice(0, 512), success],
  );
}

/* ── POST /register ──────────────────────────────────────────────────── */
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email e password são obrigatórios' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password deve ter pelo menos 8 caracteres' });
    }

    // Check duplicate
    const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (existing.rows.length) {
      return res.status(409).json({ error: 'Email já registado' });
    }

    const passwordHash = await hashPassword(password);
    const { rows } = await query(
      `INSERT INTO users (email, password_hash, name)
       VALUES ($1, $2, $3)
       RETURNING id, email, name, is_admin`,
      [email.toLowerCase().trim(), passwordHash, (name || '').trim()],
    );
    const user = rows[0];
    const tokens = generateTokens({ id: user.id, email: user.email, isAdmin: user.is_admin });

    res.status(201).json({
      user: { id: user.id, email: user.email, name: user.name, isAdmin: user.is_admin },
      ...tokens,
    });
  } catch (e) {
    console.error('[auth/register]', e.message);
    res.status(500).json({ error: 'Erro no registo' });
  }
});

/* ── POST /login ─────────────────────────────────────────────────────── */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email e password são obrigatórios' });
    }

    const { rows } = await query(
      'SELECT id, email, password_hash, name, totp_secret, totp_verified, is_admin FROM users WHERE email = $1',
      [email.toLowerCase().trim()],
    );
    if (!rows.length) {
      await auditLogin(null, req.ip, req.headers['user-agent'], false);
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }
    const user = rows[0];

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      await auditLogin(user.id, req.ip, req.headers['user-agent'], false);
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    // 2FA required?  Admin always, others if TOTP configured
    const needs2FA = user.is_admin || (user.totp_secret && user.totp_verified);
    if (needs2FA && user.totp_secret && user.totp_verified) {
      // Return a short-lived pre-auth token for the TOTP step
      return res.json({
        requires2FA: true,
        totpPending: true,
        userId: user.id,
      });
    }

    // Admin without TOTP → force setup
    if (user.is_admin && (!user.totp_secret || !user.totp_verified)) {
      return res.json({
        requires2FA: true,
        totpSetupRequired: true,
        userId: user.id,
      });
    }

    await auditLogin(user.id, req.ip, req.headers['user-agent'], true);
    const tokens = generateTokens({ id: user.id, email: user.email, isAdmin: user.is_admin });
    res.json({
      user: { id: user.id, email: user.email, name: user.name, isAdmin: user.is_admin },
      ...tokens,
    });
  } catch (e) {
    console.error('[auth/login]', e.message);
    res.status(500).json({ error: 'Erro no login' });
  }
});

/* ── POST /login/totp ────────────────────────────────────────────────── */
router.post('/login/totp', async (req, res) => {
  try {
    const { userId, code } = req.body;
    if (!userId || !code) {
      return res.status(400).json({ error: 'userId e code são obrigatórios' });
    }
    const { rows } = await query(
      'SELECT id, email, name, totp_secret, is_admin FROM users WHERE id = $1',
      [userId],
    );
    if (!rows.length) return res.status(404).json({ error: 'Utilizador não encontrado' });
    const user = rows[0];

    if (!user.totp_secret || !verifyTotp(user.totp_secret, code)) {
      await auditLogin(user.id, req.ip, req.headers['user-agent'], false);
      return res.status(401).json({ error: 'Código TOTP inválido' });
    }

    await auditLogin(user.id, req.ip, req.headers['user-agent'], true);
    const tokens = generateTokens({ id: user.id, email: user.email, isAdmin: user.is_admin });
    res.json({
      user: { id: user.id, email: user.email, name: user.name, isAdmin: user.is_admin },
      ...tokens,
    });
  } catch (e) {
    console.error('[auth/login/totp]', e.message);
    res.status(500).json({ error: 'Erro na verificação TOTP' });
  }
});

/* ── POST /refresh ───────────────────────────────────────────────────── */
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'refreshToken em falta' });

    const decoded = verifyRefreshToken(refreshToken);
    const { rows } = await query(
      'SELECT id, email, is_admin FROM users WHERE id = $1',
      [decoded.sub],
    );
    if (!rows.length) return res.status(401).json({ error: 'Utilizador não encontrado' });
    const user = rows[0];

    const tokens = generateTokens({ id: user.id, email: user.email, isAdmin: user.is_admin });
    res.json(tokens);
  } catch (e) {
    res.status(401).json({ error: 'Refresh token inválido ou expirado' });
  }
});

/* ── POST /logout ────────────────────────────────────────────────────── */
router.post('/logout', (_req, res) => {
  // Stateless JWT — client removes tokens. Future: token blacklist.
  res.json({ ok: true });
});

/* ── GET /me ─────────────────────────────────────────────────────────── */
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT id, email, name, is_admin, totp_verified, created_at FROM users WHERE id = $1',
      [req.user.id],
    );
    if (!rows.length) return res.status(404).json({ error: 'Utilizador não encontrado' });
    const u = rows[0];
    res.json({
      id: u.id, email: u.email, name: u.name,
      isAdmin: u.is_admin, totpEnabled: u.totp_verified, createdAt: u.created_at,
    });
  } catch (e) {
    res.status(500).json({ error: 'Erro ao obter perfil' });
  }
});

/* ── PUT /me ─────────────────────────────────────────────────────────── */
router.put('/me', authMiddleware, async (req, res) => {
  try {
    const { name, email } = req.body;
    const sets = [];
    const params = [];
    let idx = 1;

    if (name !== undefined)  { sets.push(`name = $${idx++}`); params.push(name.trim()); }
    if (email !== undefined) {
      const normEmail = email.toLowerCase().trim();
      const dup = await query('SELECT id FROM users WHERE email = $1 AND id != $2', [normEmail, req.user.id]);
      if (dup.rows.length) return res.status(409).json({ error: 'Email já em uso' });
      sets.push(`email = $${idx++}`);
      params.push(normEmail);
    }

    if (!sets.length) return res.status(400).json({ error: 'Nada para atualizar' });
    sets.push(`updated_at = NOW()`);
    params.push(req.user.id);

    const { rows } = await query(
      `UPDATE users SET ${sets.join(', ')} WHERE id = $${idx} RETURNING id, email, name, is_admin`,
      params,
    );
    const u = rows[0];
    res.json({ id: u.id, email: u.email, name: u.name, isAdmin: u.is_admin });
  } catch (e) {
    res.status(500).json({ error: 'Erro ao atualizar perfil' });
  }
});

/* ── PUT /me/password ────────────────────────────────────────────────── */
router.put('/me/password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Passwords atual e nova são obrigatórias' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Nova password deve ter pelo menos 8 caracteres' });
    }

    const { rows } = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (!rows.length) return res.status(404).json({ error: 'Utilizador não encontrado' });

    const valid = await verifyPassword(currentPassword, rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Password atual incorreta' });

    const hash = await hashPassword(newPassword);
    await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hash, req.user.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Erro ao alterar password' });
  }
});

/* ── POST /totp/setup ────────────────────────────────────────────────── */
router.post('/totp/setup', async (req, res) => {
  try {
    // Accepts either a valid JWT or a userId from the login flow (admin first setup)
    let userId;
    const header = req.headers.authorization;
    if (header && header.startsWith('Bearer ')) {
      try {
        const decoded = require('../lib/auth-middleware').verifyAccessToken(header.slice(7));
        userId = decoded.sub;
      } catch (_) { /* fall through to body */ }
    }
    if (!userId) userId = req.body.userId;
    if (!userId) return res.status(400).json({ error: 'userId em falta' });

    const { rows } = await query('SELECT id, email FROM users WHERE id = $1', [userId]);
    if (!rows.length) return res.status(404).json({ error: 'Utilizador não encontrado' });
    const user = rows[0];

    const secret = generateTotpSecret();
    await query('UPDATE users SET totp_secret = $1, totp_verified = FALSE, updated_at = NOW() WHERE id = $2', [secret, user.id]);

    const uri = totpUri(user.email, secret);
    res.json({ secret, uri });
  } catch (e) {
    console.error('[auth/totp/setup]', e.message);
    res.status(500).json({ error: 'Erro ao configurar TOTP' });
  }
});

/* ── POST /totp/verify ───────────────────────────────────────────────── */
router.post('/totp/verify', async (req, res) => {
  try {
    let userId;
    const header = req.headers.authorization;
    if (header && header.startsWith('Bearer ')) {
      try {
        const decoded = require('../lib/auth-middleware').verifyAccessToken(header.slice(7));
        userId = decoded.sub;
      } catch (_) { /* fall through */ }
    }
    if (!userId) userId = req.body.userId;
    if (!userId) return res.status(400).json({ error: 'userId em falta' });

    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'code em falta' });

    const { rows } = await query(
      'SELECT id, email, name, totp_secret, is_admin FROM users WHERE id = $1',
      [userId],
    );
    if (!rows.length) return res.status(404).json({ error: 'Utilizador não encontrado' });
    const user = rows[0];

    if (!user.totp_secret) {
      return res.status(400).json({ error: 'TOTP não configurado. Chame /totp/setup primeiro.' });
    }

    if (!verifyTotp(user.totp_secret, code)) {
      return res.status(401).json({ error: 'Código TOTP inválido' });
    }

    await query('UPDATE users SET totp_verified = TRUE, updated_at = NOW() WHERE id = $1', [user.id]);

    // Return tokens so the user is logged in after verification
    const tokens = generateTokens({ id: user.id, email: user.email, isAdmin: user.is_admin });
    res.json({
      ok: true,
      user: { id: user.id, email: user.email, name: user.name, isAdmin: user.is_admin },
      ...tokens,
    });
  } catch (e) {
    console.error('[auth/totp/verify]', e.message);
    res.status(500).json({ error: 'Erro ao verificar TOTP' });
  }
});

/* ── DELETE /totp ────────────────────────────────────────────────────── */
router.delete('/totp', authMiddleware, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Password é obrigatória para desativar 2FA' });

    const { rows } = await query('SELECT password_hash, is_admin FROM users WHERE id = $1', [req.user.id]);
    if (!rows.length) return res.status(404).json({ error: 'Utilizador não encontrado' });

    // Admins cannot disable 2FA
    if (rows[0].is_admin) {
      return res.status(403).json({ error: 'Administradores não podem desativar 2FA' });
    }

    const valid = await verifyPassword(password, rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Password incorreta' });

    await query(
      'UPDATE users SET totp_secret = NULL, totp_verified = FALSE, updated_at = NOW() WHERE id = $1',
      [req.user.id],
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Erro ao desativar TOTP' });
  }
});

module.exports = router;
