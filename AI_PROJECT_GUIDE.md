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
- docs/{quiz}/index.html: 各クイズページ（boki1, devops, kokyo1, joho1, itpassport, itpassportjr など）。HTML骨格のみで、見た目・挙動は docs/shared/ の共通ファイルを読み込む。
- docs/shared/quiz-app.css: 全クイズページ共通のスタイル。
- docs/shared/quiz-app.js: 全クイズページ共通のロジック（パート/セット表示、採点、Firebase連携など）。
- docs/config.json: 各クイズの表示メタデータ。
- docs/build-info.json: 自動生成されるビルド日時。

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
- 各クイズページの見た目・挙動ロジックは docs/shared/quiz-app.css と docs/shared/quiz-app.js に一本化している。クイズ固有の index.html はHTML骨格（画面のdiv構造）だけを持ち、内容はすべて同一。
- クイズを追加・修正するときは docs/shared/ の共通ファイルを編集する。docs/{quiz}/index.html 自体を個別に書き換える必要は基本的にない（HTML骨格自体を変えるときだけ、6ファイル全部に同じ内容をコピーする）。
- クイズごとのラベル、見出し、色、説明文は docs/config.json に置く。共通JSが起動時に config.json を読んで適用する。メインメニューの教材一覧・検索でも同じ config.json の description を使うので、内容を充実させると両方に反映される。
- 各クイズページでは ?admin=1 で問題レビュー画面を表示できる。
- 各クイズの「教材トップ」画面（旧クイズトップ）は、パートの行をクリックするとその場でセット一覧がアコーディオン展開する。初期表示ではどのパートも閉じた状態で表示する（現在パートも含めて自動的には開かない）。セットは横長のリスト行（Finder風）で、行クリックではなく「試験モード（記録あり）」ボタンと「演習モード」または「誤答復習」（どちらも記録なし）ボタンの2択で開始する。
- ログアウトは `confirm()`/`alert()` を使わず、既存の `logout-modal` と同じ自前モーダルパターンを使う。iOS Safari（Chrome for iOSも含む）は繰り返しダイアログを出すページで「今後表示しない」を選べてしまい、選ばれると以降の `confirm()`/`alert()` が無言で失敗するため。
- クイズ画面の問題文・選択肢・解説（結果画面の解答一覧も含む）には🔍アイコンが付いており、クリックすると `search-modal` が開いてその全文が選択可能なテキストとして表示される。テキストの一部をドラッグ選択してから「Googleで検索」を押すとその選択範囲だけを、何も選択しなければ全文をGoogle検索する（`searchIconHtml()` / `openSearchModal()` / `runTermSearch()` in quiz-app.js）。日本語の自動キーワード抽出は精度が低いため意図的に採用していない。

## 問題データ
- 各クイズの問題は docs/{quiz}/questions*.json に置く（例: docs/boki1/questions1.json, docs/devops/questions1.json）。
- 問題数は動的に表示できるため、テストやルールで明示しない限り、将来も必ず10問とは仮定しない。
- 簿記の作問ルールは QUESTION_GUIDE.md に書く。他クイズの作問時も、同ファイルの共通ルール（正答1つ、選択肢重複なし、解説必須）を守る。

## スコアと認証の注意
- スコアは quiz id から決まる Firestore collection（`quiz_<quizId>`）に、クイズ別・ユーザー別で保存する。
- メインメニュー（docs/index.html）は認証状態に関わらず常にホーム画面（教材一覧・検索・成績枠）を表示する。専用のログイン画面はない。ログインしていない状態で成績に関わる操作（教材トグルのON/OFFなど）をしようとしたときだけ、その場でログインを促す。
- 教材トグルのON/OFF状態は Firestore の `quiz_menu_prefs/{uid}` に保存する。Firestoreのセキュリティルールが `scores` または `^quiz_.*` にマッチするコレクションだけを許可しているため、新しいコレクションを追加するときは必ず `quiz_` プレフィックスを付ける。
- スコア表示は現在の問題データから計算し、古い固定値に依存しない。

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

## ビルド日時
- docs/build-info.json は自動生成される。pre-commit hook で変更されたらコミットに含める。
- タイムスタンプは JST。
- ビルドスクリプトや hook が失敗して、ユーザーから手動修正を頼まれた場合以外は、docs/build-info.json を手で編集しない。
