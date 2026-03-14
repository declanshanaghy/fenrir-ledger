# --------------------------------------------------------------------------
# Agent Sandbox Container — Fenrir Ledger
#
# Ephemeral container for running Claude Code agent tasks on GKE Autopilot.
# Pre-bakes Node.js, Claude CLI, GitHub CLI, Playwright browsers + system
# deps, and a warm npm cache to minimize cold-start time for agent Jobs.
#
# Build:
#   docker build -t us-central1-docker.pkg.dev/fenrir-ledger-prod/fenrir-images/agent-sandbox:latest \
#     -f infrastructure/k8s/agents/Dockerfile .
#
# Push:
#   docker push us-central1-docker.pkg.dev/fenrir-ledger-prod/fenrir-images/agent-sandbox:latest
# --------------------------------------------------------------------------

FROM node:20-bookworm-slim

LABEL maintainer="firemandecko@fenrir-ledger.dev"
LABEL description="Fenrir Ledger agent sandbox for Claude Code tasks"

# Avoid interactive prompts during package install
ENV DEBIAN_FRONTEND=noninteractive

# --------------------------------------------------------------------------
# 1. System dependencies — git, curl, jq, plus Playwright's system libs
# --------------------------------------------------------------------------
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    ca-certificates \
    jq \
    openssh-client \
    # Playwright Chromium system dependencies (avoids slow `--with-deps` at runtime)
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxkbcommon0 \
    libatspi2.0-0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    libwayland-client0 \
    fonts-liberation \
    fonts-noto-color-emoji \
    xvfb \
    && rm -rf /var/lib/apt/lists/*

# --------------------------------------------------------------------------
# 2. GitHub CLI
# --------------------------------------------------------------------------
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
      -o /usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
      > /etc/apt/sources.list.d/github-cli.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends gh \
    && rm -rf /var/lib/apt/lists/*

# --------------------------------------------------------------------------
# 3. Claude Code CLI (global)
# --------------------------------------------------------------------------
RUN npm install -g @anthropic-ai/claude-code@latest

# --------------------------------------------------------------------------
# 4. Pre-install Playwright Chromium browser binary
#    Version is pinned to whatever @playwright/test ships with.
#    sandbox-setup.sh skips this step when browsers are already present.
# --------------------------------------------------------------------------
COPY development/frontend/package.json development/frontend/package-lock.json /tmp/frontend/
RUN cd /tmp/frontend \
    && npm ci --prefer-offline 2>/dev/null || npm ci \
    && npx playwright install chromium \
    && rm -rf /tmp/frontend

# --------------------------------------------------------------------------
# 5. Non-root user — Claude Code refuses --dangerously-skip-permissions as root
# --------------------------------------------------------------------------
# node:20 image ships with user 'node' (uid 1000) — reuse it
RUN mkdir -p /workspace && chown node:node /workspace

# --------------------------------------------------------------------------
# 6. Workspace + git config
# --------------------------------------------------------------------------
WORKDIR /workspace
USER node

RUN git config --global init.defaultBranch main \
    && git config --global advice.detachedHead false

# --------------------------------------------------------------------------
# 7. Entrypoint — clones repo, runs sandbox setup, executes task
# --------------------------------------------------------------------------
COPY --chown=node:node infrastructure/k8s/agents/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
