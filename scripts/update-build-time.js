#!/usr/bin/env node

/**
 * Build script: Update BUILD_TIME placeholder with last commit timestamp
 * Usage: node scripts/update-build-time.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

try {
  // Get last commit timestamp in JST format (YYYY-MM-DD HH:MM:SS)
  const commitTimestamp = execSync('git log -1 --format=%ci | head -c 19', {
    encoding: 'utf-8',
  }).trim();

  if (!commitTimestamp) {
    console.error('❌ Failed to get commit timestamp');
    process.exit(1);
  }

  console.log(`📅 Last commit: ${commitTimestamp}`);

  // HTML files to update
  const htmlFiles = [
    'docs/index.html',
    'docs/boki1/index.html',
    'docs/devops/index.html',
  ];

  let updatedCount = 0;
  htmlFiles.forEach((file) => {
    const filePath = path.join(__dirname, '..', file);
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️  File not found: ${filePath}`);
      return;
    }

    let content = fs.readFileSync(filePath, 'utf-8');
    const originalContent = content;
    content = content.replace(
      /__BUILD_TIME__/g,
      commitTimestamp
    );

    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf-8');
      console.log(`✅ Updated: ${file}`);
      updatedCount++;
    } else {
      console.log(`⏭️  No changes needed: ${file}`);
    }
  });

  console.log(`\n✨ Build time updated successfully (${updatedCount} files)`);
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
