# quiz1

反復学習クイズアプリ「🏠満点まで帰れません✨（反復学習システム）」。間違えた問題を何度も復習して満点を目指す、静的サイトです。docs/ から配信します。

## クイズ一覧
- boki1: 簿記超入門レベル
- devops: AWS認定 DevOpsエンジニア試験対策（DOP-C02）
- kokyo1: 公共1（高校向け）
- joho1: 情報処理1 練習問題
- itpassport: （IPA）ITパスポート試験
- itpassportjr: ITパスポートJr（やさしい版）

## 主なファイル
- docs/index.html: メインメニュー、認証判定、クイズ選択。
- docs/{quiz}/index.html: 各クイズページ。HTML骨格のみで、見た目・挙動は docs/shared/ を読み込む（6ファイルは同一内容で同期）。
- docs/shared/quiz-app.css: 全クイズページ共通のスタイル。
- docs/shared/quiz-app.js: 全クイズページ共通のロジック（パート/セット表示、採点、Firebase連携）。
- docs/config.json: クイズごとの表示名、色、説明。
- docs/{quiz}/questions*.json: 各クイズの問題データ。
- docs/build-info.json: 自動生成されるビルド日時。

## 開発コマンド
- npm install
- npm test
- npm run build
- npm run prepare

## ドキュメント
- AI/作業ルール: AI_PROJECT_GUIDE.md
- 作問ルール: QUESTION_GUIDE.md
- 実装仕様: IMPLEMENTATION_SPEC.md
- テスト概要: TEST_DOCUMENTATION.md

## ローカル確認
静的ファイルなので、docs/ をローカルサーバーで配信します。

```bash
cd docs
python3 -m http.server 8000
```

- http://localhost:8000/
- 各クイズは `?admin=1` で問題レビュー画面を表示できます（例: http://localhost:8000/boki1/?admin=1 ）。
