const fs = require('fs');
const path = require('path');
const vm = require('vm');

// docs/index.html はブラウザ専用のプレーンスクリプトでrequire()できないため、
// ソースから関数定義部分だけを中括弧の対応を数えて切り出し、vmで実行してテストする
// （src/配下に手動で同じロジックのコピーを置くと、今回のバグ（best_/lesson_の食い違い）
// のように実装と乖離して気付けなくなるため、実物のソースをそのまま実行する）。
function extractFunctionSource(source, functionName) {
  let startIdx = source.indexOf(`async function ${functionName}(`);
  if (startIdx === -1) startIdx = source.indexOf(`function ${functionName}(`);
  if (startIdx === -1) throw new Error(`${functionName} not found in source`);
  const braceStart = source.indexOf('{', startIdx);
  let depth = 0;
  for (let i = braceStart; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) return source.slice(startIdx, i + 1);
    }
  }
  throw new Error(`Could not find end of function ${functionName}`);
}

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
    expect(indexHtml).toContain('data[`lesson_${level}_${testId}`]');
    expect(indexHtml).not.toContain("Object.keys(data).filter(k => k.startsWith('lesson_'))");
  });

  test('getQuizScore should compute a nonzero correct count from real lesson_ score data (regression test for the best_/lesson_ field-name bug)', async () => {
    const fnSource = extractFunctionSource(indexHtml, 'getQuizScore');
    const sandbox = {
      currentUser: { uid: 'test-uid' },
      calculateQuizMeta: async () => ({
        total: 8,
        setCounts: { 1: { 1: 2, 2: 2 }, 2: { 1: 2, 2: 2 } },
      }),
      userDataAction: async () => ({ lesson_1_1: 100, lesson_1_2: 50, lap: 1 }),
      console,
    };
    vm.createContext(sandbox);
    vm.runInContext(fnSource, sandbox);
    const result = await sandbox.getQuizScore('sample', './sample/');
    // lesson_1_1: 100点 → 2/2問、lesson_1_2: 50点 → 1/2問（四捨五入）、level2は未挑戦
    expect(result).toEqual({ correct: 3, total: 8, lap: 1 });
  });

  test('getQuizScore should return 0 correct when the score doc has no matching lesson_ fields', async () => {
    const fnSource = extractFunctionSource(indexHtml, 'getQuizScore');
    const sandbox = {
      currentUser: { uid: 'test-uid' },
      calculateQuizMeta: async () => ({
        total: 8,
        setCounts: { 1: { 1: 2, 2: 2 }, 2: { 1: 2, 2: 2 } },
      }),
      userDataAction: async () => ({ best_1_1: 100 }), // 古いフィールド名しか無いケース
      console,
    };
    vm.createContext(sandbox);
    vm.runInContext(fnSource, sandbox);
    const result = await sandbox.getQuizScore('sample', './sample/');
    expect(result.correct).toBe(0);
  });

  test('should clear current user when auth signs out in quiz pages', () => {
    expect(quizAppJs).toContain('currentUser = user || null;');
  });

  test('should avoid updating missing Firestore score documents during reset', () => {
    expect(quizAppJs).toContain('const snapshot = await docRef.get();');
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
