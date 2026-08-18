# Romance Guide Split Implementation Plan

> **For agentic workers:** Execute inline and track every checkbox. Preserve character voice, relationship evidence requirements, and the first-import EJS guards.

**Goal:** Replace the 5981-token constant romance guide with a compact common contract and fourteen character-local selective guides.

**Architecture:** Keep only numeric and multi-route rules in the constant mechanism entry. Move each character's effective interaction, negative evidence, observable progression, and commitment trigger into that character's existing selective personality or NPC file without adding extra relationship-eligibility declarations.

**Tech Stack:** SillyTavern worldbook YAML/EJS, Tavern Card state JSON, MVU relationship variables, Node.js built-in verification.

---

### Task 1: Freeze the split contract

**Files:**
- Modify: `创作规划.yaml`
- Create: `docs/superpowers/plans/2026-08-04-romance-guide-split.md`
- Create: `build_tools/verify_romance_guide_split.mjs`

- [x] Record the compact-constant and per-character-selective architecture.
- [x] Add a verifier for fourteen destinations, selective registration, token budget, and prohibited legacy locks.
- [x] Run the verifier before implementation and confirm it fails on the monolith.

### Task 2: Split the monolith

**Files:**
- Modify: `世界书/机制/攻略难度.yaml`
- Modify: eight `世界书/角色/*/性格调色盘.yaml` files
- Modify: six `世界书/NPC/*.yaml` files

- [x] Reduce the constant mechanism entry to common numeric and evidence rules.
- [x] Append one compact guide to each of the fourteen existing selective character entries.
- [x] Remove duplicated defense/stage prose and all legacy romance-lock declarations.

### Task 3: Synchronize registration and validate

**Files:**
- Modify: `tavern-cards-state.json`
- Modify: `editable-summary.md`

- [x] Allow the Aiblana personality entry to render in free mode while retaining POV behavior.
- [x] Update the mechanism abstract to describe the split architecture.
- [x] Run split verification, EJS first-import verification, MVU validation, JSON/EJS structure checks, and a token-size report.
- [x] Pack a non-overwriting candidate and verify raw readback.
