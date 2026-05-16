#!/usr/bin/env node

/**
 * Build script: Generate build-info.json with current time in JST
 * Usage: node scripts/update-build-time.js
 *
 * Note: This script is called from pre-commit hook, so we record the current time
 * (which is essentially the commit completion time) in JST format.
 */

const fs = require('fs');
const path = require('path');

try {
  // Get current time in UTC and convert to JST (UTC+9)
  const now = new Date();
  const jstDate = new Date(now.getTime() + (9 * 60 * 60 * 1000));

  const year = jstDate.getUTCFullYear();
  const month = String(jstDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(jstDate.getUTCDate()).padStart(2, '0');
  const hours = String(jstDate.getUTCHours()).padStart(2, '0');
  const minutes = String(jstDate.getUTCMinutes()).padStart(2, '0');
  const seconds = String(jstDate.getUTCSeconds()).padStart(2, '0');

  const commitTimestamp = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

  console.log(`📅 Commit (JST): ${commitTimestamp}`);

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
