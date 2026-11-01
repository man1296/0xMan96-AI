#!/usr/bin/env bash
set -euo pipefail

# Workers Builds exposes build secrets to this process only.
# Never print, persist, or commit secret values.
if [[ -z "${OPENROUTER_API_KEY:-}" ]]; then
  echo "Missing required build secret: OPENROUTER_API_KEY" >&2
  exit 1
fi

echo "STEP 1/4: Building the OpenNext application..."
npx opennextjs-cloudflare build

echo "STEP 2/4: Deploying the Cloudflare Worker..."
npx opennextjs-cloudflare deploy -- --keep-vars

echo "STEP 3/4: Installing OPENROUTER_API_KEY as a runtime Secret..."
printf '%s' "$OPENROUTER_API_KEY" | npx wrangler secret put OPENROUTER_API_KEY

echo "STEP 4/4: Installing optional Agent runtime secrets..."
for secret_name in SUPABASE_SERVICE_ROLE_KEY AGENT_WORKER_SECRET; do
  if [[ -n "${!secret_name:-}" ]]; then
    printf '%s' "${!secret_name}" | npx wrangler secret put "$secret_name"
  else
    echo "Agent background processing remains disabled until $secret_name is configured."
  fi
done

echo "Deployment commands completed. Verify the deployed Worker and scheduled trigger before enabling users."
