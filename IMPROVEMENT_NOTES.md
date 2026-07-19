# コードレビュー: quiz1 プロジェクト改善点

> 作成日: 2026-07-20
> 対象: `docs/shared/quiz-app.js`, `docs/index.html`, `src/utils.js`, `src/scoreManager.js`, `src/menu.test.js` など

---

## 🔴 バグリスク（Bug Risks）

### 1. レースコンディション（競合状態） — `quiz-app.js` L411付近
`initializeBestScoresCache()` の中で、`await db.collection(...)` の**前に**フラグ(`cacheInitialized`)を立てていない。
複数の `getBest()` が並行して呼ばれると Firestore への Read が重複発行される。

```diff
 async function initializeBestScoresCache() {
   if (cacheInitialized || !currentUser) return;
+  cacheInitialized = true;           // ← 先にフラグを立てる（またはPromiseを保持）
   try {
     const doc = await db.collection(...).doc(currentUser.uid).get();
     bestScores = doc.exists ? doc.data() : {};
-    cacheInitialized = true;
   } catch (e) {
+    cacheInitialized = false;        // ← 失敗時はリセット
     console.error(e);
   }
 }
```

### 2. エラー握りつぶし — `quiz-app.js` L230付近
questions*.json の fetch ループで、**ネットワークエラーやタイムアウト**も「次ファイルが存在しない」と同等に扱って `break` している。問題が読み込めていないのに正常終了したように見える。

```diff
 try {
   res = await fetch(...);
+  if (!res.ok) break;   // 404=終端、他のエラーは区別する
 } catch (e) {
-  break;
+  console.error('問題ファイルの読み込み失敗:', e);
+  break;
 }
```

### 3. エラーメッセージの XSS リスク — `quiz-app.js` L289, L302付近
`e.message` を直接 `innerHTML` に埋め込んでいる箇所がある。

```diff
- document.getElementById('test-grid').innerHTML = '<p>' + e.message + '</p>';
+ const p = document.createElement('p');
+ p.textContent = e.message;
+ document.getElementById('test-grid').replaceChildren(p);
```

---

## 🟠 パフォーマンス（Performance）

### 4. resize イベントにデバウンス欠如 — `quiz-app.js` L83付近
`window.addEventListener('resize', applyFontSizePref)` で、リサイズ中に `document.getElementById` を連続呼び出し。レンダリングが詰まる原因になる。

```js
// 改善例
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(applyFontSizePref, 100);
});
```

### 5. 問題ファイルの直列フェッチ — `quiz-app.js` L223付近
レベル数が `quiz-meta.json` から事前に分かるにもかかわらず、`for` ループで `await fetch(...)` を直列実行している。

```js
// 改善例: maxLevel が判明している場合
const levels = Array.from({ length: maxLevel }, (_, i) => i + 1);
const results = await Promise.all(levels.map(l => fetch(`questions${l}.json?t=...`)));
```

---

## 🟠 保守性（Maintainability）

### 6. quiz-app.js が巨大すぎる（1600行超）
Firebase 初期化・Web Audio API・Firestore 保存・UI 描画が1ファイルに混在している。最低限でも以下のように分割を検討：

| 現状 | 分割案 |
|------|--------|
| quiz-app.js（全部） | `quiz-auth.js` — Firebase/GIS 認証 |
| | `quiz-audio.js` — 効果音・Fanfare |
| | `quiz-api.js` — Firestore Read/Write |
| | `quiz-ui.js` — 画面描画・HTML生成 |
| | `quiz-app.js` — エントリポイントのみ |

### 7. グローバル変数の多用 — `quiz-app.js` L19付近
`currentUser`, `bestScores`, `TESTS`, `quizData`, `currentLevel` などが全てグローバルスコープ。副作用が追いにくい。IIFE またはクラス/モジュールでスコープを閉じることを推奨。

### 8. index.html にインラインCSS 約800行
`docs/index.html` の `<style>` タグ内に大量のCSSが直書きされている。`docs/shared/quiz-app.css` と同様に外部ファイルへ切り出すとブラウザキャッシュが効き、保守性も向上する。

### 9. HTML文字列のJS内構築が多い — `quiz-app.js` L639, L684付近
`entriesHtml +=` や `lapEntriesHtml +=` で長大なHTMLをテンプレートリテラルで構築している。変更箇所の特定が難しい。`<template>` タグやコンポーネント化を検討する価値がある。

---

## 🟡 コード品質（Code Quality）

### 10. マジックナンバー — `quiz-app.js` L185付近
`soundFanfare` 内の音符周波数リスト `[[523,0],[659,0.15],...]` や、フォントサイズ閾値などが直接埋め込まれている。定数化してコードの意図を明確にする。

```js
// 改善例
const FANFARE_NOTES = [
  { freq: 523, delay: 0    },  // C5
  { freq: 659, delay: 0.15 },  // E5
  { freq: 784, delay: 0.30 },  // G5
];
```

---

## 🟡 テスト品質（Test Quality）

### 11. 壊れやすいテスト（Brittle Tests） — `src/menu.test.js`
HTMLファイル内の**生のJavaScript文字列**を `toContain("document.getElementById(...)")` で直接マッチングしている。インデントや変数名を変えただけでテストが落ちる。JSDOM 等を使ったDOM操作のテストへ改善すべき。

---

## 🟡 アクセシビリティ（Accessibility）

### 12. ARIA属性の欠如 — `quiz-app.js` L592付近
`toggleHistoryPart()` のアコーディオンのボタンに `aria-expanded` が設定されていないため、スクリーンリーダーで開閉状態が伝わらない。

```diff
- button.onclick = () => toggleHistoryPart(i);
+ button.setAttribute('aria-expanded', 'false');
+ button.onclick = () => {
+   const expanded = button.getAttribute('aria-expanded') === 'true';
+   button.setAttribute('aria-expanded', String(!expanded));
+   toggleHistoryPart(i);
+ };
```

### 13. 装飾要素への aria-hidden 欠如 — `quiz-app.js` L194付近
紙吹雪（`confetti-piece`）のdivに `aria-hidden="true"` が付いていないため、音声読み上げソフトが不要な要素を読み上げてしまう可能性がある。

```diff
- el.className = 'confetti-piece';
+ el.className = 'confetti-piece';
+ el.setAttribute('aria-hidden', 'true');
```

---

## 優先度サマリー

| # | カテゴリ | 問題 | 優先度 | 対応状況 |
|---|--------|------|--------|---------|
| 1 | バグリスク | キャッシュ初期化のレースコンディション | 🔴 高 | ✅ 対応済み |
| 2 | バグリスク | fetch エラーの握りつぶし | 🔴 高 | ✅ 対応済み |
| 3 | セキュリティ | innerHTML への e.message 直接挿入 | 🔴 高 | ✅ 対応済み |
| 4 | パフォーマンス | resize デバウンス欠如 | 🟠 中 | ✅ 対応済み |
| 5 | パフォーマンス | 問題ファイルの直列フェッチ | 🟠 中 | ✅ 対応済み |
| 6 | 保守性 | quiz-app.js の巨大化（1600行超） | 🟠 中 | ⬜ 未対応 |
| 7 | 保守性 | グローバル変数の多用 | 🟠 中 | ⬜ 未対応 |
| 8 | 保守性 | index.html のインラインCSS | 🟠 中 | ⬜ 未対応 |
| 9 | 保守性 | JS内 HTML文字列構築 | 🟡 低 | ⬜ 未対応 |
| 10 | コード品質 | マジックナンバー | 🟡 低 | ⬜ 未対応 |
| 11 | テスト品質 | 壊れやすいテスト | 🟡 低 | ⬜ 未対応 |
| 12 | アクセシビリティ | aria-expanded 欠如 | 🟡 低 | ✅ 対応済み |
| 13 | アクセシビリティ | aria-hidden 欠如（紙吹雪） | 🟡 低 | ✅ 対応済み |
