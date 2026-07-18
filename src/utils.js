// Utility functions extracted from HTML files for testing

// Format currency
function fmt(n) {
  return '¥' + n.toLocaleString();
}

// Shuffle array using Fisher-Yates algorithm
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Calculate total questions from test array
function calculateTotalQuestions(tests) {
  if (!tests || !Array.isArray(tests)) return 0;
  return tests.reduce((sum, test) => sum + test.questions.length, 0);
}

// Render journal entry for accounting
function renderJournal(entry) {
  if (!entry || !entry.debit || !entry.credit) return '';
  const dLines = entry.debit.map(e =>
    `<div class="entry-item journal-debit"><span>${e.account}</span><span>${fmt(e.amount)}</span></div>`
  ).join('');
  const cLines = entry.credit.map(e =>
    `<div class="entry-item journal-credit"><span>${e.account}</span><span>${fmt(e.amount)}</span></div>`
  ).join('');
  return `<div class="journal">
    <div><div class="journal-header">借方（左）</div><div class="entry-line">${dLines}</div></div>
    <div class="journal-sep">｜</div>
    <div><div class="journal-header">貸方（右）</div><div class="entry-line">${cLines}</div></div>
  </div>`;
}

// Convert journal entry to text format
function journalText(entry) {
  if (!entry || !entry.debit || !entry.credit) return '';
  return '借: ' + entry.debit.map(e=>`${e.account} ${fmt(e.amount)}`).join('・')
       + ' ／ 貸: ' + entry.credit.map(e=>`${e.account} ${fmt(e.amount)}`).join('・');
}

// Parse score from percentage
function parseScore(percentage, totalQuestions = 10) {
  if (percentage < 0) return -1;
  return Math.round(percentage / 100 * totalQuestions);
}

// Get star rating based on ratio
function getStarRating(ratio) {
  if (ratio === 1) return '⭐⭐⭐';
  if (ratio >= 0.7) return '⭐⭐';
  if (ratio >= 0.4) return '⭐';
  return '　';
}

// Get message based on score ratio
function getScoreMessage(ratio) {
  if (ratio === 1) return '🏆 満点！';
  if (ratio >= 0.8) return '🌟 すごい！';
  if (ratio >= 0.6) return '💪 惜しい！';
  if (ratio >= 0.4) return '📚 復習しよう';
  return '😅 もう一度';
}

// Determine whether a question is a free-text (記述式) question
function isTextQuestion(q) {
  return q.type === 'text';
}

// Normalize free-text answers for comparison (NFKC + whitespace strip + lowercase)
function normalizeAnswerText(s) {
  return String(s)
    .normalize('NFKC')
    .replace(/[　\s]+/g, '')
    .toLowerCase();
}

// Check whether a typed answer matches the correct answer or one of its accepted variants
function isTextAnswerCorrect(q, typed) {
  const candidates = [q.correctText, ...(q.acceptedAnswers || [])];
  const normTyped = normalizeAnswerText(typed);
  return candidates.some(c => normalizeAnswerText(c) === normTyped);
}

// Validate quiz data structure
function isValidQuizData(data) {
  if (!data || typeof data !== 'object') return false;
  if (!data.id || typeof data.id !== 'string') return false;
  if (!data.tests || !Array.isArray(data.tests)) return false;
  return data.tests.every(test =>
    test.id && test.title && Array.isArray(test.questions)
  );
}

// Validate test structure
function isValidTest(test) {
  if (!test || typeof test !== 'object') return false;
  if (!test.id || !test.title) return false;
  if (!Array.isArray(test.questions)) return false;
  return test.questions.every(q =>
    q.scenario !== undefined && Array.isArray(q.choices) && q.correct !== undefined
  );
}

module.exports = {
  fmt,
  shuffle,
  calculateTotalQuestions,
  renderJournal,
  journalText,
  parseScore,
  getStarRating,
  getScoreMessage,
  isValidQuizData,
  isValidTest,
  isTextQuestion,
  normalizeAnswerText,
  isTextAnswerCorrect,
};
