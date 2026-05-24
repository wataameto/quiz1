# テストドキュメント

## 概要

このプロジェクトは Jest でユーティリティ、スコア計算、メニュー表示仕様、簿記問題JSON、統合的なスコア処理を検証します。

現在の実行結果:
- テストスイート: 5 passed / 5 total
- テストケース: 118 passed / 118 total
- 実行コマンド: npm test -- --runInBand

## テストファイル

### src/utils.test.js
- fmt(): 円表記と3桁区切り。
- shuffle(): Fisher-Yates形式のシャッフル、元配列の非破壊性。
- calculateTotalQuestions(): 複数テストの問題数集計。
- renderJournal(): 仕訳HTML表示。
- journalText(): 仕訳テキスト化。
- parseScore(), getStarRating(), getScoreMessage(): スコア表示補助。
- isValidQuizData(), isValidTest(): クイズデータ構造検証。

### src/scoreManager.test.js
- ScoreManager の初期化、ユーザー/DB設定、キャッシュクリア。
- percentage から正答数への換算。
- 複数テストの合計スコアと平均スコア。
- quiz id から Firestore collection 名への変換。
- スコア改善判定と試行済みテスト抽出。

### src/integration.test.js
- クイズデータ、スコア計算、シャッフル、仕訳/選択式問題の統合確認。
- 複数ユーザー、空データ、高スコア、特殊文字、大規模配列などのエッジケース。

### src/menu.test.js
- docs/index.html の表示名が docs/config.json と一致すること。
- パート数と問題数を question metadata から動的に扱うこと。
- メニューのスコア集計が現在の question files だけを対象にすること。
- reset 時に Firestore document の存在確認を行うこと。
- boki1/devops の quiz page に admin question review mode があること。

### src/bokiQuestions.test.js
- docs/boki1/questions*.json の構造検証。
- 各テストが現在の簿記ルールどおり10問であること。
- 各問題に scenario, choices, correct, explanation があること。
- 選択肢が重複しないこと。
- 仕訳問題の借方合計と貸方合計が一致すること。
- 仕訳の勘定科目名に 売上 / 仕入 を使っていないこと。

## 実行方法

```bash
npm test
npm test -- --runInBand
npm test -- src/menu.test.js
npm run test:watch
npm run test:coverage
```

## 運用ルール

- JavaScript または問題JSONを変更したら npm test を実行する。
- ドキュメントだけの変更なら npm test は不要。
- 問題数ルールを変更する場合は、UI表示だけでなく src/bokiQuestions.test.js も見直す。
- 簿記問題の作問ルールは QUESTION_GUIDE.md を優先する。
