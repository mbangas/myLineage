/**
 * auth.js — myLineage Authentication (JWT-based)
 * Stores access + refresh tokens in localStorage.
 * Attaches Authorization header to every /api/ fetch.
 * Handles automatic token refresh on 401 responses.
 */
(function () {
  'use strict';

  const TOKEN_KEY   = 'ml_access';
  const REFRESH_KEY = 'ml_refresh';
  const USER_KEY    = 'ml_user';
  const LOGIN_URL   = 'login.html';

  /* ─────────────────────────────────────────────────────────────────────
     Token helpers
  ───────────────────────────────────────────────────────────────────── */
  function getAccessToken()  { return localStorage.getItem(TOKEN_KEY); }
  function getRefreshToken() { return localStorage.getItem(REFRESH_KEY); }

  function setTokens(accessToken, refreshToken) {
    localStorage.setItem(TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_KEY, refreshToken);
  }

  function clearTokens() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
  }

  function getUser() {
    try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch (_) { return null; }
  }

  function setUser(u) {
    localStorage.setItem(USER_KEY, JSON.stringify(u));
  }

  /** Decode JWT payload without a library (no verification — server does that). */
  function decodePayload(token) {
    try {
      const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(base64));
    } catch (_) { return null; }
  }

  /** Returns true if the access token is present and NOT expired (with 30 s buffer). */
  function isAccessValid() {
    const t = getAccessToken();
    if (!t) return false;
    const p = decodePayload(t);
    return p && p.exp && (p.exp * 1000 > Date.now() + 30000);
  }

  /* ─────────────────────────────────────────────────────────────────────
     Session-like API (backward-compat for pages that call getSession)
  ───────────────────────────────────────────────────────────────────── */
  function getSession() {
    if (!isAccessValid()) return null;
    return getUser();
  }

  function setSession(data) {
    if (data.accessToken)  setTokens(data.accessToken, data.refreshToken);
    if (data.user)         setUser(data.user);
    else if (data.id)      setUser(data); // compat
  }

  function clearSession() { clearTokens(); }

  /* ─────────────────────────────────────────────────────────────────────
     Logout
  ───────────────────────────────────────────────────────────────────── */
  function logout() {
    // Best-effort server-side logout
    const t = getAccessToken();
    if (t) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + t, 'Content-Type': 'application/json' },
      }).catch(function () {});
    }
    clearTokens();
    window.location.replace(LOGIN_URL);
  }

  /* ─────────────────────────────────────────────────────────────────────
     Automatic token refresh
  ───────────────────────────────────────────────────────────────────── */
  let _refreshPromise = null;

  async function refreshAccessToken() {
    if (_refreshPromise) return _refreshPromise;
    const rt = getRefreshToken();
    if (!rt) { clearTokens(); return null; }
    _refreshPromise = fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rt }),
    }).then(function (res) {
      if (!res.ok) throw new Error('refresh failed');
      return res.json();
    }).then(function (data) {
      setTokens(data.accessToken, data.refreshToken);
      return data.accessToken;
    }).catch(function () {
      clearTokens();
      return null;
    }).finally(function () {
      _refreshPromise = null;
    });
    return _refreshPromise;
  }

  /* ─────────────────────────────────────────────────────────────────────
     Fetch wrapper — attaches Authorization header + auto-refresh
  ───────────────────────────────────────────────────────────────────── */
  const _origFetch = window.fetch.bind(window);

  async function authFetch(input, init) {
    const url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
    // Only intercept /api/ calls (skip auth endpoints themselves)
    if (!url.includes('/api/') || url.includes('/api/auth/')) {
      return _origFetch(input, init);
    }

    init = init || {};
    init.headers = init.headers || {};

    // Ensure fresh token
    if (!isAccessValid()) {
      const newToken = await refreshAccessToken();
      if (!newToken) { logout(); return _origFetch(input, init); }
    }
    init.headers['Authorization'] = 'Bearer ' + getAccessToken();

    let res = await _origFetch(input, init);
    if (res.status === 401) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        init.headers['Authorization'] = 'Bearer ' + newToken;
        res = await _origFetch(input, init);
      } else {
        logout();
      }
    }
    return res;
  }

  // Override global fetch so all existing code gets auth headers automatically
  window.fetch = authFetch;

  /* ─────────────────────────────────────────────────────────────────────
     Auth guard — protect all pages except login / register / setup
  ───────────────────────────────────────────────────────────────────── */
  function getCurrentPage() {
    return window.location.pathname.split('/').pop() || 'index.html';
  }

  function requireAuth() {
    const page = getCurrentPage();
    if (page === LOGIN_URL || page === 'register.html' || page === 'setup.html' || page === '') return;

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
    getAccessToken,
    getRefreshToken,
    getUser,
    setUser,
    getSession,
    setSession,
    clearSession,
    logout,
    refreshAccessToken,
    requireAuth,
    isAccessValid,
    setTokens,
  };

  /* Run guard immediately (sync session check → redirect if needed) */
  requireAuth();

})();
