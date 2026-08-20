# Mobile Portrait and Avatar Zoom Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Center opening-screen character art on narrow mobile layouts and replace the dialogue avatar zoom's black presentation with a warm light display card.

**Architecture:** Keep the existing Vue template and dialogue-renderer DOM behavior intact, and make the fix entirely in scoped opening CSS plus the renderer's injected zoom CSS. Add source-contract tests before implementation, then rebuild the opening snapshot and dialogue-script artifacts with the project's existing tools.

**Tech Stack:** Vue 3 SFC, scoped SCSS, browser CSS, Node.js `node:test`, Webpack, Python packaging scripts.

---

## File map

- Create `角色卡工程/build_tools/test_mobile_visual_contracts.mjs`: static regression contracts for the two CSS fixes.
- Modify `tavern_helper_template/src/Counterfeit/界面/开场白/DlcSetup.vue`: mobile card/art width, sizing, and centering rules. `tavern_helper_template` is a junction to `前端工程`, so only this path is edited.
- Modify `角色卡工程/脚本/对话渲染.js`: warm light avatar-zoom mask, image card, caption, hint, and fallback styles.
- Regenerate `tavern_helper_template/dist/Counterfeit/界面/开场白/index.html`: self-contained opening frontend.
- Regenerate `角色卡工程/脚本/开场白挂载.js`: embed the rebuilt opening HTML.
- Regenerate `独立产物/酒馆助手脚本-对话渲染-Counterfeit.json`, `独立产物/对话渲染-预览.html`, and the dialogue script metadata in `角色卡工程/tavern-cards-state.json`.

The two source files already contain user-owned uncommitted work. Do not reset, replace, or broadly reformat them. Do not create implementation commits that would accidentally capture those pre-existing changes; keep the implementation as a reviewed working-tree patch.

### Task 1: Add failing mobile visual contracts

**Files:**
- Create: `角色卡工程/build_tools/test_mobile_visual_contracts.mjs`

- [ ] **Step 1: Create the source-contract test**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..', '..');
const openingSource = fs.readFileSync(
  path.join(projectRoot, 'tavern_helper_template', 'src', 'Counterfeit', '界面', '开场白', 'DlcSetup.vue'),
  'utf8',
);
const dialogueSource = fs.readFileSync(path.join(projectRoot, '角色卡工程', '脚本', '对话渲染.js'), 'utf8');

test('开场白窄屏角色卡图片区占满宽度并居中 contain', () => {
  assert.match(openingSource, /\.dlc-pov-card\{[^}]*width:100%[^}]*min-width:0/s);
  assert.match(openingSource, /\.pov-art\{[^}]*width:100%[^}]*min-width:0/s);
  assert.match(openingSource, /\.pov-art img\{[^}]*display:block[^}]*max-width:100%[^}]*margin-inline:auto/s);
  assert.match(openingSource, /@media\(max-width:520px\)\{[\s\S]*?\.pov-art\{[^}]*height:clamp\(210px,68vw,310px\)[^}]*\}/);
  assert.match(openingSource, /@media\(max-width:520px\)\{[\s\S]*?\.pov-art img\{[^}]*width:min\(100%,360px\)[^}]*height:100%[^}]*object-fit:contain[^}]*object-position:center bottom[^}]*\}/);
});

test('对话头像放大层使用浅色展示卡且不裁切', () => {
  assert.match(dialogueSource, /\.cf-zoom-mask\{[^}]*background:rgba\(104,91,85,\.24\)[^}]*backdrop-filter:blur\(6px\)/s);
  assert.match(dialogueSource, /\.cf-zoom-mask img\{[^}]*max-width:min\(420px,82vw\)[^}]*object-fit:contain[^}]*background:#f4f1ea/s);
  assert.match(dialogueSource, /\.cf-zoom-mask \.cf-zoom-caption\{[^}]*color:#5b4a4f/s);
  assert.match(dialogueSource, /\.cf-zoom-mask-fallback\{[^}]*background:#f4f1ea[^}]*color:#a5737f/s);
  assert.doesNotMatch(dialogueSource, /\.cf-zoom-mask img\{[^}]*aspect-ratio:9\/13/s);
  assert.doesNotMatch(dialogueSource, /\.cf-zoom-mask img\{[^}]*object-fit:cover/s);
});
```

- [ ] **Step 2: Run the contract test and verify red**

Run:

```powershell
node --test .\角色卡工程\build_tools\test_mobile_visual_contracts.mjs
```

Expected: 2 failing tests because the new centering tokens and light zoom-card tokens are not yet present.

### Task 2: Center opening character art on narrow screens

**Files:**
- Modify: `tavern_helper_template/src/Counterfeit/界面/开场白/DlcSetup.vue` in the `.dlc-pov-card`, `.pov-art`, `.pov-art img`, and `@media(max-width:520px)` rules.
- Test: `角色卡工程/build_tools/test_mobile_visual_contracts.mjs`

- [ ] **Step 1: Add stable grid/flex width constraints**

Update the three base selectors to contain these declarations while preserving their existing colors, borders, transitions, and alignment:

```scss
.dlc-pov-card {
  width: 100%;
  min-width: 0;
}

.pov-art {
  width: 100%;
  min-width: 0;
}

.pov-art img {
  display: block;
  max-width: 100%;
  margin-inline: auto;
}
```

- [ ] **Step 2: Add the narrow-screen art sizing rules**

Inside the existing `@media(max-width:520px)` block, keep all current declarations and add:

```scss
.dlc-pov-card {
  width: 100%;
}

.pov-art {
  width: 100%;
  height: clamp(210px, 68vw, 310px);
}

.pov-art img {
  width: min(100%, 360px);
  height: 100%;
  max-width: 100%;
  object-fit: contain;
  object-position: center bottom;
  margin-inline: auto;
}
```

- [ ] **Step 3: Run the contract test**

Run:

```powershell
node --test .\角色卡工程\build_tools\test_mobile_visual_contracts.mjs
```

Expected: the opening-layout test passes; the zoom-layer test still fails.

### Task 3: Replace the black avatar zoom with a warm light card

**Files:**
- Modify: `角色卡工程/脚本/对话渲染.js` in the `.cf-zoom-*` portion of `STYLE_TEXT`.
- Test: `角色卡工程/build_tools/test_mobile_visual_contracts.mjs`
- Test: `角色卡工程/build_tools/test_dialogue_renderer.mjs`

- [ ] **Step 1: Replace only the zoom CSS declarations**

Replace the current `.cf-zoom-mask`, image, caption, hint, and fallback rules with:

```css
.cf-zoom-mask{position:fixed;inset:0;background:rgba(104,91,85,.24);z-index:99999;display:flex;align-items:center;justify-content:center;flex-direction:column;cursor:zoom-out;backdrop-filter:blur(6px);padding:clamp(18px,4vw,36px);box-sizing:border-box}
.cf-zoom-mask img{display:block;width:auto;max-width:min(420px,82vw);height:auto;max-height:74vh;object-fit:contain;border:1px solid rgba(143,119,108,.2);border-radius:18px;padding:clamp(10px,2vw,18px);box-sizing:border-box;box-shadow:0 16px 48px rgba(85,64,58,.22);background:#f4f1ea}
.cf-zoom-mask .cf-zoom-caption{color:#5b4a4f;font-size:13px;margin-top:14px;letter-spacing:1px;font-weight:600}
.cf-zoom-mask .cf-zoom-hint{color:#7f7074;font-size:11px;margin-top:6px;opacity:.82}
.cf-zoom-mask-fallback{width:min(320px,70vw);aspect-ratio:9/13;max-height:74vh;border:1px solid rgba(143,119,108,.2);border-radius:18px;background:#f4f1ea;color:#a5737f;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:120px;box-shadow:0 16px 48px rgba(85,64,58,.22)}
```

Do not change `openAvatarZoom`, click delegation, source URL selection, or Esc handling.

- [ ] **Step 2: Run visual contracts and dialogue parser regressions**

Run:

```powershell
node --test .\角色卡工程\build_tools\test_mobile_visual_contracts.mjs
node --test .\角色卡工程\build_tools\test_dialogue_renderer.mjs
```

Expected: 2/2 visual contract tests pass and all dialogue renderer tests pass.

### Task 4: Rebuild and sync deliverables

**Files:**
- Regenerate: `tavern_helper_template/dist/Counterfeit/界面/开场白/index.html`
- Regenerate: `角色卡工程/脚本/开场白挂载.js`
- Regenerate: `独立产物/酒馆助手脚本-对话渲染-Counterfeit.json`
- Regenerate: `独立产物/对话渲染-预览.html`
- Modify metadata: `角色卡工程/tavern-cards-state.json`

- [ ] **Step 1: Build only the opening frontend**

Run from `前端工程`:

```powershell
pnpm exec webpack --config webpack.opening.config.ts --mode production
```

Expected: webpack exits 0 and updates `dist/Counterfeit/界面/开场白/index.html` without running whole-project sync side effects.

- [ ] **Step 2: Embed the working-tree opening snapshot**

Run from the project root:

```powershell
python .\角色卡工程\build_tools\pack_embedded_frontends.py
```

Expected: JSON output includes `opening_html_bytes`, `opening_script_bytes`, and `opening_script_sha256`; `角色卡工程/脚本/开场白挂载.js` is updated.

- [ ] **Step 3: Pack the dialogue script and preview**

Run:

```powershell
python .\角色卡工程\build_tools\pack_dialogue_script.py
```

Expected: output reports the generated JSON size/hash and the generated local preview path.

- [ ] **Step 4: Run packaging regressions**

Run:

```powershell
node .\角色卡工程\build_tools\test_opening_mounter.mjs
node --test .\角色卡工程\build_tools\test_dialogue_renderer.mjs
node --test .\角色卡工程\build_tools\test_mobile_visual_contracts.mjs
```

Expected: opening mounter prints its passing JSON summary; dialogue renderer and visual contracts pass.

### Task 5: Visual verification

**Files:**
- Inspect: `tavern_helper_template/dist/Counterfeit/界面/开场白/index.html`
- Inspect: `独立产物/对话渲染-预览.html`

- [ ] **Step 1: Check opening layout at target widths**

Open the rebuilt opening page in the signed-in browser environment and navigate to the 《错位的日常》 role picker. At viewport widths 390px, 430px, and 520px, verify each `.dlc-pov-card` and `.pov-art` spans its container, the image center aligns with the card center, the full portrait remains visible, and no horizontal scrollbar appears. At a desktop width, verify the two-column grid remains unchanged.

- [ ] **Step 2: Check avatar zoom across themes**

Open `独立产物/对话渲染-预览.html`, click the genderbend Hachiman avatar, and verify the overlay is warm translucent gray, the image sits on a light beige card, transparent pixels are not black, and no image edge is cropped. Repeat under parchment, dark, and green themes, then verify both outside-click and Esc close the overlay.

- [ ] **Step 3: Review the final diff without touching unrelated work**

Run:

```powershell
git diff --check
git status --short
git diff -- tavern_helper_template/src/Counterfeit/界面/开场白/DlcSetup.vue 角色卡工程/脚本/对话渲染.js 角色卡工程/build_tools/test_mobile_visual_contracts.mjs
```

Expected: no whitespace errors; the reviewed diff contains only the targeted responsive and zoom-card additions on top of the user's existing work. Do not stage or commit the implementation files because their pre-existing uncommitted changes must remain distinguishable as user-owned work.
