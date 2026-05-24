# quiz1

簿記とDevOpsのクイズ学習アプリ。静的サイトとして docs/ から配信します。

## 主なファイル
- docs/index.html: メインメニュー、認証判定、クイズ選択。
- docs/boki1/index.html: 簿記クイズページ。
- docs/devops/index.html: DevOpsクイズページ。
- docs/config.json: クイズごとの表示名、色、説明。
- docs/boki1/questions*.json: 簿記問題。
- docs/devops/questions*.json: DevOps問題。

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
- http://localhost:8000/boki1/?admin=1
- http://localhost:8000/devops/?admin=1
