const fs = require('fs');
const path = require('path');

describe('Main menu HTML', () => {
  const docsDir = path.join(__dirname, '..', 'docs');
  const indexHtml = fs.readFileSync(path.join(docsDir, 'index.html'), 'utf8');
  const bokiHtml = fs.readFileSync(path.join(docsDir, 'boki1', 'index.html'), 'utf8');
  const devopsHtml = fs.readFileSync(path.join(docsDir, 'devops', 'index.html'), 'utf8');
  const config = JSON.parse(fs.readFileSync(path.join(docsDir, 'config.json'), 'utf8'));

  test('should hide login screen until auth state is resolved', () => {
    expect(indexHtml).toContain('id="screen-loading"');
    expect(indexHtml).toContain('id="screen-login" class="login-screen hidden"');
    expect(indexHtml).toContain("document.getElementById('screen-loading').classList.add('hidden')");
  });

  test('should use configured quiz names in menu labels', () => {
    expect(indexHtml).toContain(config.boki1.heading);
    expect(indexHtml).toContain(config.devops.heading);
  });

  test('should show part counts from question metadata', () => {
    expect(indexHtml).toContain('${bokiMeta.parts}パート');
    expect(indexHtml).toContain('${devopsMeta.parts}パート');
    expect(indexHtml).toContain('async function calculateQuizMeta');
  });

  test('should count only current question files for menu scores', () => {
    expect(indexHtml).toContain('data[`best_${level}_${test.id}`]');
    expect(indexHtml).not.toContain("Object.keys(data).filter(k => k.startsWith('best_'))");
  });

  test('should clear current user when auth signs out in quiz pages', () => {
    expect(bokiHtml).toContain('currentUser = user || null;');
    expect(devopsHtml).toContain('currentUser = user || null;');
  });

  test('should avoid updating missing Firestore score documents during reset', () => {
    expect(bokiHtml).toContain('const snapshot = await doc.get();');
    expect(bokiHtml).toContain('if (snapshot.exists)');
    expect(devopsHtml).toContain('const snapshot = await doc.get();');
    expect(devopsHtml).toContain('if (snapshot.exists)');
  });

  test('should include admin question list mode in quiz pages', () => {
    expect(bokiHtml).toContain('screen-admin');
    expect(bokiHtml).toContain("get('admin') === '1'");
    expect(bokiHtml).toContain('function showAdmin()');
    expect(devopsHtml).toContain('screen-admin');
    expect(devopsHtml).toContain("get('admin') === '1'");
    expect(devopsHtml).toContain('function showAdmin()');
  });
});
