# AI Project Guide

## 最初に読むもの
- 共通の作業ルールと運用ルールはこのファイルにまとめる。
- 問題の追加・修正ルールは [QUESTION_GUIDE.md](./QUESTION_GUIDE.md) を読む。
- 実装の詳しい仕様やコード理解には [IMPLEMENTATION_SPEC.md](./IMPLEMENTATION_SPEC.md) を読む。
- 作業ディレクトリは /Users/user/work/ai/quiz1 を使う。

## プロジェクト
このリポジトリは、docs/ から配信する静的なクイズ学習アプリ。アプリ名は「🏠満点まで帰れません✨（反復学習システム）」。間違えた問題を何度も復習して満点にする、という反復学習をコンセプトにしている。

主な入口:
- docs/index.html: メインメニュー、認証判定、クイズ選択。
- docs/{quiz}/index.html: 各クイズページ（sample, sample2, sample3, bokinyu, devops, sapc02, koukyou1, jouhou1, itpass, itpassjr, fp3kyuu, takken, shouwa, heisei, capital, eiken2, eiken3, eiken2pre, eiken4, eiken5, gentsuki の21種）。HTML骨格のみで、見た目・挙動は docs/shared/ の共通ファイルを読み込む。sample3は記述式（自由入力）問題タイプの最小構成サンプル。
- docs/shared/quiz-app.css: 全クイズページ共通のスタイル。
- docs/shared/quiz-app.js: 全クイズページ共通のロジック（パート/レッスン表示、採点、Firebase連携など）。
- docs/config.json: 各クイズの表示メタデータ。
- docs/build-info.json: 自動生成されるビルド日時。
- docs/quiz-meta.json: 自動生成される全クイズのパート数・レッスン数・問題数（メインメニューが questions*.json を全部読まずに済むように使う）。
- docs/manifest.json・docs/sw.js・docs/icon-*.svg: PWA化用のファイル。メインメニューと各教材ページの両方から参照される（`<link rel="manifest">`・Service Worker登録）。

## コマンド
- npm install
- npm test
- npm run build
- npm run prepare

## 作業ルール
- JavaScript または問題JSONを変更したら npm test を実行する。
- ドキュメントだけの変更なら npm test は不要。
- npm run build は docs/build-info.json を更新する。
- hooks/pre-commit はコミット前に docs/build-info.json を更新する。
- npm install は prepare を実行し、git config core.hooksPath hooks の設定とビルド日時更新を行う。
- 新しい clone で hook が未設定なら、npm install または npm run prepare を実行する。

## HTML と config のルール
- 各クイズページの見た目・挙動ロジックは docs/shared/quiz-app.css と docs/shared/quiz-app.js に一本化している。クイズ固有の index.html はHTML骨格（画面のdiv構造）だけを持ち、内容はすべて同一（`?v=` のキャッシュバスティング用クエリだけがビルドのたびに変わる）。
- クイズを追加・修正するときは docs/shared/ の共通ファイルを編集する。docs/{quiz}/index.html 自体を個別に書き換える必要は基本的にない（HTML骨格自体を変えるときだけ、全クイズページに同じ内容をコピーする。1ファイルを正として編集し、残り全部へバイト単位でコピーするのが確実）。
- クイズごとのラベル、見出し、色、説明文は docs/config.json に置く。共通JSが起動時に config.json を読んで適用する。メインメニューの教材一覧・検索でも同じ config.json の description を使うので、内容を充実させると両方に反映される。
- 各クイズは docs/config.json に `genreMajor`（大分類: sample/shikaku/gakkou/zatsugaku）と `genreMinor`（小分類、shikaku配下のみ it_shikaku/kaikei_kinyu_shikaku/houritsu_sonota_shikaku のいずれか、それ以外はnull）を持つ。メインメニューはこの階層でジャンル別グループ表示になる（📌ピン留め教材は別枠で先頭）。ジャンルのラベル・並び順はdocs/index.htmlの`GENRE_ORDER`定数で管理し、config.json自体はジャンルidのみ持つ（表示上の関心事とデータを分離するため）。新しい教材を追加するときはgenreMajor/genreMinorを書き忘れないこと（src/menu.test.jsで検証）。
- メインメニューの「教材ジャンル」欄は大分類・小分類とも選択式のフィルターボタンになっている（`toggleGenreFilter()`/`groupByGenre()`）。選んだジャンルの教材だけ下の「教材一覧」に絞り込まれ、何も選んでいなければ全件表示、「✖️ リセット」ボタンで選択をクリアできる。ボタン全体は枠線で囲ったボックス（`#quiz-genre-nav`）にまとめてある。
- 「あなたの選択教材」の各行は、教材名の直後にスペース1つ空けて「Xパート・Yレッスン」を続け、行末の「✅ X/Y問正解」の右隣に「入る」ボタンを置く（旧デザインの「›」矢印は廃止）。
- 新しいクイズを追加するときは、`docs/{quiz}/questions*.json` の各ファイルに必ず `"id": "<quizId>"` フィールドを含める。共通JSがこの `id` を最初に読み込んだ questions1.json から拾って Firestoreの保存先（`users/{uid}/quizzes/<quizId>`）を決めるため、これが無いと成績が `users/{uid}/quizzes/undefined` という誤った場所に保存されてしまう（実際に起きた事故）。
- 各クイズページでは ?admin=1 で問題レビュー画面を表示できる。
- 各クイズの「教材トップ」画面（旧クイズトップ）は、パートの行をクリックするとその場でレッスン一覧がアコーディオン展開する。初期表示ではどのパートも閉じた状態で表示する（現在パートも含めて自動的には開かない）。パート行の集計表示は「試験 X/Y問(N回)・演習/復習(M回)」の形式で、PC・スマホともに2行（1行目：パート名、2行目：右寄せで集計表示）に折り返す。パート行の背景色はメインメニューの「あなたの選択教材」の大分類見出しと同じ薄い青（`rgba(23,92,211,0.16)`）。レッスンは横長のリスト行（Finder風）で、行クリックではなく「試験」ボタンと「演習」または「誤答復習」（どちらも記録なし）ボタンの2択で開始する。3つのボタンとも最低幅（min-width）を揃えてあるので、文言が短いボタンだけ狭く見えることはない。ボタン行もPC・スマホともにレッスン名の下の行に折り返す（`.set-meta`が常時`flex-basis: 100%`）。各レッスン行のサブテキストにはそのレッスンの `subtitle` フィールドと問題数を表示する（パート名は1つ上のアコーディオン見出しに既に出ているため重複させない）。教材トップ画面の「🏠 メインメニュー」ボタンとログイン中ユーザー表示は、絶対配置ではなく通常のフローに縦積みで並べてあり、表示サイズを変えても重ならない。
- 「📊 成績/設定」ボタン（教材トップとクイズ画面の両方にある）を押すと成績・設定モーダルが開き、「成績履歴を見る」「成績をリセット」「表示サイズ」を選べる。表示サイズはPC用・スマホ用のスライダーを常に両方同時に表示し（`setFontSize('pc'|'mobile', value)`）、それぞれ独立してlocalStorageに保存する。PC は70〜200%（デフォルト130%）、スマホは70〜120%（デフォルト90%）、5%刻み。実際に適用されるのは表示中の画面幅（`matchMedia('(max-width: 520px)')`）に応じた方の値で、リサイズ時も再適用される。各スライダーに「デフォルトに戻す」ボタンがある。
- 成績履歴モーダルは、レッスンごとの挑戦履歴（日時・正答数・通し番号）をチェックボックス付きで一覧表示し、「選択した履歴を削除」（確認モーダルdelete-history-modalを挟む）でまとめて削除できる。パートごとにアコーディオンで開閉でき（初期状態は全パート閉じている）、パート見出しの右側には教材トップと同様「試験 X/Y問(N回)」（演習/復習回数は含めない）を表示する。一番上には周回履歴（後述の全クリア機能）も表示する。日時と、通し番号・正答数・全クリア表示などの付随情報は同じ行に収まらない場合だけ付随情報の方を次の行に折り返す（日時自体は`white-space: nowrap`で常に1行を保つ）。周回履歴の「全問正解」表示は「🎉 全クリア(試験回数N回)」の形式で、何周目かは省略する。
- 教材を全パート・全レッスンとも100点（lesson）にすると、教材トップに「🎉全問正解達成！」バナーと「🏁次の周へ進む」ボタンが出る。ボタンは押す前に確認モーダル（advance-lap-modal）を挟む。押すと各レッスンの最高点・誤答記録だけがリセットされ（挑戦履歴・周回数・達成記録は消えない）、周回数（`lap`フィールド）が+1、その周回の試験挑戦回数（`lapAttemptCount`）が0にリセットされる。ボタンは全問正解している限り何度でも押せる（何周でも積み上げられる）。メインメニューの成績行にも、周回数がある場合は `⭐×N`、全問正解済みでまだ次の周へ進んでいない場合は `+⭐` を追記表示する。全問正解を初めて達成した日時と、その周回での試験挑戦回数は `fullClearHistory` に記録され、成績履歴モーダルの周回履歴セクションに「N周目全問正解（M回挑戦）」として表示される。
- テスト結果画面（`#screen-results`）は、左上に「テスト選択へ戻る／(結果保存)」という2行ボタン（クイズ画面中の「テスト選択へ戻る／(破棄中断)」と同じ`.quiz-back`スタイルだが、結果画面側だけ教材テーマ色ではなく固定の青色`.quiz-back-blue`）、その下にパートラベル・タイトル、スコアバッジ「N点 (正答数/全問数)」（角丸長方形、フォントは点数が大きく分数は小さい）、最高スコア「🏅 最高: N/M問 (X回)」、星とスコアメッセージ（全角スペース1つで同じ行に並べる）の順で表示する。解答一覧の各設問は、Q番号と正誤マークだけ問題文と並べてインデントし、「正解:」「あなた:」「💡解説」は行の全幅にまたがる（アイコン列の下に潜り込まない）。
- ログアウトは `confirm()`/`alert()` を使わず、既存の `logout-modal` と同じ自前モーダルパターンを使う。iOS Safari（Chrome for iOSも含む）は繰り返しダイアログを出すページで「今後表示しない」を選べてしまい、選ばれると以降の `confirm()`/`alert()` が無言で失敗するため。
- クイズ画面の問題文・選択肢・解説（結果画面の解答一覧も含む）には🔍アイコンが付いており、クリックすると `search-modal` が開いてその全文が選択可能なテキストとして表示される。テキストの一部をドラッグ選択してから「Googleで検索」を押すとその選択範囲だけを、何も選択しなければ全文をGoogle検索する（`searchIconHtml()` / `openSearchModal()` / `runTermSearch()` in quiz-app.js）。日本語の自動キーワード抽出は精度が低いため意図的に採用していない。選択肢の中の🔍は`<button>`の入れ子を避けるため`<span role="button">`で実装している。
- メインメニューにはPWAインストールの案内が2種類ある（`renderPwaInstallUI()` in docs/index.html）。上のバナー（`#pwa-install-banner`）は×で閉じると`localStorage`の`pwaInstallBannerDismissed`フラグで二度と出なくなる。教材一覧の最下部の常設ヒント（`#pwa-install-footer-hint`）は×の対象外で常に表示される（iOSはSafariの共有ボタン経由の案内文、それ以外はブラウザのインストールボタンの案内文）。`isRunningStandalone()`がtrue（すでにホーム画面から起動済み）のときは両方とも表示しない。

## 問題データ
- 各クイズの問題は docs/{quiz}/questions*.json に置く（例: docs/bokinyu/questions1.json, docs/devops/questions1.json）。
- 問題数は動的に表示できるため、テストやルールで明示しない限り、将来も必ず10問とは仮定しない。
- 簿記の作問ルールは QUESTION_GUIDE.md に書く。他クイズの作問時も、同ファイルの共通ルール（正答1つ、選択肢重複なし、解説必須）を守る。

## スコアと認証の注意
- スコアは `users/{uid}/quizzes/{quizId}` ドキュメントに、教材別・ユーザー別で保存する。教材トグルのON/OFF・プロフィール（displayName/email/lastSeen）は `users/{uid}` ドキュメント本体に保存する。Firestoreへの読み書きは全て `docs/shared/quiz-app.js` の `userDataAction(action, params)` に集約されており、通常はこの関数にcaseを足すだけで済む（呼び出し側を変える必要はない）。
- 旧構造（教材ごとにトップレベルコレクションを1個ずつ増やす `quiz_<quizId>/{uid}` ・ `quiz_menu_prefs/{uid}`）からの移行は `migrateUserDataIfNeeded()` が担う。ユーザーが次回ログインした時に1回だけ、旧データを新構造へ非破壊コピーする（`users/{uid}.migratedAt` の有無で判定）。全ユーザーの移行完了を確認した後、旧`quiz_*`コレクションはFirebase Consoleから手動で削除済み（2026-07-20）。`migrateUserDataIfNeeded()`のコード自体は残っているが、旧データが無いユーザーに対しては何もコピーせず`migratedAt`だけセットする形で安全に動く。Firestoreセキュリティルールの`^quiz_.*`向け後方互換ルールは、実データが無くなった今も残ってはいるが実害はない（削除するかはユーザー判断）。
- 保存フィールド: `lesson_<level>_<lessonId>`（最高点0-100）、`lessonHistory_<level>_<lessonId>`（挑戦履歴、初回1件＋直近10件を保持、各要素は`{no, score, date}`）、`lessonWrongAnswers_<level>_<lessonId>`（誤答問題番号）、`lessonAttemptCount_<level>_<lessonId>`（履歴が間引かれても減らない通しの挑戦回数）、`lap`（全クリア周回数）、`lapHistory`（周回開始日時の配列 `[{lap, date}, ...]`）、`lapAttemptCount`（今の周回に入ってからの試験挑戦回数、周回が進むたびに0にリセット）、`fullClearHistory`（全問正解を達成した日時の記録 `[{lap, date, attempts}, ...]`、周回ごとに初めて達成した瞬間だけ追記）。
- メインメニュー（docs/index.html）は認証状態に関わらず常にホーム画面（教材一覧・検索・成績枠）を表示する。専用のログイン画面はない。ログインしていない状態で成績に関わる操作（教材トグルのON/OFFなど）をしようとしたときだけ、その場でログインを促す。
- 管理者ダッシュボード（`docs/admin/index.html`）は特定の管理者メールアドレスでログインした時だけ、全ユーザーの利用状況（ユーザーごと・教材ごとの集計、個別ユーザーの詳細）を閲覧できる。一般ユーザーには一切見えない。Firestoreルールに管理者メールアドレス向けの読み取り専用の例外が入っている。
- `users/{uid}` ドキュメントへ書き込む関数（`syncUserProfile()`など）は、一度も`.get()`していないドキュメントへ`.set(data, {merge:true})`する前に必ず`.get()`を挟むこと。挟まずに書くと、ほぼ同時に走る別の読み取り（`loadVisiblePrefs()`など）がこのドキュメントを「書き込まれたフィールドしか無い」状態で観測してしまい、`visible`/`pinned`が読めているのに画面には反映されない不具合が起きる（実際にFirestore再構築時にこのガードがコードから抜け落ちて再発した）。
- `config.json`や教材一覧のようにページ内でキャッシュする値は、**取得に失敗した場合はキャッシュしない**こと。失敗時に`{}`のような空値をキャッシュしてしまうと、一時的な通信失敗1回だけで、リロードするまでずっと教材一覧が空表示のままになる（`loadMenuConfig()`で実際に発生し修正済み）。
- スコア表示は現在の問題データから計算し、古い固定値に依存しない。メインメニューは docs/quiz-meta.json（ビルド時生成、パート数・レッスン数・レッスンごとの問題数）を読んで計算するため、questions*.json 自体はメインメニューからは読み込まない。

### ログイン方式（重要・Firebase の signInWithPopup/signInWithRedirect は使わない）
- Googleログインは Firebase Auth の `signInWithPopup`/`signInWithRedirect` を使わず、**Google Identity Services (GIS)** の OAuth トークンクライアントを直接呼び出す方式にしている（`docs/index.html` と `docs/shared/quiz-app.js` の `loginWithGoogle()` / `getGISTokenClient()`）。
  - 理由: Firebase の popup は iPhone Chrome (CriOS) で開けない。redirect は認証状態を `boki1-b66ad.firebaseapp.com` という別ドメインの iframe に保存する仕組みで、Chrome M115+/Safari 16.1+ 等のサードパーティストレージ制限によりブロックされ、無言で失敗する（Firebase 公式の [redirect-best-practices](https://firebase.google.com/docs/auth/web/redirect-best-practices) にも明記されている既知の問題）。この2つを何度も試したが iPhone Chrome だけ直せなかった。
  - GIS はブラウザに依存しない Google 自身の OAuth ポップアップ機構なので、`accounts.google.com/gsi/client` を読み込み、`google.accounts.oauth2.initTokenClient()` でアクセストークンを取得し、`firebase.auth.GoogleAuthProvider.credential(null, accessToken)` → `signInWithCredential()` で Firebase にログインさせている。
  - `loginWithGoogle()` は同期関数（async ではない）。GIS の `requestAccessToken()` はユーザー操作（クリック）に直接紐づけて同期的に呼ぶ必要があるため。
- **必須の外部設定（コードだけでは完結しない）**:
  1. Firebase Console → Authentication → Settings → 承認済みドメイン に実際のホスティングドメイン（例: `wataameto.github.io`）を追加する。
  2. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → 認証情報 → 該当の OAuth 2.0 クライアント ID（Web クライアント。Firebase Console の Authentication → Sign-in method → Google → ウェブ SDK の構成 で確認できる）→ **承認済みの JavaScript 生成元** に同じドメインを追加する。Firebase 側の承認済みドメインとは別設定なので、両方必要。
  3. どちらの設定変更も反映まで数分〜十数分のタイムラグがあることがある（`origin_mismatch` エラーが一時的に出ても、設定自体が誤っているとは限らない）。
- 新しいクイズページを増やす、または `docs/shared/quiz-app.js` のログイン部分を書き換えるときは、上記の GIS 方式を壊さないこと。Firebase の popup/redirect に戻すと iPhone Chrome のログインが再び壊れる。
- **将来的な代替案**: 独自ドメインを取得した場合、`authDomain` をその独自ドメインの子（親ドメインを共有する）サブドメインにすれば、ブラウザからファーストパーティ扱いされてサードパーティストレージ制限を受けなくなり、Firebase標準の `signInWithPopup`/`signInWithRedirect` がそのまま動くようになる可能性が高い（GitHub Pagesの `wataameto.github.io` のような他社ドメイン配下ではこの手が使えないため、今回はGIS方式を採用した）。独自ドメインに移行する機会があれば検討の余地あり。

## ビルド日時とキャッシュ対策
- docs/build-info.json は自動生成される。pre-commit hook で変更されたらコミットに含める。
- タイムスタンプは JST。
- ビルドスクリプトや hook が失敗して、ユーザーから手動修正を頼まれた場合以外は、docs/build-info.json を手で編集しない。
- scripts/update-build-time.js は同時に、21クイズページ全部の `<link>`/`<script>` タグの `?v=` を最新タイムスタンプへ書き換え、docs/quiz-meta.json も再生成する。これは pre-commit hook（hooks/pre-commit）が `git add` するので、手動での追加コミットは不要。
- questions*.json や config.json への fetch は毎回 `?t=Date.now()` を付けて常にキャッシュを回避しているが、docs/shared/quiz-app.js・quiz-app.css 自体はブラウザ・CDNにキャッシュされるため、上記の `?v=` バージョン管理で対応している。
