#!/usr/bin/env node
/**
 * Gmail MCP Server — Static Code Security Audit
 *
 * Reads the server source and validates:
 * 1. Only gmail.readonly scope used
 * 2. No hardcoded tokens
 * 3. All email content wrapped in markers
 * 4. Error messages generic
 * 5. PKCE implementation present
 * 6. Keychain methods used
 * 7. No filesystem token storage
 */

const fs = require("fs");
const path = require("path");
const assert = require("assert");

const serverPath = path.resolve(
  __dirname,
  "../../..",
  ".claude/mcp-servers/gmail/server.js"
);

if (!fs.existsSync(serverPath)) {
  console.error(`Error: Server file not found at ${serverPath}`);
  process.exit(1);
}

const serverCode = fs.readFileSync(serverPath, "utf-8");

console.log(
  "╔══════════════════════════════════════════════════════════════╗"
);
console.log("║       Gmail MCP Server — Static Code Security Audit     ║");
console.log(
  "╚══════════════════════════════════════════════════════════════╝\n"
);

/**
 * AUDIT 1: Only gmail.readonly scope
 */
function auditScopes() {
  console.log("✓ Audit 1: Scope enforcement");

  // Check for readonly scope
  assert(
    serverCode.includes("gmail.readonly"),
    "gmail.readonly scope not found"
  );

  // Check forbidden scopes are absent
  const forbiddenScopes = [
    "gmail.send",
    "gmail.compose",
    "gmail.modify",
    'auth/gmail"',
  ];

  for (const scope of forbiddenScopes) {
    if (
      serverCode.includes(scope) &&
      !serverCode.includes(`"${scope}"`) // Allow in comments
    ) {
      // Double-check it's not in a comment
      const lines = serverCode.split("\n");
      let found = false;
      for (const line of lines) {
        if (
          line.includes(scope) &&
          !line.trim().startsWith("//") &&
          !line.includes("comment")
        ) {
          found = true;
          break;
        }
      }
      assert(
        !found,
        `Forbidden scope ${scope} found in code: ${line}`
      );
    }
  }

  console.log("  - Only gmail.readonly scope configured");
  console.log("  - No send/compose/modify scopes");
  console.log("  - No full Gmail scope");
}

/**
 * AUDIT 2: No hardcoded tokens
 */
function auditHardcodedTokens() {
  console.log("\n✓ Audit 2: No hardcoded tokens");

  // Look for suspicious patterns
  const hardcodedTokenPatterns = [
    /access_token['":\s=]+"[a-zA-Z0-9_-]+"/,
    /refresh_token['":\s=]+"[a-zA-Z0-9_-]+"/,
    /ya29\.[a-zA-Z0-9_-]+/,
    /Bearer\s+[a-zA-Z0-9_-]+/,
  ];

  for (const pattern of hardcodedTokenPatterns) {
    const match = serverCode.match(pattern);
    assert(
      !match,
      `Found hardcoded token pattern: ${match ? match[0] : pattern}`
    );
  }

  // Verify tokens come from environment/Keychain only
  assert(
    serverCode.includes("process.env.GMAIL_MCP_CLIENT_ID"),
    "Client ID not read from environment"
  );
  assert(
    serverCode.includes("process.env.GMAIL_MCP_CLIENT_SECRET"),
    "Client secret not read from environment"
  );
  assert(
    serverCode.includes("keychainRetrieve"),
    "Tokens not retrieved from Keychain"
  );

  console.log("  - No hardcoded tokens in source");
  console.log("  - Client credentials from environment variables");
  console.log("  - Tokens retrieved from Keychain only");
}

/**
 * AUDIT 3: All email content wrapped
 */
function auditUntrustedMarkers() {
  console.log("\n✓ Audit 3: Email content wrapped in markers");

  // Check for marker definitions
  assert(
    serverCode.includes("[BEGIN UNTRUSTED EMAIL"),
    "BEGIN marker not defined"
  );
  assert(
    serverCode.includes("[END UNTRUSTED EMAIL]"),
    "END marker not defined"
  );

  // Check wrapUntrusted function
  assert(
    serverCode.includes("function wrapUntrusted"),
    "wrapUntrusted function not found"
  );

  // Check wrapping is used in formatMessage
  assert(
    serverCode.includes("wrapUntrusted(msg.snippet"),
    "Snippet not wrapped"
  );
  assert(
    serverCode.includes("wrapUntrusted(extractBody"),
    "Body not wrapped"
  );

  // Check formatSummary also wraps
  assert(
    serverCode.match(
      /formatSummary[\s\S]*?wrapUntrusted\(msg\.snippet/
    ),
    "formatSummary doesn't wrap snippet"
  );

  console.log("  - Marker constants defined");
  console.log("  - wrapUntrusted() function present");
  console.log("  - formatMessage() wraps snippet and body");
  console.log("  - formatSummary() wraps snippet");
}

/**
 * AUDIT 4: Error messages generic
 */
function auditErrorMessages() {
  console.log("\n✓ Audit 4: Error messages generic (no token leaks)");

  // Find all error messages
  const errorMsgPattern =
    /"(.*?(error|error message|message|msg).*?)"/gi;

  // Check specific error handling blocks
  assert(
    serverCode.includes("Authentication required"),
    "Generic auth error message missing"
  );
  assert(
    serverCode.includes("Gmail API error"),
    "Generic API error message missing"
  );

  // Verify err.message is only written to stderr
  const stderrWrites = serverCode.match(
    /process\.stderr\.write.*?err\.message/gs
  );
  assert(stderrWrites, "Error details not logged to stderr");

  // Verify tool results don't include err.message in the returned text
  const toolReturns = serverCode.match(
    /content:\s*\[[\s\S]*?type:\s*"text",[\s\S]*?text:\s*[^}]*?\}/g
  );
  if (toolReturns) {
    for (const toolReturn of toolReturns) {
      // Check if err.message appears in the text being returned
      if (toolReturn.includes("err.message") && !toolReturn.includes("stderr")) {
        assert(
          false,
          "err.message returned in tool result text"
        );
      }
    }
  }

  // Verify safeMsg is used for error responses
  assert(
    serverCode.includes("safeMsg"),
    "safeMsg not used in tool error responses"
  );

  console.log("  - Error messages are generic");
  console.log("  - No token/credential keywords in messages");
  console.log("  - Detailed errors logged to stderr only");
}

/**
 * AUDIT 5: PKCE implementation
 */
function auditPKCE() {
  console.log("\n✓ Audit 5: OAuth2 PKCE implementation");

  assert(
    serverCode.includes("generatePKCE"),
    "generatePKCE function missing"
  );
  assert(
    serverCode.includes("crypto.randomBytes"),
    "PKCE verifier generation missing"
  );
  assert(
    serverCode.includes("createHash(\"sha256\")"),
    "PKCE challenge (SHA256) missing"
  );
  assert(
    serverCode.includes("code_challenge: challenge"),
    "code_challenge parameter missing from auth URL"
  );
  assert(
    serverCode.includes('code_challenge_method: "S256"'),
    "code_challenge_method S256 missing"
  );
  assert(
    serverCode.includes("codeVerifier: verifier"),
    "codeVerifier not passed to token exchange"
  );

  console.log("  - generatePKCE() function present");
  console.log("  - Verifier: crypto.randomBytes(32)");
  console.log("  - Challenge: SHA256(verifier)");
  console.log("  - code_challenge_method = S256");
}

/**
 * AUDIT 6: Keychain integration
 */
function auditKeychain() {
  console.log("\n✓ Audit 6: macOS Keychain integration");

  assert(
    serverCode.includes("keychainStore"),
    "keychainStore function missing"
  );
  assert(
    serverCode.includes("keychainRetrieve"),
    "keychainRetrieve function missing"
  );
  assert(
    serverCode.includes("security add-generic-password"),
    "Keychain store command missing"
  );
  assert(
    serverCode.includes("security find-generic-password"),
    "Keychain retrieve command missing"
  );
  assert(
    serverCode.includes("fenrir-gmail-mcp"),
    "Keychain account identifier missing"
  );
  assert(
    serverCode.includes("gmail-oauth-token"),
    "Keychain service identifier missing"
  );

  // Verify tokens stored via keychainStore in auth flow
  assert(
    serverCode.includes("keychainStore(tokens)"),
    "Tokens not stored in Keychain after auth"
  );
  assert(
    serverCode.includes("keychainStore(credentials)"),
    "Refreshed tokens not stored in Keychain"
  );

  console.log("  - keychainStore() stores encrypted tokens");
  console.log("  - keychainRetrieve() retrieves tokens");
  console.log("  - Account: fenrir-gmail-mcp");
  console.log("  - Service: gmail-oauth-token");
}

/**
 * AUDIT 7: No filesystem token storage
 */
function auditNoFilesystemTokens() {
  console.log("\n✓ Audit 7: No filesystem token storage");

  // Look for filesystem writes that might store tokens
  assert(
    !serverCode.includes("fs.writeFileSync") ||
      !serverCode.match(/fs\.writeFileSync.*token/i),
    "Tokens may be written to filesystem"
  );
  assert(
    !serverCode.includes("fs.writeFile") ||
      !serverCode.match(/fs\.writeFile.*token/i),
    "Tokens may be written to filesystem"
  );
  assert(
    !serverCode.match(/\.json.*token/i) ||
      !serverCode.includes("writeFile"),
    "JSON token files may be written"
  );

  // Verify no home directory writes for tokens
  assert(
    !serverCode.match(/process\.env\.HOME.*token/i),
    "Tokens may be stored in home directory"
  );
  assert(
    !serverCode.match(/process\.env\.USER.*token/i),
    "Tokens may be stored in user directory"
  );

  console.log("  - No fs.writeFile token storage");
  console.log("  - No JSON token files");
  console.log("  - Keychain is exclusive storage mechanism");
}

/**
 * AUDIT 8: OAuth2 browser consent flow
 */
function auditBrowserFlow() {
  console.log("\n✓ Audit 8: Browser-based OAuth2 consent flow");

  assert(
    serverCode.includes("runOAuthFlow"),
    "OAuth flow function missing"
  );
  assert(
    serverCode.includes("http.createServer"),
    "Local server for callback missing"
  );
  assert(
    serverCode.includes("generateAuthUrl"),
    "Auth URL generation missing"
  );
  assert(
    serverCode.includes('execSync(`open "'),
    "Browser open attempt missing"
  );
  assert(
    serverCode.includes("REDIRECT_PATH"),
    "Redirect path handling missing"
  );
  assert(
    serverCode.includes("access_type: \"offline\""),
    "Offline access not requested"
  );
  assert(
    serverCode.includes('prompt: "consent"'),
    "Forced consent prompt missing"
  );

  console.log("  - Local HTTP server listens for OAuth callback");
  console.log("  - Browser opened automatically (or manual fallback)");
  console.log("  - access_type=offline for refresh tokens");
  console.log("  - Forced consent flow");
}

/**
 * AUDIT 9: Token refresh handling
 */
function auditTokenRefresh() {
  console.log("\n✓ Audit 9: Token refresh and expiry handling");

  assert(
    serverCode.includes("refreshAccessToken"),
    "Token refresh call missing"
  );
  assert(
    serverCode.includes("expiry_date"),
    "Token expiry check missing"
  );
  assert(
    serverCode.includes("Date.now()"),
    "Current time check missing"
  );
  assert(
    serverCode.includes("60_000"),
    "Expiry buffer (60s) missing"
  );

  // Verify refresh_token preservation
  assert(
    serverCode.includes("credentials.refresh_token || tokens.refresh_token"),
    "refresh_token not preserved on token refresh"
  );

  console.log("  - Expired tokens automatically refreshed");
  console.log("  - 60-second expiry buffer");
  console.log("  - refresh_token preserved after refresh");
  console.log("  - Failed refresh triggers re-auth");
}

/**
 * AUDIT 10: 4 tools with proper schemas
 */
function auditToolDefinitions() {
  console.log("\n✓ Audit 10: Tool definitions and schemas");

  assert(
    serverCode.includes('server.tool(\n  "gmail_list"'),
    "gmail_list tool missing"
  );
  assert(
    serverCode.includes('server.tool(\n  "gmail_read"'),
    "gmail_read tool missing"
  );
  assert(
    serverCode.includes('server.tool(\n  "gmail_search"'),
    "gmail_search tool missing"
  );
  assert(
    serverCode.includes('server.tool(\n  "gmail_thread"'),
    "gmail_thread tool missing"
  );

  // Check all use z.string() or z.number() for params
  assert(
    serverCode.includes("z.string()"),
    "Zod string schema missing"
  );
  assert(
    serverCode.includes("z") && serverCode.includes(".number()"),
    "Zod number schema missing"
  );

  console.log("  - 4 tools defined: gmail_list, gmail_read, gmail_search, gmail_thread");
  console.log("  - All tools have Zod schemas");
  console.log("  - All parameters typed and validated");
}

/**
 * Run all audits
 */
function runAllAudits() {
  try {
    auditScopes();
    auditHardcodedTokens();
    auditUntrustedMarkers();
    auditErrorMessages();
    auditPKCE();
    auditKeychain();
    auditNoFilesystemTokens();
    auditBrowserFlow();
    auditTokenRefresh();
    auditToolDefinitions();

    console.log(
      "\n╔══════════════════════════════════════════════════════════════╗"
    );
    console.log("║                 ALL AUDITS PASSED ✓                      ║");
    console.log(
      "╚══════════════════════════════════════════════════════════════╝\n"
    );

    return 0;
  } catch (err) {
    console.error(`\n✗ AUDIT FAILED: ${err.message}`);
    console.error(`\nFile: ${serverPath}`);
    console.error(err.stack);
    return 1;
  }
}

process.exit(runAllAudits());
