# テストドキュメント

## 概要

このプロジェクトは Jest でユーティリティ、スコア計算、メニュー表示仕様、全クイズの問題データ品質、簿記固有ルール、統合的なスコア処理を検証します。

現在の実行結果:
- テストスイート: 6 passed / 6 total
- テストケース: 140 passed / 140 total
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

### src/questionQuality.test.js
- docs/ 配下の全クイズ（boki1, devops, kokyo1, joho1, itpassport, itpassportjr）を横断して問題データ品質を検証する共通テスト。
- 各問題に scenario, choices（2件以上）, correct（範囲内の整数）, explanation があること。
- 1問の中で選択肢が重複しないこと。
- 同じクイズ内でシナリオ文が完全一致する問題が存在しないこと（コピペ重複の検出）。
- 仕訳問題（type: journal）がある場合、全選択肢で借方合計と貸方合計が一致すること。
- 「選択肢セット・正解が同じでシナリオだけ言い回しを変えた」近似重複は誤検知が多いため対象外（分類問題など、同じ選択肢プールを正当に使い回すパターンがあるため）。まれに見つかった場合は手動監査で対応する。

### src/bokiQuestions.test.js
- docs/boki1/questions*.json 固有のルール検証（構造・重複・仕訳バランスは questionQuality.test.js に統合済み）。
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
- どのクイズの問題JSONを追加・修正しても、src/questionQuality.test.js が構造・選択肢重複・シナリオ重複・仕訳バランスを自動チェックする。
- 簿記固有の作問ルールは src/bokiQuestions.test.js と QUESTION_GUIDE.md を優先する。
