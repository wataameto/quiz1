#!/usr/bin/env node

/**
 * Build script: Generate build-info.json with last commit timestamp
 * Usage: node scripts/update-build-time.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

try {
  // Get last commit timestamp in JST format (YYYY-MM-DD HH:MM:SS +0900)
  const fullTimestamp = execSync('TZ=Asia/Tokyo git log -1 --format=%ci', {
    encoding: 'utf-8',
  }).trim();
  // Extract just the date and time (first 19 chars) for display
  const commitTimestamp = fullTimestamp.substring(0, 19);

  if (!commitTimestamp) {
    console.error('❌ Failed to get commit timestamp');
    process.exit(1);
  }

  console.log(`📅 Last commit: ${commitTimestamp}`);

  // Create build info object
  const buildInfo = {
    buildTime: commitTimestamp,
    timezone: 'Asia/Tokyo (JST = UTC+9)',
  };

  // Write to docs/build-info.json
  const buildInfoPath = path.join(__dirname, '..', 'docs', 'build-info.json');
  fs.writeFileSync(buildInfoPath, JSON.stringify(buildInfo, null, 2), 'utf-8');
  console.log(`✅ Updated: docs/build-info.json`);

  console.log(`\n✨ Build info updated successfully`);
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
