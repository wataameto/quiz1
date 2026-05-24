# AI Project Guide

## Read First
- Shared project and workflow rules are in this file.
- Question authoring rules are in [QUESTION_GUIDE.md](./QUESTION_GUIDE.md).
- Use /Users/user/Documents/codextest1 as the working directory.

## Project
Quiz learning app served as a static site from docs/.

Main entry points:
- docs/index.html: main menu, authentication gate, quiz selection.
- docs/boki1/index.html: boki quiz page.
- docs/devops/index.html: DevOps quiz page.
- docs/config.json: display metadata for each quiz.
- docs/build-info.json: generated build timestamp.

## Commands
- npm install
- npm test
- npm run build
- npm run prepare

## Workflow Rules
- Run npm test after changing JavaScript or question JSON.
- Documentation-only changes do not require npm test.
- npm run build updates docs/build-info.json.
- hooks/pre-commit updates docs/build-info.json before commits.
- npm install runs prepare, which sets git config core.hooksPath hooks and updates build info.
- If a fresh clone has no hook configured yet, run npm install or npm run prepare.

## HTML And Config Rules
- boki1 and devops index.html are intentionally kept in sync.
- Quiz-specific labels, headings, colors, and descriptions belong in docs/config.json.
- Do not hardcode quiz-specific display names in only one quiz page.
- When changing one quiz index.html, check the other quiz index.html for drift.
- Admin question review mode is available with ?admin=1 on each quiz page.

## Question Data
- boki questions live in docs/boki1/questions*.json.
- devops questions live in docs/devops/questions*.json.
- The app can display question counts dynamically; do not assume every future file has exactly 10 questions unless the test or rule explicitly requires it.
- Authoring rules for boki and DevOps questions are in QUESTION_GUIDE.md.

## Scoring And Auth Notes
- Scores are stored per quiz/user in Firestore collections derived from quiz id.
- Authentication state is checked before showing the main menu or login screen.
- Score displays should be calculated from current question data, not stale hardcoded totals.

## Build Timestamp
- docs/build-info.json is generated and should be committed when the pre-commit hook changes it.
- The timestamp is JST.
- Do not hand-edit build-info.json unless the build script or hook failed and the user asks for a manual fix.
