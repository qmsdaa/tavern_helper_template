# Counterfeit MVU Finalization Implementation Plan

> **For agentic workers:** Execute inline in this session. Do not dispatch subagents, do not touch the 150 scene files, and do not package the card.

**Goal:** Replace the legacy five-affection MVU with the confirmed dynamic-character relationship model, world/player basics, a real opening user message, and corrected stage facts while keeping the current card runnable before visual redesign.

**Architecture:** Keep mode, POV, scene, Omega, hammers, information locks, ending direction, and phone at the root. Move date/location into `world`, add `player`, and replace fixed `affection_*` fields with a canonical-name `characters` record. EJS exposes compatibility globals where scene routing needs them; the temporary status renderer reads the new model without establishing the final visual design.

**Tech Stack:** TypeScript/Zod 4, YAML MVU rules, EJS, TavernHelper chat APIs, PowerShell validation.

---

### Task 1: Update design sources

**Files:**
- Modify: `创作规划.yaml`
- Modify: `../../MVU-DESIGN.md`
- Modify: `../../galgame 系统设计.md`

- [ ] Replace the legacy 24-variable/five-affection description with `world`, `player`, and dynamic `characters`.
- [ ] Keep `branch_choice` as the author-preset ending direction; do not add an Iroha preset ending.
- [ ] Record that the phone remains front-end-owned and is not rebuilt in this task.

### Task 2: Implement the new MVU model

**Files:**
- Modify: `schema.ts`
- Modify: `世界书/MVU/初始变量.yaml`
- Modify: `世界书/MVU/更新规则.yaml`
- Modify: `世界书/MVU/输出格式.yaml`
- Modify: `脚本/Zod.txt`

- [ ] Define `world.current_date/current_location`.
- [ ] Define nullable `player.cash` and `player.carried_items`.
- [ ] Define dynamic canonical-name character records with `display_name/present/known/relationship/outfit`.
- [ ] Remove all five `affection_*` fields and rules.
- [ ] Add precise update constraints for presence, relationship, outfit, location, cash, and carried items.
- [ ] Regenerate the Zod runtime copy from `schema.ts`.

### Task 3: Update runtime EJS and opening behavior

**Files:**
- Modify: `世界书/EJS预处理/EJS预处理.txt`
- Modify: `世界书/EJS预处理/开局场景路由.txt`
- Modify: `世界书/EJS预处理/角色阶段事实.txt`
- Modify: `脚本/开场白挂载.js`

- [ ] Map date/location/player/characters from the new paths.
- [ ] Detect the actual opening user message instead of requesting floor 65535.
- [ ] Emit a data-only opening user message without player-control prose.
- [ ] Copy initialized variables to the created user floor before `/trigger`.
- [ ] Correct the red ribbon to the left wrist and delay Iroha's completed-debut fact until scene 49.

### Task 4: Keep the status renderer compatible

**Files:**
- Modify: `世界书/EJS预处理/状态栏渲染.txt`

- [ ] Remove all `affection_*` reads.
- [ ] Read present-and-known relationships, location, cash, and carried items.
- [ ] Preserve the current simple visual shell; defer layout and front-end redesign.

### Task 5: Synchronize manifests and validate

**Files:**
- Modify if needed: `tavern-cards-state.json`

- [ ] Update stale abstracts that explicitly describe the old variable model.
- [ ] Parse all edited YAML files.
- [ ] Verify `schema.ts` and `脚本/Zod.txt` contain the same Schema.
- [ ] Run the available MVU validation command from the project toolchain.
- [ ] Search for remaining runtime `affection_*` references outside archived/generated phone artifacts.
- [ ] Confirm no scene file, phone source, build artifact, or packaged card was modified.
