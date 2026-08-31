# MVU Update Rules Slimming Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce the per-generation MVU update-rule prompt while preserving Counterfeit gameplay semantics and fixing the runtime participation schema drift.

**Architecture:** Keep the existing single registered update-rules entry, but render campaign/mode/POV/finale-specific sections through inline EJS and retain a compact always-on semantic core. Synchronize the frontend ParticipationSchema into the card runtime schema and regenerate Zod.txt from the canonical schema.

**Tech Stack:** YAML/EJS worldbook prompts, TypeScript-style Zod 4 schema, TavernHelper MVU JSONPatch, Node.js verification scripts, tavern-cards-forge pack/unpack.

---

### Task 1: Record design and baseline

**Files:**
- Create: `docs/superpowers/specs/2026-08-20-mvu-update-rules-slimming-design.md`
- Create: `docs/superpowers/plans/2026-08-20-mvu-update-rules-slimming.md`

- [ ] Record the accepted scope, exclusions, conditional rendering matrix, and smoke-test acceptance criteria.
- [ ] Capture baseline line/character/byte counts for `世界书/MVU/更新规则.yaml` and `世界书/MVU/输出格式.yaml`.

### Task 2: Synchronize participation schema

**Files:**
- Modify: `schema.ts`
- Modify: `脚本/Zod.txt`
- Reference: `../前端工程/src/Counterfeit/schema.ts`

- [ ] Add `ParticipationSchema` with nullable `track`/`note` semantics matching the frontend source.
- [ ] Add `participation: ParticipationSchema` to `custom_protagonist`.
- [ ] Regenerate `脚本/Zod.txt` from the canonical root schema using the tavern-cards MVU template contract.
- [ ] Compare root schema and Zod payload after removing only the TypeScript export line; expect no diff.

### Task 3: Slim and conditionally render update rules

**Files:**
- Modify: `世界书/MVU/更新规则.yaml`

- [ ] Replace repeated evidence/no-change language with one shared rule block.
- [ ] Remove opening commit documentation, immutable-field update entries, and the initial relationship table.
- [ ] Preserve the compact core for world/player/character semantic updates.
- [ ] Add inline EJS guards for scripted mainline, free mode, DLC identity, Laff Ω/hammers, and finale selection; keep compact milestone criteria always available for inherited/open-world saves.
- [ ] Rename annotated pseudo-path headings to exact schema paths (`arc_milestones`, `iroha_milestones`) and keep descriptions inside their rule bodies.
- [ ] Add a static test that renders representative stat states and asserts required/forbidden section markers.

### Task 4: Slim output contract

**Files:**
- Modify: `世界书/MVU/输出格式.yaml`

- [ ] Keep the UpdateVariable/Analysis/JSONPatch envelope and five supported operations.
- [ ] Remove repeated rule prose already enforced by the update-rules entry.
- [ ] Replace the full character insert example with minimal scalar/array examples.

### Task 5: Synchronize planning and manifest metadata

**Files:**
- Modify: `创作规划.yaml`
- Modify: `tavern-cards-state.json` only if its update-rule abstract no longer describes the implementation accurately.

- [ ] Add a dated runtime maintenance record describing participation synchronization and conditional update-rule rendering.
- [ ] Keep the registered path, UID, part, system role, depth, and order unchanged.
- [ ] Update only the abstract if necessary; do not alter unrelated manifest data.

### Task 6: Verification and smoke test

**Files:**
- Create or modify a focused verifier under `build_tools/` only if existing checks do not exercise update-rule EJS branches.
- Produce: a non-overwriting candidate artifact and a fresh `.build/readback-*` directory.

- [ ] Run Node syntax checks for any new verifier.
- [ ] Run the focused update-rule renderer across main POV, scripted custom, free, genderbend DLC, body-swap DLC, Laff POV, and completed-main states.
- [ ] Run `validate-mvu` for the project.
- [ ] Run `verify_v060_contracts`, `verify_ejs_condition_guards`, `verify_scene_fields`, `verify_romance_guide_split`, `verify_relationship_guide_sync`, and strict ensemble audit.
- [ ] Run all existing `build_tools/test_*.mjs` tests relevant to opening, identity, scene routing, transitions, and CG.
- [ ] Pack a candidate artifact without overwriting the previous release.
- [ ] Unpack into a fresh readback directory.
- [ ] Confirm the readback contains the slim update rules, synchronized Zod payload, expected scripts/regexes, and unchanged 150-scene registration.
