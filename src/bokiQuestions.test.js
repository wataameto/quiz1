const fs = require('fs');
const path = require('path');

const questionsDir = path.join(__dirname, '..', 'docs', 'bokinyu');
const questionFiles = fs.readdirSync(questionsDir)
  .filter(file => /^questions\d+\.json$/.test(file))
  .sort();

describe('Boki question data', () => {
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
