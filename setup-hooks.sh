#!/bin/bash
# Setup git hooks

echo "Setting up git hooks..."

# Create symlink for pre-commit hook
ln -sf ../../hooks/pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit

echo "✅ Git hooks installed successfully"
echo ""
echo "Pre-commit hook will automatically:"
echo "  1. Run 'npm run build' before each commit"
echo "  2. Generate docs/build-info.json with JST timestamp"
echo "  3. Include build-info.json in the commit"
echo ""
echo "Workflow: git add . → git commit -m '...' → git push"
echo "No 'npm run build' needed - it's automatic!"
