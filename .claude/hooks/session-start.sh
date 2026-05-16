#!/bin/bash
set -euo pipefail

# Setup for this session:
# 1. Install dependencies (npm packages)
# 2. Setup git hooks (pre-commit hook for build-info.json)

echo '{"async": false}'

# Install npm dependencies if needed
if [ ! -d "node_modules" ]; then
  npm install
fi

# Setup git hooks for this session
# (important for remote environments where .git is not persisted)
bash setup-hooks.sh
