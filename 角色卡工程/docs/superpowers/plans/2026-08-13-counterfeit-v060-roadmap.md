# Counterfeit v0.6.0 Campaign, Transition, and Gallery Roadmap

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Release a backward-compatible v0.6.0 that turns the existing mainline into one campaign among several, removes calendar duplication, makes long time jumps legible, makes CG discovery progress-aware, and ships two priority DLC open worlds with authored openings and persistent premise rules.

**Architecture:** Preserve `mode` as the play-style axis (`pov | custom | free`) and add an independent `campaign_id` axis. The main campaign remains a generated 150-scene campaign; DLC campaigns use `mode=free`, a fixed mainline timeline snapshot, one authored opening route, and campaign-specific EJS premise rules instead of numbered scene files. Status UI, phone UI, opening commit, EJS routing, CG unlocks, and validators consume the same campaign registry while v0.5.1 fields remain one-release compatibility mirrors.

**Tech Stack:** SillyTavern Tavern Card v3, Tavern Helper, MVU, EJS, Vue 3, TypeScript, Node.js generators/tests, JSON Schema, IndexedDB for optional cross-save collection cache, tavern-cards-forge.

---

## 1. Release definition

v0.6.0 is complete only when all of the following ship together:

- Mainline remains 150 scenes and old saves open at the same scene, POV, relationships, phone data, and completion state.
- Calendar data has one authority: each scene YAML plus one campaign manifest. No handwritten duplicate calendar/worldbook entry returns.
- All date gaps of seven days or more have an authored or explicitly date-only transition contract; no model-invented montage is required.
- Statusbar, phone, opening screen, CG mounter, and gallery use campaign-aware progress: scripted campaigns display registry totals while open-world campaigns display date/premise state without a fake denominator.
- Built-in CGs have deterministic IDs, validation, alt text, unlock rules, and fixed-release asset URLs.
- Both priority DLCs are fully playable open worlds: each has an authored first-turn opening, a canonical scene-118 snapshot, stable identity rules, campaign-aware free-world routing, and no dependency on numbered DLC scene files.
- A fresh install, a v0.5.1 mainline save, a completed mainline save, and each DLC save pass the same pack/readback/runtime matrix.

Non-goals for v0.6.0: live service DLC downloads, paid unlocks, cloud accounts, procedural scene writing, and changing the established 150-scene mainline facts.

## 2. Canonical campaign model

### Campaign registry

Create `世界书/剧情/campaigns.yaml` as the human-authored registry:

```yaml
schema_version: 1
campaigns:
  main:
    title: Counterfeit 公共线
    revision: 1
    campaign_type: scripted
    total_scenes: 150
    allowed_povs: [hachiman, yukino, yui, laff]
    scene_dir: 世界书/事件
    completion_field_compat: mainline_completed
  dlc_genderbend_hachiman:
    title: 错位的日常
    revision: 1
    campaign_type: open_world
    timeline_anchor: main:118
    start_date: 2014-07-12
    allowed_povs: [hachiman]
    forced_mode: free
    opening_route: dlc_genderbend_hachiman
    premise_entry: 世界书/DLC/性转八幡/演绎规则.yaml
  dlc_body_swap_mrs_yukinoshita:
    title: 君的名字？
    revision: 1
    campaign_type: open_world
    timeline_anchor: main:118
    start_date: 2014-07-12
    allowed_povs: [hachiman, mrs_yukinoshita]
    forced_mode: free
    opening_route: dlc_body_swap_mrs_yukinoshita
    premise_entry: 世界书/DLC/身体互换/演绎规则.yaml
```

Add MVU fields:

```yaml
campaign_id: main
campaign_revision: 1
current_scene: 1
campaign_completed: false
mainline_completed: false   # v0.5.1 compatibility mirror; only mirrors main
branch_choice: null
identity_state: null        # only populated by campaigns that need it
collection:
  version: 1
  cg_unlocks: {}
  ending_unlocks: {}
```

Rules:

- `campaign_id` and `campaign_revision` are opening-commit fields and immutable within a chat.
- `mode` continues to mean play style, not content route. Never add `mode=dlc`. The two DLC campaigns commit `mode=free`; `campaign_id` selects their content.
- `current_scene` remains meaningful only for `campaign_type=scripted`. Open-world campaigns keep the compatibility value `1`, never increment it, and use `world.current_date` plus premise state for progression.
- `campaign_completed` is the general irreversible completion flag.
- `mainline_completed` remains for v0.5.x save/script compatibility and must equal `campaign_id === 'main' && campaign_completed` on all new writes.
- `collection` is client-owned. The main AI must never emit patches beneath `/collection`.
- A campaign is selected only when creating a new chat. The UI must not offer mid-save campaign switching.
- Both DLCs begin from the canonical world state immediately after main scene 118, on Saturday 2014-07-12. They do not import an arbitrary mainline chat and do not activate scenes 1-118; a generated snapshot fixture provides only facts established by the end of scene 118.
- Open-world DLCs do not require the player to investigate, cure, or conclude the supernatural premise. `campaign_completed` changes only after an explicit player-facing end-story action or an actually established resolution; ordinary long-running play remains incomplete without penalty.

### Player viewpoint and event-focus contract

There is exactly one narrative-viewpoint authority: immutable `stat_data.current_pov`. In model-facing text call it **玩家视点** rather than “当前 POV” or “主 POV”. It answers “whose consciousness, observations, and first-person inner layer does the player control?” and can never be changed by a scene file.

The existing scene field `主场POV` does not describe a viewpoint: all 150 scene files use it, and its values include non-playable NPCs, multi-character pairs, and `共享场景／零POV`. Migrate it out of both source and generated data:

```yaml
事件焦点:
  类型: 角色        # 角色 | 群像
  角色:
    - 雪之下雪乃
    - 拉芙希妮·都柏林

玩家入口:
  hachiman:
    在场: false
    演绎入口: [...]
  yukino:
    在场: true
    演绎入口: [...]
```

- `事件焦点` answers only “which character or relationship carries this scene's planned dramatic movement?” It is plot metadata, not camera, player identity, first-person voice, or permission to write that character's inner monologue.
- `玩家入口` replaces `POV适配`. It answers “given the immutable player viewpoint, what can this player observe and where can play begin?”
- Runtime scene rendering must emit common scene facts, a clearly labelled non-authoritative event-focus summary, and only `玩家入口[current_pov]`. The other three player routes are source material and must not be sent to the model in the same generation.
- Rename `世界书/EJS预处理/POV分幕滤镜.txt` and its manifest entry to `玩家视点滤镜.txt`. It continues to derive observation style exclusively from `current_pov`; it must not read `事件焦点`.
- Rename the “非主场轨道” terminology in `扮演准则.yaml` to “非事件焦点玩家路线”. When the player is not an event-focus character, their own route remains the playable subject and the focal event arrives only through evidence available to them.
- Static validation rejects source/generated keys or labels named `主场POV`, beginning with `POV适配`, named `main_pov`, `scene_pov`, or bare `pov`. The compatibility name `current_pov` is allowed only in MVU/frontend/EJS code and is always documented as the player viewpoint.

The model-facing order is explicit and asymmetric:

```text
<player_viewpoint priority="absolute">
玩家视点: 雪之下雪乃
叙事镜头、第一人称与可写内心只属于玩家视点；场景资料不得改写本项。
</player_viewpoint>

<scene_context>
事件焦点（不是叙事视点）: 比企谷八幡
当前玩家入口: [only the rendered yukino route]
</scene_context>
```

`<player_viewpoint>` must be injected before `<scene_context>`. No scene-render fallback may substitute an event-focus character when a route is missing; fail validation instead.

### Old-save migration

Migration runs idempotently before UI rendering and before the first new generation:

1. Missing `campaign_id` becomes `main`.
2. Missing `campaign_revision` becomes the main campaign revision supported by the save.
3. Missing `campaign_completed` copies boolean `mainline_completed`, otherwise defaults false.
4. Existing `current_scene`, relationships, phone data, flags, and history remain untouched.
5. Missing `collection` is created by the client, never by the model.
6. A future campaign revision change requires an explicit migration table; revision mismatch must display a recoverable warning, not silently clamp progress.

### Portable save and raw-chat migration

Replace the disabled title-screen `读取存档` placeholder with `迁移旧档`. This is a compatibility importer, not a second SillyTavern chat manager.

Support two inputs:

1. **Official portable save**: `.counterfeit-save.json`, exported from the phone settings screen. This is the stable forward-compatible format.
2. **Legacy recovery**: SillyTavern character-chat `.jsonl` (and array-form `.json` when detected). Native SillyTavern raw export stores a header followed by message records; per-message MVU snapshots may be stored in the selected swipe's `variables`.

The portable envelope is:

```json
{
  "format": "counterfeit-portable-save",
  "version": 1,
  "exported_at": "2026-08-14T00:00:00.000Z",
  "card_version": "0.6.0",
  "campaign_id": "main",
  "campaign_revision": 1,
  "state": {
    "stat_data": {
      "mode": "pov",
      "campaign_id": "main",
      "campaign_revision": 1,
      "current_pov": "hachiman",
      "current_scene": 87,
      "world": {
        "current_date": "2014-03-03",
        "current_location": "奉仕部活动室",
        "time_slot": "放课后"
      }
    }
  },
  "resume_tail": [
    { "role": "user", "text": "我把门拉开了一半。" },
    { "role": "assistant", "text": "活动室里的谈话停了半拍。" }
  ],
  "provenance": {
    "source": "counterfeit-export",
    "source_message_count": 214,
    "source_sha256": "0000000000000000000000000000000000000000000000000000000000000000"
  }
}
```

Import is a five-stage transaction with no writes before confirmation:

1. **Parse locally**: use a streaming JSONL reader; never upload the selected file. Reject files above 128 MiB, malformed headers, unsupported group chats, and records with embedded data URIs larger than the configured media-skip threshold.
2. **Recover state**: inspect the active swipe from newest message to oldest and select the newest complete `stat_data` that passes the source-version schema. A corrupt newest snapshot may fall back to an earlier valid full snapshot, but the report must identify the fallback floor.
3. **Classify compatibility**: return `exact`, `migratable`, or `incompatible`. Compare `card_version`, `campaign_id`, `campaign_revision`, immutable player identity, scene alias tables, and schema version. Missing legacy version fields are inferred from a documented field-signature table, never from filename alone.
4. **Preview**: show source version, campaign, player viewpoint, scene/date/location, recovered floor, message count, migration steps, discarded fields, and unresolved conflicts. Nothing changes until the player presses `迁移并继续`.
5. **Commit atomically**: migrate through sequential version functions, validate against the current Zod schema, write the resulting full snapshot to message 0 and chat variables, replace `<OpeningUI/>` with a compact resume capsule, create one visible user continuation marker, copy the snapshot to that user floor, and call `/trigger` exactly once.

Do not call SillyTavern's internal `/api/chats/import` endpoint from the card and do not replay the full exported transcript into the new chat. Native import remains available in SillyTavern for users who want an exact archival copy. The card importer creates a clean continuation chat under the current card version, so old opening text, obsolete `<UpdateVariable>` blocks, stale worldbook routing markers, and old identity baselines cannot execute again.

The resume capsule contains:

- the fully migrated `stat_data` snapshot;
- at most the last eight visible user/assistant messages, capped at 12,000 characters after stripping reasoning, tool payloads, media/base64, old variable-update blocks, and UI markup;
- an authored `legacy_established_facts` ledger produced by the applicable migration table when a card update changed previously playable facts;
- provenance and warnings, but no API keys, browser-local settings, hidden prompt text, or unrelated chat metadata.

Continuity precedence is explicit: **facts actually established in the imported chat → authored migration ledger → current campaign defaults**. A raw importer cannot reliably infer semantic contradictions. If a release changes established canon without an authored `from_revision → to_revision` ledger, classify the save as `incompatible`, make no writes, and tell the player which older card version must continue it.

Frontend/source ownership:

- Create `tavern_helper_template/src/Counterfeit/存档/types.ts` for the portable envelope, compatibility report, migration result, and sanitized resume-message types.
- Create `tavern_helper_template/src/Counterfeit/存档/parseChatExport.ts` as a pure streaming parser for `.jsonl`, array `.json`, active-swipe variables, snapshot recovery, media stripping, and hard limits.
- Create `tavern_helper_template/src/Counterfeit/存档/migrations.ts` containing explicit, sequential, idempotent migration functions and the field-signature table for pre-v0.6.0 saves.
- Create `tavern_helper_template/src/Counterfeit/存档/portableSave.ts` for current-schema validation, export, hashing, resume-tail sanitization, and preview reports. Both opening and phone import this module.
- Create `tavern_helper_template/src/Counterfeit/界面/开场白/SaveImportScreen.vue`; enable the existing title button and route `title → save_import → preview → commit/done` without entering campaign or DLC setup.
- Update `tavern_helper_template/src/Counterfeit/界面/手机/SettingsApp.vue` to export the complete portable save. Keep the existing phone-only `backup.ts` format as a separate phone-data backup; do not silently reinterpret it as a full-game save.
- Update `脚本/开场白挂载.template.js` with a campaign-aware continuation marker and a resume commit kind. The mounter retains sole responsibility for creating the user floor and triggering the first resumed reply.
- Add `世界书/EJS预处理/存档续接路由.txt`, active only for the first reply after a verified resume marker. It tells the model to continue from the capsule's final observable moment, not replay an opening, re-run a numbered scene entrance, or invent missing events.

Required fixtures and tests:

- native `.jsonl` with variables stored as an active-swipe array and as a swipe-indexed object;
- truncated final line, corrupt latest snapshot with valid earlier fallback, missing header, group chat, oversized media, and no valid MVU snapshot;
- v0.4.6, v0.5.0-preview, v0.5.1, and v0.6.0 portable fixtures, each migrated twice to prove idempotence;
- scene renumber alias, removed field, added field, campaign mismatch, forged `current_pov`, unsupported future version, and missing breaking-canon ledger;
- preview/cancel/error paths proving byte-for-byte that message 0, chat variables, and messages remain untouched;
- successful resume proving message-0/chat/user-floor snapshot equality, exactly one continuation marker, exactly one `/trigger`, no old transcript replay, and no DLC opening route activation.

### Routing contract

Every mainline event gate becomes:

```ejs
getvar('stat_data.campaign_id', {defaults: 'main'}) === 'main'
&& getvar('stat_data.mode', {defaults: null}) === 'pov'
&& getvar('stat_data.current_scene', {defaults: null}) === N
```

DLC premise entries use their own campaign ID and contain no `current_scene` test. Shared character/world entries may declare `campaigns: [main, ...]`; DLC-specific secrets never rely on prompt wording alone.

### Opening and EJS entry contract

Keep one registered first message, `开场白/0.txt`, containing `<OpeningUI/>`. Do not add DLC alternate greetings or `initvar_override` files. Preserve the existing split of responsibilities: the opening iframe/store is the sole full-snapshot commit authority, while the persistent opening mounter is the sole first-reply orchestrator.

1. Opening UI selects `campaign_id` before play style.
2. `main` continues to expose scripted POV, custom, and free-world choices.
3. `dlc_genderbend_hachiman` skips play-style selection, commits `mode=free`, and commits `current_pov=hachiman`.
4. `dlc_body_swap_mrs_yukinoshita` skips play-style selection, commits `mode=free`, and asks which stable mind the player controls: `hachiman` or `mrs_yukinoshita`.
5. The iframe commit writes the complete campaign snapshot to message 0 and chat variables and replaces `<OpeningUI/>`; the mounter then creates one visible user line containing `我选择扮演`, copies the message-0 snapshot to that user floor, and calls `/trigger` exactly once.
6. `世界书/EJS预处理/开局场景路由.txt` detects the first reply from the visible user line but chooses the actual opening exclusively from immutable `campaign_id` and `current_pov`.

Opening commit values:

| Selection | `campaign_id` | `mode` | `current_pov` | `current_scene` | `world.current_date` |
|---|---|---|---|---:|---|
| Main scripted player viewpoint | `main` | `pov` | selected player character | `1` | `2013-05-20` |
| Main custom character | `main` | `custom` | `null` | `1` | `2013-05-20` |
| Main built-in open world | `main` | `free` | selected player character | `1` | `2013-05-20` |
| Main custom open world | `main` | `free` | `null` | `1` | `2013-05-20` |
| 《错位的日常》 | `dlc_genderbend_hachiman` | `free` | `hachiman` | `1` compatibility placeholder | `2014-07-12` |
| 《君的名字？》八幡意识 | `dlc_body_swap_mrs_yukinoshita` | `free` | `hachiman` | `1` compatibility placeholder | `2014-07-12` |
| 《君的名字？》夫人意识 | `dlc_body_swap_mrs_yukinoshita` | `free` | `mrs_yukinoshita` | `1` compatibility placeholder | `2014-07-12` |

Visible user lines remain human-readable routing checks rather than hidden XML. Use these exact forms so the existing `我选择扮演` detector continues to work:

- `我选择扮演比企谷八幡，进入《错位的日常》。`
- `我选择扮演比企谷八幡的意识，进入《君的名字？》。`
- `我选择扮演雪之下夫人的意识，进入《君的名字？》。`

Frontend ownership stays in `tavern_helper_template/src/Counterfeit/界面/开场白/`:

- Add `CampaignSelect.vue` as the first choice after the title screen. It presents `main` and the two DLC premises; it does not present DLCs as a fourth play style.
- Add `DlcSetup.vue` for DLC-only setup. It always exposes the existing romance-difficulty choice; for 《错位的日常》 it shows Hachiman as the fixed consciousness, while for 《君的名字？》 it also asks which consciousness the player controls and explains the initial body in plain language.
- Update `App.vue` so the step graph is `title → campaign → main mode flow` for `main`, and `title → campaign → dlc_setup → opening` for either DLC. Intro, gallery, and gate behavior remain unchanged.
- Update `store.ts` with a `CampaignId` type and campaign-aware commit builders. The store writes identity/world/MVU state; the registered shared + per-`current_pov` worldbook snapshot routes provide the two DLC prompt snapshots without duplicating them into frontend variables. Do not overload the existing `GameMode`; selecting either DLC always writes `mode=free`.
- Keep `ModeSelect.vue`, `PovConfirm.vue`, and `CustomForm.vue` main-campaign-only. Their visible copy says “选择／确认扮演角色”, never “选择主 POV”. Add Mrs. Yukinoshita to the DLC consciousness selector, not to the main four-character list; the body-swap copy says “选择玩家意识”.
- Add campaign title, premise, warning, and confirmation copy to `copy.ts`/`copy.yaml`. `OpeningText.vue` continues to preview the authored opening prose. The exact visible user line remains the responsibility of the campaign-aware `buildOpeningMarker(stat)` in `脚本/开场白挂载.template.js`, so the persistent mounter—not the iframe—still inserts the user floor.
- Extend opening tests to cover every row of the commit matrix, one visible user message, one `/trigger`, message-0/chat/user-floor snapshot equality, and rejection of forged `campaign_id`, `campaign_revision`, or disallowed `current_pov` combinations.

The three DLC starts also commit exact physical coordinates so the first EJS reply has no location ambiguity:

| Selection | `world.time_slot` | `world.current_location` | initial observable pressure |
|---|---|---|---|
| 《错位的日常》 | `早晨` | `比企谷家·八幡房间` | Komachi's hand is already on the outside door handle |
| 《君的名字？》八幡意识 | `早晨` | `雪之下家本邸·夫人卧室` | Haruno is downstairs and expects her mother to appear as usual |
| 《君的名字？》夫人意识 | `早晨` | `比企谷家·八幡房间` | Komachi is outside the door, addressing the body as her brother |

Add these globals to `世界书/EJS预处理/EJS预处理.txt`:

```ejs
define('campaign_id', getvar('stat_data.campaign_id', { defaults: 'main' }));
define('campaign_revision', getvar('stat_data.campaign_revision', { defaults: 1 }));
define('campaign_completed', getvar('stat_data.campaign_completed', { defaults: false }));
define('identity_state', getvar('stat_data.identity_state', { defaults: null }));
```

Update the EJS routers in this order:

- `玩家身份路由.txt`: branch on `campaign_id` before the generic `mode` branch. Treat immutable `current_pov` as the stable player mind; derive body and public identity from `identity_state`. Extend `current_pov` to allow `mrs_yukinoshita`, but only the body-swap manifest may select it. Emit the absolute-priority `<player_viewpoint>` block before any scene context and call `mode=pov` “主线剧本模式” in model-facing copy. Also repair the existing generic `mode=free` branch so a built-in player character or custom protagonist always receives an explicit identity/viewpoint block.
- `开局场景路由.txt`: add the two authored first-turn anchors from sections 6 and 7. The first assistant reply establishes one observable situation and stops before the player's first decision.
- `角色阶段事实.txt`: for either DLC, inject the generated `main:118` snapshot instead of treating `current_scene=1` as pre-mainline continuity.
- `玩家视点滤镜.txt`: main scripted play keeps scene phases; DLC play receives a campaign-specific observation filter without a scene number or act label. Both branches read only immutable `current_pov`; event focus is never an input.
- `开放世界在场注入.txt`: run for `mode=free` in every campaign. In the body-swap campaign, remove both swapped bodies from default schedule inference and use `identity_state` for their locations; all uninvolved characters still follow date/time schedules.
- `扮演准则.yaml`: replace the current blanket free-mode claim that 150-scene facts never happened with campaign-aware wording. `campaign_id=main && mode=free` retains the current unanchored sandbox; DLC free worlds inherit only the `main:118` snapshot.

Register the two authored premise entries with entry-level EJS guards, not keywords and not frontend-controlled worldbook enable flags:

```ejs
@@if getvar('stat_data.campaign_id', { defaults: 'main' }) === 'dlc_genderbend_hachiman'
```

```ejs
@@if getvar('stat_data.campaign_id', { defaults: 'main' }) === 'dlc_body_swap_mrs_yukinoshita'
```

The generated `main:118` snapshot entry uses one combined guard for either DLC. Its payload separates shared world facts from player-mind baselines: `player_snapshots.hachiman` is used by both DLCs, while `player_snapshots.mrs_yukinoshita` supplies the body-swap route's knowledge and relationship baseline. Mrs. Yukinoshita's snapshot is explicitly authored from evidence available by scene 118; it is not copied from Hachiman's relationship values. Mainline scene entries remain individually guarded by `campaign_id=main && mode=pov && current_scene=N`; therefore committing DLC `current_scene=1` cannot activate main scene 1.

Extend `buildOpeningMarker(stat)` in `脚本/开场白挂载.template.js` to emit the exact campaign-aware visible lines above while retaining the generic main/custom fallbacks. Extend the same script's opening identity guard from `mode/current_pov/custom_protagonist/difficulty` to also protect `campaign_id/campaign_revision`. `current_pov` is the sole immutable player-mind authority. `identity_state` remains mutable because body presentation and occupants can change during play; it must not duplicate a writable `player_mind` field.

## 3. Generated scene index and calendar replacement

Create `build_tools/build_scene_index.mjs` and generate `generated/scene-index.json` for scripted campaigns only. Open-world campaigns are validated through the same registry but contribute no numbered scene records. Each scripted record contains:

```json
{
  "id": "main:126",
  "campaign_id": "main",
  "number": 126,
  "date": "2014-10-16",
  "act": 8,
  "title": "...",
  "event_focus": {
    "type": "character",
    "characters": ["比企谷八幡"]
  },
  "player_route_keys": ["hachiman", "yukino", "yui", "laff"],
  "source": "世界书/事件/场景一百二十六.yaml",
  "previous_id": "main:125",
  "next_id": "main:127",
  "gap_days": 48,
  "transition_id": "main:125>126",
  "cg_ids": ["main:126:default"]
}
```

The generator must:

- Require `total_scenes` and `scene_dir` only for `campaign_type=scripted`; require `timeline_anchor`, `start_date`, `forced_mode=free`, `opening_route`, and `premise_entry` for `campaign_type=open_world`.
- Parse dates, titles, acts, `事件焦点`, `玩家入口` keys, and optional transition blocks directly from scene YAML.
- Migrate all 150 `主场POV` fields to structured `事件焦点`. Migrate the 149 exact `POV适配` blocks plus scene 110's `POV适配（共享场景——所有人散落在不同岗位）` variant to the uniform key `玩家入口`. Explicitly map the `共享场景／零POV` variants to `类型: 群像` instead of preserving “zero POV” wording.
- Generate a campaign-aware scene-render lookup that selects exactly one player route by immutable `current_pov`. Test representative mismatches: scene 44 with Hachiman as player, scene 49 with Yukino as player, and scene 48 as a group-focus scene.
- Validate unique IDs, contiguous local scene numbers, valid ISO dates, manifest totals, paths, CG references, and non-regressing dates unless a scene explicitly declares a flashback.
- Fail when a removed/renumbered scene lacks a save-migration alias.
- Generate compact TypeScript data for frontends and a compact EJS lookup for model routing from the same JSON.
- Generate `generated/campaign-snapshots/main-118.json` from explicitly mapped completed facts and milestone evidence through scene 118. Store shared world facts once and separate `player_snapshots.hachiman` / `player_snapshots.mrs_yukinoshita` knowledge and relationship baselines. DLC initialization consumes one selected baseline without enabling or replaying any mainline event entry.
- Run in `--check` mode in every package build and reject stale generated output.

Calendar deletion/change workflow becomes: edit the scene YAML date or transition block → run generator → review diff → run validators. There is no second calendar entry to remember.

## 4. Long-span transition system

After all 150 scenes received canonical `索引日期`, the mainline has 37 adjacent gaps of at least seven days; the earlier count of 25 came from regex-parsing only explicit date prose and missed approximate/continuation labels. The largest include 125→126 (48 days), 130→131 (32 days), and 129→130 (28 days). v0.6.0 handles them in two layers.

### Author-facing transition block

The destination scene may define:

```yaml
转场:
  mode: authored          # none | date_only | authored
  visible_title: 十月，生日之前
  visible_lines:
    - 夏季制服换回了长袖。
    - 那封没有回复的消息仍停在共同生日之前。
  established_changes:
    - 爱布拉娜近两个月没有主动联系拉芙
  unresolved:
    - 不得替爱布拉娜解释沉默原因
  max_model_sentences: 4
```

Rules:

- 0–6 days: no dedicated card by default.
- 7–20 days: compact date/season card; authored text optional.
- 21+ days: authored transition is mandatory; the validator fails on `date_only`.
- Transition text may establish elapsed time, visible seasonal change, repeated routine, and already-known relationship state. It must not invent off-screen reconciliation, relationship milestones, disclosures, or player actions.

### Model-facing layer

A generated EJS entry injects the transition contract only on the first generation after a scene change. It gives the old/new dates, elapsed days, established changes, unresolved facts, and sentence ceiling. It explicitly tells the model to enter the new scene rather than replay the skipped period.

### Player-visible layer

The statusbar mounter compares adjacent AI-floor snapshots and inserts a small transition card before the destination scene content. It uses only generated static text and dates; it does not make a second LLM call. Deleting or swiping a floor naturally removes/recomputes the card from snapshots.

Acceptance checks:

- Every ≥7-day gap produces exactly one visible card on first crossing.
- Regeneration/swipes do not duplicate it.
- Jumping several scenes displays only the destination transition plus an honest skipped-range count.
- Rewind removes later cards; no global storage is required.

## 5. CG manifest and gallery v2

Replace the loose map with a validated manifest:

```json
{
  "schema_version": 2,
  "release": "v0.6.0",
  "asset_commit": "<fixed commit>",
  "items": [{
    "id": "main:150:default",
    "campaign_id": "main",
    "scene": 150,
    "variant": "default",
    "file": "场景150.webp",
    "title": "公共路线终点",
    "alt": "毕业后的四人再次约定星期三见面",
    "date": "2015-03-24",
    "tags": ["主线", "终幕"],
    "unlock": {"type": "scene_completed", "scene": 150},
    "spoiler_level": 3
  }]
}
```

Mandatory behavior:

- No title truncation in the build tool. Titles come from an explicit `CG标题` override or the full scene title.
- All built-in items require nonempty `title`, `alt`, campaign, stable ID, fixed-commit file URL, and valid unlock rule.
- Mainline unlock migration derives completed scenes as `current_scene - 1`, plus scene 150 when completion is true.
- The runtime reveal and opening gallery use the same predicate evaluator.
- Scripted-campaign CGs may use scene completion predicates. Open-world DLC CGs use stable discovery predicates such as `opening_seen`, `fact_observed`, or explicit player-owned unlock IDs; they never invent a fake scene number.
- Locked thumbnails show campaign, approximate chapter, and spoiler-safe placeholder; no full title/date for high-spoiler items.
- `collection.cg_unlocks` records discoveries for portable saves. IndexedDB may cache the union across saves but is never the sole authority; export/import includes it.
- Existing user-added gallery images and deletion tombstones are migrated unchanged.
- Gallery filters: campaign, act/chapter, character/tag, unlocked-only; keyboard navigation and reduced-motion are required.

## 6. DLC 1 — 性转比企谷八幡《错位的日常》

### Narrative contract

This campaign is an open-ended youth-comedy world, not a twenty-scene quest and not a sequence of spectacle reactions. Hachiman retains memory, voice, legal identity, relationships, and responsibility while his presentation changes. Ordinary school, family, shopping, calls, invitations, and summer plans keep moving before he has decided what the change means.

The main AI must not generate a compulsory “solve the transformation” request. Investigation enters the foreground only when the player pursues it. Body logistics recur only when the current action makes them relevant; they are not a permanent camera subject or an every-turn reminder.

### Authored opening

Date and time: `2014-07-12`, Saturday morning. Location: Hachiman's bedroom.

The first assistant reply establishes only these observable facts:

- Hachiman wakes to the phone alarm and discovers changed fingers, voice, hair, clothing fit, and the mirror image.
- The bedroom, phone history, memories, legal name, and previous day's events remain unchanged.
- Komachi calls from outside the door, notices the silence, and puts her hand on the handle.
- End on the handle beginning to move after Komachi asks whether her brother is alive.

Do not make Hachiman answer, block the door, disclose the change, inspect further, call anyone, accept an identity label, or decide whether to attend school. Those are the player's first choices.

### Persistent premise state

```yaml
identity_state:
  kind: transformation
  current_body: hachiman
  presentation: female
  legal_identity: 比企谷八幡
  self_naming: 八幡
  cause_status: unknown
  disclosure: {}
```

Relationships remain keyed to Hachiman as a person; no second Hachiman record is created. `disclosure` records observer-specific knowledge only after actual observation, evidence, or explicit disclosure.

### Free-world pressure sources

The premise entry offers reusable sources, not ordered events:

- body and daily-life friction: clothing fit, voice verification, stamina, medical uncertainty, school records, uniform and facility choices;
- familiar reactions: Komachi's over-helping, Yukino's procedural help, Yui acting before asking, Laff reducing excuses to concrete cost and disclosure questions, Totsuka recognizing Hachiman through behavior, Zaimokuza failing to recognize him;
- social rereading: identical silence, sarcasm, solitude, and proximity receiving different interpretations;
- youth-comedy opportunities: shopping, school return, lunch groups, hair, photographs, summer invitations, ordinary messages, and MAX coffee remaining reassuringly unchanged;
- relationship development through actual shared time, forms of address, invitations, accepted or rejected help, and chosen distance.

The AI selects pressure from current date, location, present characters, and player choices. It must not force a representative issue, a public scandal, a cure hunt, a fixed school-return date, or a predetermined ending.

### Required evaluations

- Opening agency test: the first reply stops before Hachiman's first decision.
- Voice test: narration remains recognizably Hachiman without making body commentary the permanent joke.
- Recurrence test: practical details appear when causally relevant and do not become an every-turn tag.
- Continuity test: the `main:118` snapshot is present while no mainline scene entry activates.
- Knowledge test: every observer's reaction is limited to what that observer has actually perceived.

## 7. DLC 2 — 雪之下夫人与八幡互换身体《君的名字？》

### Narrative contract

This campaign is an open-ended identity-confusion comedy built from irregular sleep-bound body swaps, missing days, phone notes, schedule damage, and other people's suspicions. It is not a one-time swap followed by a fixed investigation or authority crisis.

The player controls one stable mind for the entire chat. Choosing Hachiman means the player always controls Hachiman's consciousness, whichever body contains it; choosing Mrs. Yukinoshita works symmetrically. The other consciousness is always AI-controlled and never receives an on-screen private monologue. When the player returns to their own body, off-screen actions are learned only from notes, devices, other characters, and observable consequences.

Swaps occur only after sleep. They may recur irregularly or pause for several days, but never happen mid-conversation merely to manufacture a cliffhanger. The model may establish a pattern from played evidence; it may not retroactively change the rules to force a climax.

### Authored opening

Date and time: `2014-07-12`, Saturday morning.

Hachiman-mind opening:

- Location is a bedroom in the Yukinoshita residence.
- Hachiman wakes in Mrs. Yukinoshita's body beside an unfamiliar phone and a precise daily schedule.
- The mirror confirms the apparent identity.
- Staff knock and announce departure at 07:40 and Haruno waiting downstairs.
- The phone rings with caller display `比企谷宅`.
- End before the player answers, hides, goes downstairs, inspects the phone, imitates Mrs. Yukinoshita, or discloses the swap.

Mrs.-Yukinoshita-mind opening mirrors the same instant from Hachiman's bedroom:

- Komachi is outside the room and interprets the unusually orderly response or silence through her brother's body.
- Hachiman's phone contains the ordinary messages and obligations of his life but no explanation.
- End before the player speaks to Komachi, accesses private messages, changes Hachiman's schedule, or contacts the Yukinoshita residence.

The two openings share world facts but never expose the unselected mind's private actions.

### Persistent premise state

```yaml
identity_state:
  kind: body_swap
  occupants:
    body_hachiman: mrs_yukinoshita
    body_mrs_yukinoshita: hachiman
  swap_phase: swapped
  last_swap_date: 2014-07-12
  disclosure: {}
  verification_evidence: []
  shared_notes: []
```

`current_pov` is the immutable player mind. `player_body` and `apparent_identity` are derived at render time from `current_pov + occupants` and are not stored as competing mutable fields. `occupants`, `swap_phase`, and `last_swap_date` may change only when a sleep transition is actually narrated. `shared_notes` contains only notes actually written or discovered in play, not summaries invented off screen.

### Free-world comedy engine

The premise entry offers reusable collisions:

- Hachiman's ambiguous replies become institutional instructions when spoken through Mrs. Yukinoshita's identity.
- Mrs. Yukinoshita's precision makes Hachiman appear ill, angry, reformed, or replaced at home and school.
- Haruno tests deviations in her mother's habits; Komachi tests ordinary sibling knowledge; Yukino compares language, distance, drink choice, and treatment of herself.
- Notes begin as prohibitions, become damage reports and schedule guidance, and may gradually become questions or personal reminders.
- A body grants access and public authority but not the owner's expertise, memory, consent, relationships, or private knowledge.
- Several observers may suspect or verify the truth in different orders. No observer knows because appearance alone “proves” it.

The AI must not automatically create an official investigation, fixed disclosure order, scheduled cure, compulsory public crisis, or required reconciliation. If the player pursues any of those, the world responds from accumulated facts.

### Required evaluations

- Stable-mind test: `current_pov` (the sole player-mind field) never changes when bodies swap.
- Sleep-bound transition test: occupant changes cannot occur without a narrated sleep/wake boundary.
- Identity matrix test after every swap: player mind, player body, apparent identity, other occupant location, and observer knowledge remain consistent.
- Relationship ownership test: bond, romance, commitment, and intimate memory attach to the participating mind/person, never the body shell.
- Authority test: Mrs. Yukinoshita's body grants perceived authority, not legal or institutional knowledge.
- Viewpoint test: the unselected mind's private thoughts and off-screen acts remain unknown until evidence reaches the player.

## 8. Opening, statusbar, and phone changes

New-game flow becomes gate → title → campaign selection → campaign-specific player selection → difficulty → opening. The title also offers the independent branch title → `迁移旧档` → compatibility preview → atomic resume commit. The main card shows 150 scenes and exposes its existing play-style choices. DLC cards are labeled `开放世界`, show the scene-118 timeline anchor, premise, content notes, allowed stable minds, and save isolation; they force `mode=free` and do not show scripted/free or custom-character choices. DLC selection and save migration both start from a fresh chat and never mutate worldbook global enabled state.

Statusbar:

- Scripted campaigns show campaign title and `scene / registry total`; open-world campaigns show campaign title, current date/time, and no fake denominator.
- Shows completion/ending state without assuming scene 150 or requiring an open-world campaign to end.
- Shows a compact identity badge only when a campaign defines `identity_state`; it must distinguish self, body, and public perception.

Phone:

- Reads scene index dates/titles rather than a separate calendar list.
- Map/contacts use body presence for the body-swap DLC but messages retain actual sender mind plus perceived sender metadata.
- Body-swap notes are ordinary in-world phone notes/messages with visibility metadata; they are not omniscient summaries of the other occupant's day.
- Phone settings expose two clearly separated exports: the existing phone-only backup and the new full `.counterfeit-save.json` portable save containing campaign, complete validated `stat_data`, collection, sanitized resume tail, and provenance.
- Hard-coded `/150` and mainline-only scene labels are forbidden by a static verifier.

## 9. Implementation sequence

### Phase A — Foundation and migration

- [x] Add tests for campaign registry, old-save migration, dynamic totals, and mainline compatibility.
- [x] Add campaign fields to planning, schema.ts mirrors, Zod, initvar, update rules, EJS, opening commit, identity guard, statusbar, and phone.
- [x] Build the shared portable-save types, streaming SillyTavern JSONL parser, version migration registry, compatibility preview, and no-write failure tests before enabling the title-screen button.
- [x] Generate the scripted scene index plus the explicit `main:118` DLC snapshot and move all date/title consumers to their correct authority.
- [x] Migrate 150 scene files from `主场POV`/`POV适配` to `事件焦点`/`玩家入口`, rename the player-viewpoint filter, and add a static ban on ambiguous POV labels.
- [x] Convert 150 mainline gates to include `campaign_id=main`; verify exact guard count and old-save defaults.

### Phase B — Transition and gallery

- [x] Author transition blocks for all 37 mainline gaps ≥7 days; require authored blocks for gaps ≥21 days.
- [x] Build model-facing transition injection and snapshot-derived visible cards from the generated index.
- [x] Migrate CG map to manifest v2, repair titles/alt text, add collection state and unlock migration.
- [ ] Replace mutable asset references with one v0.6.0 fixed commit and validate every file before packing.

### Phase C — DLC opening vertical slices

- [x] Build campaign-aware player identity, opening, timeline-snapshot, player-viewpoint filter, and open-world-presence routers plus the identity-state test harness.
- [x] Author and validate the single first-turn opening for genderbend Hachiman and both stable-mind variants of the body-swap opening.
- [ ] Browser-play each opening through at least three unrestricted replies, one time-slot advance, and one relationship update without adding any numbered DLC event entry.
- [ ] Run voice, opening agency, identity matrix, relationship ownership, sleep-transition, and knowledge-leak reviews; freeze the premise contracts only after these slices pass.

### Phase D — Open-world premise production

- [x] Complete `世界书/DLC/性转八幡/演绎规则.yaml`: recurring pressure sources, disclosure evidence, recurrence limits, cause/investigation opt-in, and player-agency rules.
- [x] Expand `世界书/NPC/雪之下夫人.yaml` enough to support her as the stable player viewpoint, then complete `世界书/DLC/身体互换/演绎规则.yaml`: sleep-bound swap contract, note visibility, observer evidence, schedule collision, and authority limits.
- [x] Register the two premise entries and the generated scene-118 snapshot with stable UIDs and exact `campaign_id` guards; validate that no DLC numbered event directory or fake scene total is introduced.
- [ ] Add an optional DLC CG set based on stable discoveries: campaign opening and premise-specific observed moments. Deferred by user to a later update because the two open-world DLCs have no fixed plot scenes; this is explicitly non-blocking for v0.6.0 and no placeholder CG is shipped.

### Phase E — Packaging and release gate

- [x] Import the accepted v0.6.0 art batch: mainline scenes 1/33/36/80/83 (42 total manifest items) plus the genderbend-Hachiman and Mrs. Yukinoshita portraits; fixed asset commit `9e5de97a57a0b92e1679b0f4da907768f0d44df3` is used by the packaged gallery and portrait UI.

- [x] Production-build opening, statusbar, and phone independently; re-embed/synchronize and verify byte identity.
- [x] Run source validators, campaign migration tests, EJS guards, MVU validation, identity tests, transition tests, gallery tests, phone pack verification, and syntax checks.
- [x] Pack v0.6.0 without overwriting v0.5.1; unpack into a fresh directory and compare 235 entries, 150 mainline scene entries, open-world premise entries, scripts, and metadata. The initial candidate `Counterfeit-v0.6.0-20260814.png` is superseded: its embedded opening HTML still loaded Vue/Pinia from jsDelivr and could hit the 8-second watchdog when Tavern external-module access was unavailable.
- [x] Rebuild the opening as a self-contained single HTML (Vue/Pinia/Zod bundled; fonts, icons, CG, and portraits remain non-blocking visual resources), strengthen both embed-time and readback checks to reject remote executable scripts/imports, and verify the complete cover → intro skip → title-screen interaction in a local in-app browser with no console errors. `Counterfeit-v0.6.0-hotfix1-20260814.png` fixed this issue but is superseded by hotfix2 below. This does not close the real-SillyTavern browser gate until the replacement card is imported and exercised there.
- [x] Replace all 150 scene-player runtime `throw` guards with a graceful `unavailable` route: an absent/illegal `current_pov` no longer aborts EJS rendering, cannot borrow the event focus or another character route, and may only ask the player to reselect a viewpoint or load a valid save. Static generation still requires all four legal routes. Reproduced and fixed against scene149 with `current_pov=null`; scene-index, scene-field, EJS, v0.6 contract, opening, pack, and fresh readback tests pass. Hotfix candidate: `Counterfeit-v0.6.0-hotfix2-20260814.png`; SHA-256 `A1184922508D7B2CE6A027E346A364F046FDB67294942E0AB2ADF7C1AF88F891`; fresh unpack contains 235 entries and scene149 contains the graceful block with no legacy throw.
- [ ] Browser-test: fresh mainline; portable-save export/resume; raw JSONL recovery; cancelled, incompatible, and corrupt imports; migrated mid-mainline and completed mainline; genderbend Hachiman; both body-swap stable minds; repeated sleep/no-swap/swap transitions; rewind/swipe; gallery unlock; phone-only backup import; and cross-chat isolation.

## 10. Mandatory release gates

| Gate | Required evidence |
|---|---|
| Save compatibility | v0.4.6, v0.5.0-preview, v0.5.1, and v0.6.0 portable/raw-chat fixtures migrate idempotently; incompatible canon revisions make no writes; successful resume replays no old transcript or update block |
| Campaign isolation | Opening a DLC chat does not change any existing mainline chat or shared worldbook enabled flag |
| Scene authority | Generated scripted index is clean; no manual calendar entry or frontend-local scene list remains; open-world campaigns have no numbered scene files |
| Long-gap continuity | 37/37 mainline gaps validated; all five ≥21-day gaps authored |
| Identity correctness | Every body-swap transition and save fixture passes mind/body/perception/knowledge matrix; player mind remains immutable |
| Viewpoint isolation | `current_pov` is the sole narrative viewpoint; rendered scene context contains exactly one matching player route and event focus never changes identity, camera, person, or inner-monologue permission |
| Relationship correctness | No relationship attaches to a body shell; no automatic romance from either premise |
| CG correctness | All manifest items resolve at fixed commit, have alt/title, and obey unlock tests |
| Dynamic UI | Static scan finds zero player-facing hard-coded `/150` totals |
| Packaging | Source ↔ build ↔ embedded script ↔ PNG readback exact where applicable |
| Runtime | Real browser evidence for two simultaneous chats, both DLC openings, unrestricted continuation, sleep-bound swaps, rewind, portable-save export/resume, raw JSONL recovery, and phone-only backup import/export |

## 11. Experimental items that must not block foundation work

- Transition-card visual variants: test compact date plate versus illustrated seasonal plate after the data contract works.
- Cross-save gallery union: IndexedDB union is optional; portable per-save collection remains authoritative.
- Body-swap cadence: tune how often the AI may offer a sleep-bound swap after the invariant works; never use a hidden fixed scene schedule.
- Dual-column body-swap status UI: compare with one compact identity badge; ship the clearer mobile layout.
- Optional “previously on” recap after gaps above 30 days: only ship if it can quote authored facts and never summarize unseen player choices.

The non-negotiable order is foundation → campaign-aware EJS entry → authored opening slices → persistent premise rules → CG expansion. Gallery polish and elaborate transition visuals may iterate later, but save migration, campaign isolation, opening agency, stable player mind, and identity correctness may not.
