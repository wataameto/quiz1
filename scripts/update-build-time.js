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

  // Bump the ?v= cache-busting query on the shared quiz-app.js/css tags in
  // every quiz's index.html, so browsers don't keep serving a stale cached
  // copy of shared/ across deploys (data fetches already cache-bust per
  // request, but these <script>/<link> tags don't reload on their own).
  const version = `${year}${month}${day}${hours}${minutes}${seconds}`;
  const docsDir = path.join(__dirname, '..', 'docs');
  const quizDirs = fs.readdirSync(docsDir)
    .filter(name => name !== 'shared')
    .filter(name => fs.statSync(path.join(docsDir, name)).isDirectory());

  quizDirs.forEach(quiz => {
    const htmlPath = path.join(docsDir, quiz, 'index.html');
    if (!fs.existsSync(htmlPath)) return;
    let html = fs.readFileSync(htmlPath, 'utf-8');
    html = html.replace(
      /(href="\.\.\/shared\/quiz-app\.css)(\?v=[^"]*)?"/,
      `$1?v=${version}"`
    );
    html = html.replace(
      /(src="\.\.\/shared\/quiz-app\.js)(\?v=[^"]*)?"/,
      `$1?v=${version}"`
    );
    fs.writeFileSync(htmlPath, html, 'utf-8');
  });
  console.log(`✅ Bumped shared asset cache-busting version (${version}) in ${quizDirs.length} quiz pages`);

  // docs/index.html（メインメニュー）もshared/quiz-app.jsを読み込むため、同じくバージョンを更新する。
  const menuHtmlPath = path.join(docsDir, 'index.html');
  if (fs.existsSync(menuHtmlPath)) {
    let menuHtml = fs.readFileSync(menuHtmlPath, 'utf-8');
    menuHtml = menuHtml.replace(
      /(src="shared\/quiz-app\.js)(\?v=[^"]*)?"/,
      `$1?v=${version}"`
    );
    fs.writeFileSync(menuHtmlPath, menuHtml, 'utf-8');
    console.log(`✅ Bumped shared asset cache-busting version (${version}) in docs/index.html`);
  }

  // Generate docs/quiz-meta.json: per-quiz part/set/question counts so the
  // main menu can render totals and compute scores without downloading every
  // questions*.json on each load.
  const quizMeta = {};
  quizDirs.forEach(quiz => {
    const setCounts = {};
    let total = 0, parts = 0, sets = 0, level = 1;
    while (true) {
      const qPath = path.join(docsDir, quiz, `questions${level}.json`);
      if (!fs.existsSync(qPath)) break;
      let data;
      try { data = JSON.parse(fs.readFileSync(qPath, 'utf-8')); } catch (e) { break; }
      if (!data || !Array.isArray(data.tests)) break;
      parts++;
      sets += data.tests.length;
      setCounts[level] = {};
      data.tests.forEach(test => {
        const qCount = Array.isArray(test.questions) ? test.questions.length : 0;
        setCounts[level][test.id] = qCount;
        total += qCount;
      });
      level++;
    }
    if (parts > 0) quizMeta[quiz] = { parts, sets, total, setCounts };
  });
  fs.writeFileSync(path.join(docsDir, 'quiz-meta.json'), JSON.stringify(quizMeta, null, 2), 'utf-8');
  console.log(`✅ Generated docs/quiz-meta.json (${Object.keys(quizMeta).length} quizzes)`);

  console.log(`\n✨ Build info updated successfully`);
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
