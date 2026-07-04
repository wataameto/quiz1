const fs = require('fs');
const path = require('path');

const questionsDir = path.join(__dirname, '..', 'docs', 'boki1');
const questionFiles = fs.readdirSync(questionsDir)
  .filter(file => /^questions\d+\.json$/.test(file))
  .sort();

function sumEntries(entries) {
  return entries.reduce((sum, entry) => sum + entry.amount, 0);
}

describe('Boki question data', () => {
  test('should have valid test and question structure', () => {
    questionFiles.forEach(file => {
      const data = JSON.parse(fs.readFileSync(path.join(questionsDir, file), 'utf8'));
      expect(Array.isArray(data.tests)).toBe(true);

      data.tests.forEach(testData => {
        expect(testData.questions.length).toBeGreaterThan(0);

        testData.questions.forEach(question => {
          expect(question.scenario).toBeTruthy();
          expect(Array.isArray(question.choices)).toBe(true);
          expect(Number.isInteger(question.correct)).toBe(true);
          expect(question.correct).toBeGreaterThan(-1);
          expect(question.correct).toBeLessThan(question.choices.length);
          expect(question.explanation).toBeTruthy();
        });
      });
    });
  });

  test('should not contain duplicate choices in a question', () => {
    questionFiles.forEach(file => {
      const data = JSON.parse(fs.readFileSync(path.join(questionsDir, file), 'utf8'));

      data.tests.forEach(testData => {
        testData.questions.forEach(question => {
          const uniqueChoices = new Set(question.choices.map(choice => JSON.stringify(choice)));
          expect(uniqueChoices.size).toBe(question.choices.length);
        });
      });
    });
  });

  test('should balance debit and credit amounts in all journal choices', () => {
    questionFiles.forEach(file => {
      const data = JSON.parse(fs.readFileSync(path.join(questionsDir, file), 'utf8'));

      data.tests.forEach(testData => {
        testData.questions
          .filter(question => question.type === 'journal')
          .forEach(question => {
            question.choices.forEach(choice => {
              expect(Array.isArray(choice.debit)).toBe(true);
              expect(Array.isArray(choice.credit)).toBe(true);
              expect(sumEntries(choice.debit)).toBe(sumEntries(choice.credit));
            });
          });
      });
    });
  });

  test('should not use purchase or sales as journal account names', () => {
    questionFiles.forEach(file => {
      const data = JSON.parse(fs.readFileSync(path.join(questionsDir, file), 'utf8'));

      data.tests.forEach(testData => {
        testData.questions
          .filter(question => question.type === 'journal')
          .forEach(question => {
            question.choices.forEach(choice => {
              const accounts = [...choice.debit, ...choice.credit].map(entry => entry.account);
              expect(accounts).not.toContain('仕入');
              expect(accounts).not.toContain('売上');
            });
          });
      });
    });
  });
});
