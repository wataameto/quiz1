# Implementation Spec

AIエージェント向けの詳細な実装仕様。記述が衝突する場合は、[AI_PROJECT_GUIDE.md](./AI_PROJECT_GUIDE.md) の現在の作業ルールと [QUESTION_GUIDE.md](./QUESTION_GUIDE.md) の作問ルールを優先する。

## 重要仕様

現在の実装スナップショットをメインの仕様として扱う。このセクションには、スナップショットだけでは見落としやすい判断・禁止・優先ルールだけを書く。

- このファイル内で記述が衝突した場合は、「重要仕様」と「現在の実装スナップショット」を優先する。
- AI_PROJECT_GUIDE.md の作業ルールと QUESTION_GUIDE.md の作問ルールは、この詳細仕様より優先する。
- 各クイズページ（docs/{quiz}/index.html）のCSS/JSは docs/shared/quiz-app.css・quiz-app.js に一本化されている。個別の index.html はHTML骨格だけを持ち、6ファイルとも内容は同一。骨格自体を変えるときだけ6ファイルへコピーする。
- クイズ固有のタイトル、見出し、説明、色は docs/config.json に置く。HTMLへ個別に戻さない。メインメニューの教材一覧・検索も同じ description を参照する。
- メインメニューは認証状態に関わらず常にホーム画面（教材一覧・検索・成績枠）を表示する。専用ログイン画面はない。ログインが必要な操作（教材トグルなど）だけ、その場でログインを促す。
- 問題数とパート数は questions*.json から動的に計算する。固定の「3パート」「180問」のような表示に戻さない。
- 現在はテストに10問前提が残る箇所がある。問題数ルールを本格的に変える場合は src/bokiQuestions.test.js と表示仕様を見直す。
- 旧スコアキー best_<testId> は questions1.json の後方互換としてのみ扱う。新規保存は best_<level>_<testId> を使う。
- ユーザー変更・ログアウト時は bestScores と cacheInitialized をリセットし、別ユーザーのキャッシュを残さない。
- resetCurrentLevel() は Firestore document の存在確認後に update する。存在しない document に update しない。
- ?admin=1 は管理者認証付きではなく、URLで開ける軽量レビュー画面。セキュリティ機能として扱わない。
- docs/build-info.json は scripts/update-build-time.js と hooks/pre-commit が更新する。pre-commit で変わったらコミットに含める。
- ドキュメントだけの変更なら npm test は不要。JavaScript または問題JSONを変更したら npm test を実行する。
- 簿記の作問ルールは QUESTION_GUIDE.md を優先する。特に分記法、売上/仕入の勘定科目禁止、自然文では使用可の扱いを守る。
- 確認ダイアログは `confirm()`/`alert()` を多用せず、破壊的操作（ログアウト、成績リセット）は自前モーダル（`logout-modal`, `reset-modal` と同じパターン）を使う。iOS Safari系ブラウザは繰り返しダイアログを出すページで「今後表示しない」を選ばれると、以降の `confirm()`/`alert()` が無言で失敗するため。
- Firestoreに新しいコレクションを追加するときは、セキュリティルールが `scores` または `^quiz_.*` にマッチするコレクション名しか許可していないことに注意する（例: メニュー設定は `menu_prefs` ではなく `quiz_menu_prefs`）。
- 新しいクイズの questions1.json（以降の各レベルファイルも）には必ず `id` フィールド（クイズスラッグと同じ値）を入れる。これが無いと `quizId` が undefined のままになり、成績が `quiz_undefined` コレクションに保存される（実際に発生した事故。sap/sample追加時に発覚し修正済み）。
- メインメニューは docs/quiz-meta.json（ビルド時生成）を読んで各クイズの parts/sets/total/setCounts を得る。questions*.json 自体をメインメニューから直接fetchするのは、quiz-meta.jsonに載っていない教材（ローカルで新規追加してまだコミット/ビルドしていない場合など）へのフォールバックのみ。
- 全クリア・周回機能（`isFullyCleared()`/`getLap()`/`advanceLap()`）は、周回を進めても `best_`/`wrongAnswers_` は削除するが `history_`/`lap`/`lapHistory`/`fullClearHistory` は消さない。`lapAttemptCount` だけは周回が進むたびに0へ明示的にリセットする。「周回のたびに成績は初期化されるが、過去の挑戦履歴と周回数・達成記録は積み上がる」という設計。
- 「次の周へ進む」「選択した履歴を削除」は破壊的操作のため、実行前に自前モーダル（advance-lap-modal, delete-history-modal）で確認する。confirmAdvanceLap()/confirmDeleteSelectedHistory() が確認モーダルを開き、advanceLap()/deleteSelectedHistory() が実処理を行う2段構え。

## 現在の実装スナップショット

このセクションは、現行コードを再現・修正するときに最初に参照する要約。後続の詳細仕様に古い記述が残っている場合は、このセクションを優先する。

### ファイル構成
- アプリ本体は docs/ 配下の静的HTML/JSONで動く。アプリ名は「🏠満点まで帰れません✨」。
- メインメニューは docs/index.html（単独ファイル、CSS/JSも内包）。
- クイズページは docs/{quiz}/index.html（boki1, devops, kokyo1, joho1, itpassport, itpassportjr, sap, sample, fp3, takken, showa, heisei, capitals の13種）。13ファイルとも内容が同一（`?v=`キャッシュバスティング用クエリだけ違う）で、共通CSS/JSは docs/shared/quiz-app.css・quiz-app.js を読み込む。
- クイズごとのタイトル、見出し、説明、色は docs/config.json に置く。
- 問題データは docs/{quiz}/questions*.json（レベル＝パートごとに1ファイル）。各ファイルは `id`（クイズスラッグ）を持つ必須フィールド。
- ビルド日時は docs/build-info.json。scripts/update-build-time.js と hooks/pre-commit が更新する。同スクリプトが8クイズページの `?v=` キャッシュバスティングと docs/quiz-meta.json（パート/セット/問題数の集計）も同時に生成する。
- テストは src/*.test.js。Jestで実行する。

### メインメニュー docs/index.html
- 初期表示は screen-loading。auth.onAuthStateChanged(user => ...) が currentUser を設定したら、ログイン状態に関わらず常に showHomeScreen() を呼ぶ（専用ログイン画面はない）。
- loginWithGoogle() は Google Identity Services (GIS) のトークンクライアントを同期的に呼び出す方式（signInWithPopup/signInWithRedirectは使わない。詳細はAI_PROJECT_GUIDE.mdのログイン方式の節）。ログアウトは confirm() ではなく logout-modal（自前モーダル）を経由する confirmLogout()。
- 左上の auth-status に、未ログイン時は「🔐 ログイン」ボタン、ログイン時は「👤 ユーザー名 ログアウト」を表示する（renderAuthStatus）。
- QUIZZES 配列（id, emoji, name, path, collection）が8クイズのメタ定義。クイズを追加するときはここに1行足す。
- loadQuizMetaAll() は docs/quiz-meta.json を1回だけfetchする（Promiseをキャッシュして並列呼び出しでも1リクエストに集約）。calculateQuizMeta(quizId, questionsPath) はこのメタを優先して使い、載っていないクイズだけ questions*.json を直接fetchするフォールバックに落ちる。
- getQuizScore(collectionName, quizId, questionsPath) は quiz-meta.json の setCounts を使って Firestore の best_<level>_<testId> を集計する（questions*.json は読まない）。未ログイン時は {correct: 0, total, lap: 0} を返す（エラーにしない）。lap（周回数）も同じドキュメント読み込みのついでに返す。
- 「あなたの選択教材」ボックス（score-summary, 600px幅で中央寄せ）は、下の「教材一覧」でONにしたクイズだけを表示する。合計（score-summary-total）も同じボックス内、見出しの右に表示する。各行には正答数表示の直前に `⭐×N`（lap>0のとき）を出し、さらに全問正解済みだが「次の周へ進む」をまだ押していない状態（correct===totalかつ）なら `+⭐` を追記する（メインメニューはFirestoreを都度読み直さない設計のため、この判定だけは既存のcorrect/totalから導出する）。
- 「教材一覧」（quiz-toggle-section）は全クイズをトグルスイッチ（左側）付きで一覧表示し、上に検索ボックス（quiz-search-input）でタイトル・説明を絞り込める。
- 教材ごとのON/OFFは visiblePrefs（{quizId: boolean}）で管理し、Firestoreの `quiz_menu_prefs/{uid}` ドキュメントに保存する。初回（ドキュメント未作成）はデフォルト全部OFF。
- toggleQuizVisibility(id) は未ログイン時、保存せずに「教材を選択するにはログインしてください」とアラートを出して終了する。
- forceReload()（最新に更新ボタン）は、直前のトグル保存（pendingPrefsSave）を待ってから location.href でリロードする。
- コンテナ幅は1500pxだが、score-summary ボックスだけ600px固定で中央寄せ。

### クイズ画面 docs/{quiz}/index.html（共通: docs/shared/quiz-app.js）
- 全クイズページで共通のJSを使う。差分を作る場合は本当に必要か確認する。
- 起動時に ../config.json と questions*.json を読み込み、quizId に合う config を画面へ反映する。
- URLパラメータ admin=1 のときは通常のテスト選択ではなく showAdmin() を表示する。
- 画面は主に screen-home（「教材トップ」ラベル表示）, screen-quiz, screen-results, screen-admin を切り替える。
- currentLevel は現在のパート、maxLevel は読み込めた最大パート数、quizData[level] は各パートのJSON、TESTS は現在パートの tests。
- showHome() はパートごとに `.part-block` を描画する（アコーディオン）。パート行クリックで toggleLevel() が呼ばれ、シングルアコーディオン（1つ開くと他は閉じる）で開閉する。初期状態は全パート閉じている（homeCollapsed = true）。パート行の集計表示（`.part-value`）は「試験 X/Y問(N回)・演習/復習(M回)」の形式で、先頭に「試験」ラベルを明記する（演習/復習の回数と並べたときにどちらの回数か分かるように）。
- 各セットは `.part-set-row`（横長のリスト行、Finder風）で、行自体はクリック不可。ボタンは「試験」（.set-exam-btn、goToTest → startTest(id, false, false)、常時表示）と、誤答があれば「誤答復習」（.set-review-btn）、なければ「演習」（.set-practice-btn）（どちらも記録なし）の2つ。ボタン内の2行目（成績や回数）は `.btn-sub-score` クラスで1行目より大きいフォントにする。3つのボタンとも文言の長さで幅が揃わないことがあるため `.set-actions button` に min-width（PC 7.8rem / 520px以下 7.0rem）を指定して幅を揃える。
- goToTest(level, testId, isReview, isPractice) は必要ならパートを切り替えてから startTest() を呼ぶ。
- startTest(id, isReview, isPracticeMode) は通常テスト（記録あり）、間違い復習、練習モードを兼ねる。記録されるのは isReview も isPracticeMode も false のときだけ（showResults() 内）。
- renderQuestion() は選択肢を毎問シャッフルし、shuffledChoices に元の選択肢インデックスを保持する。
- answer() は選択後に正誤表示、効果音、解説、次へ進む操作を出す。
- showResults() は結果、星評価、間違い復習ボタン、回答一覧を表示する。試験モードのときは recordTestResult() を呼び、最高: X点/N回（N回＝getAttemptCount、attemptCount_フィールド優先・無ければhistory.length）も表示する。
- 成績リセット（resetScores）とログアウト（logout）は、いずれも自前モーダル（reset-modal, logout-modal）で確認してから実行する。「📊 成績/設定」ボタン（openScoreModal）から成績履歴・成績リセット・表示サイズ設定を開く。

### 成績履歴・全クリア・周回機能
- recordTestResult(id, score) は試験モード完走のたびに `history_<level>_<id>` へ `{no, score, date}` を追記する。no は attemptCount_<level>_<id>（削除されない通し番号）から採番。追記後、配列が11件（初回1件＋直近10件）を超えたら [先頭, ...末尾10件] に間引く。
- getAttemptCount(id, level) は attemptCount フィールドを返す。showScoreHistory() での表示回数は `Math.max(attemptCount, history.length)` を使う（この機能追加前からの古い履歴には attemptCount が無いため）。
- showScoreHistory() は各セットの履歴をチェックボックス付きで表示し、deleteSelectedHistory() でチェックした要素だけ history_ 配列から取り除く（best_やattemptCount_には触れない）。
- isFullyCleared() は読み込み済み全レベル・全セットの best が100かどうかを判定する（1セットも無ければfalse）。getLap()/advanceLap() が周回数を管理する。advanceLap() は confirmAdvanceLap() の確認モーダル経由で呼ばれ、best_・wrongAnswers_ を削除しつつ lap を+1、lapHistory に `{lap, date}` を追記、lapAttemptCount を0にリセットする（history_/fullClearHistoryは消さない）。
- showHome() は #full-clear-banner に、lap>0なら「🌟 全クリア ×N」バッジ、isFullyCleared()がtrueなら「🎉 全問正解達成！」＋「🏁 次の周へ進む」ボタンを両方とも表示できる（周回を無限に進められる設計）。
- lapAttemptCount は「今の周回に入ってから試験モードを何回受けたか」を数える通しカウンター。recordTestResult() が試験モード完走のたびに+1し、advanceLap() が0に戻す。
- recordTestResult() は更新前後で isFullyCleared() を比較し、false→trueに転じた瞬間（＝その周回で初めて全問正解を達成した瞬間）だけ fullClearHistory に `{lap: getLap()+1, date, attempts: その時点のlapAttemptCount}` を追記する。以後同じ周回中に再度全問正解の状態が続いても追記しない（次にlapが進んでリセットされるまで再発火しない）。
- showScoreHistory() の周回履歴セクションは、最初の挑戦日時（全セットのhistory_から最も古い日付を検索）による「🌟 1周目開始」、lapHistoryの各エントリによる「🌟 (lap+1)周目開始」、fullClearHistoryの各エントリによる「🎉 N周目全問正解（M回挑戦）」を、parseJstDateString()で実際の日時順にソートしてから表示する（push順ではなく日時順）。
- resetCurrentLevel() は現在パートの best_/wrongAnswers_/history_/attemptCount_ を削除するが、lap/lapHistory/lapAttemptCount/fullClearHistoryは触らない（周回トロフィーは維持）。resetAllLevels() はdocument自体を削除するのでlapも含め全部消える。

### 管理レビュー ?admin=1
- docs/{quiz}/?admin=1 で問題一覧を表示する（全クイズ共通）。
- screen-admin には全パート、全テスト、全問題、全選択肢、正解、解説を表示する。
- 仕訳問題の選択肢は renderJournal(choice) で表示する。
- 正解選択肢には correct class とチェック表示を付ける。
- 管理者専用認証はない。URLを知っていれば表示できる軽量レビュー画面として扱う。

### Firestore スキーマ
- スコア用collection名は quiz_<quizId>。例: quiz_boki1, quiz_devops, quiz_kokyo1, quiz_joho1, quiz_itpassport, quiz_itpassportjr, quiz_sap, quiz_sample。quizId は questions1.json の `id` フィールドから取得するため、新規クイズでは必ずこれを設定すること（無いと quiz_undefined に保存される）。
- メインメニューの教材トグル設定は quiz_menu_prefs（document id は uid、フィールド visible が {quizId: boolean}）。
- セキュリティルールは `request.auth.uid == userId && (collection == 'scores' || collection.matches('^quiz_.*'))` の形。新規コレクションは `quiz_` プレフィックス必須（`scores` は現状未使用）。
- document id は currentUser.uid。
- 最高点は best_<level>_<testId> に保存する。
- 間違えた問題番号は wrongAnswers_<level>_<testId> に配列で保存する。
- 挑戦履歴は history_<level>_<testId> に `[{no, score, date}, ...]` で保存する（初回1件＋直近10件まで）。
- 通しの挑戦回数は attemptCount_<level>_<testId>（履歴が間引かれても減らない）。
- 全クリア周回数は lap（整数）、周回開始日時は lapHistory（`[{lap, date}, ...]`）。
- 今の周回に入ってからの試験挑戦回数は lapAttemptCount（整数、advanceLap()で0にリセット）。全問正解を達成した日時は fullClearHistory（`[{lap, date, attempts}, ...]`、周回ごとにfalse→true転換時のみ追記）。
- 旧キー best_<testId> はメインメニューの集計で後方互換として扱う。
- resetCurrentLevel() は現在パートの best_*・wrongAnswers_*・history_*・attemptCount_* を FieldValue.delete() で削除する（lap/lapHistoryは触らない）。Firestore document が存在しない場合は update しない。
- resetAllLevels() は現在ユーザーの quiz collection document を削除する（lap/lapHistory含め全部消える）。
- ログアウトまたは認証ユーザー変更時は currentUser と bestScores/cacheInitialized を更新し、別ユーザーのキャッシュを残さない。

### 点数と問題数
- 問題JSONは現在テスト上 1テスト10問を期待している箇所があるが、UI表示は問題数を動的に扱う。
- クイズ画面の結果スコアは correct * 10 点、満点は currentTest.questions.length * 10 点。
- Firestoreに保存する best_* も点数として扱う。メニュー集計では Math.round(score / 10) で正答数へ戻す。
- 10問以外を読み込むこと自体はできるが、テストや仕様で固定を期待している箇所が残る可能性がある。問題数ルールを変えるときは src/bokiQuestions.test.js と表示仕様も見直す。

### 問題JSONスキーマ
- 1ファイルは { id, label, description, tests } を持つ。
- tests[] は { id, title, emoji, type, subtitle, questions } を持つ。
- questions[] は { id, scenario, choices, correct, type, explanation } を持つ。
- type === 'choice' の choices は文字列配列。
- type === 'journal' の choices は { debit: [{ account, amount }], credit: [{ account, amount }] } の配列。
- correct は choices の0始まりインデックス。
- 簿記の作問ルールは QUESTION_GUIDE.md を優先する。特に仕訳の勘定科目名として 売上 / 仕入 を使わない。

### テストで守っていること
- src/menu.test.js はメニュー名が config と一致すること、パート数/問題数を動的に扱うこと、スコア集計対象、reset時の存在確認、admin mode の存在を確認する。
- src/bokiQuestions.test.js は簿記問題JSONの構造、10問構成、解説、重複選択肢なし、仕訳の借貸一致、禁止勘定科目を確認する。
- src/scoreManager.test.js は ScoreManager のスコア計算、collection名、平均、試行済み判定を確認する。
- src/utils.test.js と src/integration.test.js はユーティリティ、仕訳表示、スコア表示ロジック、統合的な計算を確認する。


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
- src/scoreManager.js の共通計算では、1テスト10問・100点満点換算を前提にする
- 実クイズ画面は currentTest.questions.length から満点を計算する
- メニュー集計では保存点数を Math.round(score / 10) で正答数へ戻す

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
  // 例: "借: 現金 ¥10,000・売掛金 ¥5,000 ／ 貸: 商品 ¥15,000"
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
  label: string,                 // レベル/パートラベル（例: "1", "基礎初級"）
  description: string,           // オプション：パート説明
  tests: [
    {
      id: number | string,       // テストID
      title: string,             // テストタイトル（形式例: "💡 簿記パート1-1" または "📦 基礎初級-1"）
      emoji: string,             // テストアイコン（表示は非表示にされている）
      type: string,              // テストタイプ（表示用）
      subtitle: string,          // テストサブタイトル
      questions: [
        {
          id: number | string,
          scenario: string,       // 問題文・シナリオ
          choices: any[],         // 選択肢（型は問題によって異なる）
          correct: number,        // 正答のインデックス
          type?: string,          // オプション: 'journal' | 'choice'
          explanation?: string,   // オプション：解説
        },
        ...
      ],
    },
    ...
  ],
}
```

**テストタイトルフォーマット:**
- 簿記: 「💡 簿記パート1-1」「📊 簿記パート1-2」など
- DevOps: 「📦 基礎初級-1」「🏗️ 基礎初級-2」など

### クイズタイプ

**1. 仕訳形式（簿記）**
```javascript
{
  scenario: '商品を現金¥10,000で売り上げた',
  choices: [
    { account: '現金', amount: 10000 },
    { account: '商品', amount: 10000 },
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
ユーザーが通常テストを再受験
↓
新スコア vs 旧スコア を比較
↓
改善時: 新しいスコアで上書き
↓
誤答記録も更新
↓
フィードバック: `getScoreMessage()` と `getStarRating()` でUI表示
```

**注意：** 復習ボタン・テスト後復習・練習モード実行時は、スコア記録フローに入らない

### テスト実行時のスコア記録条件
```javascript
// showResults() 内の判定ロジック
if (!isReviewMode && !isPracticeModeActive) {
  // ✅ 通常テストのみ
  await setBest(currentTest.id, score);           // スコア記録
  await saveWrongAnswers(currentTest.id, answers, currentLevel); // 誤答記録
} else {
  // ❌ 復習・練習モードは記録しない
}
```

### キャッシュ管理
- `bestScores`: ユーザーの最高スコアをキャッシュ
- `clearCache()`: キャッシュをリセット
- Firebase連携時はDBから最新スコアを読み込み
- スコアリセット時：キャッシュと初期化フラグもリセット

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
npm test                    # 全テスト実行
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
│   ├── index.html            # メインメニューページ（カラースキーム：青系）
│   ├── build-info.json       # コミット日時情報（自動生成）
│   ├── boki1/
│   │   ├── index.html        # 簿記クイズページ（3パート）
│   │   ├── questions1.json   # パート1データ（3テスト）
│   │   ├── questions2.json   # パート2データ（3テスト）
│   │   └── questions3.json   # パート3データ（3テスト）
│   └── devops/
│       ├── index.html        # DevOpsクイズページ（共通テンプレート）
│       ├── questions1.json   # パート1: 基礎初級データ（6テスト）
│       ├── questions2.json   # パート2: 基礎中級データ（6テスト）
│       └── questions3.json   # パート3: 基礎上級データ（6テスト）
├── scripts/
│   └── update-build-time.js  # コミット日時自動生成スクリプト
├── hooks/
│   └── pre-commit            # Git pre-commitフック（自動build実行）
├── .claude/
│   ├── hooks/
│   │   └── session-start.sh  # セッション開始時に npm install と setup-hooks.sh を実行
│   ├── settings.json         # SessionStart フック登録（Claude Code on the web 用）
│   └── settings.local.json   # ローカル設定（権限許可など）
├── package.json              # npm設定（build, prepare フック）
├── jest.config.js            # Jest設定
├── setup-hooks.sh            # Git フック セットアップスクリプト
├── README.md                 # 人間向け概要
├── TEST_DOCUMENTATION.md     # テストドキュメント
├── AI_PROJECT_GUIDE.md       # AI向け作業ルール
├── QUESTION_GUIDE.md         # 作問ルール
├── IMPLEMENTATION_SPEC.md    # 実装仕様
├── AGENTS.md                 # Codex入口
├── CLAUDE.md                 # Claude入口
├── GEMINI.md                 # Gemini入口
└── .github/copilot-instructions.md # GitHub Copilot入口
```

---

## HTMLページのスコア管理実装（docs/boki1/index.html, docs/devops/index.html）

### マルチレベルスコア管理

**Firestoreキー形式:**
```
best_<level>_<testId>: <percentage>

例:
- パート1テスト1: best_1_1: 80
- パート2テスト1: best_2_1: 75
- パート2テスト2: best_2_2: 90
```

### Firebase認証とキャッシュ初期化

**初期化フロー:**
1. ページ読み込み時、`auth.onAuthStateChanged()` が実行される（非同期）
2. 認証完了時、`currentUser` が設定され、同時に `loadAllQuestions()` が呼ばれる
3. `loadAllQuestions()` で全レベルのクイズデータを読み込む
4. 最初の `showHome()` が呼ばれ、レベル別スコアを表示

**重要:** `loadAllQuestions()` は`auth.onAuthStateChanged()` **内部** で呼ばれるため、`currentUser` が確実に設定されてから実行される。これにより初期表示でスコアが正しく表示される。

### キャッシュ戦略（`bestScores`）

**問題:** 複数の `getBest()` 呼び出しが並行実行されると、Firestoreレスポンスのタイミングがランダムになり、キャッシュ状態が不確定になる。

**解決策:** キャッシュ初期化を1回だけ実行し、その後はキャッシュからのみ読み取る。

**実装:**
```javascript
let bestScores = {};           // キャッシュ
let cacheInitialized = false;  // 初期化フラグ

async function initializeBestScoresCache() {
  if (cacheInitialized || !currentUser) return;
  try {
    const collection = getCollectionName();
    const doc = await db.collection(collection).doc(currentUser.uid).get();
    const scores = doc.exists ? doc.data() : {};
    bestScores = scores;        // 一度だけ取得
    cacheInitialized = true;
  } catch (e) { console.error(e); }
}

async function getBest(id, level = currentLevel) {
  if (!currentUser) return -1;
  if (!cacheInitialized) {
    await initializeBestScoresCache();  // 初回のみ初期化
  }
  return parseInt(bestScores[`best_${level}_${id}`] || '-1', 10);
}
```

**キャッシュリセット:** `resetScores()` で新スコアをリセットするときは、キャッシュと初期化フラグもリセット：
```javascript
bestScores = {};
cacheInitialized = false;
```

### レベル別スコア表示

`showHome()` で複数レベルのスコアを集計表示：
```javascript
for (let level = 1; level <= maxLevel; level++) {
  const levelData = quizData[level];
  let levelCorrect = 0;
  for (const t of levelData.tests) {
    const best = await getBest(t.id, level);  // 明示的にlevelを指定
    if (best >= 0) {
      levelCorrect += Math.round(best / 100 * 10);
    }
  }
  // レベル別の成績を表示
}
```

**重要:** `getBest(id, level)` に **明示的に level を渡す**。デフォルト値 `currentLevel` を使用するとバグが発生する。

### 解答記録と復習機能

**目的：** ユーザーが解いた問題の正解/不正解を記録し、後で間違い問題だけを復習できる機能

**Firestore コレクション構造：**

```
quiz_<quizId>/{userId}
  ├─ best_<level>_<testId>: <percentage>
  ├─ best_1_1: 85
  ├─ best_1_2: 92
  ├─ best_2_1: 78
  │ ...
  │
  ├─ wrongAnswers_<level>_<testId>: [<questionIds>]
  ├─ wrongAnswers_1_1: [1, 3, 5]        // テスト1-1で間違えた問題番号
  ├─ wrongAnswers_1_2: [2, 7, 9]        // テスト1-2で間違えた問題番号
  ├─ wrongAnswers_2_1: [4, 6]
  │ ...
```

**フィールド定義：**

- `best_<level>_<testId>`: パーセンテージスコア（0-100）
  - 例：`best_1_1: 85` （レベル1テスト1の最高得点は85%）

- `wrongAnswers_<level>_<testId>`: 不正解だった問題番号の配列（1-indexed）
  - 例：`wrongAnswers_1_1: [1, 3, 5]` （レベル1テスト1で問題1, 3, 5が不正解）
  - **重要：** 初回完了時点での正解/不正解を記録。復習後の再解答では更新しない

**コレクション名の生成：**
```javascript
function getCollectionName(quizId) {
  return `quiz_${quizId}`;
}

// 例：
// quizId: 'boki1' → 'quiz_boki1'
// quizId: 'devops' → 'quiz_devops'
```

**データ例：**

```javascript
// DevOps の例
quiz_devops/{userId}
{
  // 最高得点（既存）
  best_1_1: 85,   // 基礎初級-テスト1
  best_1_2: 92,
  best_1_3: 78,
  best_1_4: 88,
  best_1_5: 95,
  best_1_6: 82,
  best_2_1: 75,   // 基礎中級-テスト1
  best_2_2: 89,
  best_3_1: 80,   // 基礎上級-テスト1
  // ...
  
  // 間違い問題（新規）
  wrongAnswers_1_1: [1, 3, 5],
  wrongAnswers_1_2: [2, 7, 9],
  wrongAnswers_1_3: [4, 6, 8, 10],
  wrongAnswers_1_4: [3],
  wrongAnswers_2_1: [1, 2, 4, 5, 7],
  // ...
}

// 簿記の例
quiz_boki1/{userId}
{
  best_1_1: 90,   // パート1-テスト1
  best_1_2: 85,
  best_1_3: 88,
  best_2_1: 75,   // パート2-テスト1
  best_2_2: 92,
  best_2_3: 80,
  best_3_1: 87,   // パート3-テスト1
  
  wrongAnswers_1_1: [2, 5],
  wrongAnswers_1_2: [1, 4, 7],
  wrongAnswers_2_1: [3, 6, 8, 9],
  // ...
}
```

**テスト実行モードと記録ルール：**

4つのテスト実行モードがあり、スコア・誤答の記録ルールが異なる：

| モード | 実行方法 | 出題内容 | スコア記録 | 誤答記録 | 結果画面タイトル |
|--------|--------|--------|---------|--------|-----------------|
| **通常テスト** | テストカードをクリック | 問題データに従う | ✅ 記録 | ✅ 記録 | 「テスト結果 🎉」 |
| **復習ボタン** | 「誤答復習(X問)」ボタン | 前回の誤答のみ | ❌ 記録しない | ❌ 更新しない | 「復習結果」 |
| **テスト後復習** | 結果画面「復習」ボタン | 今回の誤答のみ | ❌ 記録しない | ❌ 更新しない | 「復習結果」 |
| **練習モード** | 練習モードボタン | 問題データに従う | ❌ 記録しない | ❌ 記録しない | 「練習結果」 |

**スコア記録の詳細：**

1. **通常テスト時の記録**
   - `best_<level>_<testId>`: スコア（パーセンテージ）を記録
   - 新スコア > 旧スコア の場合のみ上書き（最高得点を保持）
   - `wrongAnswers_<level>_<testId>`: 不正解だった問題IDを配列で記録

2. **復習ボタン時（isReviewMode = true）**
   - スコア保存なし（`setBest()`呼ばない）
   - 誤答記録更新なし（`saveWrongAnswers()`呼ばない）
   - 何度復習しても `best_<level>_<testId>` と `wrongAnswers_<level>_<testId>` は不変

3. **テスト後復習時（isReviewMode = true）**
   - スコア保存なし
   - 誤答記録更新なし
   - 復習後のスコア向上は反映されない

4. **練習モード時（isPracticeModeActive = true）**
   - スコア保存なし
   - 誤答記録保存なし
   - スコアや誤答は記録されず、学習目的のみ

**誤答記録の更新ルール：**

- 初回の通常テスト実行時に `wrongAnswers_<level>_<testId>` が作成される
- その後、復習ボタンやテスト後復習で何度再解答しても、誤答記録は**初回の記録のままキープ**
- 同じテストを再度通常モード（`startTest(id, false, false)`）で実行した場合のみ、新しいスコアと誤答が記録される
- スコアリセット（`resetCurrentLevel()`）時は、対応する `wrongAnswers_<level>_<testId>` も一緒に削除される

**復習ボタン表示条件：**
- `wrongAnswers_<level>_<testId>` が存在し、かつ要素数 > 0 の場合のみ表示
- ボタン上に誤答数が表示される（例：「誤答復習(3問)」）

**練習モードボタン表示条件：**
- テストの `best_<level>_<testId>` が存在しない（スコア < 0）場合のみ表示
- 一度でも通常テストを実行すると、練習ボタンは表示されなくなる

### デバイスタイプとビルド時刻表示

ページ左下に固定表示：
- **デバイス判定:** `navigator.userAgent` で Touch/PC を判定
- **ビルド時刻:** `docs/build-info.json` から動的に読み込み（**日本標準時 JST で表示**）
- **フォント:** 14px、2行表示（デバイス / ビルド時刻）
- **形式:** `YYYY-MM-DD HH:MM:SS`（秒単位、日本時間）

```javascript
(function() {
  const isTouchDevice = () => {
    return (('ontouchstart' in window) ||
            (navigator.maxTouchPoints > 0) ||
            (navigator.msMaxTouchPoints > 0));
  };
  const deviceType = isTouchDevice() ? '📱 Touch' : '🖥️ PC';

  let buildTime = 'Loading...';
  fetch('../build-info.json')
    .then(res => res.json())
    .then(data => {
      buildTime = data.buildTime;  // JST で読み込み
      updateBuildTimeDisplay();
    })
    .catch(err => {
      buildTime = 'Unknown';
      updateBuildTimeDisplay();
    });

  function updateBuildTimeDisplay() {
    const timeEl = document.getElementById('build-time-display') || createBuildTimeDisplay();
    timeEl.innerHTML = `${deviceType}<br>ビルド: ${buildTime}`;
  }

  function createBuildTimeDisplay() {
    const timeEl = document.createElement('div');
    timeEl.id = 'build-time-display';
    timeEl.style.position = 'fixed';
    timeEl.style.bottom = '10px';
    timeEl.style.left = '10px';
    timeEl.style.fontSize = '14px';
    timeEl.style.color = '#999';
    timeEl.style.zIndex = '9999';
    timeEl.style.pointerEvents = 'none';
    timeEl.style.lineHeight = '1.4';
    timeEl.style.whiteSpace = 'nowrap';
    document.body.appendChild(timeEl);
    return timeEl;
  }

  createBuildTimeDisplay();
  updateBuildTimeDisplay();
})();
```

**日本時間（JST）での表示：**
- コミット日時は `docs/build-info.json` に JST 形式で保存される
- `update-build-time.js` スクリプトが日本標準時で自動生成
- HTML 左下に「📱 Touch（または 🖥️ PC）」と「ビルド: YYYY-MM-DD HH:MM:SS」で表示

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

### 5. Firebase連携と認証タイミング
- **認証完了後の初期化:** `auth.onAuthStateChanged()` 内で `loadAllQuestions()` を呼ぶ
  - 初期表示で `currentUser` が確実に設定されている
  - 初期スコア取得が正常に動作する
- **キャッシュ初期化:** `cacheInitialized` フラグで1回だけ実行
  - 複数の `getBest()` 並行実行時の競合状態を防止
  - Firestore呼び出しを最小化（パフォーマンス向上）
- **スコア書き込み:** `setBest()` で新スコアをFirestore+キャッシュ両方に更新
  - キャッシュとFirestoreの整合性を保つ

### 6. マルチレベルスコア管理
- **レベル別キー:** `best_<level>_<testId>` 形式でFirestoreに保存
- **getBest() 呼び出しの2つのパターン：**
  1. **全レベルをループで処理する場合** - `level` パラメータ **必須**
     - 例：部分成績表示で複数レベルを計算する時
     - `for (let level = 1; level <= maxLevel; level++) { const best = await getBest(t.id, level); }`
     - デフォルト値 `currentLevel` に依存するとバグになる
  2. **currentLevel のテストのみを処理する場合** - `level` パラメータ **不要**
     - 例：テストカード表示（TESTS は currentLevel のテストのみ）
     - `const best = await getBest(t.id);` でOK（デフォルト `currentLevel` を使用）
- **ホーム画面の表示内容：**
  - **総合成績**（ページ右上）: 全レベル全テストの合計点数のみ表示
  - **部分成績セクション**（複数レベルある場合）: 各レベルの詳細スコア（クリックで切り替え）
  - **テストカード**（メイン表示）: 現在の `currentLevel` のテストのみ
- **レベル切り替え:** `switchLevel()` で `currentLevel` を更新
  - その後 `loadQuestions(level)` → `showHome()` で表示を再計算
  - キャッシュは保持されるため Firestore 呼び出し不要
- **Firestore構造:** ユーザードキュメント内に全レベル全テストのスコアを保存
  ```
  {
    best_1_1: 80, best_1_2: 90,
    best_2_1: 75, best_2_2: 70,
    best_3_1: 85, best_3_2: 88, best_3_3: 92
  }
  ```

### 6. UI表示仕様
- **デバイス表示**: 左下に固定表示、フォントサイズ14px
  - Touch デバイス: 📱 Touch
  - PC デバイス: 🖥️ PC
- **ビルド時刻表示**: コミット日時（日本標準時 JST = UTC+9）
  - 形式: YYYY-MM-DD HH:MM:SS（2行表示）
  - 毎回のgit pushでcommitタイムスタンプが自動注入

---

## テンプレートとメタデータ管理

### テンプレート統一（config.json）

**目的:** boki1 と devops のテンプレート HTML を統一し、quiz 固有の表示情報は config.json で管理

**実装方式:**
- `docs/boki1/index.html` と `docs/devops/index.html` は同一の HTML テンプレート
- `docs/config.json` にクイズごとの表示メタデータを記録
- JavaScript が `questions.json` から `quizId` を読み込む
- `quizId` に対応する config を取得して、CSS・DOM を動的に更新

**config.json の構造:**
```json
{
  "boki1": {
    "title": "📚 簿記超入門レベル",
    "heading": "簿記超入門レベル",
    "description": "簿記（会計）の基礎知識",
    "icon": "📚",
    "bgColor": "#0f2027",
    "bgGradient": "linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)",
    "topGradient": "linear-gradient(90deg, #667eea, #f093fb, #f5576c, #fda085)",
    "accentColor": "#667eea",
    "accentActive": "linear-gradient(135deg, #f7f8ff, #f5f7ff)"
  },
  "devops": {
    "title": "☁️ AWS認定DevOpsエンジニア(DOP-C02)",
    "heading": "AWS認定DevOpsエンジニア(DOP-C02)",
    "description": "AWS DevOps Engineer Professional",
    "icon": "☁️",
    "bgColor": "#0f2027",
    "bgGradient": "linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)",
    "topGradient": "linear-gradient(90deg, #f7971e, #ffd200, #21d4fd, #b721ff)",
    "accentColor": "#f7971e",
    "accentActive": "linear-gradient(135deg, #fff9ed, #fffbea)"
  }
}
```

**HTML での動的適用例:**
```javascript
const cfg = configData[quizId];
document.title = cfg.title;
document.body.style.background = cfg.bgGradient;
document.getElementById('quiz-heading').textContent = cfg.heading;

const dynamicStyle = document.getElementById('dynamic-colors');
dynamicStyle.textContent = `
  .container::before { background: ${cfg.topGradient}; }
  .level-btn.active { border-color: ${cfg.accentColor}; }
  /* その他のスタイル */
`;
```

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
- 自動実行: `prepare` script と `hooks/pre-commit`
- package.json に以下設定:
  ```json
  "scripts": {
    "build": "node scripts/update-build-time.js",
    "prepare": "git config core.hooksPath hooks && npm run build"
  }
  ```

**仕様の重要ポイント：**
- コミット日時は**必ず日本時間（JST）で表示**
- TZ=Asia/Tokyo 環境変数で強制指定
- プレースホルダー形式は `__BUILD_TIME__` (アンダースコア2つ)
- ビルド後はプレースホルダーが実際の日時に置き換わる
- 毎回のcommitでコミット日時が更新される

**ビルドシステム：コミット日時の自動更新**

**仕組み：**
- git pre-commitフックで自動的に `npm run build` を実行
- `docs/build-info.json` にタイムスタンプを保存（日本標準時JST）
- HTMLファイルは一切変更されない
- JavaScriptで `build-info.json` を読み込んで動的に表示

**セットアップ（初回のみ）：**
```bash
bash setup-hooks.sh
```

**Workflow（セットアップ後）：**
```bash
git add .
git commit -m "..."   # ← フックが自動的に npm run build を実行
git push
```

**特徴：**
- `npm run build` は手動不要 → フックで自動実行
- build-info.jsonは自動的にcommitに含まれる
- HTMLファイルは変更されない → 確実でシンプル
- 全ページで日本時間（JST）で表示

### セッション開始フック (.claude/hooks/session-start.sh)

**目的：** リモート環境（Claude Code on the web）で毎回のセッション開始時に、自動的に npm dependencies と git pre-commit フックをセットアップする

**背景：** リモート環境では毎回 fresh clone されるため、前回のセッションで設定した .git/hooks が引き継がれない。これにより、git commit 時にビルド日時の更新が自動実行されないという問題が発生していた。

**実装：**
- `.claude/hooks/session-start.sh` - セッション開始時に実行するスクリプト
  1. `npm install` - 依存パッケージをインストール
  2. `bash setup-hooks.sh` - git pre-commit フックをセットアップ

- `.claude/settings.json` - SessionStart フックを登録
  ```json
  {
    "hooks": {
      "SessionStart": [
        {
          "hooks": [
            {
              "type": "command",
              "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/session-start.sh"
            }
          ]
        }
      ]
    }
  }
  ```

**特徴：**
- セッション開始時に自動実行 → 手動セットアップ不要
- npm packages と git hooks が確実にセットアップされる
- 同期モード（Synchronous）で実行 → race condition なし
- 実行結果は `.claude/hooks/session-start.sh` のログで確認可能

**動作フロー：**
```
セッション開始
  ↓
SessionStart フック実行
  ├─ npm install （初回のみ、node_modules が無い場合）
  └─ bash setup-hooks.sh （pre-commit フックをセットアップ）
  ↓
セッション準備完了 → ユーザーが git commit 実行
  ↓
pre-commit フック自動実行 → docs/build-info.json を最新時刻で更新
```

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

## UI 仕様と表示設計

### テスト選択ページのレイアウト（docs/boki1/index.html, docs/devops/index.html）

**構成要素:**
1. **ヘッダー**
   - クイズタイトル（config.json から動的に取得）
   - 例: 「簿記超入門レベル」
   - ユーザー情報（ログアウトボタン付き）

2. **パート別成績表示**（統合表示）
   - クリック可能なスコア行
   - レイアウト: 「🟢 パート X」| 「X問 / Y問」
   - クリックでパート切り替え
   - 選択中のパートは枠線でハイライト

3. **総合成績** - ページ上部に小さく表示
   - 形式: 「合計：X問 / Y問」
   - 右寄せ、小さいフォント（0.85rem）

4. **リセットボタン** - 総合成績エリアの右側
   - クリックでモーダルダイアログを表示
   - モーダルオプション:
     - 「キャンセル」
     - 「現在のパートのスコアをリセット」
     - 「全パートのスコアをリセット」

5. **テストグリッド** - テストカード（コンパクト化）
   - パディング: 12px 14px（コンパクト）
   - 大きなアイコンは非表示
   - 表示内容: テスト名、タイプ、最高スコア

**デバイス表示とビルド時刻**（全ページ共通）
- **位置**: 左下に固定（position: fixed）
- **フォントサイズ**: 14px
- **色**: #999（薄いグレー）
- **表示内容**:
  - 1行目: デバイス判定（「📱 Touch」または「🖥️ PC」）
  - 2行目: 「ビルド: YYYY-MM-DD HH:MM:SS」（日本標準時 JST）
- **実装**: build-info.json を fetch して動的に表示

### メインメニュー（docs/index.html）

**表示内容:**
- **ログイン画面**: ユーザーが未認証時に表示
  - ロゴ（📚）、タイトル、ログインボタン
- **ホーム画面**: ユーザー認証後に表示
  - ユーザー情報（アバター + 名前 + ログアウトボタン）
  - 総合成績（右寄せ、小さい表示）
    - 形式: 「合計：X問 / Y問」
    - 位置: スコアサマリーの上
  - クイズ一覧（クリック可能リンク）
    - 「📖 簿記（3パート）」- X問 / 90問
    - 「☁️ DevOps（Nパート）」- X問 / Y問

**カラースキーム:**
- **背景**: 濃紺グラデーション (`linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)`)
- **アクセント色**: 青系（`#0066ff` → `#0099ff`）
  - ログインボタン
  - ユーザーアバター背景
  - スコア表示背景

**レイアウト:**
- トップアライン（`align-items: flex-start`）- コンテンツが上に寄せられる
- 最大幅 600px
- パディング: 24px 18px

### 成績リセット機能

**リセットボタン動作:**
- テスト選択ページに「成績リセット」ボタンを配置
- クリックでモーダルダイアログを表示
- ユーザーは以下から選択可能:
  1. **キャンセル** - リセットしない、ダイアログ閉じる
  2. **現在のパートのみリセット** - `resetCurrentLevel()` を実行
  3. **全パートをリセット** - `resetAllLevels()` を実行

**リセット時の動作:**
- Firestore のスコアドキュメントから該当キーを削除
- ブラウザキャッシュ（`bestScores`）をリセット
- ページを自動的にリロードして表示を更新

### 用語統一

すべてのクイズで「パート」という表記を統一：
- 簿記: 「3パート」
- DevOps: パート数は問題JSONから動的に表示
  - 内部的には「レベル」という変数名を使用（コード層）
  - UI 表示では「パート」を使用（ユーザー層）

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

## 既知の制限と注意事項

### 1. Firebase認証の必須性
- スコア管理には Firebase Authentication が必須
- `currentUser` が `null` の場合、すべての `getBest()` は -1 を返す
- 匿名認証での動作はテストされていない

### 2. キャッシュの一貫性
- `bestScores` キャッシュはメモリ内のみ（ページリロードでリセット）
- `setBest()` で新スコアをFirestoreに書き込んでもキャッシュは自動更新される
- `resetScores()` 後はキャッシュと初期化フラグをリセット必須

### 3. パフォーマンスに関する考慮
- 初回ページロード時に Firestore からユーザードキュメントを1回取得
  - 全レベル全テストのスコアを一度にキャッシュ
  - その後の `getBest()` 呼び出しはメモリ内キャッシュから O(1) で取得
- Firestore のネットワーク遅延により初期表示が遅延する可能性あり

### 4. レベルスイッチング時の動作
- レベル切り替え時、`currentLevel` が変更される
- 新しい `showHome()` でレベル別スコア（全レベル）が再計算される
- キャッシュは保持されるため、再度のFirestore呼び出しは発生しない

---

## 今後の拡張ポイント

1. **Firebase統合**: `setDB()` の実装、リアルタイムスコア同期
2. **UI実装**: HTMLテンプレート、React/Vueコンポーネント化
3. **分析機能**: スコア推移グラフ、学習時間追跡
4. **複数言語対応**: 英語、中国語など
5. **問題バンク拡充**: より多くのクイズ種類

---

## AIエージェントでの開発ガイドライン

### 🌍 言語対応
- **すべてのコミュニケーション**: 日本語で対応します
- **コード内の日本語**: コメント・変数名・UIメッセージはすべて日本語を優先
- **エラーメッセージ**: ユーザーには日本語で説明

### 📋 開発時の心得
1. **テスト駆動**: 新機能追加・バグ修正前に該当テストを確認
2. **コミットメッセージ**: 日本語で明確に（「何を」「なぜ」を含める）
3. **関連ドキュメント更新**: 仕様変更時は AI_PROJECT_GUIDE.md / QUESTION_GUIDE.md / IMPLEMENTATION_SPEC.md の該当箇所を反映
4. **シンプル設計**: 必要最小限の実装を心がける

### 📝 HTML ファイル管理ルール

**boki1 と devops の index.html について：**
- `docs/boki1/index.html` と `docs/devops/index.html` は内容が完全に同一です
- 片方のファイルを修正した場合、**必ずもう一方のファイルにも同じ修正を適用**してください
- どちらを先に修正するかは制限なし（boki1 優先ではない）
- 修正漏れを防ぐため、修正時には以下の手順を推奨：
  1. 片方のファイルで修正・テストを実施
  2. 修正内容を確認した後、他方のファイルにも適用
  3. 両ファイルを同時に commit・push

---

**プロジェクト作成日**: 2026-05-15
**バージョン**: 1.0.0
**テストフレームワーク**: Jest 29.7.0
