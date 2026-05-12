const ScoreManager = require('./scoreManager');

describe('ScoreManager - Score management and calculations', () => {
  let scoreManager;

  beforeEach(() => {
    scoreManager = new ScoreManager();
  });

  // ============================================================
  // Constructor and Setup Tests
  // ============================================================
  describe('Constructor and setup', () => {
    test('should initialize with default values', () => {
      expect(scoreManager.currentUser).toBeNull();
      expect(scoreManager.db).toBeNull();
      expect(scoreManager.bestScores).toEqual({});
    });

    test('should initialize with provided user and db', () => {
      const mockUser = { uid: 'user123' };
      const mockDB = {};
      const manager = new ScoreManager(mockUser, mockDB);
      expect(manager.currentUser).toBe(mockUser);
      expect(manager.db).toBe(mockDB);
    });

    test('should set user', () => {
      const mockUser = { uid: 'user456' };
      scoreManager.setUser(mockUser);
      expect(scoreManager.currentUser).toBe(mockUser);
    });

    test('should set database', () => {
      const mockDB = {};
      scoreManager.setDB(mockDB);
      expect(scoreManager.db).toBe(mockDB);
    });

    test('should clear cache', () => {
      scoreManager.bestScores = { best_1_test1: 90 };
      scoreManager.clearCache();
      expect(scoreManager.bestScores).toEqual({});
    });
  });

  // ============================================================
  // calculateCorrectAnswers() Tests
  // ============================================================
  describe('calculateCorrectAnswers', () => {
    test('should return 10 for 100% score', () => {
      expect(scoreManager.calculateCorrectAnswers(100)).toBe(10);
    });

    test('should return 5 for 50% score', () => {
      expect(scoreManager.calculateCorrectAnswers(50)).toBe(5);
    });

    test('should return 0 for 0% score', () => {
      expect(scoreManager.calculateCorrectAnswers(0)).toBe(0);
    });

    test('should return 0 for negative score', () => {
      expect(scoreManager.calculateCorrectAnswers(-1)).toBe(0);
    });

    test('should round correctly', () => {
      expect(scoreManager.calculateCorrectAnswers(35)).toBe(4);
      expect(scoreManager.calculateCorrectAnswers(45)).toBe(5);
    });

    test('should handle decimal scores', () => {
      expect(scoreManager.calculateCorrectAnswers(33.3)).toBe(3);
      expect(scoreManager.calculateCorrectAnswers(66.6)).toBe(7);
    });
  });

  // ============================================================
  // calculateTotalScore() Tests
  // ============================================================
  describe('calculateTotalScore', () => {
    test('should return 0 for empty tests', () => {
      const tests = [];
      const scores = {};
      expect(scoreManager.calculateTotalScore(tests, scores)).toBe(0);
    });

    test('should return 0 for null tests', () => {
      expect(scoreManager.calculateTotalScore(null, {})).toBe(0);
    });

    test('should return 0 for non-array tests', () => {
      expect(scoreManager.calculateTotalScore({}, {})).toBe(0);
    });

    test('should calculate total from multiple test scores', () => {
      const tests = [
        { id: 1 },
        { id: 2 },
        { id: 3 },
      ];
      const scores = {
        'best_1': 100,  // 10 points
        'best_2': 80,   // 8 points
        'best_3': 60,   // 6 points
      };
      expect(scoreManager.calculateTotalScore(tests, scores)).toBe(24);
    });

    test('should ignore missing scores', () => {
      const tests = [{ id: 1 }, { id: 2 }];
      const scores = { 'best_1': 100 };
      expect(scoreManager.calculateTotalScore(tests, scores)).toBe(10);
    });

    test('should ignore negative scores', () => {
      const tests = [{ id: 1 }, { id: 2 }];
      const scores = {
        'best_1': 100,
        'best_2': -1,
      };
      expect(scoreManager.calculateTotalScore(tests, scores)).toBe(10);
    });
  });

  // ============================================================
  // getCollectionName() Tests
  // ============================================================
  describe('getCollectionName', () => {
    test('should return correct collection name', () => {
      expect(scoreManager.getCollectionName('boki1')).toBe('quiz_boki1');
    });

    test('should handle devops quiz', () => {
      expect(scoreManager.getCollectionName('devops')).toBe('quiz_devops');
    });

    test('should throw error for invalid quiz id', () => {
      expect(() => scoreManager.getCollectionName(null)).toThrow();
      expect(() => scoreManager.getCollectionName(undefined)).toThrow();
      expect(() => scoreManager.getCollectionName(123)).toThrow();
    });
  });

  // ============================================================
  // isScoreImproved() Tests
  // ============================================================
  describe('isScoreImproved', () => {
    test('should return true when new score is higher', () => {
      expect(scoreManager.isScoreImproved(90, 80)).toBe(true);
    });

    test('should return false when new score is lower', () => {
      expect(scoreManager.isScoreImproved(70, 80)).toBe(false);
    });

    test('should return false when scores are equal', () => {
      expect(scoreManager.isScoreImproved(80, 80)).toBe(false);
    });

    test('should work with negative scores', () => {
      expect(scoreManager.isScoreImproved(0, -1)).toBe(true);
      expect(scoreManager.isScoreImproved(-1, 0)).toBe(false);
    });
  });

  // ============================================================
  // getAttemptedTests() Tests
  // ============================================================
  describe('getAttemptedTests', () => {
    test('should return empty array for no attempted tests', () => {
      const tests = [{ id: 1 }, { id: 2 }];
      const scores = {};
      expect(scoreManager.getAttemptedTests(tests, scores)).toEqual([]);
    });

    test('should filter attempted tests', () => {
      const tests = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const scores = {
        'best_1': 80,
        'best_3': 90,
      };
      const attempted = scoreManager.getAttemptedTests(tests, scores);
      expect(attempted.length).toBe(2);
      expect(attempted[0].id).toBe(1);
      expect(attempted[1].id).toBe(3);
    });

    test('should return empty array for null tests', () => {
      expect(scoreManager.getAttemptedTests(null, {})).toEqual([]);
    });

    test('should ignore negative scores', () => {
      const tests = [{ id: 1 }, { id: 2 }];
      const scores = {
        'best_1': -1,
        'best_2': 70,
      };
      const attempted = scoreManager.getAttemptedTests(tests, scores);
      expect(attempted.length).toBe(1);
      expect(attempted[0].id).toBe(2);
    });
  });

  // ============================================================
  // calculateAverageScore() Tests
  // ============================================================
  describe('calculateAverageScore', () => {
    test('should return 0 for no attempted tests', () => {
      const tests = [{ id: 1 }, { id: 2 }];
      const scores = {};
      expect(scoreManager.calculateAverageScore(tests, scores)).toBe(0);
    });

    test('should calculate average correctly', () => {
      const tests = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const scores = {
        'best_1': 100,
        'best_2': 80,
        'best_3': 60,
      };
      // Average = (100 + 80 + 60) / 3 = 240 / 3 = 80
      expect(scoreManager.calculateAverageScore(tests, scores)).toBe(80);
    });

    test('should only consider attempted tests', () => {
      const tests = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const scores = {
        'best_1': 100,
        'best_2': 80,
      };
      // Average = (100 + 80) / 2 = 90
      expect(scoreManager.calculateAverageScore(tests, scores)).toBe(90);
    });

    test('should handle single attempted test', () => {
      const tests = [{ id: 1 }, { id: 2 }];
      const scores = { 'best_1': 75 };
      expect(scoreManager.calculateAverageScore(tests, scores)).toBe(75);
    });

    test('should round average correctly', () => {
      const tests = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const scores = {
        'best_1': 100,
        'best_2': 85,
        'best_3': 70,
      };
      // Average = (100 + 85 + 70) / 3 = 255 / 3 = 85
      expect(scoreManager.calculateAverageScore(tests, scores)).toBe(85);
    });

    test('should return 0 for null tests', () => {
      expect(scoreManager.calculateAverageScore(null, {})).toBe(0);
    });
  });
});
