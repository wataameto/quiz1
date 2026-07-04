// Score management functions (Firebase integration can be mocked in tests)

class ScoreManager {
  constructor(currentUser = null, db = null) {
    this.currentUser = currentUser;
    this.db = db;
    this.bestScores = {};
  }

  setUser(user) {
    this.currentUser = user;
  }

  setDB(db) {
    this.db = db;
  }

  clearCache() {
    this.bestScores = {};
  }

  // Calculate number of correct answers from percentage score
  calculateCorrectAnswers(percentageScore, totalQuestions = 10) {
    if (percentageScore < 0) return 0;
    return Math.round(percentageScore / 100 * totalQuestions);
  }

  // Calculate total score from tests
  calculateTotalScore(tests, scores) {
    if (!tests || !Array.isArray(tests)) return 0;
    return tests.reduce((sum, test) => {
      const score = scores[`best_${test.id}`];
      if (score !== undefined && score >= 0) {
        const qCount = (test.questions && Array.isArray(test.questions)) ? test.questions.length : 10;
        sum += this.calculateCorrectAnswers(score, qCount);
      }
      return sum;
    }, 0);
  }

  // Get quiz collection name from quiz id
  getCollectionName(quizId) {
    if (!quizId || typeof quizId !== 'string') {
      throw new Error('Invalid quiz ID');
    }
    return `quiz_${quizId}`;
  }

  // Check if score improved
  isScoreImproved(newScore, oldScore) {
    return newScore > oldScore;
  }

  // Filter tests that have been attempted
  getAttemptedTests(tests, scores) {
    if (!tests || !Array.isArray(tests)) return [];
    return tests.filter(test => {
      const score = scores[`best_${test.id}`];
      return score !== undefined && score >= 0;
    });
  }

  // Calculate average score
  calculateAverageScore(tests, scores) {
    const attempted = this.getAttemptedTests(tests, scores);
    if (attempted.length === 0) return 0;

    const totalScore = attempted.reduce((sum, test) => {
      const score = scores[`best_${test.id}`] || 0;
      return sum + score;
    }, 0);

    return Math.round(totalScore / attempted.length);
  }
}

module.exports = ScoreManager;
