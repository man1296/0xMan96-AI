#!/usr/bin/env bash
set -euo pipefail

# Workers Builds exposes build secrets to this process only.
# Never print, persist, or commit the secret value.
if [[ -z "${OPENROUTER_API_KEY:-}" ]]; then
  echo "Missing required build secret: OPENROUTER_API_KEY" >&2
  exit 1
fi

echo "STEP 1/3: Building the OpenNext application..."
npx opennextjs-cloudflare build

echo "STEP 2/3: Deploying the Cloudflare Worker..."
npx opennextjs-cloudflare deploy -- --keep-vars

# Attach the build-only secret to the deployed Worker runtime.
# Wrangler reads the value from stdin and creates a new Worker version.
echo "STEP 3/3: Installing OPENROUTER_API_KEY as a runtime Secret (value hidden)..."
printf '%s' "$OPENROUTER_API_KEY" | npx wrangler secret put OPENROUTER_API_KEY
echo "Runtime Secret installation command completed."
