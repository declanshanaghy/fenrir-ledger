# Fenrir Gmail MCP Server

Secure read-only Gmail access for Claude Code. Built in-house after Heimdall's
audit found all community Gmail MCP servers unsafe (see
`security/reports/2026-03-07-gmail-mcp-deep-audit.md`).

## Security Properties

| Property | Implementation |
|----------|---------------|
| Scope | `gmail.readonly` only -- no send, compose, modify |
| Token storage | macOS Keychain (`security` CLI) -- encrypted at rest by OS |
| Prompt injection defense | All email body content wrapped in `[BEGIN UNTRUSTED EMAIL]` markers |
| Token leakage prevention | Tokens never appear in tool results, MCP state, or error messages |
| OAuth flow | Standard Google OAuth2 with PKCE |
| File permissions | No token files on disk (Keychain only) |

## Prerequisites

- macOS (uses Keychain via `security` CLI)
- Node.js 18+
- A Google Cloud Platform project with the Gmail API enabled

## Setup

### 1. Create GCP OAuth Client

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project (or select existing)
3. Enable the **Gmail API** (APIs & Services > Library > search "Gmail API")
4. Go to **APIs & Services > Credentials**
5. Click **Create Credentials > OAuth client ID**
6. Application type: **Web application**
7. Add authorized redirect URI: `http://127.0.0.1` (any port -- the server picks a random one)
   - Note: Google allows `http://127.0.0.1` with any port for loopback redirect
8. Copy the **Client ID** and **Client Secret**

### 2. Configure OAuth Consent Screen

1. Go to **APIs & Services > OAuth consent screen**
2. User type: **External** (or Internal if using Google Workspace)
3. Add scopes: select `Gmail API > .../auth/gmail.readonly`
4. If in Testing mode, add your Google account as a test user

### 3. Install Dependencies

```bash
cd .claude/mcp-servers/gmail
npm install
```

### 4. Configure Claude Code

Add to your `.claude.json` (project-level) or `~/.claude.json` (global):

```json
{
  "mcpServers": {
    "gmail": {
      "command": "node",
      "args": [".claude/mcp-servers/gmail/server.js"],
      "env": {
        "GMAIL_MCP_CLIENT_ID": "YOUR_CLIENT_ID.apps.googleusercontent.com",
        "GMAIL_MCP_CLIENT_SECRET": "GOCSPX-YOUR_SECRET"
      }
    }
  }
}
```

Replace the env values with your actual OAuth client credentials.

### 5. First Use

The first time you call any Gmail tool, the server will:

1. Open your browser to Google's consent page
2. After you authorize, redirect back to a local callback
3. Store the tokens securely in macOS Keychain
4. Subsequent calls use the stored token (auto-refreshes when expired)

## Available Tools

| Tool | Description |
|------|-------------|
| `gmail_list` | List inbox messages (subject, from, date, snippet). Optional query filter. Max 20. |
| `gmail_read` | Read a single message by ID. Returns headers + role-wrapped body. |
| `gmail_search` | Search messages by Gmail query string. Returns summaries. Max 20. |
| `gmail_thread` | Read entire thread by thread ID. All messages with role-wrapped bodies. |

## Keychain Management

Tokens are stored under:
- Account: `fenrir-gmail-mcp`
- Service: `gmail-oauth-token`

To revoke access / clear stored tokens:

```bash
security delete-generic-password -a "fenrir-gmail-mcp" -s "gmail-oauth-token"
```

You can also revoke the app's access from
[Google Account > Security > Third-party apps](https://myaccount.google.com/permissions).

## Troubleshooting

**"Missing GMAIL_MCP_CLIENT_ID" error**: Ensure the env vars are set in your
MCP config (`.claude.json`), not in your shell profile.

**Consent page does not open**: The server will print the auth URL to stderr.
Copy and paste it into your browser manually.

**Token expired / auth errors**: Delete the Keychain entry (see above) and
re-authorize on next use.
