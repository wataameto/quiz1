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

let currentUser = null;
let bestScores = {};
let cacheInitialized = false;

// ===== 表示サイズ設定（端末ごとにlocalStorageで保持） =====
const FONT_SIZE_KEY = 'quizFontSize';
const FONT_SIZES = { xxs: '70%', xs: '80%', s: '90%', m: '100%', l: '115%' };
const FONT_SIZE_LEGACY = { small: 's', medium: 'm', large: 'l', xl: 'l' }; // 旧段階からの移行

function applyFontSizePref() {
  let size = localStorage.getItem(FONT_SIZE_KEY) || 'm';
  if (FONT_SIZE_LEGACY[size]) size = FONT_SIZE_LEGACY[size];
  document.documentElement.style.fontSize = FONT_SIZES[size] || FONT_SIZES.m;
  Object.keys(FONT_SIZES).forEach(s => {
    const btn = document.getElementById(`font-size-btn-${s}`);
    if (btn) btn.style.borderColor = s === size ? '#667eea' : 'transparent';
  });
}

function setFontSize(size) {
  if (!FONT_SIZES[size]) return;
  localStorage.setItem(FONT_SIZE_KEY, size);
  applyFontSizePref();
  soundClick();
}

applyFontSizePref();

auth.onAuthStateChanged(user => {
  currentUser = user || null;
  cacheInitialized = false;
  bestScores = {};
  renderAuthStatus();
  // 認証状態に関わらず初期化を実行
  loadAllQuestions();
});

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
    el.innerHTML = `<span class="user-chip">👤 <span class="user-name" id="auth-status-name"></span><button class="btn-logout-inline" onclick="logout()">ログアウト</button></span>`;
    document.getElementById('auth-status-name').textContent = currentUser.displayName || 'ユーザー';
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

function launchConfetti(count = 60) {
  const wrap = document.getElementById('confetti-wrap');
  wrap.innerHTML = '';
  const colors = ['#f7971e','#ffd200','#21d4fd','#b721ff','#0f2027','#38a169','#f5576c'];
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'confetti-piece';
    el.style.left = Math.random() * 100 + 'vw';
    el.style.background = colors[Math.floor(Math.random() * colors.length)];
    el.style.animationDuration = (1.5 + Math.random() * 2) + 's';
    el.style.animationDelay = (Math.random() * 0.8) + 's';
    el.style.width = el.style.height = (6 + Math.random() * 8) + 'px';
    el.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
    wrap.appendChild(el);
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

async function loadAllQuestions() {
  try {
    // config.json を読み込む
    const configRes = await fetch('../config.json?t=' + Date.now());
    const configData = await configRes.json();

    // 各レベルを1回のfetchで読み込みつつ、次のレベルの有無を検出する
    // （レベル1は必須。レベル2以降は存在しなければそこで打ち切り）
    maxLevel = 0;
    for (let level = 1; ; level++) {
      let res;
      if (level === 1) {
        res = await fetch(`questions${level}.json?t=${Date.now()}`);
      } else {
        try {
          res = await fetch(`questions${level}.json?t=${Date.now()}`);
        } catch (e) {
          break; // 次のレベルが存在しない
        }
        if (!res.ok) break; // 次のレベルが存在しない
      }
      if (level === 1 && !res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      if (!data || !data.tests || !Array.isArray(data.tests)) {
        throw new Error(`Invalid data at level ${level}`);
      }
      quizData[level] = data;
      maxLevel = level;
      if (!quizId) {
        quizId = data.id; // 最初のデータから quizId を取得
        // config から title, colors などを動的に設定
        if (configData[quizId]) {
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
            .btn-home { background: ${cfg.topGradient}; color: #2d3748; }
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
      }
    }

    currentLevel = 1;
    if (isAdminMode) {
      showAdmin();
    } else {
      loadQuestions(1);
    }
  } catch (e) {
    console.error('Failed to load questions:', e);
    TESTS = [];
    document.getElementById('screen-home').classList.remove('hidden');
    document.getElementById('screen-quiz').classList.add('hidden');
    document.getElementById('screen-results').classList.add('hidden');
    document.getElementById('screen-admin').classList.add('hidden');
    document.getElementById('test-grid').innerHTML = '<p style="color:#e53e3e;padding:15px;text-align:center;">問題ファイルの読み込みに失敗: ' + e.message + '</p>';
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
    document.getElementById('test-grid').innerHTML = '<p style="color:#e53e3e;padding:15px;text-align:center;">問題の読み込みに失敗しました</p>';
  }
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
    const partLabel = levelData.description || levelData.label || `パート ${level}`;
    lines.push(`## ${partLabel}`);

    for (const test of levelData.tests) {
      const countLabel = Array.isArray(test.questions) ? `${test.questions.length}問` : '0問';
      lines.push('');
      lines.push(`### ${test.title} ${test.type || ''} / ${countLabel}`);

      test.questions.forEach((question, qIndex) => {
        lines.push('');
        lines.push(`Q${qIndex + 1}. ${question.scenario}`);
        question.choices.forEach((choice, choiceIndex) => {
          const isCorrect = choiceIndex === question.correct;
          const label = String.fromCharCode(65 + choiceIndex);
          const choiceText = question.type === 'journal' ? journalText(choice) : choice;
          lines.push(`${isCorrect ? '*' : ' '} ${label}. ${choiceText}`);
        });
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
    descEl.textContent = levelData.description || '各10問・100点満点';
  }
}

function switchLevel(level) {
  if (level === currentLevel || level < 1 || level > maxLevel) return;
  currentLevel = level;
  updatePartBadge();
  loadQuestions(level);
}

let homeCollapsed = true; // 現在パートのセット一覧を閉じているか

function toggleLevel(level) {
  soundClick();
  if (level === currentLevel) {
    homeCollapsed = !homeCollapsed;
    showHome();
  } else {
    homeCollapsed = false;
    switchLevel(level);
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

function getCollectionName() {
  // quizId（boki1 or devops）をコレクション名に変換
  return `quiz_${quizId}`;
}

async function initializeBestScoresCache() {
  if (cacheInitialized || !currentUser) return;
  try {
    const collection = getCollectionName();
    const doc = await db.collection(collection).doc(currentUser.uid).get();
    const scores = doc.exists ? doc.data() : {};
    bestScores = scores;
    cacheInitialized = true;
  } catch (e) { console.error(e); }
}

// ===== 解答記録と復習機能 =====

function saveWrongAnswersKey(level, testId) {
  return `wrongAnswers_${level}_${testId}`;
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

    const collection = getCollectionName();
    const key = saveWrongAnswersKey(level, testId);

    await db.collection(collection).doc(currentUser.uid).set(
      { [key]: wrongQuestionNumbers },
      { merge: true }
    );
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
  const v = bestScores[`best_${level}_${id}`];
  return (v === undefined || v === null) ? -1 : parseInt(v, 10);
}

function historyKey(level, id) {
  return `history_${level}_${id}`;
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

// 試験モード完走のたびに、日時付きで履歴に積み、必要なら最高得点も更新する
async function recordTestResult(id, s) {
  if (!currentUser) return;
  if (!cacheInitialized) {
    await initializeBestScoresCache();
  }
  try {
    const bestField = `best_${currentLevel}_${id}`;
    const historyField = historyKey(currentLevel, id);
    const best = await getBest(id);
    const history = await getHistory(id);
    const updatedHistory = [...history, { score: s, date: nowJstString() }];

    const updates = { [historyField]: updatedHistory };
    if (s > best) updates[bestField] = s;

    const collection = getCollectionName();
    await db.collection(collection).doc(currentUser.uid).set(updates, { merge: true });
    Object.assign(bestScores, updates);
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

async function showScoreHistory() {
  closeScoreModal();
  if (!cacheInitialized) await initializeBestScoresCache();
  const labelEl = document.getElementById('history-part-label');
  if (labelEl) labelEl.textContent = '全パート';

  const listEl = document.getElementById('history-list');
  if (listEl) listEl.innerHTML = '<p style="text-align:center; color:#a0aec0;">読み込み中…</p>';

  const partSections = [];
  let earliestDate = null; // 初めてどれか1セットを終えた日時＝1周目開始日時

  for (let level = 1; level <= maxLevel; level++) {
    const levelData = quizData[level];
    if (!levelData) continue;
    const partLabel = levelData.description || levelData.label || `パート ${level}`;
    const tests = levelData.tests || [];

    const setSections = [];
    for (const t of tests) {
      const history = await getHistory(t.id, level);
      const qCount = Array.isArray(t.questions) ? t.questions.length : 10;
      history.forEach(h => {
        const ts = parseJstDateString(h.date);
        if (ts !== null && (earliestDate === null || ts < earliestDate.ts)) {
          earliestDate = { ts, date: h.date };
        }
      });
      const entriesHtml = history.length
        ? [...history].reverse().map(h =>
            `<div style="display:flex; justify-content:space-between; padding:4px 0; font-size:0.85rem; color:#4a5568;"><span>${escapeHtml(h.date)}</span><span style="font-weight:700;">${Math.round(h.score / 100 * qCount)}/${qCount}問</span></div>`
          ).join('')
        : `<p style="font-size:0.82rem; color:#a0aec0; padding:4px 0; margin:0;">まだ記録がありません</p>`;
      setSections.push(
        `<div style="margin-bottom:14px;"><div style="font-weight:800; color:#2d3748; margin-bottom:4px;">${escapeHtml(t.title || '')}（${history.length}回）</div>${entriesHtml}</div>`
      );
    }

    partSections.push(
      `<div style="margin-bottom:20px;"><div style="font-size:0.95rem; font-weight:800; color:#7c3a00; background:linear-gradient(135deg, #fff3e0, #ffe8cc); border-radius:8px; padding:8px 12px; margin-bottom:10px;">${escapeHtml(partLabel)}</div>${setSections.join('')}</div>`
    );
  }

  const lapHistory = getLapHistory();
  if (lapHistory.length > 0 || earliestDate) {
    const lapEntries = [];
    if (earliestDate) lapEntries.push({ date: earliestDate.date, label: '🌟 1周目開始' });
    lapHistory.forEach(h => lapEntries.push({ date: h.date, label: `🌟 ${h.lap + 1}周目へ` }));
    const lapEntriesHtml = [...lapEntries].reverse().map(e =>
      `<div style="display:flex; justify-content:space-between; padding:4px 0; font-size:0.85rem; color:#4a5568;"><span>${escapeHtml(e.date)}</span><span style="font-weight:700;">${e.label}</span></div>`
    ).join('');
    partSections.unshift(
      `<div style="margin-bottom:20px;"><div style="font-size:0.95rem; font-weight:800; color:#7c4a00; background:linear-gradient(135deg, #fffbea, #fff3c4); border-radius:8px; padding:8px 12px; margin-bottom:10px;">🌟 周回履歴</div>${lapEntriesHtml}</div>`
    );
  }
  if (listEl) listEl.innerHTML = partSections.join('') || '<p>パートがありません</p>';

  const modal = document.getElementById('history-modal');
  if (modal) modal.style.display = 'flex';
}

function closeHistoryModal() {
  const modal = document.getElementById('history-modal');
  if (modal) modal.style.display = 'none';
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

async function resetCurrentLevel() {
  if (!currentUser) return;
  closeResetModal();
  try {
    const collection = getCollectionName();
    const doc = db.collection(collection).doc(currentUser.uid);
    const snapshot = await doc.get();
    const fieldsToDelete = {};
    if (!quizData[currentLevel] || !quizData[currentLevel].tests) return;
    for (const t of quizData[currentLevel].tests) {
      fieldsToDelete[`best_${currentLevel}_${t.id}`] = firebase.firestore.FieldValue.delete();
      fieldsToDelete[`wrongAnswers_${currentLevel}_${t.id}`] = firebase.firestore.FieldValue.delete();
      fieldsToDelete[historyKey(currentLevel, t.id)] = firebase.firestore.FieldValue.delete();
    }
    if (snapshot.exists) {
      await doc.update(fieldsToDelete);
    }
    // キャッシュから削除
    for (const t of quizData[currentLevel].tests) {
      delete bestScores[`best_${currentLevel}_${t.id}`];
      delete bestScores[`wrongAnswers_${currentLevel}_${t.id}`];
      delete bestScores[historyKey(currentLevel, t.id)];
    }
    soundClick(); showHome();
  } catch (e) { console.error(e); }
}

async function resetAllLevels() {
  if (!currentUser) return;
  closeResetModal();
  try {
    const collection = getCollectionName();
    await db.collection(collection).doc(currentUser.uid).delete();
    bestScores = {};
    cacheInitialized = false;
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

async function isFullyCleared() {
  if (!currentUser) return false;
  if (!cacheInitialized) await initializeBestScoresCache();
  let sawAnyTest = false;
  for (let level = 1; level <= maxLevel; level++) {
    if (!quizData[level] || !quizData[level].tests) continue;
    for (const t of quizData[level].tests) {
      sawAnyTest = true;
      const best = await getBest(t.id, level);
      if (best !== 100) return false;
    }
  }
  return sawAnyTest; // テストが1つも無ければ「クリア」扱いにしない
}

function getLap() {
  const v = bestScores['lap'];
  return (v === undefined || v === null) ? 0 : parseInt(v, 10);
}

// 全問正解を達成した状態で呼ばれる。既存のbest/history/wrongAnswersは一切変更せず、
// 周回数(lap)だけを加算する。best_が消えない限り何度でも呼べる設計。
// 2周目に入る＝各セットの最高点・誤答記録を振り出しに戻す（挑戦履歴histoy_だけは残す）。
// これで「もう一度全問正解を取り直す」という周回の実感が出る。
function getLapHistory() {
  const h = bestScores['lapHistory'];
  return Array.isArray(h) ? h : [];
}

async function advanceLap() {
  if (!currentUser) return;
  if (!cacheInitialized) await initializeBestScoresCache();
  try {
    const newLap = getLap() + 1;
    const newLapHistory = [...getLapHistory(), { lap: newLap, date: nowJstString() }];
    const fieldsToDelete = { lap: newLap, lapHistory: newLapHistory };
    for (let level = 1; level <= maxLevel; level++) {
      if (!quizData[level] || !quizData[level].tests) continue;
      for (const t of quizData[level].tests) {
        fieldsToDelete[`best_${level}_${t.id}`] = firebase.firestore.FieldValue.delete();
        fieldsToDelete[`wrongAnswers_${level}_${t.id}`] = firebase.firestore.FieldValue.delete();
      }
    }
    const collection = getCollectionName();
    await db.collection(collection).doc(currentUser.uid).set(fieldsToDelete, { merge: true });
    // ローカルキャッシュも同期: best_/wrongAnswers_は削除、lap/lapHistoryだけ更新
    Object.keys(fieldsToDelete).forEach(key => {
      if (key === 'lap') { bestScores.lap = newLap; return; }
      if (key === 'lapHistory') { bestScores.lapHistory = newLapHistory; return; }
      delete bestScores[key];
    });
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
  const bannerEl = document.getElementById('full-clear-banner');
  if (bannerEl) {
    let bannerHtml = '';
    if (lap > 0) bannerHtml += `<div class="full-clear-badge">🌟 全クリア ×${lap}</div>`;
    if (fullyCleared) {
      bannerHtml += `<div class="full-clear-celebrate">
        <p>🎉 全問正解達成！</p>
        <button onclick="advanceLap()">🏁 次の周へ進む</button>
      </div>`;
    }
    bannerEl.innerHTML = bannerHtml;
    bannerEl.style.display = bannerHtml ? 'block' : 'none';
  }

  const currentLevelData = quizData[currentLevel];
  const currentPartLabel = currentLevelData?.description || currentLevelData?.label || `パート ${currentLevel}`;
  const currentPartCard = document.getElementById('current-part-card');

  const unitName = quizId === 'kokyo1' ? 'プリント' : 'セット';

  // レベル別スコアを計算・表示
  const partScoresSection = document.getElementById('part-scores-section');
  const partScoresList = document.getElementById('part-scores-list');

  if (maxLevel > 1) {
    if (currentPartCard) currentPartCard.style.display = 'none';

    let partScoresHtml = '';

    for (let level = 1; level <= maxLevel; level++) {
      const levelData = quizData[level];
      if (!levelData || !levelData.tests) continue;

      let levelCorrect = 0;
      const levelQuestions = levelData.tests.reduce((sum, test) => (
        sum + (Array.isArray(test.questions) ? test.questions.length : 0)
      ), 0);

      for (const t of levelData.tests) {
        const best = await getBest(t.id, level);
        if (best >= 0) {
          const qCount = Array.isArray(t.questions) ? t.questions.length : 10;
          levelCorrect += Math.round(best / 100 * qCount);
        }
      }

      const levelLabel = levelData.description || levelData.label || `レベル ${level}`;
      const isOpen = level === currentLevel && !homeCollapsed;
      const blockClass = `part-block${isOpen ? ' open' : ''}${level === currentLevel ? ' active' : ''}`;
      const setRowsHtml = await buildSetRowsHtml(levelData.tests, level, levelLabel, unitName);

      partScoresHtml += `<div class="${blockClass}">
        <div class="part-score-row" onclick="toggleLevel(${level});">
          <span class="part-name">${levelLabel}</span>
          <span class="part-value">${levelCorrect}/${levelQuestions}問</span>
          <span class="part-arrow">▶</span>
        </div>
        <div class="part-set-list">${setRowsHtml}</div>
      </div>`;
    }

    partScoresList.innerHTML = partScoresHtml;
    partScoresSection.style.display = 'block';
    document.getElementById('test-grid').innerHTML = '';
  } else {
    partScoresSection.style.display = 'none';

    if (currentLevelData && currentPartCard) {
      currentPartCard.innerHTML = `<strong>現在のパート：${currentPartLabel}</strong>`;
      currentPartCard.style.display = 'block';
    } else if (currentPartCard) {
      currentPartCard.style.display = 'none';
    }

    document.getElementById('test-grid').innerHTML = await buildSetRowsHtml(TESTS, currentLevel, currentPartLabel, unitName);
  }
}

async function buildSetRowsHtml(tests, level, partLabel, unitName) {
  let html = '';
  for (const t of tests) {
    const best = await getBest(t.id, level);
    const questionCount = Array.isArray(t.questions) ? t.questions.length : 10;

    // 復習問題の数を取得
    const wrongIndices = await getWrongAnswerIds(t.id, level);
    const reviewCount = wrongIndices.length;

    // 2つ目のボタン：誤答があれば誤答復習、なければ演習モード（どちらも記録なし）
    const secondaryBtn = reviewCount > 0
      ? `<button class="set-review-btn" onclick="goToTest(${level}, ${t.id}, true, false);"><span class="btn-title">誤答復習(${reviewCount}問)</span><span class="btn-sub">記録なし</span></button>`
      : `<button class="set-practice-btn" onclick="goToTest(${level}, ${t.id}, false, true);"><span class="btn-title">演習モード</span><span class="btn-sub">記録なし</span></button>`;

    const bestCorrect = Math.round(best / 100 * questionCount);
    const scoreText = best >= 0 ? `🏆 最高 <span>${bestCorrect}/${questionCount}問</span>` : '🔰 未挑戦';

    html += `<div class="part-set-row">
      <span class="set-icon">${t.emoji}</span>
      <div class="set-main">
        <div class="set-name"><span class="set-icon-inline">${t.emoji}</span>${unitName}${t.id}　${t.type || ''}</div>
        <div class="set-sub">${escapeHtml(t.subtitle || partLabel)} ・ ${questionCount}問</div>
      </div>
      <div class="set-meta">
        <div class="set-score">${scoreText}</div>
        <div class="set-actions">
          <button class="set-exam-btn" onclick="goToTest(${level}, ${t.id}, false, false);"><span class="btn-title">試験モード</span><span class="btn-sub">記録あり</span></button>
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
  const isJ = q.type === 'journal'; // 仕訳問題判定
  const pct = Math.round((currentQ / total) * 100);

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

  const indexed = shuffle(q.choices.map((c, i) => ({ choice: c, origIdx: i })));
  shuffledChoices = indexed;
  const correctShuffledIdx = indexed.findIndex(x => x.origIdx === q.correct);

  choicesEl.innerHTML = indexed.map((item, i) => {
    const label = String.fromCharCode(97 + i); // a, b, c, d
    const choiceHtml = isJ ? renderJournal(item.choice) : escapeHtml(item.choice);
    const searchText = isJ ? journalText(item.choice) : item.choice;
    return `<div class="choice-row"><button class="choice-btn" onclick="answer(${i},${correctShuffledIdx})" id="choice-${i}" disabled><span class="choice-text">${label}. ${choiceHtml}</span>${searchIconHtml(searchText, true)}</button></div>`;
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
  const nextLabel = isLast ? '→ 結果を見る' : '→ 次の問題';
  if (ok) {
    ansBtn.innerHTML = `<span>${ansBtn.querySelector('.choice-text').textContent}</span><span class="next-indicator">${nextLabel}</span>`;
    ansBtn.onclick = goNext;
    ansBtn.onkeydown = goNext;
    // 答え合わせ表示後 0.5秒はクリック受け付けない
    setTimeout(() => { ansBtn.disabled = false; }, 500);
  }
  const correctBtn = document.getElementById(`choice-${correctIdx}`);
  if (!ok) {
    correctBtn.classList.add('reveal');
    correctBtn.innerHTML = `<span>${correctBtn.querySelector('.choice-text').textContent}</span><span class="next-indicator">${nextLabel}</span>`;
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
    document.getElementById('best-msg').textContent = `🏅 最高: ${best}点 / ${history.length}回`;
    document.getElementById('best-msg').style.display = '';
  } else {
    document.getElementById('best-msg').style.display = 'none';
  }

  document.getElementById('screen-quiz').classList.add('hidden');
  document.getElementById('screen-results').classList.remove('hidden');
  let resultTitle = currentTest.title + ' 結果 🎉';
  if (isReviewMode) resultTitle = currentTest.title + ' 復習結果';
  if (isPracticeModeActive) resultTitle = currentTest.title + ' 練習結果';
  document.getElementById('result-title').textContent = resultTitle;
  document.getElementById('score-num').innerHTML    = `<span class="score-main">${score}</span><span class="score-sub"> / ${maxScore}点</span>`;

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
    const correctText = escapeHtml(q.type === 'journal' ? journalText(q.choices[q.correct]) : q.choices[q.correct]);
    const chosenText = escapeHtml(q.type === 'journal' ? journalText(q.choices[ans.chosenOrigIdx]) : q.choices[ans.chosenOrigIdx]);
    let detail = `<span>${escapeHtml(q.scenario)}</span>${searchIconHtml(q.scenario)}<br><span style="color:#555;font-size:0.82rem">正解: ${correctText}</span>`;
    if (!ans.correct) detail += `<br><span style="color:#e53e3e;font-size:0.82rem">あなた: ${chosenText}</span>`;
    if (q.explanation) detail += `<div class="exp">💡 ${escapeHtml(q.explanation)}${searchIconHtml(q.explanation)}</div>`;
    return `<div class="answer-row"><span class="q-num">Q${i + 1}</span><span class="mark">${ans.correct ? '✅' : '❌'}</span><div class="answer-detail">${detail}</div></div>`;
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
  let buildTime = 'Loading...';
  fetch('../build-info.json?t=' + Date.now())
    .then(res => res.json())
    .then(data => {
      buildTime = data.buildTime;
      updateBuildTimeDisplay();
    })
    .catch(err => {
      buildTime = 'Unknown';
      updateBuildTimeDisplay();
    });

  function updateBuildTimeDisplay() {
    const timeEl = document.getElementById('build-time-display') || createBuildTimeDisplay();
    timeEl.innerHTML = `ビルド: ${buildTime}　${deviceType}`;
  }

  function createBuildTimeDisplay() {
    const timeEl = document.createElement('div');
    timeEl.id = 'build-time-display';
    timeEl.style.position = 'fixed';
    timeEl.style.bottom = '10px';
    timeEl.style.left = '10px';
    timeEl.style.fontSize = '14px';
    timeEl.style.color = '#999';
    timeEl.style.zIndex = '9999';
    timeEl.style.pointerEvents = 'none';
    timeEl.style.lineHeight = '1.4';
    timeEl.style.whiteSpace = 'nowrap';
    document.body.appendChild(timeEl);
    return timeEl;
  }

  // Create initial display
  createBuildTimeDisplay();
  updateBuildTimeDisplay();
})();
