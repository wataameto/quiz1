#!/bin/bash
# Setup git hooks

echo "Setting up git hooks..."

# Create symlink for pre-commit hook
ln -sf ../../hooks/pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit

# Create symlink for post-commit hook
ln -sf ../../hooks/post-commit .git/hooks/post-commit
chmod +x .git/hooks/post-commit

echo "✅ Git hooks installed successfully"
echo ""
echo "Post-commit hook will automatically:"
echo "  1. Update docs/build-info.json after each commit"
echo "  2. Generate accurate JST timestamp for the commit"
echo ""
echo "Workflow: git add . → git commit -m '...' → git push"
echo "No manual setup needed - it's automatic!"
