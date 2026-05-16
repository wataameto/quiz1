#!/usr/bin/env node

/**
 * Build script: Generate build-info.json with last commit timestamp in JST
 * Usage: node scripts/update-build-time.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

try {
  // Get last commit timestamp as Unix timestamp
  const unixTimestamp = parseInt(execSync('git log -1 --format=%at', {
    encoding: 'utf-8',
  }).trim(), 10);

  if (!unixTimestamp) {
    console.error('❌ Failed to get commit timestamp');
    process.exit(1);
  }

  // Convert to JST (UTC+9)
  const date = new Date(unixTimestamp * 1000);
  const jstDate = new Date(date.getTime() + 9 * 60 * 60 * 1000);

  const year = jstDate.getUTCFullYear();
  const month = String(jstDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(jstDate.getUTCDate()).padStart(2, '0');
  const hours = String(jstDate.getUTCHours()).padStart(2, '0');
  const minutes = String(jstDate.getUTCMinutes()).padStart(2, '0');
  const seconds = String(jstDate.getUTCSeconds()).padStart(2, '0');

  const commitTimestamp = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

  console.log(`📅 Last commit (JST): ${commitTimestamp}`);

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
