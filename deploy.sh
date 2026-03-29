#!/usr/bin/env sh

# abort on errors
set -e

echo "==> Building core-utils..."
pnpm --filter streamsight-core-utils build

echo "==> Building streamsight SDK..."
pnpm --filter streamsight build

echo "==> Building demo-app for GitHub Pages..."
DEPLOY_GH_PAGES=1 pnpm --filter @streamsight/demo-app build

# navigate into the build output directory
cd apps/demo-app/dist

# GitHub Pages needs a 404.html for SPA fallback
cp index.html 404.html

git init -b main
git add -A
git commit -m 'deploy: streamsight demo'

# deploy to https://Sunny-117.github.io/streamsight
git push -f https://github.com/Sunny-117/streamsight.git main:gh-pages

cd -

echo ""
echo "==> Deployed! Visit https://Sunny-117.github.io/streamsight/"
