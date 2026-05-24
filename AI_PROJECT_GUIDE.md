# AI Project Guide

## 最初に読むもの
- 共通の作業ルールと運用ルールはこのファイルにまとめる。
- 問題の追加・修正ルールは [QUESTION_GUIDE.md](./QUESTION_GUIDE.md) を読む。
- 実装の詳しい仕様やコード理解には [IMPLEMENTATION_SPEC.md](./IMPLEMENTATION_SPEC.md) を読む。
- 作業ディレクトリは /Users/user/Documents/codextest1 を使う。

## プロジェクト
このリポジトリは、docs/ から配信する静的なクイズ学習アプリ。

主な入口:
- docs/index.html: メインメニュー、認証判定、クイズ選択。
- docs/boki1/index.html: 簿記クイズページ。
- docs/devops/index.html: DevOpsクイズページ。
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
- boki1 と devops の index.html は意図的に同期している。
- クイズごとのラベル、見出し、色、説明文は docs/config.json に置く。
- 片方のクイズページだけに、クイズ固有の表示名をハードコードしない。
- 片方の quiz index.html を変更したら、もう片方との差分も確認する。
- 各クイズページでは ?admin=1 で問題レビュー画面を表示できる。

## 問題データ
- 簿記の問題は docs/boki1/questions*.json に置く。
- DevOpsの問題は docs/devops/questions*.json に置く。
- 問題数は動的に表示できるため、テストやルールで明示しない限り、将来も必ず10問とは仮定しない。
- 簿記とDevOpsの作問ルールは QUESTION_GUIDE.md に書く。

## スコアと認証の注意
- スコアは quiz id から決まる Firestore collection に、クイズ別・ユーザー別で保存する。
- メインメニューまたはログイン画面を表示する前に、認証状態を判定する。
- スコア表示は現在の問題データから計算し、古い固定値に依存しない。

## ビルド日時
- docs/build-info.json は自動生成される。pre-commit hook で変更されたらコミットに含める。
- タイムスタンプは JST。
- ビルドスクリプトや hook が失敗して、ユーザーから手動修正を頼まれた場合以外は、docs/build-info.json を手で編集しない。
