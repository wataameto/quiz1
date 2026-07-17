const fs = require('fs');
const path = require('path');

describe('Main menu HTML', () => {
  const docsDir = path.join(__dirname, '..', 'docs');
  const indexHtml = fs.readFileSync(path.join(docsDir, 'index.html'), 'utf8');
  const bokiHtml = fs.readFileSync(path.join(docsDir, 'boki1', 'index.html'), 'utf8');
  const devopsHtml = fs.readFileSync(path.join(docsDir, 'devops', 'index.html'), 'utf8');
  const quizAppJs = fs.readFileSync(path.join(docsDir, 'shared', 'quiz-app.js'), 'utf8');
  const config = JSON.parse(fs.readFileSync(path.join(docsDir, 'config.json'), 'utf8'));

  test('should hide loading screen once auth state is resolved, without gating home behind login', () => {
    expect(indexHtml).toContain('id="screen-loading"');
    expect(indexHtml).toContain("document.getElementById('screen-loading').classList.add('hidden')");
    expect(indexHtml).not.toContain('screen-login');
  });

  test('should prompt for login instead of toggling when signed out', () => {
    expect(indexHtml).toContain("if (!currentUser) {");
    expect(indexHtml).toContain('教材を選択するにはログインしてください');
  });

  test('should use configured quiz names in menu labels', () => {
    expect(indexHtml).toContain(config.boki1.heading);
    expect(indexHtml).toContain(config.devops.heading);
  });

  test('should show part counts from question metadata', () => {
    expect(indexHtml).toContain('${r.meta.parts}パート');
    expect(indexHtml).toContain('async function calculateQuizMeta');
  });

  test('should count only current question files for menu scores', () => {
    expect(indexHtml).toContain('data[`best_${level}_${testId}`]');
    expect(indexHtml).not.toContain("Object.keys(data).filter(k => k.startsWith('best_'))");
  });

  test('should clear current user when auth signs out in quiz pages', () => {
    expect(quizAppJs).toContain('currentUser = user || null;');
  });

  test('should avoid updating missing Firestore score documents during reset', () => {
    expect(quizAppJs).toContain('const snapshot = await doc.get();');
    expect(quizAppJs).toContain('if (snapshot.exists)');
  });

  test('should include admin question list mode in quiz pages', () => {
    expect(bokiHtml).toContain('screen-admin');
    expect(devopsHtml).toContain('screen-admin');
    expect(bokiHtml).toMatch(/src="\.\.\/shared\/quiz-app\.js(\?v=\d+)?"/);
    expect(devopsHtml).toMatch(/src="\.\.\/shared\/quiz-app\.js(\?v=\d+)?"/);
    expect(quizAppJs).toContain("get('admin') === '1'");
    expect(quizAppJs).toContain('function showAdmin()');
  });
});
