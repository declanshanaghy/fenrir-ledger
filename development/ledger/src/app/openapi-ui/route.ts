/**
 * GET /openapi-ui
 *
 * Interactive OpenAPI explorer powered by Scalar.
 *
 * Auth-gated client-side:
 *  - Reads session from localStorage ("fenrir:auth")
 *  - Redirects to /ledger/sign-in if no valid session
 *  - Auto-injects Bearer token into Scalar's "Try It" requests
 *  - Fetches spec from /api/openapi (server-side auth-gated) with Bearer token
 *
 * Nordic dark theme via CSS variables (void-black #07070d, gold #c9920a).
 * Scalar loaded from CDN (~66 KB bundle).
 *
 * Issue #2057
 */

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Fenrir Ledger — API Explorer</title>
  <style>
    /* ── Reset ─────────────────────────────────────────────────────────── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    html, body {
      height: 100%;
      background: #07070d;
      color: #e8e4d4;
      font-family: system-ui, sans-serif;
    }

    /* ── Loading / error states ────────────────────────────────────────── */
    #fenrir-loading {
      position: fixed;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #07070d;
      color: #c9920a;
      font-family: Georgia, serif;
      font-size: 1rem;
      letter-spacing: 0.08em;
      font-style: italic;
    }
    #fenrir-loading.hidden { display: none; }

    /* ── Scalar mount ───────────────────────────────────────────────────── */
    #app { height: 100%; }

    /* ── Nordic dark theme CSS variables ───────────────────────────────── */
    :root {
      --scalar-background-1: #07070d;
      --scalar-background-2: #0f0f1a;
      --scalar-background-3: #16162a;
      --scalar-background-accent: #1a1a2e;
      --scalar-border-color: rgba(201,146,10,0.15);

      --scalar-color-1: #e8e4d4;
      --scalar-color-2: #b8b0a0;
      --scalar-color-3: #7a7060;
      --scalar-color-accent: #c9920a;
      --scalar-color-green: #4caf7d;
      --scalar-color-red: #c0392b;
      --scalar-color-yellow: #c9920a;
      --scalar-color-blue: #5b8fd4;
      --scalar-color-orange: #d4803a;
      --scalar-color-purple: #9b59b6;

      --scalar-sidebar-background-1: #07070d;
      --scalar-sidebar-background-2: #0f0f1a;
      --scalar-sidebar-color-1: #e8e4d4;
      --scalar-sidebar-color-2: #b8b0a0;
      --scalar-sidebar-color-active: #c9920a;
      --scalar-sidebar-border-color: rgba(201,146,10,0.15);
      --scalar-sidebar-item-hover-background: rgba(201,146,10,0.08);
      --scalar-sidebar-item-active-background: rgba(201,146,10,0.12);

      --scalar-button-1: #c9920a;
      --scalar-button-1-color: #07070d;
      --scalar-button-1-hover: #e0a30c;

      --scalar-scrollbar-color: rgba(201,146,10,0.3);
      --scalar-scrollbar-color-active: rgba(201,146,10,0.6);

      --scalar-heading-color: #e8e4d4;
      --scalar-code-background: #0f0f1a;

      /* Badge colors for HTTP methods */
      --scalar-color-get: #5b8fd4;
      --scalar-color-post: #4caf7d;
      --scalar-color-put: #d4803a;
      --scalar-color-patch: #9b59b6;
      --scalar-color-delete: #c0392b;
    }

    /* Extra polish */
    .scalar-app { background: #07070d !important; }
  </style>
</head>
<body>
  <div id="fenrir-loading">The ravens scout the routes&hellip;</div>
  <div id="app"></div>

  <!-- Scalar CDN — loaded after auth gate passes -->
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>

  <script>
    (function () {
      'use strict';

      var SIGN_IN_URL = '/ledger/sign-in?returnTo=/openapi-ui';
      var SPEC_URL = '/api/openapi';

      function redirect() {
        window.location.href = SIGN_IN_URL;
      }

      function getSession() {
        try {
          var raw = localStorage.getItem('fenrir:auth');
          if (!raw) return null;
          var session = JSON.parse(raw);
          if (!session || !session.id_token || !session.expires_at) return null;
          if (Date.now() >= session.expires_at) return null;
          return session;
        } catch (e) {
          return null;
        }
      }

      function showLoading(msg) {
        var el = document.getElementById('fenrir-loading');
        if (el) el.textContent = msg;
      }

      function hideLoading() {
        var el = document.getElementById('fenrir-loading');
        if (el) el.classList.add('hidden');
      }

      function initScalar(spec, token) {
        if (typeof Scalar === 'undefined' || !Scalar.createApiReference) {
          showLoading('Failed to load Scalar. Please refresh.');
          return;
        }

        hideLoading();

        Scalar.createApiReference('#app', {
          content: spec,
          theme: 'none',
          darkMode: true,
          authentication: {
            preferredSecurityScheme: 'BearerAuth',
            http: {
              bearer: {
                token: token
              }
            }
          },
          customCss: '',
          defaultOpenAllTags: false,
          showSidebar: true,
          hideModels: false,
          hideDownloadButton: false,
          pathRouting: { basePath: '/openapi-ui' }
        });
      }

      function boot() {
        var session = getSession();

        if (!session) {
          redirect();
          return;
        }

        var token = session.id_token;
        showLoading('Fetching routes\u2026');

        fetch(SPEC_URL, {
          headers: { 'Authorization': 'Bearer ' + token }
        })
          .then(function (res) {
            if (res.status === 401 || res.status === 403) {
              redirect();
              return null;
            }
            if (!res.ok) {
              showLoading('Failed to load API spec (' + res.status + '). Refresh to retry.');
              return null;
            }
            return res.json();
          })
          .then(function (spec) {
            if (spec) initScalar(spec, token);
          })
          .catch(function () {
            showLoading('Network error loading API spec. Refresh to retry.');
          });
      }

      // Wait for DOM + CDN script to finish loading
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
      } else {
        boot();
      }
    })();
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
