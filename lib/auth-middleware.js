/**
 * lib/auth-middleware.js — Authentication & authorisation helpers for myLineage.
 *
 * Provides password hashing (bcrypt), JWT token generation / verification,
 * Express middleware for protecting routes, and role-based access control.
 */

'use strict';

const bcrypt = require('bcrypt');
const jwt    = require('jsonwebtoken');

const BCRYPT_ROUNDS      = 12;
const ACCESS_TOKEN_TTL   = '15m';
const REFRESH_TOKEN_TTL  = '7d';

function getSecret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET env var is not set');
  return s;
}

/* ── Password helpers ───────────────────────────────────────────────── */

/** Hash a plain-text password. */
function hashPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

/** Compare a plain-text password against a bcrypt hash. */
function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

/* ── JWT helpers ─────────────────────────────────────────────────────── */

/**
 * Generate an access + refresh token pair for the given user.
 * @param {{ id: string, email: string, isAdmin: boolean }} user
 * @returns {{ accessToken: string, refreshToken: string }}
 */
function generateTokens(user) {
  const secret = getSecret();
  const payload = { sub: user.id, email: user.email, isAdmin: user.isAdmin };
  const accessToken  = jwt.sign(payload, secret, { expiresIn: ACCESS_TOKEN_TTL });
  const refreshToken = jwt.sign({ sub: user.id, type: 'refresh' }, secret, { expiresIn: REFRESH_TOKEN_TTL });
  return { accessToken, refreshToken };
}

/**
 * Verify and decode an access token.
 * @param {string} token
 * @returns {{ sub: string, email: string, isAdmin: boolean }}
 */
function verifyAccessToken(token) {
  return jwt.verify(token, getSecret());
}

/**
 * Verify and decode a refresh token.
 * @param {string} token
 * @returns {{ sub: string, type: string }}
 */
function verifyRefreshToken(token) {
  const decoded = jwt.verify(token, getSecret());
  if (decoded.type !== 'refresh') throw new Error('Not a refresh token');
  return decoded;
}

/* ── Express middleware ──────────────────────────────────────────────── */

/**
 * Extract Bearer token from the Authorization header, verify it, and
 * attach `req.user = { id, email, isAdmin }` to the request.
 *
 * Responds with 401 when token is missing or invalid.
 */
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token em falta' });
  }
  try {
    const decoded = verifyAccessToken(header.slice(7));
    req.user = { id: decoded.sub, email: decoded.email, isAdmin: decoded.isAdmin };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

/**
 * Middleware factory — checks that the authenticated user has one of the
 * given roles for the tree identified by `req.params.treeId`.
 *
 * Must be used AFTER `authMiddleware`.
 *
 * @param  {...string} roles  Allowed roles, e.g. 'owner', 'writer', 'reader'
 */
function requireRole(...roles) {
  return async (req, res, next) => {
    if (req.user.isAdmin) return next();
    const treeId = req.params.treeId || req.query.treeId || req.headers['x-tree-id'];
    if (!treeId) return res.status(400).json({ error: 'treeId em falta' });

    const { query } = require('./db');
    const { rows } = await query(
      'SELECT role FROM tree_memberships WHERE tree_id = $1 AND user_id = $2',
      [treeId, req.user.id],
    );
    if (!rows.length || !roles.includes(rows[0].role)) {
      return res.status(403).json({ error: 'Sem permissão para esta árvore' });
    }
    next();
  };
}

/**
 * Middleware — rejects the request unless `req.user.isAdmin` is true.
 * Must be used AFTER `authMiddleware`.
 */
function requireAdmin(req, res, next) {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ error: 'Apenas administradores' });
  }
  next();
}

module.exports = {
  hashPassword,
  verifyPassword,
  generateTokens,
  verifyAccessToken,
  verifyRefreshToken,
  authMiddleware,
  requireRole,
  requireAdmin,
};
