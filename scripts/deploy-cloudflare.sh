#!/usr/bin/env bash
set -euo pipefail

# Workers Builds exposes build secrets to this process only.
# Never print, persist, or commit the secret value.
if [[ -z "${OPENROUTER_API_KEY:-}" ]]; then
  echo "Missing required build secret: OPENROUTER_API_KEY" >&2
  exit 1
fi

npx opennextjs-cloudflare build
npx opennextjs-cloudflare deploy -- --keep-vars

# Attach the build-only secret to the deployed Worker runtime.
# Wrangler reads the value from stdin and creates a new Worker version.
printf '%s' "$OPENROUTER_API_KEY" | npx wrangler secret put OPENROUTER_API_KEY
