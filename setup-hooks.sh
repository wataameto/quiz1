#!/bin/bash
# Setup git hooks

echo "Setting up git hooks..."

# Create symlink for pre-commit hook
ln -sf ../../hooks/pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit

# Remove post-commit symlink if it exists
rm -f .git/hooks/post-commit

echo "✅ Git hooks installed successfully"
echo ""
echo "Pre-commit hook will automatically:"
echo "  1. Update docs/build-info.json before each commit"
echo "  2. Include build-info.json in the commit"
echo "  3. Generate accurate JST timestamp"
echo ""
echo "Workflow: git add . → git commit -m '...' → git push"
echo "No manual setup needed - it's automatic!"
