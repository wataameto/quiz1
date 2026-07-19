const fs = require('fs');
const path = require('path');

describe('Main menu HTML', () => {
  const docsDir = path.join(__dirname, '..', 'docs');
  const indexHtml = fs.readFileSync(path.join(docsDir, 'index.html'), 'utf8');
  const bokiHtml = fs.readFileSync(path.join(docsDir, 'bokinyu', 'index.html'), 'utf8');
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

  test('should build the quiz list from config.json instead of duplicating it in index.html', () => {
    // 教材一覧はconfig.jsonのキーから動的に組み立てる（QUIZZES配列のような
    // 別の静的一覧をindex.html側に持たせない、二重管理を避ける設計）
    expect(indexHtml).toContain('Object.keys(menuConfig)');
    expect(indexHtml).toContain('cfg.heading');
    expect(indexHtml).not.toContain(`path: './${Object.keys(config)[0]}/'`);
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

  test('every config.json entry has a valid genreMajor/genreMinor for menu grouping', () => {
    // メインメニューのジャンル別グループ表示（docs/index.htmlのGENRE_ORDER）と対になる集合。
    // 新しい教材を追加したときに分類を書き忘れると失敗する（quiz_undefined事故の再発防止と同じ考え方）。
    const KNOWN_MAJORS = ['sample', 'shikaku', 'gakkou', 'zatsugaku'];
    const KNOWN_MINORS = ['it_shikaku', 'kaikei_kinyu_shikaku', 'language_shikaku', 'houritsu_sonota_shikaku'];

    Object.entries(config).forEach(([id, cfg]) => {
      expect(KNOWN_MAJORS).toContain(cfg.genreMajor);
      if (cfg.genreMajor === 'shikaku') {
        expect(KNOWN_MINORS).toContain(cfg.genreMinor);
      } else {
        expect(cfg.genreMinor).toBeNull();
      }
    });
  });
});
