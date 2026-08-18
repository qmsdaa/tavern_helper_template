# Counterfeit Phone Registration And Packaging Cleanup Implementation Plan

**Goal:** Embed the MVU v0.5.1 phone assistant into the character card and clear the initvar, Zod, and phone-persona packaging blockers without wiring the separate status-bar frontend.

**Architecture:** Keep the generated standalone phone JSON as the build artifact, extract its `content` into a card-local Tavern Helper script file, and register that file through `tavern-cards-state.json`. Move only the default initvar to the forge-standard path, regenerate Zod from the current schema, and use the redesigned character/NPC entries as phone persona sources instead of importing stale legacy `[手机]` entries.

**Tech Stack:** SillyTavern character card state JSON, Tavern Helper scripts, MVU/Zod 4, YAML, PowerShell, `tavern-cards-forge.mjs`.

---

### Task 1: Record The Packaging Decisions

**Files:**
- Modify: `创作规划.yaml`
- Modify: `docs/superpowers/plans/2026-07-26-phone-registration-packaging-cleanup.md`

- [x] Add the phone script registration source, persona resolution rule, and legacy-persona exclusion rule to `phone_assistant`.
- [x] Keep the new card entry manifest as the character-card source of truth; treat the 233-entry root worldbook as a legacy standalone index rather than a list to merge.

### Task 2: Materialize And Register The Current Phone Script

**Files:**
- Create: `脚本/手机助手.js`
- Replace generated artifact: `酒馆助手脚本-手机助手-Counterfeit.json`
- Modify: `tavern-cards-state.json`

- [x] Parse the project-root `酒馆助手脚本-手机助手-Counterfeit.json`.
- [x] Write its `content` field as UTF-8 without BOM to `脚本/手机助手.js`.
- [x] Copy the same JSON into the card directory so the standalone and embedded sources identify the same build.
- [x] Add `extensions.tavern_helper.scripts["手机助手-Counterfeit"]` with the source JSON's id, info, button/data settings, and `script_file: "脚本/手机助手.js"`.
- [x] Query the state and verify the phone script is enabled and references an existing file.

### Task 3: Normalize The Default Initvar Path

**Files:**
- Move: `世界书/MVU/初始变量.yaml` → `世界书/变量/initvar.yaml`
- Modify: `tavern-cards-state.json`
- Modify: `创作规划.yaml`

- [x] Use an RFC 6902 `replace` patch for the initvar entry path so forge performs the file move and state update together.
- [x] Update the planning entry path to `世界书/变量/initvar.yaml`.
- [x] Run `validate-mvu Counterfeit` without `--initvar`; expect `校验通过`.

### Task 4: Regenerate The Runtime Zod Script

**Files:**
- Regenerate: `脚本/Zod.txt`

- [x] Read the clean `assets/mvu-templates/脚本/Zod.txt`.
- [x] Replace `// SCHEMA_CONTENT` with the current `schema.ts`, excluding `export type` lines.
- [x] Write UTF-8 without BOM.
- [x] Compare the generated expected text and `脚本/Zod.txt` after newline normalization; expect exact equality.

### Task 5: Verify Packaging Readiness For This Scope

**Files:**
- Verify: `tavern-cards-state.json`
- Verify: `脚本/手机助手.js`
- Verify: `世界书/变量/initvar.yaml`
- Verify: `脚本/Zod.txt`

- [x] Run `validate-mvu Counterfeit`.
- [x] Query registered scripts and confirm MVU, Zod, opening mount, and phone assistant are present.
- [x] Verify all entry, regex, script, avatar, and first-message file references exist.
- [x] Verify the embedded phone script contains latest-message MVU reads, latest memory, and six outfit fields, with no legacy `affection_*`.
- [x] Run a temporary pack to `D:\tmp\Counterfeit-phone-registration-check.png`; do not overwrite the official card.
- [x] Inspect the temporary packed card by unpacking it to a temporary directory and confirm the phone script survived conversion.
- [x] Report the concurrently added status-bar mount plus the retained legacy inline EJS as a separate duplicate-rendering blocker outside this scope.
