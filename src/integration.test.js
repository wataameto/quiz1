const ScoreManager = require('./scoreManager');
const {
  fmt,
  shuffle,
  calculateTotalQuestions,
  getStarRating,
  getScoreMessage,
  isValidQuizData,
} = require('./utils');

// ============================================================
// Integration Tests
// ============================================================
describe('Integration Tests - Quiz Application Workflow', () => {
  let scoreManager;
  let quizData;

  beforeEach(() => {
    scoreManager = new ScoreManager();
    quizData = {
      id: 'boki1',
      tests: [
        {
          id: 1,
          title: 'Test 1',
          questions: [
            {
              id: 1,
              scenario: 'Q1',
              choices: [
                { account: '現金', amount: 1000 },
                { account: '売上', amount: 1000 },
              ],
              correct: 0,
            },
            {
              id: 2,
              scenario: 'Q2',
              choices: [
                { account: '現金', amount: 2000 },
                { account: '売掛金', amount: 2000 },
              ],
              correct: 1,
            },
          ],
        },
        {
          id: 2,
          title: 'Test 2',
          questions: [
            {
              id: 3,
              scenario: 'Q3',
              choices: ['A', 'B', 'C', 'D'],
              correct: 0,
            },
          ],
        },
      ],
    };
  });

  test('should validate and process quiz data', () => {
    expect(isValidQuizData(quizData)).toBe(true);
  });

  test('should calculate total questions across all tests', () => {
    const totalQuestions = calculateTotalQuestions(quizData.tests);
    expect(totalQuestions).toBe(3);
  });

  test('should manage user scores across multiple attempts', () => {
    const scores = {
      'best_1': 80,
      'best_2': 60,
    };

    const totalScore = scoreManager.calculateTotalScore(quizData.tests, scores);
    expect(totalScore).toBe(14); // 8 + 6 points

    const averageScore = scoreManager.calculateAverageScore(quizData.tests, scores);
    expect(averageScore).toBe(70); // (80 + 60) / 2
  });

  test('should provide feedback based on score progression', () => {
    // First attempt: 60%
    const score1 = 60;
    const ratio1 = score1 / 100;
    expect(getScoreMessage(ratio1)).toBe('💪 惜しい！');
    expect(getStarRating(ratio1)).toBe('⭐');

    // Improvement: 90%
    const score2 = 90;
    const ratio2 = score2 / 100;
    expect(getScoreMessage(ratio2)).toBe('🌟 すごい！');
    expect(getStarRating(ratio2)).toBe('⭐⭐');

    // Perfect: 100%
    const score3 = 100;
    const ratio3 = score3 / 100;
    expect(getScoreMessage(ratio3)).toBe('🏆 満点！');
    expect(getStarRating(ratio3)).toBe('⭐⭐⭐');
  });

  test('should track improvement across attempts', () => {
    const previousScore = 70;
    const newScore = 85;

    expect(scoreManager.isScoreImproved(newScore, previousScore)).toBe(true);
    expect(scoreManager.calculateCorrectAnswers(newScore)).toBe(9);
  });

  test('should handle quiz collection names correctly', () => {
    expect(scoreManager.getCollectionName(quizData.id)).toBe('quiz_boki1');

    const bokiQuiz = { ...quizData, id: 'boki1' };
    expect(scoreManager.getCollectionName(bokiQuiz.id)).toBe('quiz_boki1');
  });

  test('should shuffle test questions without duplicates', () => {
    const questions = quizData.tests[0].questions;
    const shuffled = shuffle(questions);

    expect(shuffled.length).toBe(questions.length);
    shuffled.forEach((q, i) => {
      expect(questions.some(orig => orig.id === q.id)).toBe(true);
    });
  });

  test('should calculate scores across multiple users', () => {
    const user1Scores = {
      'best_1': 100,
      'best_2': 100,
    };

    const user2Scores = {
      'best_1': 50,
      'best_2': 50,
    };

    const user1Total = scoreManager.calculateTotalScore(quizData.tests, user1Scores);
    const user2Total = scoreManager.calculateTotalScore(quizData.tests, user2Scores);

    expect(user1Total).toBe(20);
    expect(user2Total).toBe(10);
    expect(scoreManager.isScoreImproved(user1Total, user2Total)).toBe(true);
  });

  test('should format currency in accounting entries', () => {
    const entry = {
      debit: [{ account: '現金', amount: 10000 }],
      credit: [{ account: '売上', amount: 10000 }],
    };

    expect(fmt(entry.debit[0].amount)).toBe('¥10,000');
    expect(fmt(entry.credit[0].amount)).toBe('¥10,000');
  });

  test('should handle multiple quiz types', () => {
    const journalQuiz = {
      id: 'boki1',
      tests: [{
        id: 1,
        title: 'Journal Test',
        questions: [{
          scenario: 'Q1',
          type: 'journal',
          choices: [],
          correct: 0,
        }],
      }],
    };

    const choiceQuiz = {
      id: 'devops',
      tests: [{
        id: 1,
        title: 'Multiple Choice',
        questions: [{
          scenario: 'Q1',
          type: 'choice',
          choices: ['A', 'B', 'C', 'D'],
          correct: 0,
        }],
      }],
    };

    expect(isValidQuizData(journalQuiz)).toBe(true);
    expect(isValidQuizData(choiceQuiz)).toBe(true);
  });

  test('should calculate performance statistics', () => {
    const tests = quizData.tests;
    const scores = {
      'best_1': 90,
      'best_2': 70,
    };

    const attempted = scoreManager.getAttemptedTests(tests, scores);
    expect(attempted.length).toBe(2);

    const average = scoreManager.calculateAverageScore(tests, scores);
    expect(average).toBe(80);

    const total = scoreManager.calculateTotalScore(tests, scores);
    expect(total).toBe(16); // 9 + 7 points
  });

  test('should provide collection names for both quiz types', () => {
    const bokiCollection = scoreManager.getCollectionName('boki1');
    const devopsCollection = scoreManager.getCollectionName('devops');

    expect(bokiCollection).toBe('quiz_boki1');
    expect(devopsCollection).toBe('quiz_devops');
  });
});

// ============================================================
// Edge Case Tests
// ============================================================
describe('Edge Cases and Error Handling', () => {
  let scoreManager;

  beforeEach(() => {
    scoreManager = new ScoreManager();
  });

  test('should handle empty quiz data gracefully', () => {
    const emptyQuiz = {
      id: 'empty',
      tests: [],
    };

    expect(isValidQuizData(emptyQuiz)).toBe(true);
    expect(calculateTotalQuestions(emptyQuiz.tests)).toBe(0);
  });

  test('should handle very high scores', () => {
    const scores = {
      'best_1': 100,
      'best_2': 100,
      'best_3': 100,
    };

    const tests = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const total = scoreManager.calculateTotalScore(tests, scores);
    expect(total).toBe(30);
  });

  test('should handle mixed score types', () => {
    const scores = {
      'best_1': 100,
      'best_2': -1,
      'best_3': 0,
      'best_4': 75,
    };

    const tests = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
    const total = scoreManager.calculateTotalScore(tests, scores);
    expect(total).toBe(18); // 10 + 0 + 0 + 8

    const attempted = scoreManager.getAttemptedTests(tests, scores);
    expect(attempted.length).toBe(3); // Only 1, 3 (score 0), and 4
  });

  test('should handle special characters in strings', () => {
    const entry = {
      debit: [{ account: '現金（JPY）', amount: 10000 }],
      credit: [{ account: '売上 / 出荷', amount: 10000 }],
    };

    const formatted = fmt(entry.debit[0].amount);
    expect(formatted).toBe('¥10,000');
  });

  test('should handle large arrays efficiently', () => {
    const largeTests = [];
    for (let i = 0; i < 100; i++) {
      largeTests.push({
        id: i,
        title: `Test ${i}`,
        questions: Array(10).fill({ scenario: 'Q', choices: [], correct: 0 }),
      });
    }

    const total = calculateTotalQuestions(largeTests);
    expect(total).toBe(1000);

    const shuffled = shuffle(largeTests);
    expect(shuffled.length).toBe(100);
  });

  test('should preserve score integrity through operations', () => {
    scoreManager.bestScores = {
      'best_1_test1': 95,
      'best_1_test2': 87,
    };

    const cache = scoreManager.bestScores;
    scoreManager.clearCache();
    expect(scoreManager.bestScores).not.toBe(cache);
    expect(scoreManager.bestScores).toEqual({});
  });
});
