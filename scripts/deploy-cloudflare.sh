#!/usr/bin/env bash
set -euo pipefail

# Deployment credentials are runtime secrets. Never print, persist, or commit their values.
for secret_name in OPENROUTER_API_KEY SUPABASE_SERVICE_ROLE_KEY AGENT_WORKER_SECRET CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID; do
  if [[ -z "${!secret_name:-}" ]]; then
    echo "Missing required deployment secret or variable: $secret_name" >&2
    exit 1
  fi
done

echo "STEP 1/4: Building the OpenNext application..."
npx opennextjs-cloudflare build

echo "STEP 2/4: Deploying the Cloudflare Worker..."
npx opennextjs-cloudflare deploy -- --keep-vars

echo "STEP 3/4: Installing provider and Agent runtime secrets..."
for secret_name in OPENROUTER_API_KEY SUPABASE_SERVICE_ROLE_KEY AGENT_WORKER_SECRET; do
  printf '%s' "${!secret_name}" | npx wrangler secret put "$secret_name"
done

echo "STEP 4/4: Deployment commands completed. Verify the deployed Worker and scheduled trigger before enabling users."
