#!/bin/bash
# Setup git hooks

echo "Setting up git hooks..."

# Create symlink for post-commit hook
ln -sf ../../hooks/post-commit .git/hooks/post-commit
chmod +x .git/hooks/post-commit

echo "✅ Git hooks installed successfully"
echo ""
echo "Post-commit hook will automatically:"
echo "  1. Inject BUILD_TIME with current JST timestamp"
echo "  2. Restore __BUILD_TIME__ placeholders"
echo ""
echo "No manual action needed - just commit normally!"
