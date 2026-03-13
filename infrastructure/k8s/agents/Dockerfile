# --------------------------------------------------------------------------
# Agent Sandbox Container — Fenrir Ledger
#
# Ephemeral container for running Claude Code agent tasks on GKE Autopilot.
# Pre-bakes Node.js, Claude CLI, GitHub CLI, and system dependencies
# to minimize cold-start time for agent Jobs.
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

# Install system dependencies required by agents
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    ca-certificates \
    jq \
    openssh-client \
    && rm -rf /var/lib/apt/lists/*

# Install GitHub CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
      -o /usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
      > /etc/apt/sources.list.d/github-cli.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends gh \
    && rm -rf /var/lib/apt/lists/*

# Install Claude Code CLI globally
RUN npm install -g @anthropic-ai/claude-code@latest

# Create workspace directory (matches Depot convention)
WORKDIR /workspace

# Pre-configure git for agent commits
RUN git config --global init.defaultBranch main \
    && git config --global advice.detachedHead false

# Agent entrypoint script — clones repo, runs sandbox setup, executes task
COPY infrastructure/k8s/agents/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
