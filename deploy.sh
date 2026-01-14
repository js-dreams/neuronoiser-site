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

# Copy dist to a temporary location before switching branches (outside git working dir)
TEMP_DIST=$(mktemp -d)
echo "📦 Storing build files in temporary location..."
cp -r dist/* "$TEMP_DIST/" 2>/dev/null || true

# Check if gh-pages branch exists
if git show-ref --verify --quiet refs/heads/gh-pages; then
    echo "📌 Switching to existing gh-pages branch..."
    git checkout gh-pages
    # Remove tracked files from git index first
    git rm -rf . --quiet 2>/dev/null || true
    # Remove files and directories except .git and ignored directories (node_modules, .vite, dist)
    find . -mindepth 1 -maxdepth 1 ! -name '.git' ! -name 'node_modules' ! -name '.vite' ! -name 'dist' -exec rm -rf {} + 2>/dev/null || true
else
    echo "✨ Creating new gh-pages branch..."
    git checkout --orphan gh-pages
    # Remove files except .git and ignored directories (node_modules, .vite, dist)
    find . -mindepth 1 -maxdepth 1 ! -name '.git' ! -name 'node_modules' ! -name '.vite' ! -name 'dist' -exec rm -rf {} + 2>/dev/null || true
fi

# Copy dist contents from temporary location to root
echo "📁 Copying build files..."
cp -r "$TEMP_DIST"/* . 2>/dev/null || true
# Clean up temporary directory
rm -rf "$TEMP_DIST"

# Explicitly remove any unwanted directories/files if they exist
rm -rf node_modules src dist .vite package.json package-lock.json vite.config.js tailwind.config.js postcss.config.js deploy.sh .gitignore 2>/dev/null || true
git rm -rf node_modules src dist .vite package.json package-lock.json vite.config.js tailwind.config.js postcss.config.js deploy.sh .gitignore 2>/dev/null || true

# Add only the built files (explicitly exclude node_modules, src, etc)
git add -f CNAME index.html assets/ audio/ logos/ cassette.jpeg music.json

# Commit
echo "💾 Committing changes..."
if git diff --cached --quiet; then
    echo "No changes to commit"
else
    git commit -m "Deploy to GitHub Pages - $(date +'%Y-%m-%d %H:%M:%S')"
fi

# Push to gh-pages branch
echo "🚢 Pushing to gh-pages branch..."
git push origin gh-pages --force

# Switch back to original branch
echo "↩️  Switching back to $CURRENT_BRANCH branch..."
git checkout $CURRENT_BRANCH

# Restore node_modules (npm install is idempotent, so safe to run always)
echo "📦 Restoring dependencies..."
npm install

echo "✅ Deployment complete!"
echo ""
echo "📝 Next steps:"
echo "1. Go to your repository on GitHub"
echo "2. Settings → Pages"
echo "3. Source: Deploy from a branch"
echo "4. Branch: gh-pages, Folder: / (root)"
echo "5. Save"
