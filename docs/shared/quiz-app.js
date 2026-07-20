// ============================================================
// 🔥 Firebase 初期化
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyASXTkFt2cm-lG5zrPL0uygNMpY6u_OWwY",
  authDomain: "boki1-b66ad.firebaseapp.com",
  projectId: "boki1-b66ad",
  storageBucket: "boki1-b66ad.firebasestorage.app",
  messagingSenderId: "416766529196",
  appId: "1:416766529196:web:9a451e15d3e1c4057c9909",
  measurementId: "G-HQKC6V6J1F"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// docs/直下への絶対URL。ページによって相対パス（'./'か'../'か）が変わる問題を避けるため、
// document.currentScriptは同期実行中しか取れないのでここで即キャプチャする。
const DOCS_ROOT = document.currentScript ? new URL('../', document.currentScript.src).href : './';

let currentUser = null;
let bestScores = {};
let cacheInitialized = false;

// ===== 表示サイズ設定（PC・スマホそれぞれ独立してlocalStorageで保持、常に両方設定可能） =====
const FONT_SIZE_KEY_LEGACY = 'quizFontSize'; // PC/スマホ分離前の単一キー（移行用）
const FONT_SIZE_KEYS = { pc: 'quizFontSizePC', mobile: 'quizFontSizeMobile' };
const FONT_SIZE_MIN = 70;
const FONT_SIZE_MAX = { pc: 200, mobile: 120 };
const FONT_SIZE_DEFAULTS = { pc: 130, mobile: 90 };
const FONT_SIZE_LEGACY_MAP = { xxs: 70, xs: 80, s: 90, m: 100, l: 115, small: 90, medium: 100, large: 115, xl: 115 }; // 旧段階からの移行

function isMobileFontSizeView() {
  return window.matchMedia('(max-width: 520px)').matches;
}

function clampFontSize(size, device) {
  size = Math.round(Number(size) / 5) * 5;
  if (isNaN(size)) size = FONT_SIZE_DEFAULTS[device];
  return Math.min(FONT_SIZE_MAX[device], Math.max(FONT_SIZE_MIN, size));
}

function getFontSizeFor(device) {
  const stored = localStorage.getItem(FONT_SIZE_KEYS[device]);
  let size;
  if (stored !== null && stored !== '' && !isNaN(Number(stored))) {
    size = Number(stored);
  } else {
    const legacyStored = localStorage.getItem(FONT_SIZE_KEY_LEGACY);
    if (legacyStored !== null && FONT_SIZE_LEGACY_MAP[legacyStored] !== undefined) {
      size = FONT_SIZE_LEGACY_MAP[legacyStored];
    } else if (legacyStored !== null && !isNaN(Number(legacyStored))) {
      size = Number(legacyStored);
    } else {
      size = FONT_SIZE_DEFAULTS[device];
    }
  }
  return clampFontSize(size, device);
}

function applyFontSizePref() {
  const activeDevice = isMobileFontSizeView() ? 'mobile' : 'pc';
  document.documentElement.style.fontSize = getFontSizeFor(activeDevice) + '%';

  ['pc', 'mobile'].forEach(device => {
    const size = getFontSizeFor(device);
    const slider = document.getElementById(`font-size-slider-${device}`);
    if (slider) slider.value = size;
    const label = document.getElementById(`font-size-value-${device}`);
    if (label) label.textContent = size + '%';
  });
}

function setFontSize(device, size) {
  size = clampFontSize(size, device);
  localStorage.setItem(FONT_SIZE_KEYS[device], String(size));
  applyFontSizePref();
  soundClick();
}

function resetFontSizeToDefault(device) {
  setFontSize(device, FONT_SIZE_DEFAULTS[device]);
}

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(applyFontSizePref, 100);
});

applyFontSizePref();

auth.onAuthStateChanged(user => {
  currentUser = user || null;
  cacheInitialized = false;
  bestScores = {};
  // ページをリロードせずに別アカウントへログインし直すと、前のユーザーで
  // 解決済みのmigrationPromiseが残ったままになり、新しいユーザーの移行チェックが
  // 走らなくなってしまう。認証状態が変わるたびにリセットし、次回userDataAction呼び出し時に
  // 今ログインしているユーザーで改めて判定させる。
  migrationPromise = null;
  renderAuthStatus();
  if (currentUser) syncUserProfile();
  // メインメニュー（docs/index.html）もこのファイルを読み込むため、教材ページ特有の
  // 初期化（問題データの読み込み）は教材ページにしかないDOM（#screen-quiz）の有無で判定する。
  if (document.getElementById('screen-quiz')) {
    // 認証状態に関わらず初期化を実行
    loadAllQuestions();
  }
});

// ログインの度に表示名・メールをquiz_menu_prefsへ書いておく（管理者ダッシュボードが
// uidから人間が読める名前を引けるようにするため）。書き込み権限は本人のuidのドキュメント
// のみなので、既存のFirestoreルールのままで問題ない。
//
// 先に.get()でこのドキュメントの最新状態（visible/pinnedフィールドなど）をクライアントの
// キャッシュに読み込んでから.set(...,{merge:true})する。これをせずにいきなりmerge書き込み
// すると、このドキュメントを一度も読んだことが無いクライアントでは、Firestoreがこの保留中の
// 書き込みを「このドキュメントにはdisplayName/email/lastSeenしか無い」とみなしてしまい、
// ほぼ同時に走るloadVisiblePrefs()等の読み込みがvisible/pinnedフィールドを見失う
// （実際に発生した不具合: メインメニューの「あなたの選択教材」が常に空になっていた）。
async function syncUserProfile() {
  if (!currentUser) return;
  try {
    await ensureMigrated();
    const userRef = db.collection('users').doc(currentUser.uid);
    await userRef.get();
    await userRef.set({
      displayName: currentUser.displayName || null,
      email: currentUser.email || null,
      lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  } catch (e) { console.error('Failed to sync user profile:', e); }
}

// Firebase の signInWithPopup/signInWithRedirect は iPhone Chrome (CriOS)
// で機能しない（redirect は firebaseapp.com への別ドメインiframeに依存
// しており、Chrome M115+等のサードパーティストレージ制限でブロックされる）。
// 代わりに Google Identity Services (GIS) の OAuth トークンクライアントを
// 直接呼び出し、取得したアクセストークンを Firebase の認証情報に変換する。
// GIS はGoogle自身が管理するポップアップ機構のため、iPhone Chromeでも動作する。
const GOOGLE_CLIENT_ID = '416766529196-d28cbbfr864eaahh8o9s5h3mopsa2dpo.apps.googleusercontent.com';
let gisTokenClient = null;

function getGISTokenClient() {
  if (gisTokenClient) return gisTokenClient;
  if (!window.google || !window.google.accounts || !window.google.accounts.oauth2) return null;
  gisTokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: 'openid email profile',
    callback: (tokenResponse) => {
      if (tokenResponse.error) {
        console.error('Google sign-in error:', tokenResponse);
        alert('ログインに失敗しました: ' + tokenResponse.error);
        return;
      }
      const credential = firebase.auth.GoogleAuthProvider.credential(null, tokenResponse.access_token);
      auth.signInWithCredential(credential).catch(e => {
        console.error('Firebase sign-in error:', e);
        alert('ログインに失敗しました: ' + e.message);
      });
    },
  });
  return gisTokenClient;
}

function loginWithGoogle() {
  const client = getGISTokenClient();
  if (!client) {
    alert('Googleログインの読み込みに失敗しました。しばらくしてから再度お試しください。');
    return;
  }
  client.requestAccessToken();
}

function logout() {
  const modal = document.getElementById('logout-modal');
  if (modal) modal.style.display = 'flex';
}

function closeLogoutModal() {
  const modal = document.getElementById('logout-modal');
  if (modal) modal.style.display = 'none';
}

function confirmLogout() {
  closeLogoutModal();
  auth.signOut().catch(e => console.error('Logout error:', e));
}

function renderAuthStatus() {
  const el = document.getElementById('auth-status');
  if (!el) return;
  if (currentUser) {
    const name = currentUser.displayName || 'ユーザー';
    const initial = name.trim().charAt(0).toUpperCase();
    el.innerHTML = `<span class="user-chip"><span class="user-avatar" id="auth-status-avatar"></span><span class="user-name" id="auth-status-name"></span><button class="btn-logout-inline" onclick="logout()">ログアウト</button></span>`;
    document.getElementById('auth-status-avatar').textContent = initial;
    document.getElementById('auth-status-name').textContent = name;
  } else {
    el.innerHTML = `<button class="btn-login-inline" onclick="loginWithGoogle()">🔐 ログイン</button>`;
  }
}

// ============================================================
// 🔊 サウンド（Web Audio API）
// ============================================================

const AC = window.AudioContext || window.webkitAudioContext;
let ac = null;
function getAC() { if (!ac) ac = new AC(); if (ac.state === 'suspended') ac.resume(); return ac; }
function tone(freq, type, start, dur, vol = 0.25) {
  try {
    const a = getAC(), osc = a.createOscillator(), gain = a.createGain();
    osc.connect(gain); gain.connect(a.destination);
    osc.type = type; osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, a.currentTime + start);
    gain.gain.exponentialRampToValueAtTime(0.001, a.currentTime + start + dur);
    osc.start(a.currentTime + start); osc.stop(a.currentTime + start + dur);
  } catch(e) {}
}
function soundCorrect() { tone(660,'sine',0,0.12,0.25); tone(880,'sine',0.08,0.15,0.25); tone(1100,'sine',0.18,0.18,0.20); }
function soundWrong()   { tone(330,'sawtooth',0,0.10,0.20); tone(220,'sawtooth',0.08,0.18,0.15); }
function soundClick()   { tone(1000,'sine',0,0.05,0.10); }
function soundFanfare() { [[523,0],[659,0.15],[784,0.30],[1047,0.45],[1047,0.60],[784,0.70],[1047,0.82]].forEach(([f,t]) => tone(f,'sine',t,0.18,0.28)); }
function soundGood()    { tone(784,'sine',0,0.15,0.25); tone(1047,'sine',0.14,0.20,0.25); }
function soundShine()   { tone(1319,'sine',0,0.65,0.18); tone(1976,'sine',0.06,0.60,0.15); tone(2637,'sine',0.12,0.55,0.12); tone(3520,'sine',0.18,0.50,0.09); tone(4699,'sine',0.24,0.45,0.06); }

function launchSparkles(x, y, count = 28) {
  const wrap = document.getElementById('confetti-wrap');
  if (!wrap) return;
  wrap.setAttribute('aria-hidden', 'true');

  const flash = document.createElement('div');
  flash.className = 'sparkle-flash';
  flash.setAttribute('aria-hidden', 'true');
  flash.style.left = x + 'px';
  flash.style.top = y + 'px';
  wrap.appendChild(flash);
  flash.addEventListener('animationend', () => flash.remove());

  const glyphs = ['✨', '⭐', '🌟'];
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'sparkle-piece';
    el.setAttribute('aria-hidden', 'true');
    el.textContent = glyphs[Math.floor(Math.random() * glyphs.length)];
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    const angle = Math.random() * Math.PI * 2;
    const dist = 70 + Math.random() * 110;
    el.style.setProperty('--sx', Math.cos(angle) * dist + 'px');
    el.style.setProperty('--sy', Math.sin(angle) * dist + 'px');
    el.style.fontSize = (18 + Math.random() * 22) + 'px';
    el.style.animationDuration = (0.6 + Math.random() * 0.5) + 's';
    el.style.animationDelay = (Math.random() * 0.12) + 's';
    wrap.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }
}

function playFullClearSparkle(event) {
  soundShine();
  const rect = event.currentTarget.getBoundingClientRect();
  launchSparkles(rect.left + rect.width / 2, rect.top + rect.height / 2);
}

function launchConfetti(count = 60) {
  const wrap = document.getElementById('confetti-wrap');
  if (wrap) {
    wrap.setAttribute('aria-hidden', 'true');
    wrap.innerHTML = '';
  }
  const colors = ['#f7971e','#ffd200','#21d4fd','#b721ff','#0f2027','#38a169','#f5576c'];
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'confetti-piece';
    el.setAttribute('aria-hidden', 'true');
    el.style.left = Math.random() * 100 + 'vw';
    el.style.background = colors[Math.floor(Math.random() * colors.length)];
    el.style.animationDuration = (1.5 + Math.random() * 2) + 's';
    el.style.animationDelay = (Math.random() * 0.8) + 's';
    el.style.width = el.style.height = (6 + Math.random() * 8) + 'px';
    el.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
    if (wrap) wrap.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }
}

// Test 1: SDLC Automation
let TESTS = [];
let quizId = null;
let quizData = {}; // 全レベルのデータをキャッシュ
let currentLevel = 1;
let maxLevel = 1;
const isAdminMode = new URLSearchParams(location.search).get('admin') === '1';

const QUIZ_LOAD_TIMEOUT_MS = 10000;

function showQuizLoadFailure() {
  const testGrid = document.getElementById('test-grid');
  if (!testGrid) return;
  testGrid.innerHTML = `
    <div class="loading-failed">
      <p class="loading-failed-text">読み込みに時間がかかりすぎています。<br>通信状況をご確認のうえ、もう一度お試しください。</p>
      <button type="button" class="btn-reload-inline loading-failed-btn" onclick="location.reload()">
        <span class="reload-icon">🔄</span> 最新に更新
      </button>
    </div>`;
}

async function loadAllQuestions() {
  // 通信がハングして「読み込み中」のまま何も表示されない状態を避けるため、
  // 一定時間で失敗表示（更新ボタンのみ）に切り替える。
  let quizLoadTimedOut = false;
  const quizLoadTimeoutId = setTimeout(() => {
    quizLoadTimedOut = true;
    showQuizLoadFailure();
  }, QUIZ_LOAD_TIMEOUT_MS);

  try {
    const tQuery = '?t=' + Date.now();
    // config.json と questions1.json, ../quiz-meta.json を並行して fetch する
    const configPromise = fetch('../config.json' + tQuery).then(r => r.json());
    const q1Promise = fetch('questions1.json' + tQuery).then(async r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    });
    const metaPromise = fetch('../quiz-meta.json' + tQuery).then(r => r.ok ? r.json() : null).catch(() => null);

    const [configData, q1Data, metaData] = await Promise.all([configPromise, q1Promise, metaPromise]);

    if (!q1Data || !q1Data.tests || !Array.isArray(q1Data.tests)) {
      throw new Error('Invalid data at level 1');
    }

    quizData[1] = q1Data;
    maxLevel = 1;
    quizId = q1Data.id;

    // config から title, colors などを動的に設定
    if (quizId && configData[quizId]) {
      const cfg = configData[quizId];
      document.title = cfg.title;
      document.body.style.background = cfg.bgGradient;
      document.getElementById('quiz-heading').textContent = cfg.heading;
      document.getElementById('quiz-description').textContent = cfg.description;

      // 動的CSSを注入
      const dynamicStyle = document.getElementById('dynamic-colors');
      dynamicStyle.textContent = `
        .container::before { background: ${cfg.topGradient}; }
        .level-btn.active { border-color: ${cfg.accentColor}; background: ${cfg.accentActive}; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .progress-bar-fill { background: ${cfg.topGradient}; }
        .quiz-back { background: ${cfg.accentColor}; color: #fff; box-shadow: 0 4px 12px rgba(0,0,0,0.16); }
        .quiz-back:hover { filter: brightness(0.92); }
        .next-btn { background: ${cfg.topGradient}; color: #2d3748; }
      `;

      // メインメニューボタンの色を更新
      const menuBtn = document.querySelector('a[href="../"]');
      if (menuBtn) {
        menuBtn.style.color = cfg.accentColor;
        menuBtn.style.borderColor = cfg.accentColor;
        menuBtn.onmouseover = function() { this.style.background = cfg.accentActive; };
        menuBtn.onmouseout = function() { this.style.background = 'transparent'; };
      }
    }

    // パート数を特定する（metaDataから、またはフォールバック）
    let expectedParts = 0;
    if (metaData && metaData[quizId] && typeof metaData[quizId].parts === 'number') {
      expectedParts = metaData[quizId].parts;
    }

    if (expectedParts > 1) {
      // 判明しているパーツを一括並列フェッチ
      const fetchPromises = [];
      for (let level = 2; level <= expectedParts; level++) {
        fetchPromises.push(
          fetch(`questions${level}.json` + tQuery)
            .then(async r => {
              if (!r.ok) throw new Error(`HTTP ${r.status}`);
              const data = await r.json();
              if (!data || !data.tests || !Array.isArray(data.tests)) {
                throw new Error(`Invalid data at level ${level}`);
              }
              return { level, data };
            })
        );
      }
      
      const settledLevels = await Promise.allSettled(fetchPromises);
      settledLevels.forEach(result => {
        if (result.status !== 'fulfilled') {
          console.error('Failed to load a quiz part:', result.reason);
          return;
        }
        const { level, data } = result.value;
        quizData[level] = data;
        if (level > maxLevel) maxLevel = level;
      });
    } else {
      // フォールバック: メタデータがない場合などは直列フェッチで検出
      for (let level = 2; ; level++) {
        let res;
        try {
          res = await fetch(`questions${level}.json` + tQuery);
        } catch (e) {
          break; // 次のレベルが存在しない
        }
        if (!res.ok) break; // 次のレベルが存在しない

        const data = await res.json();
        if (!data || !data.tests || !Array.isArray(data.tests)) {
          throw new Error(`Invalid data at level ${level}`);
        }
        quizData[level] = data;
        maxLevel = level;
      }
    }

    clearTimeout(quizLoadTimeoutId);
    if (quizLoadTimedOut) return; // 失敗表示済みなら、そのまま更新ボタンでのやり直しに任せる

    currentLevel = 1;
    if (isAdminMode) {
      showAdmin();
    } else {
      loadQuestions(1);
    }
  } catch (e) {
    clearTimeout(quizLoadTimeoutId);
    console.error('Failed to load questions:', e);
    if (quizLoadTimedOut) return; // 失敗表示済みなら、そのまま更新ボタンでのやり直しに任せる
    TESTS = [];
    document.getElementById('screen-home').classList.remove('hidden');
    document.getElementById('screen-quiz').classList.add('hidden');
    document.getElementById('screen-results').classList.add('hidden');
    document.getElementById('screen-admin').classList.add('hidden');

    const testGrid = document.getElementById('test-grid');
    if (testGrid) {
      testGrid.innerHTML = '';
      const errorP = document.createElement('p');
      errorP.style.cssText = 'color:#e53e3e;padding:15px;text-align:center;';
      errorP.textContent = '問題ファイルの読み込みに失敗: ' + e.message;
      testGrid.appendChild(errorP);
    }
  }
}

async function loadQuestions(level = 1) {
  try {
    if (!quizData[level]) throw new Error(`Level ${level} data not found`);
    const data = quizData[level];
    TESTS = data.tests;
    showHome();
  } catch (e) {
    console.error('Failed to load questions:', e);
    TESTS = [];
    const testGrid = document.getElementById('test-grid');
    if (testGrid) {
      testGrid.innerHTML = '';
      const errorP = document.createElement('p');
      errorP.style.cssText = 'color:#e53e3e;padding:15px;text-align:center;';
      errorP.textContent = '問題の読み込みに失敗しました';
      testGrid.appendChild(errorP);
    }
  }
}

function getPartLabel(levelData, level) {
  return levelData.label || `Part${level}`;
}

function showAdmin() {
  document.getElementById('screen-home').classList.add('hidden');
  document.getElementById('screen-quiz').classList.add('hidden');
  document.getElementById('screen-results').classList.add('hidden');
  document.getElementById('screen-admin').classList.remove('hidden');

  const title = document.getElementById('quiz-heading').textContent || 'クイズ';
  document.getElementById('admin-title').textContent = `${title} 問題一覧`;
  document.getElementById('admin-subtitle').textContent = `${maxLevel}パートの問題・選択肢・正解・解説を表示中`;

  const lines = [];
  for (let level = 1; level <= maxLevel; level++) {
    const levelData = quizData[level];
    if (!levelData || !Array.isArray(levelData.tests)) continue;
    const partLabel = getPartLabel(levelData, level);
    lines.push(`## ${partLabel}`);

    for (const test of levelData.tests) {
      const countLabel = Array.isArray(test.questions) ? `${test.questions.length}問` : '0問';
      lines.push('');
      lines.push(`### ${test.title} / ${countLabel}`);

      test.questions.forEach((question, qIndex) => {
        lines.push('');
        lines.push(`Q${qIndex + 1}. ${question.scenario}`);
        if (isTextQuestion(question)) {
          lines.push(`* 正解: ${question.correctText}`);
          if (question.acceptedAnswers && question.acceptedAnswers.length > 0) {
            lines.push(`  許容: ${question.acceptedAnswers.join(', ')}`);
          }
        } else {
          question.choices.forEach((choice, choiceIndex) => {
            const isCorrect = choiceIndex === question.correct;
            const label = String.fromCharCode(65 + choiceIndex);
            const choiceText = isJournalQuestion(question) ? journalText(choice) : choice;
            lines.push(`${isCorrect ? '*' : ' '} ${label}. ${choiceText}`);
          });
        }
        if (question.explanation) {
          lines.push(`解説: ${question.explanation}`);
        }
      });
    }

    lines.push('');
  }

  document.getElementById('admin-list').innerHTML = `<pre class="admin-text"></pre>`;
  document.querySelector('#admin-list .admin-text').textContent = lines.join('\n');
}

function updatePartBadge() {
  const levelData = quizData[currentLevel];
  const descEl = document.getElementById('part-description');
  if (levelData && descEl) {
    descEl.textContent = levelData.label || '各10問・100点満点';
  }
}

async function switchLevel(level) {
  if (level === currentLevel || level < 1 || level > maxLevel) return;
  currentLevel = level;
  updatePartBadge();
  await loadQuestions(level);
}

let homeCollapsed = true; // 現在パートのレッスン一覧を閉じているか

async function toggleLevel(level) {
  soundClick();
  let opening;
  if (level === currentLevel) {
    homeCollapsed = !homeCollapsed;
    opening = !homeCollapsed;
    await showHome();
  } else {
    homeCollapsed = false;
    opening = true;
    await switchLevel(level);
  }
  // 開いたパートが画面外にある場合、そこまで自動スクロールする
  if (opening) {
    const openBlock = document.querySelector('.part-block.open');
    if (openBlock) openBlock.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function goToTest(level, testId, isReview, isPractice) {
  if (level !== currentLevel) {
    currentLevel = level;
    TESTS = quizData[level].tests;
  }
  soundClick();
  startTest(testId, isReview, isPractice);
}

let currentTest = null, currentQ = 0, answers = [], shuffledChoices = [];
let TOTAL_QUESTIONS = 0;

function calculateTotalQuestions() {
  if (!TESTS || !Array.isArray(TESTS)) return 0;
  return TESTS.reduce((sum, test) => sum + test.questions.length, 0);
}

// ==== Firestoreデータ構造の移行（教材ごとのトップレベルコレクション → ユーザーごとの階層） ====
// 旧: quiz_<教材id>/{uid}、quiz_menu_prefs/{uid}
// 新: users/{uid}、users/{uid}/quizzes/{教材id}
// ログインの度に1回だけ、旧データを新構造へ非破壊コピーする（旧データは削除しない）。
let migrationPromise = null;
function ensureMigrated() {
  if (!migrationPromise) migrationPromise = migrateUserDataIfNeeded();
  return migrationPromise;
}

async function migrateUserDataIfNeeded() {
  if (!currentUser) return;
  const userRef = db.collection('users').doc(currentUser.uid);
  try {
    const userSnap = await userRef.get();
    if (userSnap.exists && userSnap.data().migratedAt) return;

    // config.jsonの取得に失敗した場合はここで例外を投げて外側のcatchに落とし、
    // migratedAtをセットしないまま終わる（次回ログイン時に再試行される）。
    // ここで{}にフォールバックしてしまうと、一時的な通信失敗のせいで
    // 教材の成績データが1個も移行されないまま「移行済み」扱いになってしまう。
    const config = await fetch(DOCS_ROOT + 'config.json').then(r => r.json());
    const quizIds = Object.keys(config);

    const [oldPrefsSnap, oldQuizDocs] = await Promise.all([
      db.collection('quiz_menu_prefs').doc(currentUser.uid).get(),
      Promise.all(quizIds.map(id =>
        db.collection(`quiz_${id}`).doc(currentUser.uid).get().then(snap => ({ id, snap }))
      )),
    ]);

    const batch = db.batch();
    const oldPrefs = oldPrefsSnap.exists ? oldPrefsSnap.data() : {};
    batch.set(userRef, { ...oldPrefs, migratedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
    oldQuizDocs.forEach(({ id, snap }) => {
      if (snap.exists) batch.set(userRef.collection('quizzes').doc(id), snap.data());
    });

    await batch.commit();
  } catch (e) { console.error('Failed to migrate user data to new structure:', e); }
}

let isInitializingCache = null;

async function initializeBestScoresCache() {
  if (cacheInitialized || !currentUser) return;
  if (isInitializingCache) {
    await isInitializingCache;
    return;
  }

  isInitializingCache = (async () => {
    try {
      bestScores = await userDataAction('getScores');
      cacheInitialized = true;
    } catch (e) {
      console.error(e);
    } finally {
      isInitializingCache = null;
    }
  })();

  await isInitializingCache;
}

// ===== 解答記録と復習機能 =====

function saveWrongAnswersKey(level, testId) {
  return `lessonWrongAnswers_${level}_${testId}`;
}

async function saveWrongAnswers(testId, answers, level) {
  if (!currentUser || isReviewMode) return;

  try {
    const wrongQuestionNumbers = [];
    answers.forEach((ans, idx) => {
      if (!ans.correct) {
        wrongQuestionNumbers.push(idx + 1); // 0-indexed → 1-indexed
      }
    });

    const key = saveWrongAnswersKey(level, testId);
    await userDataAction('saveWrongAnswers', { key, wrongQuestionNumbers });
    bestScores[key] = wrongQuestionNumbers;
  } catch (e) {
    console.error('Failed to save wrong answers:', e);
  }
}

async function getWrongAnswerIds(testId, level) {
  if (!currentUser) return [];
  if (!cacheInitialized) {
    await initializeBestScoresCache();
  }

  try {
    const key = saveWrongAnswersKey(level, testId);
    const wrongNumbers = bestScores[key] || [];

    // 1-indexed → 0-indexed
    return wrongNumbers.map(n => n - 1);
  } catch (e) {
    console.error('Failed to get wrong answers:', e);
    return [];
  }
}

async function getBest(id, level = currentLevel) {
  if (!currentUser) return -1;
  if (!cacheInitialized) {
    await initializeBestScoresCache();
  }
  const v = bestScores[`lesson_${level}_${id}`];
  return (v === undefined || v === null) ? -1 : parseInt(v, 10);
}

function historyKey(level, id) {
  return `lessonHistory_${level}_${id}`;
}

function attemptCountKey(level, id) {
  return `lessonAttemptCount_${level}_${id}`;
}

function practiceCountKey(level, id) {
  return `lessonPracticeCount_${level}_${id}`;
}

function getPracticeCount(id, level = currentLevel) {
  const v = bestScores[practiceCountKey(level, id)];
  return (v === undefined || v === null) ? 0 : parseInt(v, 10);
}

// 演習モード・誤答復習の完走回数を区別せず1つのカウンターで数える
async function recordPracticeAttempt(id) {
  if (!currentUser) return;
  if (!cacheInitialized) await initializeBestScoresCache();
  try {
    const field = practiceCountKey(currentLevel, id);
    const updates = { [field]: getPracticeCount(id) + 1 };
    await userDataAction('recordPracticeAttempt', { updates });
    Object.assign(bestScores, updates);
  } catch (e) { console.error(e); }
}

// 保存する履歴の上限（初回1件＋直近10件）
const HISTORY_KEEP_LATEST = 10;

function getAttemptCount(id, level = currentLevel) {
  const v = bestScores[attemptCountKey(level, id)];
  return (v === undefined || v === null) ? 0 : parseInt(v, 10);
}

function nowJstString() {
  return new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', hour12: false });
}

// nowJstString()が生成する「YYYY/M/D HH:mm:ss」形式を比較可能なタイムスタンプに変換
function parseJstDateString(s) {
  const m = /^(\d+)\/(\d+)\/(\d+)\s+(\d+):(\d+):(\d+)$/.exec(s || '');
  if (!m) return null;
  const [, y, mo, d, hh, mm, ss] = m.map(Number);
  return new Date(y, mo - 1, d, hh, mm, ss).getTime();
}

async function getHistory(id, level = currentLevel) {
  if (!currentUser) return [];
  if (!cacheInitialized) {
    await initializeBestScoresCache();
  }
  const h = bestScores[historyKey(level, id)];
  return Array.isArray(h) ? h : [];
}

// このアプリがFirestoreに対して行う読み書き（成績データ・メインメニューの教材設定）を
// 1箇所に集約する。現状はクライアントから直接Firestoreへ読み書きするが、Cloud Functions
// 移行時はこのswitch各caseの中身をそのままサーバー側（onCall関数）に移す想定で書いてある。
// docs/index.html（メインメニュー）もこのquiz-app.jsを読み込んで同じ関数を使う。
async function userDataAction(action, params = {}) {
  await ensureMigrated();
  const userRef = db.collection('users').doc(currentUser.uid);
  // メインメニュー（docs/index.html）から呼ばれる場合はquizIdが無いので、
  // ここで.doc(null)を作ろうとして例外にならないよう、必要な時だけ組み立てる。
  const docRef = quizId ? userRef.collection('quizzes').doc(quizId) : null;
  switch (action) {
    case 'getScores': {
      const doc = await docRef.get();
      return doc.exists ? doc.data() : {};
    }
    case 'saveWrongAnswers': {
      const { key, wrongQuestionNumbers } = params;
      await docRef.set({ [key]: wrongQuestionNumbers }, { merge: true });
      return { [key]: wrongQuestionNumbers };
    }
    case 'recordPracticeAttempt': {
      const { updates } = params;
      await docRef.set(updates, { merge: true });
      return updates;
    }
    case 'recordTestResult': {
      const { id, s } = params;
      const wasFullyCleared = await isFullyCleared();

      const bestField = `lesson_${currentLevel}_${id}`;
      const historyField = historyKey(currentLevel, id);
      const countField = attemptCountKey(currentLevel, id);
      const best = await getBest(id);
      const history = await getHistory(id);
      // 機能追加前からの履歴（attemptCountが未設定）でも既存件数から番号を続けられるようにする
      const newCount = Math.max(getAttemptCount(id), history.length) + 1;
      let updatedHistory = [...history, { no: newCount, score: s, date: nowJstString() }];
      // 初回1件＋直近10件だけ残す（間の分は間引く）
      if (updatedHistory.length > HISTORY_KEEP_LATEST + 1) {
        updatedHistory = [updatedHistory[0], ...updatedHistory.slice(-HISTORY_KEEP_LATEST)];
      }

      const newLapAttemptCount = getLapAttemptCount() + 1;
      const updates = { [historyField]: updatedHistory, [countField]: newCount, lapAttemptCount: newLapAttemptCount };
      if (s > best) updates[bestField] = s;

      // このテストの結果で「初めて」全問正解の状態になるかを、書き込み前に判定する。
      // すでに全問正解済みならlesson_は上がることはあっても下がらないので、再スキャンせず true とみなせる。
      // まだFirestoreに書き込んでいないupdatesの値をoverridesとして渡すことで、
      // fullClearHistoryの更新も同じ1回の書き込みにまとめられる。
      const nowFullyCleared = wasFullyCleared ? true : await isFullyCleared(updates);
      if (!wasFullyCleared && nowFullyCleared) {
        const entry = { lap: getLap() + 1, date: nowJstString(), attempts: newLapAttemptCount };
        updates.fullClearHistory = [...getFullClearHistory(), entry];
      }

      await docRef.set(updates, { merge: true });
      Object.assign(bestScores, updates);
      return updates;
    }
    case 'resetCurrentLevel': {
      const { level } = params;
      const snapshot = await docRef.get();
      if (!quizData[level] || !quizData[level].tests) return null;

      // 全問正解の状態からこのパートをリセットする場合、記録を残しておく。
      // これにより、次にまた全問正解を達成したときのfullClearHistoryの新しいエントリが
      // 「バグで重複した」のではなく「リセットして取り直した」ことだと履歴から分かる。
      const wasFullyCleared = await isFullyCleared();
      const fieldsToDelete = {};
      if (wasFullyCleared) {
        const resetEntry = { lap: getLap() + 1, date: nowJstString() };
        fieldsToDelete.partialResetHistory = [...getPartialResetHistory(), resetEntry];
      }
      for (const t of quizData[level].tests) {
        fieldsToDelete[`lesson_${level}_${t.id}`] = firebase.firestore.FieldValue.delete();
        fieldsToDelete[`lessonWrongAnswers_${level}_${t.id}`] = firebase.firestore.FieldValue.delete();
        fieldsToDelete[historyKey(level, t.id)] = firebase.firestore.FieldValue.delete();
        fieldsToDelete[attemptCountKey(level, t.id)] = firebase.firestore.FieldValue.delete();
        fieldsToDelete[practiceCountKey(level, t.id)] = firebase.firestore.FieldValue.delete();
      }
      if (snapshot.exists) {
        await docRef.update(fieldsToDelete);
      }
      // キャッシュから削除
      for (const t of quizData[level].tests) {
        delete bestScores[`lesson_${level}_${t.id}`];
        delete bestScores[`lessonWrongAnswers_${level}_${t.id}`];
        delete bestScores[historyKey(level, t.id)];
        delete bestScores[attemptCountKey(level, t.id)];
        delete bestScores[practiceCountKey(level, t.id)];
      }
      if (wasFullyCleared) {
        bestScores.partialResetHistory = fieldsToDelete.partialResetHistory;
      }
      return fieldsToDelete;
    }
    case 'resetAllLevels': {
      await docRef.delete();
      bestScores = {};
      cacheInitialized = false;
      return {};
    }
    case 'deleteHistoryEntries': {
      const { groups } = params;
      const updates = {};
      Object.keys(groups).forEach(field => {
        const current = Array.isArray(bestScores[field]) ? bestScores[field] : [];
        updates[field] = current.filter((_, i) => !groups[field].has(i));
      });
      await docRef.set(updates, { merge: true });
      Object.assign(bestScores, updates);
      return updates;
    }
    case 'advanceLap': {
      const newLap = getLap() + 1;
      const newLapHistory = [...getLapHistory(), { lap: newLap, date: nowJstString() }];
      const fieldsToDelete = { lap: newLap, lapHistory: newLapHistory, lapAttemptCount: 0 };
      for (let level = 1; level <= maxLevel; level++) {
        if (!quizData[level] || !quizData[level].tests) continue;
        for (const t of quizData[level].tests) {
          fieldsToDelete[`lesson_${level}_${t.id}`] = firebase.firestore.FieldValue.delete();
          fieldsToDelete[`lessonWrongAnswers_${level}_${t.id}`] = firebase.firestore.FieldValue.delete();
        }
      }
      await docRef.set(fieldsToDelete, { merge: true });
      // ローカルキャッシュも同期: lesson_/lessonWrongAnswers_は削除、lap/lapHistory/lapAttemptCountだけ更新
      Object.keys(fieldsToDelete).forEach(key => {
        if (key === 'lap') { bestScores.lap = newLap; return; }
        if (key === 'lapHistory') { bestScores.lapHistory = newLapHistory; return; }
        if (key === 'lapAttemptCount') { bestScores.lapAttemptCount = 0; return; }
        delete bestScores[key];
      });
      return fieldsToDelete;
    }
    // ==== ここからメインメニュー（docs/index.html）の教材設定用 ====
    case 'getMenuPrefs': {
      const doc = await userRef.get();
      return doc.exists ? doc.data() : {};
    }
    case 'setVisiblePrefs': {
      const { visible } = params;
      await userRef.set({ visible }, { merge: true });
      return { visible };
    }
    case 'setPinnedPrefs': {
      const { pinned } = params;
      await userRef.set({ pinned }, { merge: true });
      return { pinned };
    }
    case 'migrateMenuPrefsIds': {
      const { migrationUpdates } = params;
      await userRef.update(migrationUpdates);
      return migrationUpdates;
    }
    case 'getQuizScoreDoc': {
      const { quizId: targetQuizId } = params;
      const doc = await userRef.collection('quizzes').doc(targetQuizId).get();
      return doc.exists ? doc.data() : null;
    }
    default:
      throw new Error(`userDataAction: unknown action "${action}"`);
  }
}

// 試験モード完走のたびに、日時付きで履歴に積み、必要なら最高得点も更新する
async function recordTestResult(id, s) {
  if (!currentUser) return;
  if (!cacheInitialized) {
    await initializeBestScoresCache();
  }
  try {
    await userDataAction('recordTestResult', { id, s });
  } catch (e) { console.error(e); }
}

function openScoreModal() {
  applyFontSizePref(); // ボタンの選択中ハイライトを最新化
  const modal = document.getElementById('score-modal');
  if (modal) modal.style.display = 'flex';
}

function closeScoreModal() {
  const modal = document.getElementById('score-modal');
  if (modal) modal.style.display = 'none';
}

function toggleHistoryPart(level) {
  const block = document.getElementById(`history-part-block-${level}`);
  if (block) {
    block.classList.toggle('open');
    const row = block.querySelector('.part-score-row');
    if (row) {
      const isOpen = block.classList.contains('open');
      row.setAttribute('aria-expanded', String(isOpen));
    }
  }
}

async function showScoreHistory() {
  closeScoreModal();
  if (!cacheInitialized) await initializeBestScoresCache();
  const labelEl = document.getElementById('history-part-label');
  if (labelEl) labelEl.textContent = '全パート';

  const listEl = document.getElementById('history-list');
  if (listEl) listEl.innerHTML = '<p style="text-align:center; color:#a0aec0;">読み込み中…</p>';

  const partSections = [];
  let earliestDate = null; // 初めてどれか1レッスンを終えた日時＝1周目開始日時

  for (let level = 1; level <= maxLevel; level++) {
    const levelData = quizData[level];
    if (!levelData) continue;
    const partLabel = getPartLabel(levelData, level);
    const tests = levelData.tests || [];

    let levelCorrect = 0;
    let levelExamAttempts = 0;
    const levelQuestions = tests.reduce((sum, test) => (
      sum + (Array.isArray(test.questions) ? test.questions.length : 0)
    ), 0);

    const setSections = [];
    for (const t of tests) {
      const [history, best] = await Promise.all([getHistory(t.id, level), getBest(t.id, level)]);
      const qCount = Array.isArray(t.questions) ? t.questions.length : 10;
      // 機能追加前からの履歴にはattemptCountが無いので、大きい方を採用する
      const attemptCount = Math.max(getAttemptCount(t.id, level), history.length);
      if (best >= 0) levelCorrect += Math.round(best / 100 * qCount);
      levelExamAttempts += attemptCount;
      history.forEach(h => {
        const ts = parseJstDateString(h.date);
        if (ts !== null && (earliestDate === null || ts < earliestDate.ts)) {
          earliestDate = { ts, date: h.date };
        }
      });
      const decorated = history.map((h, idx) => ({ ...h, idx }));
      const historyField = historyKey(level, t.id);
      const entriesHtml = decorated.length
        ? [...decorated].reverse().map(h =>
            `<div style="display:flex; flex-wrap:wrap; align-items:center; gap:4px 8px; padding:4px 0; font-size:0.85rem; color:#4a5568;">
              <input type="checkbox" class="history-check" data-field="${historyField}" data-idx="${h.idx}">
              <span style="flex-shrink:0; color:#a0aec0; font-size:0.76rem; min-width:2.6em; white-space:nowrap;">${h.no ? h.no + '回目' : ''}</span>
              <span style="white-space:nowrap; font-size:0.72rem;">${escapeHtml(h.date)}</span>
              <span style="font-weight:700; margin-left:auto; white-space:nowrap;">${Math.round(h.score / 100 * qCount)}/${qCount}問</span>
            </div>`
          ).join('')
        : `<p style="font-size:0.82rem; color:#a0aec0; padding:4px 0; margin:0;">まだ記録がありません</p>`;
      setSections.push(
        `<div style="margin-bottom:14px;"><div style="font-weight:800; color:#2d3748; margin-bottom:4px;">${escapeHtml(t.title || '')}（${attemptCount}回）</div>${entriesHtml}</div>`
      );
    }

    partSections.push(
      `<div class="part-block" id="history-part-block-${level}" style="margin-bottom:16px;">
        <div class="part-score-row" role="button" tabindex="0" aria-expanded="false" onclick="toggleHistoryPart(${level});" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleHistoryPart(${level});}">
          <span class="part-name">${escapeHtml(partLabel)}</span>
          <span class="part-value">試験 ${levelCorrect}/${levelQuestions}問(${levelExamAttempts}回)</span>
          <span class="part-arrow">▶</span>
        </div>
        <div class="part-set-list" style="padding:10px 12px;">${setSections.join('')}</div>
      </div>`
    );
  }

  const lapHistory = getLapHistory();
  const fullClearHistory = getFullClearHistory();
  const partialResetHistory = getPartialResetHistory();
  if (lapHistory.length > 0 || earliestDate || fullClearHistory.length > 0 || partialResetHistory.length > 0) {
    const lapEntries = [];
    if (earliestDate) lapEntries.push({ date: earliestDate.date, ts: earliestDate.ts, label: '🌟 1周目開始', field: null, idx: null });
    lapHistory.forEach((h, idx) => {
      const ts = parseJstDateString(h.date);
      lapEntries.push({ date: h.date, ts: ts === null ? 0 : ts, label: `🌟 ${h.lap + 1}周目開始`, field: 'lapHistory', idx });
    });
    fullClearHistory.forEach((h, idx) => {
      const ts = parseJstDateString(h.date);
      lapEntries.push({ date: h.date, ts: ts === null ? 0 : ts, label: `🎉 全クリア(試験回数${h.attempts}回)`, field: 'fullClearHistory', idx });
    });
    partialResetHistory.forEach((h, idx) => {
      const ts = parseJstDateString(h.date);
      lapEntries.push({ date: h.date, ts: ts === null ? 0 : ts, label: `🔧 ${h.lap}周目 一部リセット`, field: 'partialResetHistory', idx });
    });
    lapEntries.sort((a, b) => a.ts - b.ts);
    const lapEntriesHtml = [...lapEntries].reverse().map(e =>
      `<div style="display:flex; flex-wrap:wrap; align-items:center; gap:4px 8px; padding:4px 0; font-size:0.85rem; color:#4a5568;">
        ${e.field ? `<input type="checkbox" class="history-check" data-field="${e.field}" data-idx="${e.idx}">` : '<span style="width:16px; flex-shrink:0; display:inline-block;"></span>'}
        <span style="white-space:nowrap; font-size:0.72rem;">${escapeHtml(e.date)}</span>
        <span style="font-weight:700; margin-left:auto; white-space:nowrap;">${e.label}</span>
      </div>`
    ).join('');
    partSections.unshift(
      `<div style="margin-bottom:20px;"><div style="font-size:0.95rem; font-weight:800; color:#7c4a00; background:linear-gradient(135deg, #fffbea, #fff3c4); border-radius:8px; padding:8px 12px; margin-bottom:10px;">🌟 周回履歴</div>${lapEntriesHtml}</div>`
    );
  }
  if (listEl) listEl.innerHTML = partSections.join('') || '<p>パートがありません</p>';

  const modal = document.getElementById('history-modal');
  if (modal) {
    modal.style.display = 'flex';
    // position:fixedのモーダルはページ側のスクロール位置によっては
    // （特にモバイルブラウザで）画面内に収まりきらないことがあるため、
    // ページ自体を先頭に戻して確実に画面内に収める
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function closeHistoryModal() {
  const modal = document.getElementById('history-modal');
  if (modal) modal.style.display = 'none';
}

function confirmDeleteSelectedHistory() {
  const checked = document.querySelectorAll('.history-check:checked');
  if (checked.length === 0) return;
  const modal = document.getElementById('delete-history-modal');
  if (modal) modal.style.display = 'flex';
}

function closeDeleteHistoryModal() {
  const modal = document.getElementById('delete-history-modal');
  if (modal) modal.style.display = 'none';
}

// チェックした履歴だけまとめて削除する（history_配列からその要素を取り除くだけで、
// lesson_やlessonAttemptCount_、周回数などには触れない）
async function deleteSelectedHistory() {
  closeDeleteHistoryModal();
  if (!currentUser) return;
  const checked = document.querySelectorAll('.history-check:checked');
  if (checked.length === 0) return;

  const groups = {};
  checked.forEach(cb => {
    const field = cb.dataset.field;
    const idx = parseInt(cb.dataset.idx, 10);
    if (!groups[field]) groups[field] = new Set();
    groups[field].add(idx);
  });

  try {
    await userDataAction('deleteHistoryEntries', { groups });
    soundClick();
    showScoreHistory();
  } catch (e) { console.error(e); }
}

function resetScores() {
  closeScoreModal();
  const modal = document.getElementById('reset-modal');
  if (modal) modal.style.display = 'flex';
}

function closeResetModal() {
  const modal = document.getElementById('reset-modal');
  if (modal) modal.style.display = 'none';
}

// リセットは危険操作なので、実行前にもう1段階「本当に消しますか」の確認を挟む。
// どちらのリセットかは、確認ボタン自身のdata属性に持たせて引数として渡す
// （モジュール変数を介さない）。

function confirmResetCurrentLevel() {
  const btn = document.getElementById('reset-danger-execute-btn');
  if (btn) btn.dataset.resetType = 'current';
  const msgEl = document.getElementById('reset-danger-message');
  if (msgEl) msgEl.textContent = '現在のパートの最高点・誤答記録・挑戦履歴・通し回数を削除します。';
  const modal = document.getElementById('reset-danger-modal');
  if (modal) modal.style.display = 'flex';
}

function confirmResetAllLevels() {
  const btn = document.getElementById('reset-danger-execute-btn');
  if (btn) btn.dataset.resetType = 'all';
  const msgEl = document.getElementById('reset-danger-message');
  if (msgEl) msgEl.textContent = 'この教材の成績データを全部（周回数・周回履歴・全問正解達成記録も含む）削除します。';
  const modal = document.getElementById('reset-danger-modal');
  if (modal) modal.style.display = 'flex';
}

function closeResetDangerModal() {
  const modal = document.getElementById('reset-danger-modal');
  if (modal) modal.style.display = 'none';
}

async function executeResetDanger(btn) {
  const type = btn && btn.dataset ? btn.dataset.resetType : null;
  closeResetDangerModal();
  if (type === 'current') await resetCurrentLevel();
  else if (type === 'all') await resetAllLevels();
}

async function resetCurrentLevel() {
  if (!currentUser) return;
  closeResetModal();
  try {
    const result = await userDataAction('resetCurrentLevel', { level: currentLevel });
    if (result === null) return;
    soundClick(); showHome();
  } catch (e) { console.error(e); }
}

async function resetAllLevels() {
  if (!currentUser) return;
  closeResetModal();
  try {
    await userDataAction('resetAllLevels');
    soundClick(); showHome();
  } catch (e) { console.error(e); }
}

function backToMainMenu(event) {
  const isFromMenu = new URLSearchParams(location.search).get('from') === 'menu';
  if (isFromMenu || (window.opener && !window.opener.closed)) {
    event.preventDefault();
    window.close();
  }
}

async function getTotalCorrect() {
  // 全レベルの合計を計算
  let total = 0, attempted = 0;
  for (let level = 1; level <= maxLevel; level++) {
    if (!quizData[level] || !quizData[level].tests) continue;
    for (const t of quizData[level].tests) {
      const best = await getBest(t.id, level);
      if (best >= 0) {
        const qCount = Array.isArray(t.questions) ? t.questions.length : 10;
        total += Math.round(best / 100 * qCount);
        attempted++;
      }
    }
  }
  return { total, attempted };
}

function calculateTotalQuestionsAllLevels() {
  // 全レベルの総問題数を計算
  let totalQuestions = 0;
  for (let level = 1; level <= maxLevel; level++) {
    if (!quizData[level] || !quizData[level].tests) continue;
    totalQuestions += quizData[level].tests.reduce((sum, test) => (
      sum + (Array.isArray(test.questions) ? test.questions.length : 0)
    ), 0);
  }
  return totalQuestions;
}

// overridesに { lesson_<level>_<id>: 100 } のような「まだFirestoreに書き込んでいない
// 予定の値」を渡すと、キャッシュより優先してその値で判定する。書き込み前に
// 「この更新で全問正解になるか」を判定し、1回の書き込みにまとめるために使う。
async function isFullyCleared(overrides) {
  if (!currentUser) return false;
  if (!cacheInitialized) await initializeBestScoresCache();
  let sawAnyTest = false;
  for (let level = 1; level <= maxLevel; level++) {
    if (!quizData[level] || !quizData[level].tests) continue;
    for (const t of quizData[level].tests) {
      sawAnyTest = true;
      const key = `lesson_${level}_${t.id}`;
      const v = (overrides && overrides[key] !== undefined) ? overrides[key] : bestScores[key];
      const best = (v === undefined || v === null) ? -1 : parseInt(v, 10);
      if (best !== 100) return false;
    }
  }
  return sawAnyTest; // テストが1つも無ければ「クリア」扱いにしない
}

function getLap() {
  const v = bestScores['lap'];
  return (v === undefined || v === null) ? 0 : parseInt(v, 10);
}

// 全問正解を達成した状態で呼ばれる。既存のlesson/lessonHistory/lessonWrongAnswersは一切変更せず、
// 周回数(lap)だけを加算する。lesson_が消えない限り何度でも呼べる設計。
// 2周目に入る＝各レッスンの最高点・誤答記録を振り出しに戻す（挑戦履歴histoy_だけは残す）。
// これで「もう一度全問正解を取り直す」という周回の実感が出る。
function getLapHistory() {
  const h = bestScores['lapHistory'];
  return Array.isArray(h) ? h : [];
}

// 今の周回に入ってから試験モードを何回受けたか（advanceLap()で0に戻る）
function getLapAttemptCount() {
  const v = bestScores['lapAttemptCount'];
  return (v === undefined || v === null) ? 0 : parseInt(v, 10);
}

function getFullClearHistory() {
  const h = bestScores['fullClearHistory'];
  return Array.isArray(h) ? h : [];
}

// 全問正解の状態から「現在のパートのみ」リセットした記録。
// これにより、その後もう一度全問正解になったときのfullClearHistoryの新しいエントリが
// 「重複」ではなく「リセット後の再達成」だと周回履歴の時系列から分かるようにする。
function getPartialResetHistory() {
  const h = bestScores['partialResetHistory'];
  return Array.isArray(h) ? h : [];
}

function confirmAdvanceLap() {
  const modal = document.getElementById('advance-lap-modal');
  if (modal) modal.style.display = 'flex';
}

function closeAdvanceLapModal() {
  const modal = document.getElementById('advance-lap-modal');
  if (modal) modal.style.display = 'none';
}

async function advanceLap() {
  closeAdvanceLapModal();
  if (!currentUser) return;
  if (!cacheInitialized) await initializeBestScoresCache();
  try {
    await userDataAction('advanceLap');
    soundFanfare();
    launchConfetti(80);
    showHome();
  } catch (e) { console.error(e); }
}

async function showHome() {
  if (isAdminMode) {
    showAdmin();
    return;
  }
  isReviewMode = false;
  isPracticeModeActive = false;
  document.getElementById('screen-home').classList.remove('hidden');
  document.getElementById('screen-quiz').classList.add('hidden');
  document.getElementById('screen-results').classList.add('hidden');
  document.getElementById('screen-admin').classList.add('hidden');

  TOTAL_QUESTIONS = calculateTotalQuestions(); // 現在のレベルの問題数
  const totalQuestionsAllLevels = calculateTotalQuestionsAllLevels(); // 全レベルの合計
  const { total, attempted } = await getTotalCorrect();
  const totalEl = document.getElementById('total-score-display');
  if (attempted === 0) {
    totalEl.innerHTML = `✅未挑戦/${totalQuestionsAllLevels}`;
  } else {
    const totalPercent = totalQuestionsAllLevels > 0 ? Math.round((total / totalQuestionsAllLevels) * 100) : 0;
    totalEl.innerHTML = `✅${total}/${totalQuestionsAllLevels}問正解(${totalPercent}%)`;
  }

  const fullyCleared = await isFullyCleared();
  const lap = getLap();
  const badgeSlotEl = document.getElementById('full-clear-badge-slot');
  if (badgeSlotEl) badgeSlotEl.innerHTML = lap > 0 ? `<span class="full-clear-badge" onclick="playFullClearSparkle(event)">🌟 全クリア ×${lap}</span>` : '';
  const bannerEl = document.getElementById('full-clear-banner');
  if (bannerEl) {
    let bannerHtml = '';
    if (fullyCleared) {
      bannerHtml += `<div class="full-clear-celebrate">
        <p onclick="playFullClearSparkle(event)" style="cursor:pointer;">🎉 全問正解達成！</p>
        <button onclick="confirmAdvanceLap()">🏁 次の周へ進む</button>
      </div>`;
    }
    bannerEl.innerHTML = bannerHtml;
    bannerEl.style.display = bannerHtml ? 'block' : 'none';
  }

  // レベル別スコアを計算・表示（パートが1個だけの教材も同じアコーディオン表示に統一する）
  const partScoresSection = document.getElementById('part-scores-section');
  const partScoresList = document.getElementById('part-scores-list');

  let partScoresHtml = '';

  for (let level = 1; level <= maxLevel; level++) {
    const levelData = quizData[level];
    if (!levelData || !levelData.tests) continue;

    let levelCorrect = 0;
    let levelExamAttempts = 0;
    let levelPracticeAttempts = 0;
    const levelQuestions = levelData.tests.reduce((sum, test) => (
      sum + (Array.isArray(test.questions) ? test.questions.length : 0)
    ), 0);

    for (const t of levelData.tests) {
      const best = await getBest(t.id, level);
      if (best >= 0) {
        const qCount = Array.isArray(t.questions) ? t.questions.length : 10;
        levelCorrect += Math.round(best / 100 * qCount);
      }
      const history = await getHistory(t.id, level);
      levelExamAttempts += Math.max(getAttemptCount(t.id, level), history.length);
      levelPracticeAttempts += getPracticeCount(t.id, level);
    }

    const levelLabel = getPartLabel(levelData, level);
    const isOpen = level === currentLevel && !homeCollapsed;
    const blockClass = `part-block${isOpen ? ' open' : ''}${level === currentLevel ? ' active' : ''}`;
    const setRowsHtml = await buildSetRowsHtml(levelData.tests, level, levelLabel);

    partScoresHtml += `<div class="${blockClass}">
        <div class="part-score-row" role="button" tabindex="0" aria-expanded="${isOpen}" onclick="toggleLevel(${level});" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleLevel(${level});}">
          <span class="part-name">${levelLabel}</span>
          <span class="part-value">試験 ${levelCorrect}/${levelQuestions}問(${levelExamAttempts}回)・演習/復習(${levelPracticeAttempts}回)</span>
          <span class="part-arrow">▶</span>
        </div>
        <div class="part-set-list">${setRowsHtml}</div>
      </div>`;
  }

  partScoresList.innerHTML = partScoresHtml;
  partScoresSection.style.display = 'block';
  document.getElementById('test-grid').innerHTML = '';
}

async function buildSetRowsHtml(tests, level, partLabel) {
  let html = '';
  for (const t of tests) {
    const best = await getBest(t.id, level);
    const questionCount = Array.isArray(t.questions) ? t.questions.length : 10;

    // 復習問題の数を取得
    const wrongIndices = await getWrongAnswerIds(t.id, level);
    const reviewCount = wrongIndices.length;

    const practiceCount = getPracticeCount(t.id, level);
    // 2つ目のボタン：誤答があれば誤答復習、なければ演習モード（どちらも記録なし、実施回数は区別せず合算）
    const secondaryBtn = reviewCount > 0
      ? `<button class="set-review-btn" onclick="goToTest(${level}, ${t.id}, true, false);"><span class="btn-title">誤答復習</span><span class="btn-sub btn-sub-score">${reviewCount}/${questionCount}問(${practiceCount}回)</span></button>`
      : `<button class="set-practice-btn" onclick="goToTest(${level}, ${t.id}, false, true);"><span class="btn-title">演習</span><span class="btn-sub btn-sub-score">非記録モード(${practiceCount}回)</span></button>`;

    const bestCorrect = Math.round(best / 100 * questionCount);
    // 機能追加前からの履歴にはattemptCountが無いので、大きい方を採用する
    const history = await getHistory(t.id, level);
    const attemptCount = Math.max(getAttemptCount(t.id, level), history.length);
    // 最高点・未挑戦の表示は試験ボタン内に統一する
    const examSub = best >= 0
      ? `<span class="btn-sub btn-sub-score">最高 ${bestCorrect}/${questionCount}問(${attemptCount}回)</span>`
      : `<span class="btn-sub btn-sub-score">記録モード(${attemptCount}回)</span>`;

    html += `<div class="part-set-row">
      <span class="set-icon">${t.emoji}</span>
      <div class="set-main">
        <div class="set-name"><span class="set-icon-inline">${t.emoji}</span>${t.title}</div>
        <div class="set-sub">${escapeHtml(t.subtitle || partLabel)} ${questionCount}問</div>
      </div>
      <div class="set-meta">
        <div class="set-actions">
          <button class="set-exam-btn" onclick="goToTest(${level}, ${t.id}, false, false);"><span class="btn-title">試験</span>${examSub}</button>
          ${secondaryBtn}
        </div>
      </div>
    </div>`;
  }
  return html;
}

// ============================================================
// 仕訳レンダリング（boki1 との統一性のため）
// ============================================================

// 仕訳問題かどうかは choices の中身の形（文字列かオブジェクトか）で自動判別する。
// 問題JSON側の"type"フィールドに依存しないため、typeを書き忘れても正しく判定できる。
function isJournalQuestion(q) {
  return Array.isArray(q.choices) && q.choices.length > 0 && typeof q.choices[0] === 'object';
}

// ============================================================
// 記述式（自由入力）問題
// ============================================================

function isTextQuestion(q) {
  return q.type === 'text';
}

function normalizeAnswerText(s) {
  return String(s)
    .normalize('NFKC')
    .replace(/[　\s]+/g, '')
    .toLowerCase();
}

function isTextAnswerCorrect(q, typed) {
  const candidates = [q.correctText, ...(q.acceptedAnswers || [])];
  const normTyped = normalizeAnswerText(typed);
  return candidates.some(c => normalizeAnswerText(c) === normTyped);
}

function fmt(n) { return '¥' + n.toLocaleString(); }

function renderJournal(entry) {
  const dLines = entry.debit.map(e =>
    `<div class="entry-item journal-debit"><span>${escapeHtml(e.account)}</span><span>${fmt(e.amount)}</span></div>`
  ).join('');
  const cLines = entry.credit.map(e =>
    `<div class="entry-item journal-credit"><span>${escapeHtml(e.account)}</span><span>${fmt(e.amount)}</span></div>`
  ).join('');
  return `<div class="journal">
    <div><div class="journal-header">借方（左）</div><div class="entry-line">${dLines}</div></div>
    <div class="journal-sep">｜</div>
    <div><div class="journal-header">貸方（右）</div><div class="entry-line">${cLines}</div></div>
  </div>`;
}

function journalText(entry) {
  return '借: ' + entry.debit.map(e=>`${e.account} ${fmt(e.amount)}`).join('・')
       + ' ／ 貸: ' + entry.credit.map(e=>`${e.account} ${fmt(e.amount)}`).join('・');
}

// ============================================================
// 🔍 用語検索
// ============================================================

let searchTextRegistry = [];
let lastModalSelection = '';

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function searchIconHtml(text, asSpan) {
  const idx = searchTextRegistry.push(text) - 1;
  // 選択肢ボタンの中に置く場合はHTML仕様上<button>を入れ子にできない（パーサーが
  // 外側のbuttonを閉じてDOMが壊れる）ため、<span role="button">で代用する。
  if (asSpan) {
    return `<span class="search-icon-btn" role="button" tabindex="0" onclick="event.stopPropagation(); openSearchModal(${idx});" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();openSearchModal(${idx});}" aria-label="用語を検索">🔍</span>`;
  }
  return `<button type="button" class="search-icon-btn" onclick="event.stopPropagation(); openSearchModal(${idx});" aria-label="用語を検索">🔍</button>`;
}

// iPad等では選択範囲外をタップした時点でOSが選択を解除してしまい、
// ボタンのclickハンドラが実行される頃には window.getSelection() が
// 空になっている。selectionchange で選択直後に随時記憶しておくことで、
// タップによる選択解除より前の状態を検索時に使えるようにする。
document.addEventListener('selectionchange', () => {
  const modal = document.getElementById('search-modal');
  const textEl = document.getElementById('search-modal-text');
  if (!modal || !textEl || modal.style.display !== 'flex') return;
  const selection = window.getSelection();
  const text = selection ? selection.toString().trim() : '';
  if (text && selection.anchorNode && textEl.contains(selection.anchorNode)) {
    lastModalSelection = text;
  }
});

function openSearchModal(idx) {
  const text = searchTextRegistry[idx];
  if (text === undefined) return;
  const modal = document.getElementById('search-modal');
  const textEl = document.getElementById('search-modal-text');
  if (!modal || !textEl) return;
  lastModalSelection = '';
  textEl.textContent = text;
  modal.style.display = 'flex';
}

function closeSearchModal() {
  const modal = document.getElementById('search-modal');
  if (modal) modal.style.display = 'none';
  lastModalSelection = '';
}

function runTermSearch() {
  const textEl = document.getElementById('search-modal-text');
  if (!textEl) return;
  const query = lastModalSelection || textEl.textContent;
  if (!query) return;
  closeSearchModal();
  const url = 'https://www.google.com/search?q=' + encodeURIComponent(query);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  if (isIOS) {
    // Any new-tab approach (window.open, a clicked <a target="_blank">)
    // creates a second tab before the navigation resolves. If iOS hands
    // the URL off to the Google app via a Universal Link, that tab is
    // left behind blank. Navigating the current tab never creates a
    // second tab, so there's nothing to strand — if the app intercepts
    // it, this tab simply never actually navigates away.
    window.location.href = url;
  } else {
    // A fixed target name (instead of "_blank") reuses the same tab on
    // repeat searches rather than opening a new one every time.
    const link = document.createElement('a');
    link.href = url;
    link.target = 'quiz-term-search';
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
}

async function startTest(id, isReview = false, isPracticeMode = false) {
  const numId = typeof id === 'string' ? parseInt(id, 10) : id;
  const originalTest = TESTS.find(t => t.id === numId);

  if (!originalTest) return;

  currentTest = { ...originalTest };

  if (isReview) {
    const wrongIndices = await getWrongAnswerIds(id, currentLevel);
    if (wrongIndices.length === 0) {
      alert('復習対象の問題がありません');
      return;
    }
    const originalQuestions = currentTest.questions;
    currentTest.questions = originalQuestions.filter((_, idx) =>
      wrongIndices.includes(idx)
    );
  }

  currentQ = 0; answers = [];
  isReviewMode = isReview;
  isPracticeModeActive = isPracticeMode;

  document.getElementById('screen-home').classList.add('hidden');
  document.getElementById('screen-quiz').classList.remove('hidden');
  document.getElementById('screen-results').classList.add('hidden');
  document.getElementById('screen-admin').classList.add('hidden');
  renderQuestion();
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const CORRECT_MSGS = ['✅ 正解！やったね！', '🎯 その通り！完璧！', '⭐ 正解！さすが！'];
const WRONG_MSGS   = ['❌ 残念...確認しよう！', '💔 惜しい！正解を見てね'];

function renderQuestion() {
  answerInProgress = false; // 新しい問題では回答可能に
  const q = currentTest.questions[currentQ];
  const total = currentTest.questions.length;
  const isJ = isJournalQuestion(q); // 仕訳問題判定（choicesの中身の形で自動判別）
  const isText = isTextQuestion(q); // 記述式問題判定
  const pct = Math.round((currentQ / total) * 100);

  document.getElementById('quiz-part-label').textContent = getPartLabel(quizData[currentLevel], currentLevel);
  document.getElementById('quiz-title').textContent    = currentTest.title;
  document.getElementById('quiz-subtitle').textContent = currentTest.subtitle;
  document.getElementById('progress-bar').style.width  = pct + '%';
  document.getElementById('progress-label').textContent = `第 ${currentQ + 1} 問 ／ ${total} 問`;
  document.getElementById('progress-pct').textContent   = pct + '%';
  document.getElementById('scenario').innerHTML          = escapeHtml(q.scenario) + searchIconHtml(q.scenario);
  document.getElementById('feedback').className         = 'feedback';
  document.getElementById('feedback').textContent       = '';
  document.getElementById('explanation').className      = 'explanation';
  document.getElementById('explanation').textContent    = '';
  document.getElementById('next-btn').style.display     = 'none';

  const choicesEl = document.getElementById('choices');
  choicesEl.innerHTML = ''; // 前の問題の状態をクリア

  if (isText) {
    choicesEl.innerHTML = `<div class="text-answer-row">
      <input type="text" id="text-answer-input" class="text-answer-input" autocomplete="off" placeholder="答えを入力">
      <button class="text-submit-btn" id="text-submit-btn" onclick="submitTextAnswer()">回答する</button>
    </div>`;
    setTimeout(() => {
      const input = document.getElementById('text-answer-input');
      if (input) input.focus();
    }, 500);
    return;
  }

  const indexed = shuffle(q.choices.map((c, i) => ({ choice: c, origIdx: i })));
  shuffledChoices = indexed;
  const correctShuffledIdx = indexed.findIndex(x => x.origIdx === q.correct);

  choicesEl.innerHTML = indexed.map((item, i) => {
    const label = String.fromCharCode(97 + i); // a, b, c, d
    const choiceHtml = isJ ? renderJournal(item.choice) : escapeHtml(item.choice);
    const searchText = isJ ? journalText(item.choice) : item.choice;
    return `<div class="choice-row"><button class="choice-btn" onclick="answer(${i},${correctShuffledIdx})" id="choice-${i}" disabled>${searchIconHtml(searchText, true)}<span class="choice-text">${label}. ${choiceHtml}</span></button></div>`;
  }).join('');

  // 問題表示後 0.5秒はクリック受け付けない
  setTimeout(() => {
    shuffledChoices.forEach((_, i) => {
      const btn = document.getElementById(`choice-${i}`);
      if (btn) btn.disabled = false;
    });
  }, 500);
}

let answerInProgress = false;
let isReviewMode = false;
let isPracticeModeActive = false;

function answer(idx, correctIdx) {
  if (answerInProgress) return; // 複数実行防止
  answerInProgress = true;

  const q = currentTest.questions[currentQ];
  const ok = idx === correctIdx;
  answers.push({ correct: ok, chosenOrigIdx: shuffledChoices[idx].origIdx });

  shuffledChoices.forEach((_, i) => { document.getElementById(`choice-${i}`).disabled = true; });
  const ansBtn = document.getElementById(`choice-${idx}`);
  ansBtn.classList.add(ok ? 'correct' : 'wrong');
  const isLast = currentQ === currentTest.questions.length - 1;
  const goNext = (e) => {
    if (e && e.key === 'Enter') e.preventDefault(); // Enter キーでの自動実行を防止
    soundClick();
    isLast ? showResults() : nextQuestion();
  };
  const nextLabel = isLast ? '➡️ 結果を見る' : '➡️ 次の問題';
  if (ok) {
    const iconHtml = ansBtn.querySelector('.search-icon-btn')?.outerHTML || '';
    ansBtn.innerHTML = `${iconHtml}<span>${ansBtn.querySelector('.choice-text').textContent}</span><span class="next-indicator">${nextLabel}</span>`;
    ansBtn.onclick = goNext;
    ansBtn.onkeydown = goNext;
    // 答え合わせ表示後 0.5秒はクリック受け付けない
    setTimeout(() => { ansBtn.disabled = false; }, 500);
  }
  const correctBtn = document.getElementById(`choice-${correctIdx}`);
  if (!ok) {
    correctBtn.classList.add('reveal');
    const iconHtml = correctBtn.querySelector('.search-icon-btn')?.outerHTML || '';
    correctBtn.innerHTML = `${iconHtml}<span>${correctBtn.querySelector('.choice-text').textContent}</span><span class="next-indicator">${nextLabel}</span>`;
    correctBtn.onclick = goNext;
    correctBtn.onkeydown = goNext;
    // 答え合わせ表示後 0.5秒はクリック受け付けない
    setTimeout(() => { correctBtn.disabled = false; }, 500);
  }

  const fb = document.getElementById('feedback');
  fb.className = `feedback ${ok ? 'correct' : 'wrong'}`;
  fb.textContent = ok ? CORRECT_MSGS[Math.floor(Math.random() * CORRECT_MSGS.length)] : WRONG_MSGS[Math.floor(Math.random() * WRONG_MSGS.length)];

  if (q.explanation) {
    const exp = document.getElementById('explanation');
    exp.innerHTML = '💡 ' + escapeHtml(q.explanation) + searchIconHtml(q.explanation);
    exp.className = 'explanation show';
  }

  ok ? soundCorrect() : soundWrong();

  document.getElementById('next-btn').style.display = 'none';
}

function submitTextAnswer() {
  if (answerInProgress) return; // 複数実行防止
  const input = document.getElementById('text-answer-input');
  const typed = input ? input.value : '';
  answerInProgress = true;

  const q = currentTest.questions[currentQ];
  const ok = isTextAnswerCorrect(q, typed);
  answers.push({ correct: ok, typedAnswer: typed });

  if (input) input.disabled = true;
  const submitBtn = document.getElementById('text-submit-btn');
  if (submitBtn) submitBtn.disabled = true;

  const isLast = currentQ === currentTest.questions.length - 1;
  const goNext = () => {
    soundClick();
    isLast ? showResults() : nextQuestion();
  };
  const nextLabel = isLast ? '➡️ 結果を見る' : '➡️ 次の問題';

  const nextIndicator = `<span class="next-indicator">${nextLabel}</span>`;
  const resultHtml = ok
    ? `<button class="text-answer-result correct" id="text-next-btn" disabled>✅ 正解！「${escapeHtml(typed)}」${nextIndicator}</button>`
    : `<button class="text-answer-result wrong" id="text-next-btn" disabled>❌ 正解: ${escapeHtml(q.correctText)}（あなたの回答: ${escapeHtml(typed || '(空欄)')}）${nextIndicator}</button>`;
  document.getElementById('choices').insertAdjacentHTML('beforeend', resultHtml);
  const nextBtn = document.getElementById('text-next-btn');
  nextBtn.onclick = goNext;
  // 答え合わせ表示後 0.5秒はクリック受け付けない
  setTimeout(() => { nextBtn.disabled = false; }, 500);

  const fb = document.getElementById('feedback');
  fb.className = `feedback ${ok ? 'correct' : 'wrong'}`;
  fb.textContent = ok ? CORRECT_MSGS[Math.floor(Math.random() * CORRECT_MSGS.length)] : WRONG_MSGS[Math.floor(Math.random() * WRONG_MSGS.length)];

  if (q.explanation) {
    const exp = document.getElementById('explanation');
    exp.innerHTML = '💡 ' + escapeHtml(q.explanation) + searchIconHtml(q.explanation);
    exp.className = 'explanation show';
  }

  ok ? soundCorrect() : soundWrong();

  document.getElementById('next-btn').style.display = 'none';
}

function nextQuestion() { currentQ++; renderQuestion(); }

async function showResults() {
  const total   = currentTest.questions.length;
  const correct = answers.filter(a => a.correct).length;
  const score   = Math.round((correct / total) * 100);
  const maxScore = 100;

  if (!isReviewMode && !isPracticeModeActive) {
    await recordTestResult(currentTest.id, score);
    await saveWrongAnswers(currentTest.id, answers, currentLevel);
    const best = await getBest(currentTest.id);
    const history = await getHistory(currentTest.id);
    const attemptCount = Math.max(getAttemptCount(currentTest.id), history.length);
    const bestCorrect = Math.round(best / 100 * total);
    document.getElementById('best-msg').textContent = `🏅 最高: ${bestCorrect}/${total}問 (${attemptCount}回)`;
    document.getElementById('best-msg').style.display = '';
  } else {
    document.getElementById('best-msg').style.display = 'none';
    await recordPracticeAttempt(currentTest.id);
  }

  document.getElementById('screen-quiz').classList.add('hidden');
  document.getElementById('screen-results').classList.remove('hidden');
  let resultTitle = currentTest.title + ' 結果 🎉';
  if (isReviewMode) resultTitle = currentTest.title + ' 復習結果';
  if (isPracticeModeActive) resultTitle = currentTest.title + ' 練習結果';
  document.getElementById('result-title').textContent = resultTitle;
  document.getElementById('result-part-label').textContent = getPartLabel(quizData[currentLevel], currentLevel);
  document.getElementById('score-num').innerHTML    = `<span class="score-main">${score}点</span> <span class="score-sub">(${correct}/${total})</span>`;

  const ratio = score / maxScore;
  const stars = ratio === 1 ? '⭐⭐⭐' : ratio >= 0.7 ? '⭐⭐' : ratio >= 0.4 ? '⭐' : '　';
  document.getElementById('score-stars').textContent = stars;
  document.getElementById('score-msg').textContent = ratio === 1 ? '🏆 満点！' : ratio >= 0.8 ? '🌟 すごい！' : ratio >= 0.6 ? '💪 惜しい！' : ratio >= 0.4 ? '📚 復習しよう' : '😅 もう一度';

  if (ratio === 1) { soundFanfare(); setTimeout(() => launchConfetti(80), 300); }
  else if (ratio >= 0.7) { soundGood(); setTimeout(() => launchConfetti(30), 300); }
  else soundClick();

  const wrongCount = answers.filter(a => !a.correct).length;
  const reviewBtn = document.getElementById('review-btn');
  if (wrongCount > 0) {
    const btnText = isReviewMode ? `🔁 もう一度復習 (${wrongCount}問)` : `🔁 間違えた ${wrongCount} 問を復習する`;
    reviewBtn.textContent = btnText;
    reviewBtn.style.display = '';
  } else {
    reviewBtn.style.display = 'none';
  }

  document.getElementById('answer-list').innerHTML = currentTest.questions.map((q, i) => {
    const ans = answers[i];
    const correctText = escapeHtml(isTextQuestion(q) ? q.correctText : (isJournalQuestion(q) ? journalText(q.choices[q.correct]) : q.choices[q.correct]));
    const chosenText = escapeHtml(isTextQuestion(q) ? (ans.typedAnswer || '(空欄)') : (isJournalQuestion(q) ? journalText(q.choices[ans.chosenOrigIdx]) : q.choices[ans.chosenOrigIdx]));
    let extra = `<div class="answer-correct">正解: ${correctText}</div>`;
    if (!ans.correct) extra += `<div class="answer-wrong">あなた: ${chosenText}</div>`;
    if (q.explanation) extra += `<div class="exp">💡 ${escapeHtml(q.explanation)}${searchIconHtml(q.explanation)}</div>`;
    return `<div class="answer-row-wrap">
      <div class="answer-row"><span class="q-num">Q${i + 1}</span><span class="mark">${ans.correct ? '✅' : '❌'}</span><div class="answer-detail"><span>${escapeHtml(q.scenario)}</span>${searchIconHtml(q.scenario)}</div></div>
      ${extra}
    </div>`;
  }).join('');
}

function startReview() {
  const wrongQuestions = currentTest.questions.filter((_, i) => !answers[i].correct);
  currentTest = { ...currentTest, questions: wrongQuestions };
  isReviewMode = true;
  isPracticeModeActive = false;
  currentQ = 0;
  answers = [];
  document.getElementById('screen-results').classList.add('hidden');
  document.getElementById('screen-quiz').classList.remove('hidden');
  renderQuestion();
}

// キーボードショートカット
document.addEventListener('keydown', (e) => {
  if (document.getElementById('screen-quiz').classList.contains('hidden')) return;
  const key = e.key.toLowerCase();
  const isText = isTextQuestion(currentTest.questions[currentQ]);

  if (isText) {
    // 記述式: 未回答時は入力欄でのEnterで送信、回答後はEnterで次へ
    if (!answerInProgress) {
      if (key === 'enter' && document.activeElement && document.activeElement.id === 'text-answer-input') {
        e.preventDefault();
        submitTextAnswer();
      }
    } else if (key === 'enter') {
      const nextBtn = document.getElementById('text-next-btn');
      if (nextBtn && !nextBtn.disabled) nextBtn.click();
    }
    return;
  }

  if (!answerInProgress) {
    // 回答前: a/b/c/d で選択
    const map = { 'a': 0, 'b': 1, 'c': 2, 'd': 3 };
    if (key in map) {
      const btn = document.getElementById(`choice-${map[key]}`);
      if (btn && !btn.disabled) btn.click();
    }
  } else if (key === 'enter') {
    // 回答後: Enter で次へ（0.5秒ガード中は disabled なので自然に弾かれる）
    for (let i = 0; i < 4; i++) {
      const btn = document.getElementById(`choice-${i}`);
      if (btn && !btn.disabled && (btn.classList.contains('correct') || btn.classList.contains('reveal'))) {
        btn.click();
        break;
      }
    }
  }
});

(function() {
  // メインメニュー（docs/index.html）には同じ処理の専用版（正しい相対パス './build-info.json'
  // を使う）が別途あるため、ここでは実行しない。ここで使う '../build-info.json' は
  // 教材ページ・管理画面（docs/{quiz}/、docs/admin/）からの相対パスとしてのみ正しい。
  if (document.getElementById('quiz-genre-nav')) return;

  const now = new Date();
  const jstTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  const year = jstTime.getFullYear();
  const isTouchDevice = () => {
    return (('ontouchstart' in window) ||
            (navigator.maxTouchPoints > 0) ||
            (navigator.msMaxTouchPoints > 0));
  };
  const deviceType = isTouchDevice() ? '📱 Touch' : '🖥️ PC';

  // Load build info from JSON
  // ?t=でキャッシュを避けているため、Service Workerのキャッシュフォールバックが
  // 効かない（毎回URLが変わりcaches.match()が一致しない）。通信が一瞬失敗しただけで
  // 「Unknown」と表示されないよう、前回成功した値をlocalStorageに残しておく。
  const BUILD_TIME_CACHE_KEY = 'lastKnownBuildTime';
  let buildTime = localStorage.getItem(BUILD_TIME_CACHE_KEY) || 'Loading...';
  fetch('../build-info.json?t=' + Date.now())
    .then(res => res.json())
    .then(data => {
      buildTime = data.buildTime;
      localStorage.setItem(BUILD_TIME_CACHE_KEY, buildTime);
      updateBuildTimeDisplay();
    })
    .catch(err => {
      buildTime = localStorage.getItem(BUILD_TIME_CACHE_KEY) || 'Unknown';
      updateBuildTimeDisplay();
    });

  function updateBuildTimeDisplay() {
    const timeEl = document.getElementById('build-time-display') || createBuildTimeDisplay();
    timeEl.innerHTML = `ビルド: ${buildTime}　${deviceType}`;
  }

  function createBuildTimeDisplay() {
    const timeEl = document.createElement('div');
    timeEl.id = 'build-time-display';
    // .containerに紐付けて配置する（position:fixedでビューポート基準にすると、
    // ウィンドウ幅によって中央寄せされたカードとの距離感がバラバラになるため）
    timeEl.style.position = 'absolute';
    timeEl.style.bottom = '10px';
    timeEl.style.left = '10px';
    timeEl.style.fontSize = '14px';
    timeEl.style.color = '#999';
    timeEl.style.zIndex = '9999';
    timeEl.style.pointerEvents = 'none';
    timeEl.style.lineHeight = '1.4';
    timeEl.style.whiteSpace = 'nowrap';
    (document.querySelector('.container') || document.body).appendChild(timeEl);

    // 試験中・結果画面では邪魔になるので隠す（メインメニューにはこの2画面が
    // 存在しないため、そちらでは常に表示されたままになる）
    const quizEl = document.getElementById('screen-quiz');
    const resultsEl = document.getElementById('screen-results');
    if (quizEl || resultsEl) {
      const syncVisibility = () => {
        const hide = (quizEl && !quizEl.classList.contains('hidden')) ||
                     (resultsEl && !resultsEl.classList.contains('hidden'));
        timeEl.style.display = hide ? 'none' : '';
      };
      [quizEl, resultsEl].filter(Boolean).forEach(el => {
        new MutationObserver(syncVisibility).observe(el, { attributes: true, attributeFilter: ['class'] });
      });
      syncVisibility();
    }

    return timeEl;
  }

  // Create initial display
  createBuildTimeDisplay();
  updateBuildTimeDisplay();
})();
