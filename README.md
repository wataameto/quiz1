# quiz1

反復学習クイズアプリ「🏠満点まで帰れません✨（反復学習システム）」。間違えた問題を何度も復習して満点を目指す、静的サイトです。docs/ から配信します。

## クイズ一覧
- bokinyu: 簿記超入門レベル
- devops: AWS認定DevOpsエンジニア(DOP-C02)
- koukyou1: 公共1（高校向け）
- jouhou1: 情報処理1 練習問題
- itpass: （IPA）ITパスポート試験
- itpassjr: ITパスポートJr（やさしい版）
- sapc02: AWS認定ソリューションアーキテクト プロフェッショナル(SAP-C02)
- sample: 動作確認・お試し用のミニ教材
- fp3kyuu: FP技能検定3級
- takken: 宅地建物取引士（宅建士）
- shouwa: 昭和レトロ雑学
- heisei: 平成レトロ雑学
- capital: 世界首都網羅クイズ

## 主なファイル
- docs/index.html: メインメニュー、認証判定、クイズ選択。
- docs/{quiz}/index.html: 各クイズページ。HTML骨格のみで、見た目・挙動は docs/shared/ を読み込む（13ファイルは同一内容で同期）。
- docs/shared/quiz-app.css: 全クイズページ共通のスタイル。
- docs/shared/quiz-app.js: 全クイズページ共通のロジック（パート/セット表示、採点、全クリア・周回、Firebase連携）。
- docs/config.json: クイズごとの表示名、色、説明。
- docs/{quiz}/questions*.json: 各クイズの問題データ（各ファイルに `id` フィールド必須）。
- docs/build-info.json: 自動生成されるビルド日時。
- docs/quiz-meta.json: 自動生成される全クイズのパート数・セット数・問題数（メインメニューが使う）。

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
- 各クイズは `?admin=1` で問題レビュー画面を表示できます（例: http://localhost:8000/bokinyu/?admin=1 ）。
