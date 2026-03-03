#!/usr/bin/env bash
# Generate a 32-byte (256-bit) hex-encoded encryption key for ENTITLEMENT_ENCRYPTION_KEY.
# Usage: ./scripts/generate-encryption-key.sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
