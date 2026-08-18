# Counterfeit Project Dirty-File Cleanup Implementation Plan

> **For agentic workers:** Execute inline and track every checkbox. This cleanup is reversible: move classified files into a timestamped directory under `backups/` and record a hash manifest before changing their locations.

**Goal:** Remove obsolete duplicates, legacy source trees, old packages, and generated caches from the active Counterfeit project layout without touching the v0.4.6 authoritative card, portrait sources, frontend sources, or scene content.

**Architecture:** Keep the active root limited to build configuration, project governance, `cards/`, `图片素材/`, `tavern_helper_template/`, and `backups/`. Move dirty files to `backups/project-dirty-files-before-cleanup-<timestamp>/quarantine/` rather than deleting them. Generate a CSV manifest containing original relative path, length, and SHA-256 so every moved file can be restored exactly.

**Tech Stack:** PowerShell, SHA-256, tavern-cards forge `validate-mvu`.

---

### Task 1: Freeze protected invariants

**Protected paths:**
- `.cardrc.json`
- `AGENTS.md`
- `CLAUDE.md`
- `WORKFLOW.md`
- `cards/Counterfeit/` authoritative sources
- `cards/Counterfeit/Counterfeit.png`
- `cards/Counterfeit/Counterfeit v0.4.6.png`
- `cards/Counterfeit/Counterfeit适配表格.json`
- `图片素材/`
- `tavern_helper_template/`
- `backups/Counterfeit-v0.4.5-before-v0.4.6-20260803-115949/`

- [x] Record the v0.4.6 SHA-256, `.cardrc.json` SHA-256, state SHA-256, and the 150 scene-source hashes.
- [x] Confirm `Counterfeit.png` is byte-identical to `Counterfeit v0.4.6.png` and retain both because `.cardrc.json` names the generic artifact.

### Task 2: Create the reversible quarantine

**Create:** `backups/project-dirty-files-before-cleanup-<timestamp>/`

- [x] Resolve the project root and assert every source and destination remains inside that exact root.
- [x] Write `move-manifest.csv`, `cleanup-summary.json`, and `RESTORE.md` before moving files.

### Task 3: Quarantine obsolete root-level material

**Move whole directories:**
- `.bak/`
- `.git/` (invalid fragment containing only `info/exclude`, not the real frontend repository)
- `archive/`
- `docs/`
- `memory/`
- `世界书/`
- `正则/`

**Move root files:**
- `Counterfeit-新版自查.png`
- `galgame 系统设计.md`
- `MVU-DESIGN.md`
- `scope-patches.json`
- `酒馆助手脚本-手机助手-Counterfeit.json`
- `开场白界面.md`
- `开场白文案.config.yaml`
- `手机助手.md`

- [x] Move every listed item while preserving its original relative path beneath `quarantine/`.
- [x] Confirm no unlisted root entry moved.

### Task 4: Quarantine generated caches and superseded card artifacts

**Move from `cards/Counterfeit/`:**
- `.build/`
- `.kilo/`
- `kilo.json`
- `Counterfeit v0.3.png`
- `Counterfeit v0.4.png`
- `Counterfeit v0.4.1.png`
- `Counterfeit v0.4.2.png`
- `Counterfeit v0.4.3.png`
- `Counterfeit v0.4.4.png`
- `Counterfeit v0.4.5.png` (the protected rollback copy already exists under the v0.4.5 backup)
- `Counterfeit-before-cg-repack-20260802-044415.png`
- `Counterfeit适配表格.backup-含旧数据.json`
- `Counterfeit适配表格.backup-无ddl.json`

- [x] Move every listed artifact and retain current sources, both current v0.4.6 artifacts, active table JSON, cover assets, scripts, entries, docs, patches, and preset.

### Task 5: Validate the cleaned project

- [x] Confirm active root contains only protected directories/files and intentionally retained governance/build files.
- [x] Confirm `Counterfeit v0.4.6.png` and `Counterfeit.png` hashes remain unchanged.
- [x] Confirm 150 scene YAML files and unchanged scene SHA-256 values.
- [x] Parse `.cardrc.json` and `tavern-cards-state.json` as JSON.
- [x] Run `tavern-cards-forge.mjs validate-mvu Counterfeit`.
- [x] Confirm every manifest source is absent from the active location and present in quarantine with the recorded length and SHA-256.

### Task 6: Record and review

- [x] Append the exact cleanup boundary, quarantine path, moved-file count/bytes, validation results, and restore method to `cards/Counterfeit/editable-summary.md`.
- [x] Review every checkbox and leave no unsupported completion claim.

## Final result

- Quarantine: `backups/project-dirty-files-before-cleanup-20260803-131847/`
- Moved roots: 28
- Moved files: 6,907
- Moved bytes: 242,377,154
- Manifest source/destination errors: 0
- Manifest hash/length errors: 0
- v0.4.6 and generic artifact SHA-256: `7AFE3BA21F59CDD43841730E64AF486A96D67312DA771D7421CA46D5ED63115D`
- Scene YAML count: 150; all hashes unchanged
- `.cardrc.json` and state JSON parsing: passed
- `validate-mvu Counterfeit`: passed
