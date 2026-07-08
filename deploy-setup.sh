#!/bin/bash
set -e

echo "== Attendace: one-shot deploy setup =="

# 1. Vercel CLI
npm i -g vercel gh 2>/dev/null || npm i -g vercel

# 2. Push CI/CD workflow to GitHub
git add -A
git commit -m "ci: add build+deploy pipeline" || echo "nothing to commit"
git push origin main

# 3. Login + link Vercel project (opens browser once)
vercel login
vercel link --yes

# 4. Push Supabase env vars into Vercel (reads from local .env)
source .env
echo "$VITE_SUPABASE_URL" | vercel env add VITE_SUPABASE_URL production
echo "$VITE_SUPABASE_ANON_KEY" | vercel env add VITE_SUPABASE_ANON_KEY production

# 5. Deploy now, get live link
vercel --prod

# 6. Wire GitHub Actions secrets so every future `git push` auto-deploys
ORG_ID=$(cat .vercel/project.json | grep -o '"orgId":"[^"]*"' | cut -d'"' -f4)
PROJ_ID=$(cat .vercel/project.json | grep -o '"projectId":"[^"]*"' | cut -d'"' -f4)

echo ""
echo "Create a Vercel token at https://vercel.com/account/tokens, then run:"
echo "  gh secret set VERCEL_TOKEN --body \"<paste token>\""
echo "  gh secret set VERCEL_ORG_ID --body \"$ORG_ID\""
echo "  gh secret set VERCEL_PROJECT_ID --body \"$PROJ_ID\""
echo "  gh secret set VITE_SUPABASE_URL --body \"$VITE_SUPABASE_URL\""
echo "  gh secret set VITE_SUPABASE_ANON_KEY --body \"$VITE_SUPABASE_ANON_KEY\""
echo ""
echo "Done. Live link is above. Every 'git push' to main now auto-deploys."
