# Quiz Learning Application - プロジェクト仕様書

## プロジェクト概要

クイズ学習アプリケーション。簿記（会計）とDevOpsに関するクイズを学習者に提供し、スコア管理・進捗追跡・フィードバック機能を備えた学習支援ツール。

**主な目的：**
- 学習者が複数のクイズテストを解く
- スコアを記録・管理し、改善を追跡
- 日本語対応のUIフィードバック（星評価、メッセージ）
- Firebaseとの連携によるデータ永続化

---

## コアアーキテクチャ

### 1. ScoreManager クラス (src/scoreManager.js)

**責務：**
- ユーザースコアの計算・管理
- Firestoreコレクションの管理
- スコア改善の判定
- 複数テスト間でのスコア集計

**メソッド：**

```javascript
constructor(currentUser = null, db = null)
  // 初期化: currentUser(ユーザー情報)、db(Firebaseインスタンス)

setUser(user)
  // ユーザー情報を更新

setDB(db)
  // Firebaseデータベースインスタンスを設定

clearCache()
  // 内部キャッシュ(bestScores)をリセット

calculateCorrectAnswers(percentageScore)
  // パーセンテージ(0-100)から正答数(0-10)を計算
  // 例: 80% → 8問正解
  // 負のスコアは0を返す

calculateTotalScore(tests, scores)
  // 複数テストのスコア合計を計算
  // scores: { 'best_testId': percentage, ... }
  // 返り値: 正答数の合計

getCollectionName(quizId)
  // Firestoreコレクション名を生成
  // 例: 'boki1' → 'quiz_boki1'
  // 不正な入力でError

isScoreImproved(newScore, oldScore)
  // 新スコア > 旧スコアで true

getAttemptedTests(tests, scores)
  // スコア >= 0 のテストのみをフィルタ

calculateAverageScore(tests, scores)
  // 試行済みテストの平均スコア（パーセンテージ）
```

**主要な計算ロジック：**
- 1テスト = 10問
- スコアはパーセンテージ (0-100%)
- 正答数 = Math.round(percentage / 100 * 10)

---

### 2. ユーティリティ関数 (src/utils.js)

#### 通貨フォーマット
```javascript
fmt(n)
  // 入力: 数値
  // 出力: "¥10,000" 形式（日本円、3桁カンマ区切り）
  // toLocaleString()で実装
```

#### 配列シャッフル
```javascript
shuffle(arr)
  // Fisher-Yatesアルゴリズムで配列をランダムに並び替え
  // 元配列を変更しない（新しい配列を返す）
  // 問題順序をランダムにする際に使用
```

#### テスト問題数計算
```javascript
calculateTotalQuestions(tests)
  // 複数テストの総問題数を計算
  // tests: [{ id, title, questions: [...] }, ...]
  // 返り値: 全テストの総問題数
```

#### 仕訳エントリの表示
```javascript
renderJournal(entry)
  // 仕訳エントリをHTML形式で生成
  // entry: { debit: [{account, amount}, ...], credit: [...] }
  // 出力例:
  //   <div class="journal">
  //     <div>借方（左）</div> | <div>貸方（右）</div>
  //   </div>
  // 借方・貸方を左右に並べて表示

journalText(entry)
  // 仕訳を日本語テキスト形式に変換
  // 例: "借: 現金 ¥10,000・売掛金 ¥5,000 ／ 貸: 売上 ¥15,000"
```

#### スコア解析
```javascript
parseScore(percentage)
  // パーセンテージから正答数に変換（小数点四捨五入）
  // 負のスコアは -1 を返す

getStarRating(ratio)
  // スコア率から星評価を返す
  // 1.0 → '⭐⭐⭐'
  // 0.7-0.99 → '⭐⭐'
  // 0.4-0.69 → '⭐'
  // 0-0.39 → '　'（空白）

getScoreMessage(ratio)
  // スコア率からメッセージを返す
  // 1.0 → '🏆 満点！'
  // 0.8-0.99 → '🌟 すごい！'
  // 0.6-0.79 → '💪 惜しい！'
  // 0.4-0.59 → '📚 復習しよう'
  // 0-0.39 → '😅 もう一度'
```

#### データ検証
```javascript
isValidQuizData(data)
  // クイズ全体の構造をバリデーション
  // 必須: data.id (string), data.tests (array)
  // tests内の各testは有効なテスト構造を持つこと

isValidTest(test)
  // テストの構造をバリデーション
  // 必須: test.id, test.title, test.questions (array)
  // questions内の各questionは:
  //   - scenario（問題シナリオ）
  //   - choices（選択肢、配列）
  //   - correct（正答インデックス）
```

---

## クイズデータ構造

### 全体構造
```javascript
{
  id: string,                    // クイズID ('boki1', 'devops' など)
  tests: [
    {
      id: number | string,       // テストID
      title: string,             // テストタイトル
      questions: [
        {
          id: number | string,
          scenario: string,       // 問題文・シナリオ
          choices: any[],         // 選択肢（型は問題によって異なる）
          correct: number,        // 正答のインデックス
          type?: string,          // オプション: 'journal' | 'choice'
        },
        ...
      ],
    },
    ...
  ],
}
```

### クイズタイプ

**1. 仕訳形式（簿記）**
```javascript
{
  scenario: '現金¥10,000で売上げた',
  choices: [
    { account: '現金', amount: 10000 },
    { account: '売上', amount: 10000 },
  ],
  correct: 0,  // 正答は借方の現金
  type: 'journal',
}
```

**2. 複数選択肢形式**
```javascript
{
  scenario: 'DevOpsの定義として正しいものは？',
  choices: ['A', 'B', 'C', 'D'],
  correct: 0,
  type: 'choice',
}
```

---

## スコア管理フロー

### スコア計算ロジック
1. **テストスコア**: ユーザーが1つのテストを完了 → パーセンテージスコア (0-100%)
2. **正答数計算**: `calculateCorrectAnswers(percentage)` → 0-10の整数
3. **総合スコア**: 複数テストの正答数合計 → 最大値は試行済みテスト数 × 10
4. **平均スコア**: 試行済みテストの平均パーセンテージ

### スコア改善フロー
```
ユーザーがテストを再受験
↓
新スコア vs 旧スコア を `isScoreImproved()` で比較
↓
改善時: 新しいスコアで上書き
↓
フィードバック: `getScoreMessage()` と `getStarRating()` でUI表示
```

### キャッシュ管理
- `bestScores`: ユーザーの最高スコアをキャッシュ
- `clearCache()`: キャッシュをリセット
- Firebase連携時はDBから最新スコアを読み込み

---

## テスト戦略

### テストスイート構成

**1. utils.test.js (66テスト)**
- `fmt()`: 通貨フォーマット、ゼロ値、大数値、小数値
- `shuffle()`: Fisher-Yates実装、非破壊性、確率的検証
- `calculateTotalQuestions()`: 複数テスト、エッジケース
- `renderJournal()`: HTML生成、複数エントリ
- `journalText()`: テキスト生成、日本語対応
- `parseScore()`: パーセンテージ変換、四捨五入
- `getStarRating()`: 4段階評価
- `getScoreMessage()`: 5段階メッセージ
- `isValidQuizData()`: データ構造検証
- `isValidTest()`: テスト構造検証

**2. scoreManager.test.js (31テスト)**
- 初期化・設定
- `calculateCorrectAnswers()`: 計算精度、エッジケース
- `calculateTotalScore()`: 複数テスト集計
- `getCollectionName()`: Firebaseコレクション名生成
- `isScoreImproved()`: スコア改善判定
- `getAttemptedTests()`: フィルタリング
- `calculateAverageScore()`: 平均値計算

**3. integration.test.js (10 + 6エッジケーステスト)**
- エンドツーエンドのワークフロー
- 複数ユーザー間のスコア比較
- 複数クイズタイプ対応
- パフォーマンス統計
- エッジケース: 空データ、高スコア、大規模配列、キャッシュ整合性

### テストカバレッジ目標
- **ステートメント**: 100%
- **ブランチ**: 98%以上
- **関数**: 100%
- **行**: 100%

### テスト実行
```bash
npm test                    # 全テスト実行（107テスト）
npm run test:watch         # ウォッチモード
npm run test:coverage      # カバレッジレポート生成
```

---

## ファイル構成

```
quiz1/
├── src/
│   ├── scoreManager.js       # スコア管理クラス (77行)
│   ├── scoreManager.test.js  # スコア管理テスト (31テスト)
│   ├── utils.js              # ユーティリティ関数 (101行)
│   ├── utils.test.js         # ユーティリティテスト (66テスト)
│   └── integration.test.js   # 統合テスト (16テスト)
├── docs/
│   ├── index.html            # メインメニューページ
│   ├── boki1/
│   │   ├── index.html        # 簿記クイズページ
│   │   ├── questions1.json   # パート1データ
│   │   └── questions2.json   # パート2データ
│   └── devops/
│       ├── index.html        # DevOpsクイズページ
│       ├── questions1.json   # 基礎初級データ
│       ├── questions2.json   # 基礎中級データ
│       └── questions3.json   # 基礎上級データ
├── scripts/
│   └── update-build-time.js  # ビルド時刻自動注入スクリプト
├── package.json              # npm設定（build, prepare フック）
├── jest.config.js            # Jest設定
├── README.md                 # (最小限)
├── TEST_DOCUMENTATION.md     # テストドキュメント
└── CLAUDE.md                 # このファイル
```

---

## 実装の重要なポイント

### 1. エラーハンドリング
- 不正なquizId → `throw new Error('Invalid quiz ID')`
- null/undefined入力 → 空配列や0を返す（例外ではなく）
- 負のスコア → 0で正規化

### 2. 日本語対応
- 通貨記号: ¥ (半角)
- 仕訳用語: 借方（左）、貸方（右）
- メッセージ: 絵文字 + 日本語テキスト
- `toLocaleString()` で自動的に3桁カンマ挿入

### 3. 配列操作
- Fisher-Yatesアルゴリズムでシャッフル（均等分布）
- `arr.slice()` で元配列を保護（非破壊）
- 配列のフィルタ・マップで関数型スタイル

### 4. スコア計算の正確性
- 小数点は `Math.round()` で四捨五入
- パーセンテージ(0-100) と 正答数(0-10) の相互変換
- キャッシュと永続層の整合性

### 5. Firebase連携（将来対応）
- `setDB(db)` でFirebaseインスタンスを注入
- `getCollectionName()` でコレクション名を生成
- テストではDBをモック（null/undefined許容）

### 6. UI表示仕様
- **デバイス表示**: 左下に固定表示、フォントサイズ14px
  - Touch デバイス: 📱 Touch
  - PC デバイス: 🖥️ PC
- **ビルド時刻表示**: コミット日時（日本標準時 JST = UTC+9）
  - 形式: YYYY-MM-DD HH:MM:SS（2行表示）
  - 毎回のgit pushでcommitタイムスタンプが自動注入

---

## ビルドシステム

### 自動時刻注入スクリプト (scripts/update-build-time.js)

**目的：** HTMLファイルのコミット日時プレースホルダーを、最新のコミットタイムスタンプで自動置き換える

**仕様：**
- HTMLファイル内の `__BUILD_TIME__` プレースホルダーを検出
- `git log -1 --format=%ci` で最新コミットの日時を取得
- タイムゾーン: **日本標準時（JST = Asia/Tokyo = UTC+9）**
- 形式: `YYYY-MM-DD HH:MM:SS`（秒単位）
- 対象ファイル: `docs/index.html`, `docs/boki1/index.html`, `docs/devops/index.html`

**実行タイミング：**
- 手動実行: `npm run build`
- 自動実行: `npm prepare` フック（git push前に自動実行）
- package.json に以下設定:
  ```json
  "scripts": {
    "build": "node scripts/update-build-time.js",
    "prepare": "npm run build"
  }
  ```

**仕様の重要ポイント：**
- コミット日時は**必ず日本時間（JST）で表示**
- TZ=Asia/Tokyo 環境変数で強制指定
- プレースホルダー形式は `__BUILD_TIME__` (アンダースコア2つ)
- ビルド後はプレースホルダーが実際の日時に置き換わる
- 毎回のcommitでコミット日時が更新される

**新アプローチ：コミット日時をJSONファイルで管理**

**仕組み：**
- `npm run build` → `docs/build-info.json` にタイムスタンプを保存（日本標準時JST）
- HTMLファイルは一切変更されない
- JavaScriptで `build-info.json` を読み込んで動的に表示

**Workflow（毎回）：**
```bash
# 1. コードを編集
git add .

# 2. npm run build を実行
npm run build

# 3. commitする（docs/build-info.json のみ更新）
git commit -m "..."

# 4. pushする
git push
```

**メリット：**
- HTMLファイルが変更されない → プレースホルダー管理が不要
- build-info.jsonだけがcommitされる → 確実でシンプル
- JavaScriptで動的表示 → 柔軟で拡張可能

---

## 主要な計算式

### 正答数計算
```javascript
correctAnswers = Math.round(percentage / 100 * 10)

例:
- 80% → 8
- 75% → 8（四捨五入）
- 50% → 5
- 0% → 0
- -10% → 0（負値は0に正規化）
```

### 総合スコア
```javascript
totalScore = Σ(best_testId別のcorrectAnswers)

例:
- テスト1: 80% → 8点
- テスト2: 60% → 6点
- 合計: 14点
```

### 平均スコア
```javascript
averageScore = Σ(attempted tests のpercentage) / attempted count

例:
- テスト1: 80%, テスト2: 60%
- 平均: (80 + 60) / 2 = 70%
```

---

## UI フィードバック設計

### 星評価システム
| スコア率 | 表示     | 意味               |
|---------|---------|-------------------|
| 100%    | ⭐⭐⭐ | 完璧                |
| 70-99%  | ⭐⭐   | 優秀                |
| 40-69%  | ⭐     | 及第点              |
| 0-39%   | 　      | 要復習              |

### メッセージシステム
| スコア率 | メッセージ    | 目的           |
|---------|--------------|----------------|
| 100%    | 🏆 満点！    | 最高評価       |
| 80-99%  | 🌟 すごい！  | ポジティブ強化 |
| 60-79%  | 💪 惜しい！  | 次頑張ろう     |
| 40-59%  | 📚 復習しよう | 学習促進       |
| 0-39%   | 😅 もう一度  | 再チャレンジ   |

---

## パフォーマンス要件

- **大規模データセット**: 100テスト × 10問 = 1000問を高速処理
- **シャッフル**: Fisher-Yates で O(n) の時間計算量
- **スコア計算**: O(n) で複数テストを集計

---

## 設計原則

1. **単一責任**: 各関数・メソッドは1つの役割のみ
2. **入力検証**: 関数の入り口で型・構造をチェック
3. **非破壊**: 配列・オブジェクト操作は新しいインスタンスを返す
4. **テスト駆動**: すべてのロジックをテストでカバー
5. **日本語優先**: UI文字列は日本語、コメントも日本語

---

## 今後の拡張ポイント

1. **Firebase統合**: `setDB()` の実装、リアルタイムスコア同期
2. **UI実装**: HTMLテンプレート、React/Vueコンポーネント化
3. **分析機能**: スコア推移グラフ、学習時間追跡
4. **複数言語対応**: 英語、中国語など
5. **問題バンク拡充**: より多くのクイズ種類

---

**プロジェクト作成日**: 2026-05-15
**バージョン**: 1.0.0
**テストフレームワーク**: Jest 29.7.0
