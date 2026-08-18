# Status Portrait Bottom Gap Fix Implementation Plan

> **For agentic workers:** Execute inline and track every checkbox. Preserve the current v0.4.6 package before modifying source or generated artifacts.

**Goal:** Remove the pink block below full-body portraits in the independent character modal without cropping, stretching, or eagerly loading the 4K image.

**Architecture:** The portrait wrapper currently has a fixed `height: min(70dvh, 700px)` and pink background while the `object-fit: contain` image is shorter after width-constrained scaling. Make real-image wrappers content-sized and transparent; retain a separate styled minimum-height state only for characters without a portrait. Rebuild only the status frontend, re-embed it, and repackage v0.4.6.

**Tech Stack:** Vue 3 scoped CSS, webpack statusbar target, `pack_embedded_frontends.py`, tavern-cards forge, browser smoke test.

---

### Task 1: Freeze and back up the current v0.4.6 state

**Back up:**
- `tavern_helper_template/src/Counterfeit/界面/状态栏/components/CharacterModal.vue`
- `tavern_helper_template/dist/Counterfeit/界面/状态栏/index.html`
- `cards/Counterfeit/脚本/状态栏挂载.js`
- `cards/Counterfeit/Counterfeit.png`
- `cards/Counterfeit/Counterfeit v0.4.6.png`

- [x] Record length and SHA-256 for all five files.
- [x] Copy them to `backups/Counterfeit-v0.4.6-before-portrait-gap-fix-<timestamp>/` with a manifest.

### Task 2: Make the portrait wrapper follow the real image

**Modify:** `tavern_helper_template/src/Counterfeit/界面/状态栏/components/CharacterModal.vue`

- [x] Add an `is-placeholder` class only when `character.portraitUrl` is absent.
- [x] Remove fixed/minimum height and pink background from the normal portrait wrapper.
- [x] Render the real image as a block with `width: 100%` and intrinsic `height: auto` so the wrapper ends exactly at the image bottom.
- [x] Keep the pink background, centered initial, and minimum height only in `.cm-portrait.is-placeholder`.
- [x] On mobile, cap wrapper width without restoring a fixed height.

### Task 3: Build and embed only the affected frontend

- [x] Run `pnpm.cmd webpack --mode production --config webpack.statusbar.config.ts`.
- [x] Run `cards/Counterfeit/build_tools/pack_embedded_frontends.py` and confirm the opening mounter remains byte-identical.
- [x] Run `node --check` on both generated mounters and `validate-mvu Counterfeit`.

### Task 4: Browser smoke test

- [x] Open the final compiled status page with mock profile data.
- [x] Open a 4K portrait modal and verify portrait wrapper height equals image rendered height, with no pink pixels below it.
- [x] Verify `object-fit: contain`, intrinsic aspect ratio, close behavior, and mobile single-column layout.
- [x] Verify no 4K portrait request occurs before opening a profile.

### Task 5: Package and read back

- [x] Pack with `tavern-cards-forge.mjs pack Counterfeit` and update `Counterfeit v0.4.6.png` while retaining the focused backup.
- [x] Unpack into a temporary readback directory and confirm the status mounter hash matches source, version remains 0.4.6, and all 150 scene hashes remain unchanged.
- [x] Update `editable-summary.md`, review every checkbox, and record any unverified external condition.

## Final result

- Backup: `backups/Counterfeit-v0.4.6-before-portrait-gap-fix-20260803-132857/`
- Desktop browser: wrapper/image height delta `0px`, bottom delta `0px`, transparent wrapper, 3328×4864 intrinsic portrait, `object-fit: contain`.
- Mobile browser: one grid column, wrapper/image height delta `0px`, bottom delta `0px`, 340px portrait width.
- Before opening: two 512×512 lazy avatars and zero 4K modal portraits.
- Status HTML: 35,286 bytes, SHA-256 `553D10D46F0FB6FC1E09A8A363AE558E446DDDE9F901C9F27223C910A3A9C7D0`.
- Status mounter: 61,247 bytes, SHA-256 `2C2A4DDA9782BECAFC6CA0F48ED2165C2A26023EEDDA6D2ACCE7722ACF7D7BD6`.
- Opening mounter remained SHA-256 `DE1E594DB6C2357E89F35B291BB24661A30AF9B7B3A3ED604213F20AC2ABD989`.
- Final v0.4.6: 10,740,669 bytes, SHA-256 `3FF477201F7BCCABFE386A342FB932EE8DDF0F3D0D34093B95C2A68B5CF50562`.
- Readback: 228 entries, version 0.4.6, one greeting, status/opening mounters match source, 150 scene name/hash differences `0` versus the pre-fix v0.4.6 readback.
