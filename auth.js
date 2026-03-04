/**
 * auth.js — myLineage Authentication
 * TOTP (RFC 6238) compatible with Microsoft / Google Authenticator
 * Session via sessionStorage (8 h window)
 */
(function () {
  'use strict';

  const SESS_KEY  = 'ml_session';
  const LOGIN_URL = 'login.html';

  /* ─────────────────────────────────────────────────────────────────────
     Session helpers
  ───────────────────────────────────────────────────────────────────── */
  function getSession() {
    try {
      const raw = sessionStorage.getItem(SESS_KEY);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      // Sessions expire after 8 hours of inactivity
      if (Date.now() - (obj.ts || 0) > 8 * 3600 * 1000) {
        sessionStorage.removeItem(SESS_KEY);
        return null;
      }
      return obj;
    } catch (e) { return null; }
  }

  function setSession(data) {
    sessionStorage.setItem(SESS_KEY, JSON.stringify({ ...data, ts: Date.now() }));
  }

  function clearSession() {
    sessionStorage.removeItem(SESS_KEY);
  }

  function logout() {
    clearSession();
    window.location.replace(LOGIN_URL);
  }

  /* ─────────────────────────────────────────────────────────────────────
     Base-32 encoding / decoding (RFC 4648)
  ───────────────────────────────────────────────────────────────────── */
  const B32_ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

  function base32Encode(uint8) {
    let bits = 0, val = 0, out = '';
    for (let i = 0; i < uint8.length; i++) {
      val = (val << 8) | uint8[i];
      bits += 8;
      while (bits >= 5) { out += B32_ALPHA[(val >>> (bits - 5)) & 31]; bits -= 5; }
    }
    if (bits > 0) out += B32_ALPHA[(val << (5 - bits)) & 31];
    return out;
  }

  function base32Decode(str) {
    const s = str.toUpperCase().replace(/=+$/, '').replace(/[^A-Z2-7]/g, '');
    const bytes = [];
    let bits = 0, val = 0;
    for (let i = 0; i < s.length; i++) {
      const idx = B32_ALPHA.indexOf(s[i]);
      if (idx < 0) continue;
      val = (val << 5) | idx;
      bits += 5;
      if (bits >= 8) { bytes.push((val >>> (bits - 8)) & 0xFF); bits -= 8; }
    }
    return new Uint8Array(bytes);
  }

  function generateSecret() {
    return base32Encode(crypto.getRandomValues(new Uint8Array(20)));
  }

  /* ─────────────────────────────────────────────────────────────────────
     Pure-JS SHA-1 + HMAC-SHA1 fallback (for HTTP / non-secure contexts
     where crypto.subtle is unavailable)
  ───────────────────────────────────────────────────────────────────── */
  function _sha1(data) {
    // data: Uint8Array → Uint8Array(20)
    let H = [0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476, 0xC3D2E1F0];
    const ml = data.length * 8;
    const padded = Array.from(data);
    padded.push(0x80);
    while ((padded.length % 64) !== 56) padded.push(0);
    // 64-bit big-endian bit-length (upper 32 bits always 0 for msgs < 512 MB)
    padded.push(0, 0, 0, 0);
    padded.push((ml >>> 24) & 0xff, (ml >>> 16) & 0xff, (ml >>> 8) & 0xff, ml & 0xff);
    for (let i = 0; i < padded.length; i += 64) {
      const W = [];
      for (let t = 0; t < 16; t++) {
        W[t] = ((padded[i+4*t]<<24)|(padded[i+4*t+1]<<16)|(padded[i+4*t+2]<<8)|padded[i+4*t+3]) >>> 0;
      }
      for (let t = 16; t < 80; t++) {
        const v = W[t-3] ^ W[t-8] ^ W[t-14] ^ W[t-16];
        W[t] = ((v << 1) | (v >>> 31)) >>> 0;
      }
      let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4];
      for (let t = 0; t < 80; t++) {
        let f, k;
        if      (t < 20) { f = (b & c) | ((~b >>> 0) & d); k = 0x5A827999; }
        else if (t < 40) { f = b ^ c ^ d;                   k = 0x6ED9EBA1; }
        else if (t < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8F1BBCDC; }
        else             { f = b ^ c ^ d;                   k = 0xCA62C1D6; }
        const temp = (((a << 5) | (a >>> 27)) + f + e + k + W[t]) >>> 0;
        e = d; d = c; c = ((b << 30) | (b >>> 2)) >>> 0; b = a; a = temp;
      }
      H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0;
      H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0; H[4] = (H[4] + e) >>> 0;
    }
    const out = new Uint8Array(20);
    H.forEach((h, i) => { out[i*4]=(h>>>24)&0xff; out[i*4+1]=(h>>>16)&0xff; out[i*4+2]=(h>>>8)&0xff; out[i*4+3]=h&0xff; });
    return out;
  }

  function _hmacSha1Fallback(key, data) {
    // key, data: Uint8Array → Uint8Array(20)
    const BLK = 64;
    let k = key.length > BLK ? _sha1(key) : key;
    const kPad = new Uint8Array(BLK);
    kPad.set(k);
    const iPad = new Uint8Array(BLK + data.length);
    const oPad = new Uint8Array(BLK + 20);
    for (let i = 0; i < BLK; i++) { iPad[i] = kPad[i] ^ 0x36; oPad[i] = kPad[i] ^ 0x5c; }
    iPad.set(data, BLK);
    const inner = _sha1(iPad);
    oPad.set(inner, BLK);
    return _sha1(oPad);
  }

  /* ─────────────────────────────────────────────────────────────────────
     TOTP — RFC 6238  (HMAC-SHA1, 30 s, 6 digits)
     Uses crypto.subtle when available (HTTPS), falls back to pure-JS
     HMAC-SHA1 for HTTP deployments (e.g. Docker/LXC on Proxmox).
  ───────────────────────────────────────────────────────────────────── */
  async function totpCode(secret, timeOffset) {
    const counter = Math.floor(Date.now() / 30000) + (timeOffset | 0);
    const keyBytes = base32Decode(secret);
    // 8-byte big-endian counter (upper 32 bits = 0 for dates until ~year 4000)
    const msgBuf = new Uint8Array(8);
    const cv = counter >>> 0;
    msgBuf[4] = (cv >>> 24) & 0xff;
    msgBuf[5] = (cv >>> 16) & 0xff;
    msgBuf[6] = (cv >>>  8) & 0xff;
    msgBuf[7] =  cv         & 0xff;

    let sig;
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const cryptoKey = await crypto.subtle.importKey(
        'raw', keyBytes, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']
      );
      sig = new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, msgBuf));
    } else {
      // Fallback for HTTP (non-secure) contexts
      sig = _hmacSha1Fallback(keyBytes, msgBuf);
    }

    const off = sig[19] & 0xf;
    const bin = ((sig[off] & 0x7f) << 24) | (sig[off + 1] << 16) | (sig[off + 2] << 8) | sig[off + 3];
    return String(bin % 1000000).padStart(6, '0');
  }

  async function verifyTOTP(secret, code) {
    const c = String(code).replace(/\s/g, '');
    for (const off of [0, -1, 1]) {
      if (await totpCode(secret, off) === c) return true;
    }
    return false;
  }

  function otpAuthUri(phone, secret) {
    const label = encodeURIComponent('myLineage:' + phone);
    return 'otpauth://totp/' + label +
      '?secret=' + secret +
      '&issuer=myLineage' +
      '&algorithm=SHA1&digits=6&period=30';
  }

  /* ─────────────────────────────────────────────────────────────────────
     Phone / DB helpers
  ───────────────────────────────────────────────────────────────────── */
  function normalizePhone(p) {
    // Remove spaces, dashes, parens — keep leading + or digits only
    return (p || '').replace(/[\s\-().]/g, '');
  }

  function isAdminPhone(phone) {
    const DB = window.GedcomDB;
    if (!DB) return false;
    const admin = DB.getSetting('adminPhone');
    if (!admin) return false;
    return normalizePhone(phone) === normalizePhone(admin);
  }

  function findPersonByPhone(phone) {
    const DB = window.GedcomDB;
    if (!DB) return null;
    const norm = normalizePhone(phone);
    return DB.getIndividuals().find(function (i) {
      return (i.contacts || []).some(function (c) {
        return c.type === 'phone' && normalizePhone(c.value) === norm;
      });
    }) || null;
  }

  function getTotpSecret(phone) {
    const DB = window.GedcomDB;
    if (!DB) return null;
    const secrets = DB.getSetting('totpSecrets') || {};
    return secrets[normalizePhone(phone)] || null;
  }

  function saveTotpSecret(phone, secret) {
    const DB = window.GedcomDB;
    if (!DB) return;
    const secrets = DB.getSetting('totpSecrets') || {};
    secrets[normalizePhone(phone)] = secret;
    DB.setSetting('totpSecrets', secrets);
  }

  /* ─────────────────────────────────────────────────────────────────────
     Auth guard — protect all pages except login.html
  ───────────────────────────────────────────────────────────────────── */
  function getCurrentPage() {
    return window.location.pathname.split('/').pop() || 'index.html';
  }

  function requireAuth() {
    const page = getCurrentPage();
    if (page === LOGIN_URL || page === 'setup.html' || page === '') return;
    // First run: no admin phone configured
    const DB = window.GedcomDB;
    if (DB && !DB.getSetting('adminPhone')) {
      window.location.replace('setup.html');
      return;
    }
    const sess = getSession();
    if (!sess) {
      window.location.replace(LOGIN_URL + '?from=' + encodeURIComponent(page));
      return;
    }
    // Inject user/admin bar into the page topbar
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { _injectUserBar(sess); });
    } else {
      _injectUserBar(sess);
    }
  }

  /* ─────────────────────────────────────────────────────────────────────
     Top-bar user widget (admin badge + name + logout button)
  ───────────────────────────────────────────────────────────────────── */
  function _injectUserBar(sess) {
    const topbar = document.querySelector('.topbar');
    if (!topbar || document.getElementById('ml-userbar')) return;

    const bar = document.createElement('div');
    bar.id = 'ml-userbar';
    bar.style.cssText = 'margin-left:auto;display:flex;align-items:center;gap:10px;flex-shrink:0;';

    if (sess.isAdmin) {
      const badge = document.createElement('span');
      badge.style.cssText = [
        'display:flex;align-items:center;gap:5px;',
        'background:rgba(210,153,34,0.15);color:#d29922;',
        'border:1px solid rgba(210,153,34,0.3);border-radius:20px;',
        'padding:3px 12px;font-size:0.78rem;font-weight:600;white-space:nowrap;'
      ].join('');
      badge.innerHTML = '<i class="mdi mdi-shield-crown" style="font-size:1rem;"></i> Administrador';
      bar.appendChild(badge);
    }

    if (sess.name) {
      const nameEl = document.createElement('span');
      nameEl.style.cssText = 'color:var(--text-secondary);font-size:0.82rem;white-space:nowrap;max-width:150px;overflow:hidden;text-overflow:ellipsis;';
      nameEl.textContent = sess.name;
      bar.appendChild(nameEl);
    }

    const logoutBtn = document.createElement('button');
    logoutBtn.style.cssText = [
      'background:none;border:1px solid var(--border);border-radius:8px;',
      'color:var(--text-secondary);padding:4px 10px;font-size:0.78rem;',
      'cursor:pointer;display:flex;align-items:center;gap:4px;',
      'transition:border-color 0.15s,color 0.15s;'
    ].join('');
    logoutBtn.innerHTML = '<i class="mdi mdi-logout" style="font-size:0.9rem;"></i> Sair';
    logoutBtn.addEventListener('mouseenter', function () {
      this.style.borderColor = 'var(--red)';
      this.style.color = 'var(--red)';
    });
    logoutBtn.addEventListener('mouseleave', function () {
      this.style.borderColor = 'var(--border)';
      this.style.color = 'var(--text-secondary)';
    });
    logoutBtn.addEventListener('click', logout);
    bar.appendChild(logoutBtn);

    topbar.appendChild(bar);
  }

  /* ─────────────────────────────────────────────────────────────────────
     Public API
  ───────────────────────────────────────────────────────────────────── */
  window.MLAuth = {
    getSession,
    setSession,
    clearSession,
    logout,
    generateSecret,
    totpCode,
    verifyTOTP,
    otpAuthUri,
    normalizePhone,
    isAdminPhone,
    findPersonByPhone,
    getTotpSecret,
    saveTotpSecret,
    requireAuth
  };

  /* Run guard immediately (sync session check → redirect if needed) */
  requireAuth();

})();
