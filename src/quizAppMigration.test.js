const fs = require('fs');
const path = require('path');
const vm = require('vm');

// docs/shared/quiz-app.js はブラウザ専用のプレーンスクリプトでrequire()できないため、
// menu.test.jsと同じ手法（ソースから関数定義部分だけを中括弧の対応を数えて切り出し、
// vmで実行する）で、Firestoreのデータ構造移行ロジック（quiz_<id>/{uid}・quiz_menu_prefs/{uid}
// →users/{uid}・users/{uid}/quizzes/{id}）を検証する。
function extractFunctionSource(source, functionName) {
  let startIdx = source.indexOf(`async function ${functionName}(`);
  if (startIdx === -1) startIdx = source.indexOf(`function ${functionName}(`);
  if (startIdx === -1) throw new Error(`${functionName} not found in source`);
  // 引数リストの丸括弧をまず数え終えてから本体の{を探す
  // （例: `params = {}` のようなデフォルト引数の{}を本体の開始と誤認しないため）
  const parenStart = source.indexOf('(', startIdx);
  let parenDepth = 0;
  let i = parenStart;
  for (; i < source.length; i++) {
    if (source[i] === '(') parenDepth++;
    else if (source[i] === ')') {
      parenDepth--;
      if (parenDepth === 0) break;
    }
  }
  const braceStart = source.indexOf('{', i);
  let depth = 0;
  for (let j = braceStart; j < source.length; j++) {
    if (source[j] === '{') depth++;
    else if (source[j] === '}') {
      depth--;
      if (depth === 0) return source.slice(startIdx, j + 1);
    }
  }
  throw new Error(`Could not find end of function ${functionName}`);
}

// パスをキーにした素朴なインメモリFirestore互換モック
// （db.collection(x).doc(y).collection(z).doc(w)のネストと、batch().set()/.commit()に対応）
function createFakeFirestore(initialData) {
  const store = new Map(Object.entries(initialData));

  function docRefFor(refPath) {
    return {
      get: async () => {
        const data = store.get(refPath);
        return { exists: data !== undefined, data: () => data };
      },
      set: async (data, opts) => {
        if (opts && opts.merge) {
          const existing = store.get(refPath) || {};
          store.set(refPath, { ...existing, ...data });
        } else {
          store.set(refPath, { ...data });
        }
      },
      update: async (data) => {
        const existing = store.get(refPath);
        if (existing === undefined) throw new Error('NOT_FOUND: ' + refPath);
        store.set(refPath, { ...existing, ...data });
      },
      delete: async () => { store.delete(refPath); },
      collection: (sub) => collectionRefFor(`${refPath}/${sub}`),
    };
  }
  function collectionRefFor(refPath) {
    return { doc: (id) => docRefFor(`${refPath}/${id}`) };
  }
  const db = {
    collection: (name) => collectionRefFor(name),
    batch: () => {
      const ops = [];
      return {
        set: (ref, data, opts) => { ops.push({ ref, data, opts }); },
        commit: async () => { for (const op of ops) await op.ref.set(op.data, op.opts); },
      };
    },
  };
  return { db, store };
}

describe('Firestore per-quiz → per-user structure migration', () => {
  const quizAppJs = fs.readFileSync(
    path.join(__dirname, '..', 'docs', 'shared', 'quiz-app.js'),
    'utf8'
  );
  const migrateSrc = extractFunctionSource(quizAppJs, 'migrateUserDataIfNeeded');
  const userDataActionSrc = extractFunctionSource(quizAppJs, 'userDataAction');

  function buildSandbox(initialData) {
    const { db, store } = createFakeFirestore(initialData);
    const sandbox = {
      db,
      currentUser: { uid: 'uid1' },
      quizId: null,
      DOCS_ROOT: '/docs/',
      migrationPromise: null,
      fetch: async (url) => {
        expect(url).toBe('/docs/config.json');
        return { json: async () => ({ sample: { title: 'サンプル' }, devops: { title: 'DevOps' } }) };
      },
      firebase: { firestore: { FieldValue: { serverTimestamp: () => ({ __serverTimestamp: true }) } } },
      console,
    };
    vm.createContext(sandbox);
    vm.runInContext(migrateSrc, sandbox);
    vm.runInContext(
      'function ensureMigrated() { if (!migrationPromise) migrationPromise = migrateUserDataIfNeeded(); return migrationPromise; }',
      sandbox
    );
    vm.runInContext(userDataActionSrc, sandbox);
    return { sandbox, store };
  }

  test('copies old quiz_menu_prefs and quiz_<id> docs into users/{uid} and users/{uid}/quizzes/{id}', async () => {
    const { sandbox, store } = buildSandbox({
      'quiz_menu_prefs/uid1': { displayName: 'Old Name', email: 'old@x.com', visible: { sample: true }, pinned: { sample: false } },
      'quiz_sample/uid1': { lesson_1_1: 100, lap: 2 },
      // quiz_devops/uid1 does not exist — should simply be skipped, not error
    });

    await sandbox.migrateUserDataIfNeeded();

    const userDoc = store.get('users/uid1');
    expect(userDoc.displayName).toBe('Old Name');
    expect(userDoc.visible).toEqual({ sample: true });
    expect(userDoc.pinned).toEqual({ sample: false });
    expect(userDoc.migratedAt).toEqual({ __serverTimestamp: true });

    expect(store.get('users/uid1/quizzes/sample')).toEqual({ lesson_1_1: 100, lap: 2 });
    expect(store.get('users/uid1/quizzes/devops')).toBeUndefined();
  });

  test('is a no-op (does not touch old collections again) once migratedAt is already set', async () => {
    const { sandbox, store } = buildSandbox({
      'users/uid1': { migratedAt: { __serverTimestamp: true }, visible: { sample: true } },
      // old collections deliberately absent/stale here — if migration re-ran and tried
      // to read them the same way, it would just find nothing; the real assertion is
      // that the existing users/uid1 doc is left untouched (not overwritten to {}).
    });

    await sandbox.migrateUserDataIfNeeded();

    expect(store.get('users/uid1')).toEqual({ migratedAt: { __serverTimestamp: true }, visible: { sample: true } });
  });

  test('userDataAction("getMenuPrefs") reads visible/pinned from the new users/{uid} location after migration', async () => {
    const { sandbox } = buildSandbox({
      'quiz_menu_prefs/uid1': { visible: { sample: true, devops: true }, pinned: {} },
    });

    const result = await sandbox.userDataAction('getMenuPrefs');
    expect(result.visible).toEqual({ sample: true, devops: true });
  });

  test('userDataAction with quizId=null (main menu context) does not throw building docRef', async () => {
    const { sandbox } = buildSandbox({});
    sandbox.quizId = null; // メインメニューはquizIdを持たない
    // 新規ユーザーなので移行処理がusers/uid1にmigratedAtだけ書き込む。
    // ここで検証したいのは「quizId=nullでも例外を投げずに完了する」ことそのもの。
    await expect(sandbox.userDataAction('getMenuPrefs')).resolves.toEqual({
      migratedAt: { __serverTimestamp: true },
    });
  });
});
