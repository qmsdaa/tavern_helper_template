# Phone MVU v0.5.1 Integration Implementation Plan

> **Execution:** Inline in the current session. Do not use `using-superpowers` or `brainstorming`; preserve all unrelated frontend work.

**Goal:** Make the Counterfeit phone read the final dynamic-character MVU structure and place outfit display exclusively in the phone Status app.

**Architecture:** Keep `vars.ts` as the phone's read-only chat-scope MVU adapter. Normalize `world`, `player`, and dynamic `characters` into a stable snapshot consumed by existing phone apps; keep `phone.contacts`, threads, and messages independent. Replace the old affection UI with present-and-known character cards, and remove outfit rendering from Friends.

**Tech Stack:** Vue 3, Pinia, TypeScript, SCSS, SillyTavern Tavern Helper APIs, webpack.

---

### Task 1: Replace the old MVU snapshot

**Files:**
- Modify: `tavern_helper_template/src/Counterfeit/界面/手机/vars.ts`

- [ ] Remove `AFFECTION_LABELS`, `snapshot.affection`, root `current_date`, and `affectionTier`.
- [ ] Add normalized types for `relationship`, `latest_user_memory`, and six-field `outfit`.
- [ ] Read `world.current_date`, `world.current_location`, `player.cash`, `player.carried_items`, and `characters`.
- [ ] Preserve chat-scope reads because the phone is a persistent current-state tool.
- [ ] Add `relationshipTier()` and `formatCash()` helpers without exposing exact romance values.

### Task 2: Rebuild the Status app around the final MVU

**Files:**
- Modify: `tavern_helper_template/src/Counterfeit/界面/手机/StatusApp.vue`

- [ ] Display act, scene, date, protagonist, and current location.
- [ ] Display player cash and carried items.
- [ ] Select only `present=true && known=true` character records.
- [ ] For each selected character, display relationship tier, latest memory, unspoken thought, and all six outfit fields.
- [ ] Render `未确认` for missing outfit evidence and never infer underwear.
- [ ] Remove all affection bars and numeric romance presentation.

### Task 3: Restore the Friends app boundary

**Files:**
- Modify: `tavern_helper_template/src/Counterfeit/界面/手机/FriendsApp.vue`

- [ ] Remove the outfit card, outfit computed value, and outfit-only styles.
- [ ] Preserve contacts, chat launch, soft removal, restoration, and blocking.
- [ ] Do not derive contacts from `characters.*.known`.

### Task 4: Update the phone documentation

**Files:**
- Modify: `手机助手.md`

- [ ] Replace the v0.4.2/`affection_*` mapping with MVU v0.5.1 paths.
- [ ] Document that Status owns outfit display and Friends owns contact/chat management.
- [ ] Remove obsolete “chat once +1 affection” and affection-gated proactive-message claims.
- [ ] State that phone activity never mechanically changes `bond`, `romance`, or `commitment`.

### Task 5: Verify and build only the phone entry

**Files:**
- Temporarily create and then remove: `tavern_helper_template/webpack.phone.config.ts`
- Generated: `tavern_helper_template/dist/Counterfeit/界面/手机/index.html`

- [ ] Run Prettier only on modified phone files.
- [ ] Run TypeScript diagnostics and distinguish existing repository errors from new phone errors.
- [ ] Search the phone source for `affection_*` and root `sd.current_date`; expect no matches.
- [ ] Build only `src/Counterfeit/界面/手机/index.ts` so opening/status frontend artifacts are not overwritten.
- [ ] Verify the generated phone HTML exists and contains no old affection field names.
- [ ] Do not pack the character card, generate the importable phone JSON, or push Git.
