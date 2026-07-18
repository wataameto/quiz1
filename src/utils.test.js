const {
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
} = require('./utils');

// ============================================================
// fmt() Tests - Currency formatting
// ============================================================
describe('fmt - Currency formatting', () => {
  test('should format number with yen symbol', () => {
    expect(fmt(1000)).toBe('¥1,000');
  });

  test('should handle zero', () => {
    expect(fmt(0)).toBe('¥0');
  });

  test('should handle large numbers', () => {
    expect(fmt(1000000)).toBe('¥1,000,000');
  });

  test('should handle small numbers', () => {
    expect(fmt(100)).toBe('¥100');
  });
});

// ============================================================
// shuffle() Tests - Array shuffling
// ============================================================
describe('shuffle - Array shuffling', () => {
  test('should return array with same length', () => {
    const arr = [1, 2, 3, 4, 5];
    const shuffled = shuffle(arr);
    expect(shuffled.length).toBe(arr.length);
  });

  test('should contain same elements', () => {
    const arr = ['a', 'b', 'c', 'd'];
    const shuffled = shuffle(arr);
    expect(shuffled.sort()).toEqual(arr.sort());
  });

  test('should not modify original array', () => {
    const original = [1, 2, 3, 4, 5];
    const originalCopy = [...original];
    shuffle(original);
    expect(original).toEqual(originalCopy);
  });

  test('should handle empty array', () => {
    expect(shuffle([])).toEqual([]);
  });

  test('should handle single element', () => {
    expect(shuffle([1])).toEqual([1]);
  });

  test('should shuffle effectively (probabilistic test)', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    let differences = 0;
    const iterations = 100;

    for (let i = 0; i < iterations; i++) {
      const shuffled = shuffle(arr);
      for (let j = 0; j < arr.length; j++) {
        if (arr[j] !== shuffled[j]) differences++;
      }
    }

    // Should have some differences (statistically very likely)
    expect(differences).toBeGreaterThan(0);
  });
});

// ============================================================
// calculateTotalQuestions() Tests
// ============================================================
describe('calculateTotalQuestions - Calculate total question count', () => {
  test('should return 0 for empty tests array', () => {
    expect(calculateTotalQuestions([])).toBe(0);
  });

  test('should return 0 for null', () => {
    expect(calculateTotalQuestions(null)).toBe(0);
  });

  test('should return 0 for undefined', () => {
    expect(calculateTotalQuestions(undefined)).toBe(0);
  });

  test('should calculate total questions correctly', () => {
    const tests = [
      { questions: [{ id: 1 }, { id: 2 }] },
      { questions: [{ id: 3 }, { id: 4 }, { id: 5 }] },
    ];
    expect(calculateTotalQuestions(tests)).toBe(5);
  });

  test('should handle single test', () => {
    const tests = [{ questions: [{}, {}, {}] }];
    expect(calculateTotalQuestions(tests)).toBe(3);
  });

  test('should handle tests with no questions', () => {
    const tests = [{ questions: [] }, { questions: [{}, {}] }];
    expect(calculateTotalQuestions(tests)).toBe(2);
  });
});

// ============================================================
// renderJournal() Tests
// ============================================================
describe('renderJournal - Render journal entry', () => {
  test('should render journal with valid entry', () => {
    const entry = {
      debit: [{ account: '現金', amount: 10000 }],
      credit: [{ account: '売上', amount: 10000 }],
    };
    const result = renderJournal(entry);
    expect(result).toContain('現金');
    expect(result).toContain('売上');
    expect(result).toContain('¥10,000');
  });

  test('should include journal class', () => {
    const entry = {
      debit: [{ account: '現金', amount: 1000 }],
      credit: [{ account: '売上', amount: 1000 }],
    };
    const result = renderJournal(entry);
    expect(result).toContain('class="journal"');
  });

  test('should handle multiple debit entries', () => {
    const entry = {
      debit: [
        { account: '現金', amount: 5000 },
        { account: '売掛金', amount: 5000 },
      ],
      credit: [{ account: '売上', amount: 10000 }],
    };
    const result = renderJournal(entry);
    expect(result).toContain('現金');
    expect(result).toContain('売掛金');
  });

  test('should return empty string for invalid entry', () => {
    expect(renderJournal(null)).toBe('');
    expect(renderJournal({})).toBe('');
    expect(renderJournal(undefined)).toBe('');
  });
});

// ============================================================
// journalText() Tests
// ============================================================
describe('journalText - Journal text format', () => {
  test('should format journal as text', () => {
    const entry = {
      debit: [{ account: '現金', amount: 10000 }],
      credit: [{ account: '売上', amount: 10000 }],
    };
    const result = journalText(entry);
    expect(result).toContain('借:');
    expect(result).toContain('貸:');
    expect(result).toContain('現金');
    expect(result).toContain('売上');
  });

  test('should use ・ as separator for multiple entries', () => {
    const entry = {
      debit: [
        { account: '現金', amount: 5000 },
        { account: '売掛金', amount: 5000 },
      ],
      credit: [{ account: '売上', amount: 10000 }],
    };
    const result = journalText(entry);
    expect(result).toContain('・');
  });

  test('should return empty string for invalid entry', () => {
    expect(journalText(null)).toBe('');
    expect(journalText({})).toBe('');
    expect(journalText(undefined)).toBe('');
  });
});

// ============================================================
// parseScore() Tests
// ============================================================
describe('parseScore - Parse percentage score', () => {
  test('should return 10 for 100%', () => {
    expect(parseScore(100)).toBe(10);
  });

  test('should return 5 for 50%', () => {
    expect(parseScore(50)).toBe(5);
  });

  test('should return 0 for 0%', () => {
    expect(parseScore(0)).toBe(0);
  });

  test('should round down 15% to 2', () => {
    expect(parseScore(15)).toBe(2);
  });

  test('should return -1 for negative percentage', () => {
    expect(parseScore(-1)).toBe(-1);
  });

  test('should handle decimal percentages', () => {
    expect(parseScore(33.3)).toBe(3);
  });
});

// ============================================================
// getStarRating() Tests
// ============================================================
describe('getStarRating - Get star rating', () => {
  test('should return 3 stars for perfect score', () => {
    expect(getStarRating(1)).toBe('⭐⭐⭐');
  });

  test('should return 2 stars for 70% or more', () => {
    expect(getStarRating(0.7)).toBe('⭐⭐');
    expect(getStarRating(0.9)).toBe('⭐⭐');
  });

  test('should return 1 star for 40-69%', () => {
    expect(getStarRating(0.4)).toBe('⭐');
    expect(getStarRating(0.6)).toBe('⭐');
  });

  test('should return blank for below 40%', () => {
    expect(getStarRating(0.39)).toBe('　');
    expect(getStarRating(0)).toBe('　');
  });
});

// ============================================================
// getScoreMessage() Tests
// ============================================================
describe('getScoreMessage - Get score message', () => {
  test('should return 🏆 for perfect score', () => {
    expect(getScoreMessage(1)).toBe('🏆 満点！');
  });

  test('should return 🌟 for 80% or more', () => {
    expect(getScoreMessage(0.8)).toBe('🌟 すごい！');
    expect(getScoreMessage(0.9)).toBe('🌟 すごい！');
  });

  test('should return 💪 for 60-79%', () => {
    expect(getScoreMessage(0.6)).toBe('💪 惜しい！');
    expect(getScoreMessage(0.7)).toBe('💪 惜しい！');
  });

  test('should return 📚 for 40-59%', () => {
    expect(getScoreMessage(0.4)).toBe('📚 復習しよう');
    expect(getScoreMessage(0.5)).toBe('📚 復習しよう');
  });

  test('should return 😅 for below 40%', () => {
    expect(getScoreMessage(0.39)).toBe('😅 もう一度');
    expect(getScoreMessage(0)).toBe('😅 もう一度');
  });
});

// ============================================================
// isValidQuizData() Tests
// ============================================================
describe('isValidQuizData - Validate quiz data', () => {
  test('should accept valid quiz data', () => {
    const data = {
      id: 'boki1',
      tests: [
        {
          id: 1,
          title: 'Test 1',
          questions: [{ scenario: 'Q1', choices: [], correct: 0 }],
        },
      ],
    };
    expect(isValidQuizData(data)).toBe(true);
  });

  test('should reject null', () => {
    expect(isValidQuizData(null)).toBe(false);
  });

  test('should reject undefined', () => {
    expect(isValidQuizData(undefined)).toBe(false);
  });

  test('should reject missing id', () => {
    const data = {
      tests: [{ id: 1, title: 'Test', questions: [] }],
    };
    expect(isValidQuizData(data)).toBe(false);
  });

  test('should reject missing tests', () => {
    const data = { id: 'boki1' };
    expect(isValidQuizData(data)).toBe(false);
  });

  test('should reject non-array tests', () => {
    const data = { id: 'boki1', tests: {} };
    expect(isValidQuizData(data)).toBe(false);
  });

  test('should reject test without id', () => {
    const data = {
      id: 'boki1',
      tests: [{ title: 'Test', questions: [] }],
    };
    expect(isValidQuizData(data)).toBe(false);
  });

  test('should reject test without title', () => {
    const data = {
      id: 'boki1',
      tests: [{ id: 1, questions: [] }],
    };
    expect(isValidQuizData(data)).toBe(false);
  });

  test('should reject test without questions array', () => {
    const data = {
      id: 'boki1',
      tests: [{ id: 1, title: 'Test' }],
    };
    expect(isValidQuizData(data)).toBe(false);
  });
});

// ============================================================
// isValidTest() Tests
// ============================================================
describe('isValidTest - Validate test structure', () => {
  test('should accept valid test', () => {
    const test = {
      id: 1,
      title: 'Test 1',
      questions: [
        {
          scenario: 'Q1',
          choices: ['A', 'B', 'C', 'D'],
          correct: 0,
        },
      ],
    };
    expect(isValidTest(test)).toBe(true);
  });

  test('should reject null', () => {
    expect(isValidTest(null)).toBe(false);
  });

  test('should reject missing id', () => {
    const test = {
      title: 'Test',
      questions: [],
    };
    expect(isValidTest(test)).toBe(false);
  });

  test('should reject missing title', () => {
    const test = {
      id: 1,
      questions: [],
    };
    expect(isValidTest(test)).toBe(false);
  });

  test('should reject non-array questions', () => {
    const test = {
      id: 1,
      title: 'Test',
      questions: {},
    };
    expect(isValidTest(test)).toBe(false);
  });

  test('should reject question without scenario', () => {
    const test = {
      id: 1,
      title: 'Test',
      questions: [{ choices: [], correct: 0 }],
    };
    expect(isValidTest(test)).toBe(false);
  });

  test('should reject question without choices', () => {
    const test = {
      id: 1,
      title: 'Test',
      questions: [{ scenario: 'Q1', correct: 0 }],
    };
    expect(isValidTest(test)).toBe(false);
  });

  test('should reject question without correct index', () => {
    const test = {
      id: 1,
      title: 'Test',
      questions: [{ scenario: 'Q1', choices: [] }],
    };
    expect(isValidTest(test)).toBe(false);
  });
});

// ============================================================
// isTextQuestion / normalizeAnswerText / isTextAnswerCorrect Tests - 記述式判定・照合
// ============================================================
describe('isTextQuestion - 記述式問題判定', () => {
  test('should detect a text-type question', () => {
    expect(isTextQuestion({ type: 'text', correctText: '東京' })).toBe(true);
  });

  test('should not detect a normal choice question', () => {
    expect(isTextQuestion({ choices: ['a', 'b'], correct: 0 })).toBe(false);
  });

  test('should not detect a journal question', () => {
    expect(isTextQuestion({ choices: [{ debit: [], credit: [] }], correct: 0 })).toBe(false);
  });
});

describe('normalizeAnswerText - 記述式解答の正規化', () => {
  test('should trim surrounding whitespace including full-width space', () => {
    expect(normalizeAnswerText('　東京　')).toBe('東京');
  });

  test('should lowercase alphabetic answers', () => {
    expect(normalizeAnswerText('Tokyo')).toBe('tokyo');
  });

  test('should normalize full-width alphanumerics via NFKC', () => {
    expect(normalizeAnswerText('Ｔｏｋｙｏ')).toBe('tokyo');
  });

  test('should collapse internal whitespace', () => {
    expect(normalizeAnswerText('東 京')).toBe('東京');
  });
});

describe('isTextAnswerCorrect - 記述式解答の正誤判定', () => {
  const q = { correctText: '東京', acceptedAnswers: ['とうきょう', 'Tokyo'] };

  test('should accept the exact correctText', () => {
    expect(isTextAnswerCorrect(q, '東京')).toBe(true);
  });

  test('should accept an acceptedAnswers entry', () => {
    expect(isTextAnswerCorrect(q, 'とうきょう')).toBe(true);
  });

  test('should accept case-insensitive romaji variant', () => {
    expect(isTextAnswerCorrect(q, 'tokyo')).toBe(true);
  });

  test('should accept answers with surrounding whitespace', () => {
    expect(isTextAnswerCorrect(q, '  東京  ')).toBe(true);
  });

  test('should reject a wrong answer', () => {
    expect(isTextAnswerCorrect(q, '大阪')).toBe(false);
  });

  test('should reject an empty answer', () => {
    expect(isTextAnswerCorrect(q, '')).toBe(false);
  });

  test('should work with no acceptedAnswers provided', () => {
    expect(isTextAnswerCorrect({ correctText: '東京' }, '東京')).toBe(true);
  });
});
