# Visual Novel Relationship Guide Rewrite Implementation Plan

> **For Codex:** Follow the `tavern-cards` source/build/package separation. Do not treat a successful source edit or webpack build as proof that the final card contains the change.

**Goal:** Rewrite all 14 character relationship guides in natural visual-novel route language, synchronize the statusbar display/data source, and produce a new importable card artifact with readback evidence.

**Architecture:** Character worldbook entries remain the semantic source of truth. Each guide uses four player-facing concepts: `路线基调` (optional), `容易心动的瞬间`, `会拉开距离的做法`, and `关系确认信号`. The statusbar keeps a typed mirror of that text for a read-only modal. MVU fields and thresholds (`bond`, `romance`, `commitment`) are not changed.

**Tech Stack:** YAML/EJS worldbook entries, Vue 3 + TypeScript statusbar, webpack, Python frontend embedder, tavern-cards-forge.

---

### Task 1: Rewrite the worldbook relationship guides

**Files:**
- Modify: `世界书/角色/*/性格调色盘.yaml`
- Modify: `世界书/NPC/*.yaml`
- Modify: `世界书/机制/攻略难度.yaml`
- Modify: `世界书/扮演准则/扮演准则.yaml`
- Modify: `创作规划.yaml`
- Modify: `build_tools/verify_romance_guide_split.mjs`

**Steps:**
1. Rewrite all 14 local guide blocks under the common `攻略提示_角色名` heading.
2. Replace report-like terms such as “有效证据 / 负面证据 / commitment翻转” with player-readable route language.
3. Preserve each character's actual relational boundaries and confirmation condition.
4. Update cross-references and the split verifier to the new contract.

### Task 2: Synchronize the statusbar source

**Files:**
- Modify: `tavern_helper_template/src/Counterfeit/界面/状态栏/profile.ts`
- Modify: `tavern_helper_template/src/Counterfeit/界面/状态栏/components/CharacterModal.vue`

**Steps:**
1. Rename the typed guide fields to `routeTone`, `heartMoments`, `distanceTriggers`, and `confirmationSignal`.
2. Copy the worldbook guide text verbatim into the statusbar table.
3. Replace UI labels and route-state tags with visual-novel wording.
4. Search the entire frontend for stale field names and old report-like labels.

### Task 3: Build and embed

**Steps:**
1. Run the targeted production statusbar webpack build.
2. Re-embed `dist/Counterfeit/界面/状态栏/index.html` into `脚本/状态栏挂载.js`.
3. Verify the embedded payload contains the new labels and none of the old labels.

### Task 4: Package and read back

**Steps:**
1. Point `.cardrc.json` at a new dated PNG artifact.
2. Run worldbook/MVU/frontend gates.
3. Pack the card with tavern-cards-forge.
4. Unpack the generated card into a temporary readback directory and verify all 14 guides plus the embedded statusbar payload.

