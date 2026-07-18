const fs = require('fs');
const path = require('path');

const docsDir = path.join(__dirname, '..', 'docs');

const quizzes = fs.readdirSync(docsDir)
  .filter(name => fs.statSync(path.join(docsDir, name)).isDirectory())
  .filter(name => name !== 'shared')
  .filter(name => fs.existsSync(path.join(docsDir, name, 'questions1.json')))
  .sort();

function loadQuizQuestions(quiz) {
  const quizDir = path.join(docsDir, quiz);
  const files = fs.readdirSync(quizDir)
    .filter(file => /^questions\d+\.json$/.test(file))
    .sort();

  const items = [];
  files.forEach(file => {
    const data = JSON.parse(fs.readFileSync(path.join(quizDir, file), 'utf8'));
    (data.tests || []).forEach(test => {
      (test.questions || []).forEach((question, index) => {
        items.push({
          quiz,
          file,
          testId: test.id,
          index: index + 1,
          question,
        });
      });
    });
  });
  return items;
}

function sumEntries(entries) {
  return entries.reduce((sum, entry) => sum + entry.amount, 0);
}

function locate(item) {
  return `${item.quiz}/${item.file} test${item.testId} Q${item.index}`;
}

describe.each(quizzes)('Question quality: %s', (quiz) => {
  const items = loadQuizQuestions(quiz);

  test('every question has a valid structure', () => {
    items.forEach(({ question }, i) => {
      const item = items[i];
      expect(question.scenario).toBeTruthy();
      if (question.type === 'text') {
        expect(question.correctText).toBeTruthy();
        expect(question.explanation).toBeTruthy();
        return;
      }
      expect(Array.isArray(question.choices)).toBe(true);
      expect(question.choices.length).toBeGreaterThanOrEqual(2);
      expect(Number.isInteger(question.correct)).toBe(true);
      expect(question.correct).toBeGreaterThan(-1);
      expect(question.correct).toBeLessThan(question.choices.length);
      expect(question.explanation).toBeTruthy();
    });
  });

  test('no question has duplicate choices', () => {
    const offenders = items.filter(({ question }) => {
      if (question.type === 'text') return false;
      const unique = new Set(question.choices.map(choice => JSON.stringify(choice)));
      return unique.size !== question.choices.length;
    });
    expect(offenders.map(locate)).toEqual([]);
  });

  test('no duplicate scenario text within the quiz', () => {
    const seen = new Map();
    items.forEach(item => {
      const key = item.question.scenario.trim();
      if (!seen.has(key)) seen.set(key, []);
      seen.get(key).push(item);
    });
    const dups = [...seen.values()].filter(list => list.length > 1);
    const report = dups.map(list => list.map(locate).join(' == '));
    expect(report).toEqual([]);
  });

  test('journal-type questions balance debit and credit in every choice', () => {
    const offenders = [];
    items
      .filter(({ question }) => question.type === 'journal')
      .forEach(item => {
        item.question.choices.forEach(choice => {
          if (sumEntries(choice.debit) !== sumEntries(choice.credit)) {
            offenders.push(locate(item));
          }
        });
      });
    expect(offenders).toEqual([]);
  });
});
