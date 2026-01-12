#!/bin/bash

# Exit on error
set -e

echo "🚀 Starting deployment to GitHub Pages..."

# Get current branch name
CURRENT_BRANCH=$(git branch --show-current)
echo "📍 Current branch: $CURRENT_BRANCH"

# Build the site
echo "📦 Building the site..."
npm run build

# Copy CNAME to dist (important for custom domain)
if [ -f "CNAME" ]; then
    echo "📋 Copying CNAME to dist..."
    cp CNAME dist/
else
    echo "⚠️  Warning: CNAME file not found"
fi

# Check if gh-pages branch exists
if git show-ref --verify --quiet refs/heads/gh-pages; then
    echo "📌 Switching to existing gh-pages branch..."
    git checkout gh-pages
    git rm -rf . --quiet
else
    echo "✨ Creating new gh-pages branch..."
    git checkout --orphan gh-pages
    git rm -rf . --quiet 2>/dev/null || true
fi

# Copy dist contents to root
echo "📁 Copying build files..."
cp -r dist/* .
if [ -f "dist/CNAME" ]; then
    cp dist/CNAME . 2>/dev/null || true
fi

# Add only the built files (explicitly exclude node_modules, src, etc)
git add -f CNAME 2>/dev/null || true
git add -f index.html 2>/dev/null || true
git add -f assets/ 2>/dev/null || true
git add -f audio/ 2>/dev/null || true
git add -f logos/ 2>/dev/null || true
git add -f cassette.jpeg 2>/dev/null || true
git add -f music.json 2>/dev/null || true
# Explicitly remove any unwanted directories/files if they exist
git rm -rf node_modules src dist .vite package.json package-lock.json vite.config.js tailwind.config.js postcss.config.js deploy.sh .gitignore 2>/dev/null || true

# Commit
echo "💾 Committing changes..."
git commit -m "Deploy to GitHub Pages - $(date +'%Y-%m-%d %H:%M:%S')" || echo "No changes to commit"

# Push to gh-pages branch
echo "🚢 Pushing to gh-pages branch..."
git push origin gh-pages --force

# Switch back to original branch
echo "↩️  Switching back to $CURRENT_BRANCH branch..."
git checkout $CURRENT_BRANCH

echo "✅ Deployment complete!"
echo ""
echo "📝 Next steps:"
echo "1. Go to your repository on GitHub"
echo "2. Settings → Pages"
echo "3. Source: Deploy from a branch"
echo "4. Branch: gh-pages, Folder: / (root)"
echo "5. Save"
