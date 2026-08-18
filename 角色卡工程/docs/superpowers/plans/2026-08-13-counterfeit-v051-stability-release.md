# Counterfeit v0.5.1 Stability Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a readback-verified v0.5.1 card that preserves the 150-scene mainline, prevents one chat from changing another chat's scene availability, records explicit mainline completion, reveals scene 150 CG after completion, and synchronizes every packaged frontend artifact.

**Architecture:** Keep all plot entries globally enabled and isolate chats exclusively through per-floor MVU values plus EJS `getvar` guards. Add one irreversible `mainline_completed` flag while retaining `current_scene = 150` at the ending. Make the CG mounter derive completion from both variables and load its manifest from the same fixed asset commit as the images. Treat source, compiled frontend, independent phone JSON, embedded card scripts, and unpacked readback as separate artifacts that must agree.

**Tech Stack:** SillyTavern Tavern Card v3, Tavern Helper, MVU, EJS, Vue 3, TypeScript, webpack, Node.js `node:test`, Python packaging tools, tavern-cards-forge.

**Status:** Completed on 2026-08-13. Final evidence is the `Counterfeit-v0.5.1-20260813.png` readback, the v0.5.1/CG regression tests, 150/150 scene validation, 180 EJS guard validation, MVU validation, and exact embedded-frontend/phone-package checks.

---

### Task 1: Freeze v0.5.1 contracts with failing checks

**Files:**
- Create: `build_tools/verify_v051_contracts.mjs`
- Create: `build_tools/test_cg_mounter.mjs`
- Inspect: `创作规划.yaml`
- Inspect: `../../tavern_helper_template/src/Counterfeit/界面/开场白/store.ts`

- [ ] **Step 1: Assert the planning YAML parses and declares `pov`, `custom`, and `free` without deleted calendar structures**
- [ ] **Step 2: Assert `mainline_completed` exists in planning, schema, initvar, update rules, EJS preprocessing, and the opening commit**
- [ ] **Step 3: Assert opening code never mutates global worldbook `enabled` state during per-chat mode changes**
- [ ] **Step 4: Simulate scene 150 completion and require the CG mounter to reveal scene 150 exactly once**
- [ ] **Step 5: Run both checks and capture the expected pre-fix failures**

### Task 2: Repair planning, authority, and release metadata

**Files:**
- Modify: `创作规划.yaml`
- Modify: `tavern-cards-state.json`
- Modify: `../../docs/权威/README.md`
- Modify: `../../AGENTS.md`
- Modify: `../../CLAUDE.md`
- Modify: `../../docs/权威/项目规则.md`

- [ ] **Step 1: Fix YAML indentation and replace the stale mode/calendar descriptions with the current model**
- [ ] **Step 2: Update the internal card version and creator notes to v0.5.1**
- [ ] **Step 3: Correct authority filenames and the current 226-entry inventory without changing project policy**
- [ ] **Step 4: Re-run planning parse and authority-link checks**

### Task 3: Propagate explicit mainline completion through MVU

**Files:**
- Modify: `schema.ts`
- Modify: `世界书/变量/initvar.yaml`
- Modify: `世界书/MVU/更新规则.yaml`
- Modify: `世界书/MVU/输出格式.yaml`
- Modify: `世界书/EJS预处理/EJS预处理.txt`
- Modify: `脚本/Zod.txt`
- Modify: `../../tavern_helper_template/src/Counterfeit/schema.ts`
- Modify: `../../tavern_helper_template/src/Counterfeit/界面/开场白/store.ts`

- [ ] **Step 1: Add `mainline_completed: boolean = false` to every authoritative schema and initializer**
- [ ] **Step 2: Define the only legal transition as `false -> true` after scene 150 completes; never advance beyond scene 150**
- [ ] **Step 3: Gate branch selection on completion and expose the flag to EJS/output analysis**
- [ ] **Step 4: Initialize the flag in every opening mode and run MVU/schema validation**

### Task 4: Remove cross-chat mutation and repair ending CG reveal

**Files:**
- Modify: `../../tavern_helper_template/src/Counterfeit/界面/开场白/store.ts`
- Modify: `脚本/CG挂载.js`
- Test: `build_tools/verify_v051_contracts.mjs`
- Test: `build_tools/test_cg_mounter.mjs`

- [ ] **Step 1: Remove per-chat calls that globally toggle worldbook entry `enabled` values**
- [ ] **Step 2: Retain isolation through the existing 180 EJS guards and document that invariant next to the opening commit**
- [ ] **Step 3: Count scene 150 as completed only when `mainline_completed` is true**
- [ ] **Step 4: Pin the CG manifest to the fixed image commit and build captions with DOM text APIs**
- [ ] **Step 5: Run the isolation and CG regression checks to green**

### Task 5: Rebuild and synchronize frontend artifacts

**Files:**
- Generate: `../../tavern_helper_template/dist/Counterfeit/界面/开场白/index.html`
- Generate: `../../tavern_helper_template/dist/Counterfeit/界面/状态栏/index.html`
- Generate: `../../tavern_helper_template/dist/Counterfeit/界面/手机/index.html`
- Generate: `脚本/开场白挂载.js`
- Generate: `脚本/状态栏挂载.js`
- Generate: `脚本/手机助手-Counterfeit.json`
- Generate: `酒馆助手脚本-手机助手-Counterfeit.json`

- [ ] **Step 1: Build opening, statusbar, and phone bundles in production mode**
- [ ] **Step 2: Re-embed opening/statusbar HTML from their authoritative templates**
- [ ] **Step 3: Pack and synchronize the independent phone JSON from the latest phone bundle**
- [ ] **Step 4: Verify embedded HTML and phone loader hashes exactly match their build outputs**

### Task 6: Validate, package, and read back v0.5.1

**Files:**
- Modify: `.cardrc.json`
- Create: `Counterfeit-v0.5.1-20260813.png`
- Create: `.build/readback-v0.5.1-20260813/`

- [ ] **Step 1: Run scene-field, EJS-guard, relationship-guide, syntax, MVU, opening, identity, isolation, CG, and phone-pack checks**
- [ ] **Step 2: Pack a new v0.5.1 artifact without overwriting v0.5.0-preview**
- [ ] **Step 3: Unpack into a fresh readback directory and compare scripts, metadata, 226 entries, and all 150 scene registrations**
- [ ] **Step 4: Record artifact hash and clearly identify any browser-only behavior not exercised in this run**

### Task 7: Produce the v0.6.0 complete design

**Files:**
- Create: `docs/superpowers/plans/2026-08-13-counterfeit-v060-roadmap.md`

- [ ] **Step 1: Specify generated scene-index and model-facing/visible long-gap transition layers**
- [ ] **Step 2: Specify gallery unlock state, manifest validation, accessibility, and migration from hard-coded totals**
- [ ] **Step 3: Specify a campaign registry supporting mainline plus both priority DLC concepts**
- [ ] **Step 4: Specify gender/body/identity ownership variables, save migration, content boundaries, tests, milestones, and release gates**
