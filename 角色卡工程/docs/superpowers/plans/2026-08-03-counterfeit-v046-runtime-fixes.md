# Counterfeit v0.4.6 Runtime Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a rollback-safe v0.4.6 card that reliably commits opening variables, creates a visible user opening turn, triggers the first assistant reply through SillyTavern, and renders sharp portraits without altering any scene entry or its enabled state.

**Architecture:** Keep the opening Vue app responsible for validating and committing the complete MVU snapshot, while the persistent Tavern Helper mounter owns chat-floor creation and `/trigger`. Split portrait delivery into lightweight avatar thumbnails for chips and pinned 4K source portraits loaded only inside the modal. Preserve all 150 scene sources verbatim and treat the Prompt Template plugin as a documented runtime prerequisite rather than changing scene gates.

**Tech Stack:** SillyTavern Tavern Card v3, Tavern Helper/JS-Slash-Runner APIs, MVU, Vue 3, TypeScript, webpack, Node.js `node:test`, Python/Pillow deterministic asset build, tavern-cards-forge.

---

### Task 1: Freeze v0.4.5 and record invariants

**Files:**
- Create: `backups/Counterfeit-v0.4.5-before-v0.4.6-<timestamp>/manifest.sha256`
- Create: `cards/Counterfeit/docs/superpowers/plans/2026-08-03-counterfeit-v046-runtime-fixes.md`
- Verify: `cards/Counterfeit/世界书/事件/*.yaml`

- [x] **Step 1: Copy the original package, sources, compiled frontends, and portrait assets into the timestamped backup directory**

```powershell
Copy-Item -LiteralPath $source -Destination $backup -Recurse
```

- [x] **Step 2: Record SHA-256 hashes for every backed-up file and every scene source**

```powershell
Get-FileHash -Algorithm SHA256 -LiteralPath $file
```

- [x] **Step 3: Verify exactly 150 scene entries are present and all scene hashes can be compared after packaging**

```powershell
$scenes = Get-ChildItem -LiteralPath 'cards\Counterfeit\世界书\事件' -File
if ($scenes.Count -ne 150) { throw "Expected 150 scene files, got $($scenes.Count)" }
```

### Task 2: Make the opening commit atomic and observable

**Files:**
- Modify: `tavern_helper_template/src/Counterfeit/界面/开场白/store.ts`
- Modify: `cards/Counterfeit/脚本/开场白挂载.template.js`
- Test: `cards/Counterfeit/build_tools/test_opening_mounter.mjs`

- [x] **Step 1: Add failing tests for the persistent mounter contract**

```js
assert.equal(calls.triggerSlash, 1);
assert.equal(calls.generate, 0);
assert.match(messages.at(-1).message, /我选择扮演|自建角色/);
assert.deepEqual(userFloor.stat_data, floor0.stat_data);
```

- [x] **Step 2: Run the tests and confirm the current `generate()` path fails the contract**

```powershell
node cards\Counterfeit\build_tools\test_opening_mounter.mjs
```

- [x] **Step 3: Expose the MVU readiness API required by the iframe bridge; leave worldbook/scene switching APIs untouched per user correction**

```js
"waitGlobalInitialized"
```

- [x] **Step 4: Await both MVU writes, verify floor 0 contains the selected mode, POV, and initialized character matrix, and abort before replacing the opening placeholder when verification fails**

```ts
await updateVariablesWith(updater, { type: 'chat' });
await updateVariablesWith(updater, { type: 'message', message_id: 0 });
const committed = getVariables({ type: 'message', message_id: 0 }).stat_data;
if (committed.mode !== next.mode || committed.current_pov !== next.current_pov) throw new Error('开局变量校验失败');
```

- [x] **Step 5: Insert a visible user turn, copy the floor-0 MVU snapshot, and invoke only `/trigger`**

```js
await createChatMessages([{ role: 'user', message: visibleText + '\n\n' + marker }], { refresh: 'affected' });
await updateVariablesWith(copyFloor0, { type: 'message', message_id: getLastMessageId() });
await triggerSlash('/trigger');
```

- [x] **Step 6: Run the mounter tests and require all assertions to pass**

```powershell
node cards\Counterfeit\build_tools\test_opening_mounter.mjs
```

### Task 3: Remove the alternate greeting bypass and document the plugin prerequisite

**Files:**
- Modify: `cards/Counterfeit/tavern-cards-state.json`
- Modify: `cards/Counterfeit/创作规划.yaml`
- Modify: `tavern_helper_template/src/Counterfeit/界面/开场白/ModeSelect.vue`
- Preserve: `cards/Counterfeit/开场白/1.txt`

- [x] **Step 1: Register only the UI greeting while retaining greeting 1 as an unregistered source backup**

```json
"first_messages": ["开场白/0.txt"]
```

- [x] **Step 2: Add a creator note and mode-screen warning that plot mode requires the Prompt Template plugin to interpret `@@if` gates**

```text
剧情模式必须安装并启用“提示词模板”插件；未安装时请勿开始生成，否则 `@@if` 场景门控不会执行。
```

- [x] **Step 3: Confirm no scene manifest entry, scene content, or `enabled` value changed**

```powershell
Compare-Object $beforeSceneHashes $afterSceneHashes | Should -BeNullOrEmpty
```

### Task 4: Generate lightweight avatars from the new portrait masters

**Files:**
- Modify: `tavern_helper_template/assets/tools/crop_portrait_headshots.py`
- Create: `tavern_helper_template/assets/Counterfeit/状态栏/avatars/*.webp`
- Source: `图片素材/角色立绘/全角色立绘/*.png`

- [x] **Step 1: Define all 12 source-to-slug mappings and deterministic crop boxes**

```python
PORTRAITS = {
    "雪之下雪乃.png": ("yukino.webp", 0.50, 0.20, 0.34),
    "由比滨结衣新立绘.png": ("yui.webp", 0.50, 0.20, 0.34),
}
```

- [x] **Step 2: Generate 512×512 WebP avatar crops while leaving all source PNGs untouched**

```powershell
python tavern_helper_template\assets\tools\crop_portrait_headshots.py
```

- [x] **Step 3: Inspect the contact sheet and correct any crop that cuts the face, hair, or identifying clothing**

```powershell
python tavern_helper_template\assets\tools\crop_portrait_headshots.py --contact-sheet
```

- [x] **Step 4: Verify each avatar is 512×512, decodes successfully, and is materially smaller than its 4K portrait**

```python
assert image.size == (512, 512)
assert avatar.stat().st_size < source.stat().st_size
```

### Task 5: Split thumbnail and 4K detail rendering

**Files:**
- Modify: `tavern_helper_template/src/Counterfeit/config.ts`
- Modify: `tavern_helper_template/src/Counterfeit/界面/状态栏/utils.ts`
- Modify: `tavern_helper_template/src/Counterfeit/界面/状态栏/App.vue`
- Modify: `tavern_helper_template/src/Counterfeit/界面/状态栏/components/CharacterModal.vue`

- [x] **Step 1: Add a pinned status-avatar base URL and return both `avatarUrl` and `portraitUrl` for all 12 mapped characters**

```ts
export const STATUS_AVATAR_BASE = `${CDN_ROOT}/assets/Counterfeit/状态栏/avatars`;
return { ...record, avatarUrl: avatarUrlOf(name), portraitUrl: portraitUrlOf(name) };
```

- [x] **Step 2: Load only the 512px avatar in character chips**

```vue
<img :src="character.avatarUrl" loading="lazy" decoding="async" />
```

- [x] **Step 3: Render the 4K portrait with `object-fit: contain` in a larger responsive modal column and lazy-decode it only after the modal opens**

```css
.cm-portrait { width: clamp(240px, 32vw, 420px); }
.cm-portrait img { width: 100%; height: min(70dvh, 680px); object-fit: contain; object-position: center top; }
```

- [x] **Step 4: Verify the dynamic profile filter remains `record.present && record.known`, so every mapped portrait character can receive a profile when MVU creates the record**

```ts
return Object.entries(characters).filter(([, record]) => record.present && record.known);
```

### Task 6: Build, embed, and package v0.4.6

**Files:**
- Generate: `tavern_helper_template/dist/Counterfeit/界面/开场白/index.html`
- Generate: `tavern_helper_template/dist/Counterfeit/界面/状态栏/index.html`
- Generate: `cards/Counterfeit/脚本/开场白挂载.js`
- Generate: `cards/Counterfeit/脚本/状态栏挂载.js`
- Create: `cards/Counterfeit/Counterfeit v0.4.6.png`

- [x] **Step 1: Publish the avatar assets to a fixed GitHub commit and pin jsDelivr to that commit**

```powershell
git add -- tavern_helper_template/assets/Counterfeit/状态栏/avatars
git commit --only -- tavern_helper_template/assets/Counterfeit/状态栏/avatars -m "assets: add Counterfeit status avatars"
git push
```

- [x] **Step 2: Build both single-file frontends**

```powershell
pnpm.cmd webpack --config webpack.opening.config.ts
pnpm.cmd webpack --config webpack.statusbar.config.ts
```

- [x] **Step 3: Embed the compiled HTML into the authoritative mounter templates**

```powershell
python cards\Counterfeit\build_tools\pack_embedded_frontends.py
```

- [x] **Step 4: Run syntax, MVU, unit, and fixed-commit URL validation**

```powershell
node --check cards\Counterfeit\脚本\开场白挂载.js
node --check cards\Counterfeit\脚本\状态栏挂载.js
node C:\Users\1\.codex\skills\tavern-cards\scripts\tavern-cards-forge.mjs validate-mvu Counterfeit
```

- [x] **Step 5: Pack with the tavern-cards forge and preserve the existing v0.4.5 package**

```powershell
node C:\Users\1\.codex\skills\tavern-cards\scripts\tavern-cards-forge.mjs pack Counterfeit
Copy-Item -LiteralPath 'cards\Counterfeit\Counterfeit.png' -Destination 'cards\Counterfeit\Counterfeit v0.4.6.png'
```

### Task 7: Readback, browser smoke test, and final audit

**Files:**
- Inspect: `cards/Counterfeit/Counterfeit v0.4.6.png`
- Modify after every completed batch: `cards/Counterfeit/editable-summary.md`

- [x] **Step 1: Unpack v0.4.6 into a temporary directory and compare scripts, greeting registration, and all scene hashes against source**

```powershell
node C:\Users\1\.codex\skills\tavern-cards\scripts\tavern-cards-forge.mjs unpack 'cards\Counterfeit\Counterfeit v0.4.6.png' --output $readback
```

- [x] **Step 2: Verify v0.4.5 remains byte-identical to the backup and verify every scene entry remains enabled exactly as before**

```powershell
if ((Get-FileHash $oldCard).Hash -ne (Get-FileHash $backupCard).Hash) { throw 'v0.4.5 was modified' }
```

- [ ] **Step 3: In the local SillyTavern browser, test plot-mode commit, initial relationships, visible user turn, one automatic assistant reply, modal sharpness, close behavior, and responsive layout**

```text
Expected: one user opening marker, one generated assistant floor, nonzero configured initial relationships, 512px chip avatars, and a sharp contain-fit 4K modal portrait.
```

No-cost portion completed on 2026-08-03: the actual SillyTavern listener was found at `localhost:8000` (the stated port 5000 was not listening); opening-mode warning/portraits and status UI were exercised in the browser from the final compiled HTML. The modal opened as an independent overlay, used the fixed-commit 3328×4864 source with `object-fit: contain`, closed correctly, and loaded no 4K portrait before a profile was opened. The persistent-mounter VM test separately proved visible user-floor creation, `/trigger` dispatch, floor-0 variable copying, duplicate suppression, and zero calls to the deprecated `generate()` API. A live card import plus paid model `/trigger` was deliberately not run because the imported internal name collides with the installed `Counterfeit` card and the request may incur substantial token usage; therefore the full end-to-end item remains unchecked instead of being overstated.

- [x] **Step 4: Review every plan checkbox and record commands, results, package hash, backup path, asset commit, and any unverified external condition in `editable-summary.md`**

```text
All completed claims must be backed by a captured command result or browser observation.
```
