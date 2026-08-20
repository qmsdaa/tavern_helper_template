import { File } from 'node:buffer';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Schema } from './.save-build/schema.ts';
import { migrateParsedSave } from './.save-build/存档/migrations.ts';
import { parseChatExport, MAX_SAVE_BYTES } from './.save-build/存档/parseChatExport.ts';
import { commitPortableResume } from './.save-build/存档/resumeCommit.ts';
import { MIGRATION_LEDGER } from './.save-build/存档/migrationLedger.ts';
import { ACU_SHEET_DATA_KEY, toShujukuSheetData, extractCheckpointSheetData, reconstructAcuSheetData, reconstructLegacyV1SheetData, countAcuSheets } from './.save-build/存档/acuTables.ts';
import type { MigrationResult, ParsedSaveSource } from './.save-build/存档/types.ts';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const parsedSource = (statData: Record<string, any>): ParsedSaveSource => ({
  source: 'sillytavern-jsonl', cardVersion: null, schemaVersion: null, statData, resumeTail: [], messageCount: 2,
  recoveredFloor: 1, warnings: [], sha256: '0'.repeat(64),
});

function legacyMain(): Record<string, any> {
  const stat = Schema.parse({ mode: 'pov', current_pov: 'hachiman', mainline_completed: false, campaign_completed: false });
  delete stat.campaign_id; delete stat.campaign_revision; delete stat.campaign_completed; delete stat.identity_state; delete stat.collection;
  return stat;
}

const genderbendIdentity = () => ({
  kind: 'transformation', current_body: 'hachiman_f', presentation: 'female',
  legal_identity: '比企谷八幡（性转）', self_naming: '八幡', cause_status: 'unknown', disclosure: {},
});

function genderbendDlc(pov: 'hachiman_f' | 'yukino' | 'yui' | 'laff' | null): Record<string, any> {
  return Schema.parse({
    mode: 'free', campaign_id: 'dlc_genderbend_hachiman', current_scene: 1,
    current_pov: pov, identity_state: pov === 'hachiman_f' ? genderbendIdentity() : null,
    custom_protagonist: pov === null ? { name: '自建主角' } : null,
    campaign_completed: false, mainline_completed: false,
  });
}

test('all five genderbend DLC viewpoints are legal and survive portable commit roundtrips', async () => {
  for (const pov of ['hachiman_f', 'yukino', 'yui', 'laff', null] as const) {
    const stat = genderbendDlc(pov);
    const migrated = migrateParsedSave(parsedSource(stat));
    assert.equal(migrated.report.status, 'exact');
    assert.deepEqual(migrated.statData, stat);

    const state: any = { message0: [{ message_id: 0, message: '<OpeningUI/>' }], floor0: {}, chat: {} };
    await commitPortableResume(migrated, {
      getMessage0: () => clone(state.message0), getFloor0Variables: () => clone(state.floor0), getChatVariables: () => clone(state.chat),
      async setMessage0(value) { state.message0 = clone(value); },
      async setFloor0Variables(updater) { state.floor0 = clone(updater(clone(state.floor0))); },
      async setChatVariables(updater) { state.chat = clone(updater(clone(state.chat))); },
    });
    assert.deepEqual(state.floor0.stat_data, stat);
    assert.deepEqual(state.chat.stat_data, stat);
    assert.equal(migrateParsedSave(parsedSource(state.chat.stat_data)).report.status, 'exact');
  }
});

test('legacy canonical genderbend identity migrates exactly once and mixed triples fail closed', () => {
  const legacy = genderbendDlc('hachiman_f');
  legacy.current_pov = 'hachiman';
  legacy.identity_state.current_body = 'hachiman';
  legacy.identity_state.legal_identity = '比企谷八幡';

  const migrated = migrateParsedSave(parsedSource(legacy));
  assert.equal(migrated.report.status, 'migratable');
  assert.equal(migrated.statData?.current_pov, 'hachiman_f');
  assert.equal(migrated.statData?.identity_state.current_body, 'hachiman_f');
  assert.equal(migrated.statData?.identity_state.legal_identity, '比企谷八幡（性转）');
  assert.ok(migrated.report.migrationSteps.some(step => step.includes('身份三元组迁移')));
  assert.equal(migrateParsedSave(parsedSource(migrated.statData!)).report.status, 'exact');

  const mixed = clone(legacy);
  mixed.identity_state.current_body = 'hachiman_f';
  const rejected = migrateParsedSave(parsedSource(mixed));
  assert.equal(rejected.report.status, 'incompatible');
  assert.equal(rejected.statData, null);
  assert.equal(rejected.report.migrationSteps.some(step => step.includes('身份三元组迁移')), false);
});

test('main hachiman_f and cross-viewpoint genderbend identity mixes are rejected', () => {
  const illegalMain = genderbendDlc('hachiman_f');
  illegalMain.campaign_id = 'main';
  illegalMain.mode = 'pov';
  illegalMain.identity_state = null;
  assert.equal(Schema.safeParse(illegalMain).success, false);
  const migratedMain = migrateParsedSave(parsedSource(illegalMain));
  assert.equal(migratedMain.report.status, 'incompatible');
  assert.ok(migratedMain.report.conflicts.some(item => item.includes('主线玩家视点非法')));

  const mixedDlc = genderbendDlc('hachiman_f');
  mixedDlc.current_pov = 'yukino';
  assert.equal(Schema.safeParse(mixedDlc).success, false);
  assert.equal(migrateParsedSave(parsedSource(mixedDlc)).report.status, 'incompatible');
});

test('v0.4.6, v0.5.0-preview, v0.5.1, and v0.6.0 migrations are idempotent', () => {
  const base = legacyMain();
  const fixtures = [
    ['0.4.6', (() => { const v = clone(base); delete v.difficulty; delete v.arc_milestones; delete v.phone; return v; })()],
    ['0.5.0-preview', (() => { const v = { ...clone(base), difficulty: '普通', arc_milestones: {} }; delete v.phone; return v; })()],
    ['0.5.1', { ...clone(base), phone: { version: 2 } }],
    ['0.6.0', Schema.parse({ mode: 'pov', current_pov: 'hachiman', mainline_completed: false, campaign_completed: false })],
  ] as const;
  for (const [version, fixture] of fixtures) {
    const first = migrateParsedSave(parsedSource(fixture));
    assert.equal(first.report.sourceVersion, version);
    assert.equal(first.statData?.campaign_id, 'main');
    const second = migrateParsedSave(parsedSource(first.statData!));
    assert.equal(second.report.status, 'exact');
    assert.deepEqual(second.statData, first.statData);
  }
});

test('unknown campaign is incompatible and produces no commit state', () => {
  const bad = { ...legacyMain(), campaign_id: 'unknown', campaign_revision: 1 };
  const migrated = migrateParsedSave(parsedSource(bad));
  assert.equal(migrated.report.status, 'incompatible');
  assert.equal(migrated.statData, null);
});

test('version and schema ledger fail closed for future or unknown inputs', () => {
  assert.ok(MIGRATION_LEDGER.every(entry => !entry.breakingCanon || entry.legacyEstablishedFacts.length > 0));
  const future = migrateParsedSave({ ...parsedSource(legacyMain()), cardVersion: '9.0.0' });
  assert.equal(future.report.status, 'incompatible');
  assert.ok(future.report.conflicts.some(item => item.includes('卡片版本')));
  const futureSchema = migrateParsedSave({ ...parsedSource(legacyMain()), cardVersion: '0.5.1', schemaVersion: 2 });
  assert.equal(futureSchema.report.status, 'incompatible');
  assert.ok(futureSchema.report.conflicts.some(item => item.includes('schema version')));
});

test('migration reports added/removed fields, preserves ledger facts, and rejects missing scene aliases', () => {
  const legacy = { ...legacyMain(), main_pov: '比企谷八幡' };
  const migrated = migrateParsedSave({
    ...parsedSource(legacy), cardVersion: '0.5.1', legacyEstablishedFacts: ['旧聊天已明确的事实'],
  });
  assert.ok(migrated.report.addedFields.includes('campaign_id'));
  assert.ok(migrated.report.discardedFields.includes('main_pov'));
  assert.deepEqual(migrated.legacyEstablishedFacts, ['旧聊天已明确的事实']);
  assert.equal('main_pov' in migrated.statData!, false);

  const renumbered = { ...legacyMain(), current_scene: 151 };
  const rejected = migrateParsedSave({ ...parsedSource(renumbered), cardVersion: '0.5.1' });
  assert.equal(rejected.report.status, 'incompatible');
  assert.ok(rejected.report.conflicts.some(item => item.includes('迁移别名')));
});

test('portable envelope identity cannot disagree with its immutable snapshot', () => {
  const result = migrateParsedSave({
    ...parsedSource(legacyMain()), cardVersion: '0.5.1', declaredCampaignId: 'dlc_genderbend_hachiman',
  });
  assert.equal(result.report.status, 'incompatible');
  assert.ok(result.report.conflicts.some(item => item.includes('外层 campaign_id')));
});

test('raw JSONL reads active swipe variables, sanitizes tail, and tolerates a truncated final line', async () => {
  const stat = legacyMain();
  const lines = [
    JSON.stringify({ user_name: 'user', chat_metadata: { card_version: '0.5.1' } }),
    JSON.stringify({ is_user: false, mes: `可见正文<OpeningUI/><UpdateVariable>[{"op":"replace"}]</UpdateVariable>`, swipe_id: 1, variables: [{}, { stat_data: stat }] }),
    '{"broken":',
  ].join('\n');
  const result = await parseChatExport(new File([lines], 'chat.jsonl'));
  assert.equal(result.recoveredFloor, 0);
  assert.equal(result.statData.current_pov, 'hachiman');
  assert.equal(result.resumeTail[0].text, '可见正文');
  assert.ok(result.warnings.some(w => w.includes('末行截断')));
});

test('raw JSONL supports object-shaped swipe_info variables and rejects groups', async () => {
  const stat = legacyMain();
  const good = [
    JSON.stringify({ name: 'chat' }),
    JSON.stringify({ role: 'assistant', text: '正文', swipe_index: 2, swipe_info: { '2': { variables: { stat_data: stat } } } }),
  ].join('\n');
  assert.equal((await parseChatExport(new File([good], 'chat.jsonl'))).statData.mode, 'pov');
  const group = `${JSON.stringify({ user_name: 'u', chat_metadata: { group_id: 'g' } })}\n${JSON.stringify({ variables: { stat_data: stat } })}`;
  await assert.rejects(() => parseChatExport(new File([group], 'group.jsonl')), /群聊/);
});

test('raw JSONL rejects a missing header and exports with no valid snapshot', async () => {
  await assert.rejects(() => parseChatExport(new File([JSON.stringify({ role: 'assistant', text: '没有头' })], 'header.jsonl')), /聊天头/);
  const empty = `${JSON.stringify({ user_name: 'u' })}\n${JSON.stringify({ is_user: false, mes: '没有快照' })}`;
  await assert.rejects(() => parseChatExport(new File([empty], 'empty.jsonl')), /没有找到/);
});

test('raw JSONL skips a newer identity-forged snapshot and falls back to the earlier legal floor', async () => {
  const legal = legacyMain();
  const forged = { ...clone(legal), current_pov: 'forged' };
  const raw = [
    JSON.stringify({ user_name: 'u' }),
    JSON.stringify({ is_user: false, mes: '较早合法', variables: { stat_data: legal } }),
    JSON.stringify({ is_user: false, mes: '最新伪造', variables: { stat_data: forged } }),
  ].join('\n');
  const parsed = await parseChatExport(new File([raw], 'fallback.jsonl'));
  assert.equal(parsed.recoveredFloor, 0);
  assert.equal(parsed.statData.current_pov, 'hachiman');
  assert.ok(parsed.warnings.some(warning => warning.includes('继续向前回退')));
});

test('raw JSONL uses header campaign identity while selecting the newest legal snapshot', async () => {
  const main = Schema.parse({ mode: 'pov', current_pov: 'hachiman', campaign_id: 'main', campaign_completed: false, mainline_completed: false });
  const dlc = Schema.parse({
    mode: 'free', current_pov: 'hachiman_f', campaign_id: 'dlc_genderbend_hachiman', current_scene: 1,
    identity_state: genderbendIdentity(),
  });
  const raw = [
    JSON.stringify({ user_name: 'u', chat_metadata: { card_version: '0.6.0', campaign_id: 'main', campaign_revision: 1 } }),
    JSON.stringify({ is_user: false, mes: '较早主线', variables: { stat_data: main } }),
    JSON.stringify({ is_user: false, mes: '伪造的DLC快照', variables: { stat_data: dlc } }),
  ].join('\n');
  const parsed = await parseChatExport(new File([raw], 'header-identity.jsonl'));
  assert.equal(parsed.recoveredFloor, 0);
  assert.equal(parsed.statData.campaign_id, 'main');
  assert.equal(migrateParsedSave(parsed).report.status, 'exact');
  assert.ok(parsed.warnings.some(warning => warning.includes('继续向前回退')));
});

test('parser rejects oversized files before reading and rejects oversized embedded data URIs', async () => {
  let touched = false;
  await assert.rejects(() => parseChatExport({ size: MAX_SAVE_BYTES + 1, arrayBuffer() { touched = true; throw new Error('read'); } } as File), /128 MiB/);
  assert.equal(touched, false);
  const stat = legacyMain();
  const huge = 'data:image/png;base64,' + 'A'.repeat(256 * 1024 + 1);
  const raw = `${JSON.stringify({ user_name: 'u' })}\n${JSON.stringify({ is_user: false, mes: huge, variables: { stat_data: stat } })}`;
  await assert.rejects(() => parseChatExport(new File([raw], 'media.jsonl')), /data URI/);
});

function commitFixture(): MigrationResult {
  const stat = Schema.parse({ mode: 'pov', current_pov: 'hachiman', mainline_completed: false, campaign_completed: false });
  return { report: { status: 'exact', sourceVersion: '0.6.0', schemaVersion: 1, campaignId: 'main', campaignRevision: 1, playerViewpoint: 'hachiman', scene: 1, date: stat.world.current_date, location: stat.world.current_location, recoveredFloor: 1, messageCount: 2, tableSheetCount: 0, migrationSteps: [], addedFields: [], discardedFields: [], conflicts: [], warnings: [] }, statData: stat, resumeTail: [{ role: 'assistant', text: '最后可见时刻' }], legacyEstablishedFacts: [], tableSheets: null, provenance: parsedSource(stat) };
}

test('successful resume writes equal snapshots and one sanitized capsule without replaying the transcript', async () => {
  const fixture = commitFixture();
  const state: any = { message0: [{ message_id: 0, message: '<OpeningUI/>' }], floor0: {}, chat: {} };
  await commitPortableResume(fixture, {
    getMessage0: () => clone(state.message0), getFloor0Variables: () => clone(state.floor0), getChatVariables: () => clone(state.chat),
    async setMessage0(value) { state.message0 = clone(value); },
    async setFloor0Variables(updater) { state.floor0 = clone(updater(clone(state.floor0))); },
    async setChatVariables(updater) { state.chat = clone(updater(clone(state.chat))); },
  });
  assert.deepEqual(state.floor0.stat_data, fixture.statData);
  assert.deepEqual(state.chat.stat_data, fixture.statData);
  assert.equal((state.message0[0].message.match(/<counterfeit_resume_capsule/g) ?? []).length, 1);
  assert.doesNotMatch(state.message0[0].message, /<OpeningUI\/>/);
  assert.doesNotMatch(state.message0[0].message, /UpdateVariable|JSONPatch/);
});

test('resume commit rolls back message0, floor0, and chat on partial failure', async () => {
  const state: any = { message0: [{ message_id: 0, message: 'old' }], floor0: { stat_data: { old: 1 } }, chat: { stat_data: { old: 2 } } };
  const before = clone(state); let failOnce = true;
  await assert.rejects(() => commitPortableResume(commitFixture(), {
    getMessage0: () => clone(state.message0), getFloor0Variables: () => clone(state.floor0), getChatVariables: () => clone(state.chat),
    async setMessage0(value) { if (failOnce) { failOnce = false; throw new Error('injected'); } state.message0 = clone(value); },
    async setFloor0Variables(updater) { state.floor0 = clone(updater(clone(state.floor0))); },
    async setChatVariables(updater) { state.chat = clone(updater(clone(state.chat))); },
  }), /已回滚/);
  assert.deepEqual(state, before);
});

test('incompatible result performs zero mutator calls', async () => {
  const result = commitFixture(); result.statData = null; result.report.status = 'incompatible'; let calls = 0;
  await assert.rejects(() => commitPortableResume(result, {
    getMessage0: () => (++calls, []), getFloor0Variables: () => (++calls, {}), getChatVariables: () => (++calls, {}),
    async setMessage0() { calls++; }, async setFloor0Variables() { calls++; }, async setChatVariables() { calls++; },
  }), /不能提交/);
  assert.equal(calls, 0);
});

/* ── shujuku(ACU) 数据库表格迁移 ── */

const acuMetaFixture = () => ({
  TavernDB_ACU_InternalSheetGuide: { version: 3, tags: { '': { data: {
    sheet_memo: { uid: 'u1', name: '备忘', content: [['row_id', '备忘标题'], ['1', '旧档记忆']] },
    sheet_summary: { uid: 'u2', name: '纪要', content: [['row_id', '纪要'], ['1', '某次委托']] },
  } } } },
  TavernDB_ACU_InternalSheetGuide__chatId: 'old-chat-id',
  TavernDB_ACU_ScopedConfig: { version: 1, template: { name: 'Counterfeit适配表格' }, templateArchives: [] },
  TavernDB_ACU_ScopedConfig__chatId: 'old-chat-id',
  unrelated_key: { untouched: true },
});

test('jsonl header ACU metadata is extracted without chatId bindings', async () => {
  const stat = Schema.parse({ mode: 'pov', current_pov: 'hachiman', mainline_completed: false, campaign_completed: false });
  const raw = `${JSON.stringify({ user_name: 'u', chat_metadata: acuMetaFixture() })}\n${JSON.stringify({ is_user: false, mes: '楼层', variables: { stat_data: stat } })}`;
  const parsed = await parseChatExport(new File([raw], 'legacy.jsonl'));
  assert.equal(parsed.tableSheets?.TavernDB_ACU_InternalSheetGuide != null, true);
  assert.equal(parsed.tableSheets?.TavernDB_ACU_ScopedConfig != null, true);
  assert.equal('TavernDB_ACU_InternalSheetGuide__chatId' in (parsed.tableSheets ?? {}), false);
  assert.equal('unrelated_key' in (parsed.tableSheets ?? {}), false);
  const result = migrateParsedSave(parsed);
  assert.equal(result.report.tableSheetCount, 2);
  assert.ok(result.report.migrationSteps.some(step => step.includes('数据库表格 2 张')));
  assert.equal(result.tableSheets != null, true);
});

test('resume commit migrates ACU tables with new chatId binding, and rolls metadata back on failure', async () => {
  const fixture = commitFixture();
  fixture.tableSheets = { TavernDB_ACU_InternalSheetGuide: acuMetaFixture().TavernDB_ACU_InternalSheetGuide, TavernDB_ACU_ScopedConfig: acuMetaFixture().TavernDB_ACU_ScopedConfig };
  const metadata: any = { TavernDB_ACU_InternalSheetGuide: { version: 0, tags: { '': { data: {} } } }, keep_me: 1 };
  const metadataBefore = clone(metadata);
  let saves = 0;
  const state: any = { message0: [{ message_id: 0, message: '<OpeningUI/>' }], floor0: {}, chat: {} };
  const deps = {
    getMessage0: () => clone(state.message0), getFloor0Variables: () => clone(state.floor0), getChatVariables: () => clone(state.chat),
    async setMessage0(value: any) { state.message0 = clone(value); },
    async setFloor0Variables(updater: any) { state.floor0 = clone(updater(clone(state.floor0))); },
    async setChatVariables(updater: any) { state.chat = clone(updater(clone(state.chat))); },
    getChatMetadata: () => metadata, saveMetadata: async () => { saves++; }, getCurrentChatId: () => 'new-chat-id',
  };
  await commitPortableResume(fixture, deps);
  assert.equal(metadata.TavernDB_ACU_InternalSheetGuide.tags[''].data.sheet_memo.uid, 'u1');
  assert.equal(metadata.TavernDB_ACU_InternalSheetGuide__chatId, 'new-chat-id');
  assert.equal(metadata.TavernDB_ACU_ScopedConfig__chatId, 'new-chat-id');
  assert.equal(metadata.keep_me, 1);
  assert.equal(saves, 1);

  // 失败路径：saveMetadata 抛错 → metadata 恢复原样（含旧值恢复与新增键删除）
  const metadata2: any = { TavernDB_ACU_InternalSheetGuide: { version: 0, tags: {} }, keep_me: 2 };
  const before2 = clone(metadata2);
  await assert.rejects(() => commitPortableResume(fixture, {
    ...deps,
    getMessage0: () => clone(state.message0), getFloor0Variables: () => clone(state.floor0), getChatVariables: () => clone(state.chat),
    getChatMetadata: () => metadata2, saveMetadata: async () => { throw new Error('disk full'); },
  }), /已回滚/);
  assert.deepEqual(metadata2, before2);
});

test('resume commit without metadata deps skips table migration but still writes stat_data', async () => {
  const fixture = commitFixture();
  fixture.tableSheets = { TavernDB_ACU_InternalSheetGuide: acuMetaFixture().TavernDB_ACU_InternalSheetGuide };
  const state: any = { message0: [], floor0: {}, chat: {} };
  await commitPortableResume(fixture, {
    getMessage0: () => clone(state.message0), getFloor0Variables: () => clone(state.floor0), getChatVariables: () => clone(state.chat),
    async setMessage0(value: any) { state.message0 = clone(value); },
    async setFloor0Variables(updater: any) { state.floor0 = clone(updater(clone(state.floor0))); },
    async setChatVariables(updater: any) { state.chat = clone(updater(clone(state.chat))); },
  });
  assert.deepEqual(state.chat.stat_data, fixture.statData);
});

/* ── sqlite/消息持久化 checkpoint 快照提取 ── */

const checkpointFixture = () => ({
  TavernDB_ACU_IsolatedData: {
    '': {
      storageFrame: {
        version: 2,
        logEntries: [],
        checkpoint: {
          kind: 'checkpoint',
          createdAt: '2026-06-26T13:00:00.000Z',
          reason: 'migration-fixture',
          data: {
            mate: { type: 'acu', version: 1 },
            sheet_summary: { uid: 'u1', name: '纪要表', content: [['row_id', '编码索引', '纪要'], ['1', 'AM0001', '转学生拉芙希妮入班成为雪乃同桌']] },
            sheet_memo: { uid: 'u2', name: '备忘录', content: [['row_id', '备忘标题'], ['1', '旧档记忆']] },
          },
        },
        headRevision: 0,
      },
      _acu_storage_version: 2,
    },
  },
});

test('jsonl messages with IsolatedData checkpoint are extracted as plugin sheet data', async () => {
  const stat = Schema.parse({ mode: 'pov', current_pov: 'hachiman', mainline_completed: false, campaign_completed: false });
  const raw = [
    JSON.stringify({ user_name: 'u', chat_metadata: { card_version: '0.6.0' } }),
    JSON.stringify({ is_user: false, mes: '楼层1', variables: { stat_data: stat }, ...checkpointFixture() }),
  ].join('\n');
  const parsed = await parseChatExport(new File([raw], 'ckpt.jsonl'));
  assert.equal(parsed.tableSheets?.[ACU_SHEET_DATA_KEY] != null, true);
  const snapshot = parsed.tableSheets![ACU_SHEET_DATA_KEY] as Record<string, unknown>;
  assert.equal((snapshot.sheet_summary as any).content[1][2], '转学生拉芙希妮入班成为雪乃同桌');
  const result = migrateParsedSave(parsed);
  assert.equal(result.report.tableSheetCount, 2);
});

test('checkpoint snapshot is preferred over guide for counting and conversion', async () => {
  const tables = {
    TavernDB_ACU_InternalSheetGuide: acuMetaFixture().TavernDB_ACU_InternalSheetGuide,
    [ACU_SHEET_DATA_KEY]: (checkpointFixture().TavernDB_ACU_IsolatedData[''] as any).storageFrame.checkpoint.data,
  };
  assert.equal(countAcuSheets(tables), 2, 'checkpoint 优先计数');
  const sheetData = toShujukuSheetData(tables)!;
  assert.equal(sheetData.mate != null, true);
  assert.equal((sheetData.sheet_summary as any).content[1][2], '转学生拉芙希妮入班成为雪乃同桌');
  assert.equal(Object.keys(sheetData).filter(k => k.startsWith('sheet_')).length, 2);
});

test('guide-only tables convert to plugin sheet format as fallback', () => {
  const sheetData = toShujukuSheetData({ TavernDB_ACU_InternalSheetGuide: acuMetaFixture().TavernDB_ACU_InternalSheetGuide });
  assert.equal(sheetData != null, true);
  assert.equal((sheetData!.mate as any).type, 'chatSheets');
  const keys = Object.keys(sheetData!).filter(k => k.startsWith('sheet_'));
  assert.deepEqual(keys.sort(), ['sheet_memo', 'sheet_summary']);
  assert.equal((sheetData!.sheet_memo as any).content[1][1], '旧档记忆');
  assert.equal(toShujukuSheetData(null), null);
  assert.equal(toShujukuSheetData({}), null);
});

test('extractCheckpointSheetData scans newest-first and ignores empty frames', () => {
  const records: any[] = [
    { user_name: 'u' },
    { is_user: false, mes: '空帧', TavernDB_ACU_IsolatedData: { '': { storageFrame: { checkpoint: { data: {} } } } } },
    { is_user: false, mes: '最新有数据', ...checkpointFixture() },
  ];
  const data = extractCheckpointSheetData(records)!;
  assert.equal((data.sheet_summary as any).name, '纪要表');
  assert.equal(extractCheckpointSheetData([{ user_name: 'u' }]), null);
});

/* ── V2 checkpoint + sql_batch 日志重放（消息持久化模式） ── */

const replayDdl = `CREATE TABLE chronicle ( -- 纪要表
  row_id INTEGER PRIMARY KEY, -- 行号
  code_index TEXT UNIQUE, -- 编码索引
  time_span TEXT, -- 时间跨度
  summary TEXT -- 纪要
);`;
const replayDdlIfNotExists = replayDdl.replace('CREATE TABLE chronicle', 'CREATE TABLE IF NOT EXISTS chronicle');

const replaySheetData = () => ({
  mate: { type: 'chatSheets', version: 1 },
  sheet_summary: {
    uid: 'u1', name: '纪要表',
    sourceData: { note: '', ddl: replayDdl },
    content: [['row_id', '编码索引', '时间跨度', '纪要'], [1, 'AM0001', '05-20 上午', '初始纪要']],
  },
});

const replayFloor = (mes: string, frame: object, isUser = false) => ({
  is_user: isUser, mes, TavernDB_ACU_IsolatedData: { '': { storageFrame: { version: 2, headRevision: 0, ...frame } } },
});
const logEntry = (seq: number, statements: string[]) => ({ seq, operations: [{ kind: 'sql_batch', statements }] });

test('reconstruct: checkpoint + 日志重放得到最新状态（UPDATE 三种 WHERE / INSERT 两种 row_id 子查询 / OR REPLACE 多行）', () => {
  const records: any[] = [
    { user_name: 'u' },
    replayFloor('楼层0 checkpoint', {
      checkpoint: { kind: 'full', data: replaySheetData() },
      logEntries: [logEntry(1, ["UPDATE chronicle SET time_span = '05-20 上午(改)' WHERE row_id = 1"])], // checkpoint 楼层自身日志也要重放（>= 边界）
    }),
    replayFloor('用户楼层', { logEntries: [logEntry(1, ["UPDATE chronicle SET summary = '不应生效' WHERE row_id = 1"])] }, true),
    replayFloor('楼层2', {
      logEntries: [
        logEntry(1, [
          "UPDATE chronicle SET time_span = '05-20 中午', summary = '含,逗号与(括号)的“纪要”' WHERE code_index = 'AM0001'",
          "INSERT INTO chronicle (row_id, code_index, time_span, summary) VALUES ((SELECT MAX(row_id)+1 FROM chronicle), 'AM0002', '05-20 下午', '第二条')",
        ]),
        logEntry(2, [
          "INSERT INTO chronicle (row_id, code_index, time_span, summary) VALUES ((SELECT COALESCE(MAX(row_id), 0) + 1 FROM chronicle), 'AM0003', '05-21 上午', '第三条')",
        ]),
      ],
    }),
    replayFloor('楼层3', {
      logEntries: [logEntry(1, [
        "UPDATE chronicle SET summary = '批量改写A' WHERE code_index IN ('AM0002', 'AM0003')",
        "INSERT OR REPLACE INTO chronicle (row_id, code_index, time_span, summary) VALUES\n(2, 'AM0002', '05-20 下午', '替换后的第二条'),\n(9, 'AM0009', '05-22', '显式行号插入')",
      ])],
    }),
  ];
  const result = reconstructAcuSheetData(records)!;
  assert.equal(result.checkpointFloor, 1);
  assert.equal(result.replayedLogs, 4, 'checkpoint 楼层 1 条 + 楼层2 两条 + 楼层3 一条（用户楼层跳过）');
  const rows = (result.data.sheet_summary as any).content.slice(1);
  assert.deepEqual(rows.map((r: any[]) => [r[0], r[1]]), [[1, 'AM0001'], [2, 'AM0002'], [3, 'AM0003'], [9, 'AM0009']]);
  assert.equal(rows[0][2], '05-20 中午', 'UPDATE col= 命中（覆盖 checkpoint 楼层日志的改动）');
  assert.equal(rows[0][3], '含,逗号与(括号)的“纪要”', '字符串内逗号/括号不被切分');
  assert.equal(rows[1][3], '替换后的第二条', 'INSERT OR REPLACE 按 row_id 覆盖');
  assert.equal(rows[2][3], '批量改写A', 'WHERE IN 批量命中');
  assert.equal(rows[2][0], 3, 'COALESCE 子查询给出递增 row_id');
  assert.deepEqual(result.warnings, [], '全语法形状内不应有告警');
});

test('reconstruct: 未命中 UPDATE 与超边界语句只告警不中断', () => {
  const records: any[] = [
    { user_name: 'u' },
    replayFloor('楼层0', {
      checkpoint: { kind: 'full', data: replaySheetData() },
      logEntries: [logEntry(1, [
        "UPDATE chronicle SET summary = 'x' WHERE code_index = '不存在'",
        "DELETE FROM chronicle WHERE row_id = 1",
        "INSERT INTO chronicle (row_id, code_index) VALUES ((SELECT MAX(row_id)+1 FROM chronicle), 'AM0002')",
      ])],
    }),
  ];
  const result = reconstructAcuSheetData(records)!;
  const rows = (result.data.sheet_summary as any).content.slice(1);
  assert.equal(rows.length, 2, '合法 INSERT 仍然生效');
  assert.equal(rows[0][3], '初始纪要', '未命中 UPDATE 不改数据');
  assert.ok(result.warnings.some(w => w.includes('未命中任何行')));
  assert.ok(result.warnings.some(w => w.includes('语句类型不支持')));
});

test('reconstruct: 无 full checkpoint 时退用数据快照并告警；完全没有返回 null；兼容 IF NOT EXISTS 与缺 mate', () => {
  const withFull = reconstructAcuSheetData([{ user_name: 'u' }, replayFloor('c', { checkpoint: { kind: 'full', data: replaySheetData() } })])!;
  assert.equal(withFull.replayedLogs, 0);
  assert.deepEqual(withFull.warnings, []);

  const looseData = replaySheetData();
  delete (looseData as any).mate;
  (looseData.sheet_summary.sourceData as any).ddl = replayDdlIfNotExists;
  const noKind = reconstructAcuSheetData([{ user_name: 'u' }, replayFloor('c', { checkpoint: { kind: 'checkpoint', data: looseData } })])!;
  assert.ok(noKind.warnings.some(w => w.includes('kind=full')), '非 full checkpoint 要告警');
  assert.equal((noKind.data.mate as any).type, 'chatSheets', '缺 mate 时补齐');
  assert.equal((noKind.data.sheet_summary as any).content[1][1], 'AM0001', 'IF NOT EXISTS 的 DDL 也能建列映射');

  assert.equal(reconstructAcuSheetData([{ user_name: 'u' }, { is_user: false, mes: '无帧' }]), null);
});

test('parseChatExport: 迁移读取到的是重放后的最新表格，并带重放说明', async () => {
  const stat = Schema.parse({ mode: 'pov', current_pov: 'hachiman', mainline_completed: false, campaign_completed: false });
  const raw = [
    JSON.stringify({ user_name: 'u', chat_metadata: { card_version: '0.6.0' } }),
    JSON.stringify({ is_user: false, mes: '楼层0', variables: { stat_data: stat }, ...replayFloor('c', { checkpoint: { kind: 'full', data: replaySheetData() } }) }),
    JSON.stringify({ is_user: false, mes: '楼层1', ...replayFloor('l', { logEntries: [logEntry(1, ["INSERT INTO chronicle (row_id, code_index) VALUES ((SELECT MAX(row_id)+1 FROM chronicle), 'AM0002')"])] }) }),
  ].join('\n');
  const parsed = await parseChatExport(new File([raw], 'replay.jsonl'));
  const snapshot = parsed.tableSheets![ACU_SHEET_DATA_KEY] as Record<string, any>;
  assert.equal(snapshot.sheet_summary.content.length - 1, 2, '导入预览拿到的是重放后的 2 行而非 checkpoint 的 1 行');
  assert.ok(parsed.warnings.some(w => w.includes('重放')), 'warnings 里要有重放说明');
});

test('resume commit calls plugin import channel with sheet data and tolerates failure', async () => {
  const fixture = commitFixture();
  fixture.tableSheets = {
    TavernDB_ACU_InternalSheetGuide: acuMetaFixture().TavernDB_ACU_InternalSheetGuide,
    TavernDB_ACU_ScopedConfig: acuMetaFixture().TavernDB_ACU_ScopedConfig,
    [ACU_SHEET_DATA_KEY]: (checkpointFixture().TavernDB_ACU_IsolatedData[''] as any).storageFrame.checkpoint.data,
  };
  const metadata: any = { keep_me: 1 };
  const state: any = { message0: [{ message_id: 0, message: '<OpeningUI/>' }], floor0: {}, chat: {} };
  let importedPayload: unknown = null;
  await commitPortableResume(fixture, {
    getMessage0: () => clone(state.message0), getFloor0Variables: () => clone(state.floor0), getChatVariables: () => clone(state.chat),
    async setMessage0(value: any) { state.message0 = clone(value); },
    async setFloor0Variables(updater: any) { state.floor0 = clone(updater(clone(state.floor0))); },
    async setChatVariables(updater: any) { state.chat = clone(updater(clone(state.chat))); },
    getChatMetadata: () => metadata, saveMetadata: async () => {}, getCurrentChatId: () => 'new-chat-id',
    async importTables(sheetData) { importedPayload = sheetData; return true; },
  });
  assert.equal(importedPayload != null, true);
  const payload = importedPayload as Record<string, unknown>;
  assert.equal(payload.mate != null, true);
  assert.equal(Object.keys(payload).some(k => k.startsWith('sheet_')), true);
  assert.equal(metadata.TavernDB_ACU_InternalSheetGuide__chatId, 'new-chat-id', 'chat_metadata 双写兜底仍在');

  // 插件导入返回 false / 抛错 → 不阻断迁移
  const state2: any = { message0: [], floor0: {}, chat: {} };
  await commitPortableResume(fixture, {
    getMessage0: () => clone(state2.message0), getFloor0Variables: () => clone(state2.floor0), getChatVariables: () => clone(state2.chat),
    async setMessage0(value: any) { state2.message0 = clone(value); },
    async setFloor0Variables(updater: any) { state2.floor0 = clone(updater(clone(state2.floor0))); },
    async setChatVariables(updater: any) { state2.chat = clone(updater(clone(state2.chat))); },
    getChatMetadata: () => metadata, saveMetadata: async () => {}, getCurrentChatId: () => 'new-chat-id',
    importTables: async () => false,
  });
  assert.deepEqual(state2.chat.stat_data, fixture.statData);
  await commitPortableResume(fixture, {
    getMessage0: () => clone(state2.message0), getFloor0Variables: () => clone(state2.floor0), getChatVariables: () => clone(state2.chat),
    async setMessage0(value: any) { state2.message0 = clone(value); },
    async setFloor0Variables(updater: any) { state2.floor0 = clone(updater(clone(state2.floor0))); },
    async setChatVariables(updater: any) { state2.chat = clone(updater(clone(state2.chat))); },
    getChatMetadata: () => metadata, saveMetadata: async () => {}, getCurrentChatId: () => 'new-chat-id',
    importTables: async () => { throw new Error('plugin offline'); },
  });
  assert.deepEqual(state2.chat.stat_data, fixture.statData);
});

test('resume commit tolerates getChatMetadata returning undefined (no TypeError, tables skipped, stat_data still written)', async () => {
  const fixture = commitFixture();
  fixture.tableSheets = { TavernDB_ACU_InternalSheetGuide: acuMetaFixture().TavernDB_ACU_InternalSheetGuide };
  const state: any = { message0: [{ message_id: 0, message: '<OpeningUI/>' }], floor0: {}, chat: {} };
  let saves = 0;
  await commitPortableResume(fixture, {
    getMessage0: () => clone(state.message0), getFloor0Variables: () => clone(state.floor0), getChatVariables: () => clone(state.chat),
    async setMessage0(value: any) { state.message0 = clone(value); },
    async setFloor0Variables(updater: any) { state.floor0 = clone(updater(clone(state.floor0))); },
    async setChatVariables(updater: any) { state.chat = clone(updater(clone(state.chat))); },
    getChatMetadata: () => undefined, saveMetadata: async () => { saves++; },
  });
  assert.equal(saves, 0);
  assert.deepEqual(state.floor0.stat_data, fixture.statData);
  assert.deepEqual(state.chat.stat_data, fixture.statData);
  assert.equal((state.message0[0].message.match(/<counterfeit_resume_capsule/g) ?? []).length, 1);
});

test('resume commit fails cleanly and rolls back when metadata disappears between snapshot and write', async () => {
  const fixture = commitFixture();
  fixture.tableSheets = { TavernDB_ACU_InternalSheetGuide: acuMetaFixture().TavernDB_ACU_InternalSheetGuide };
  const metadata: any = { keep_me: 1 };
  const state: any = { message0: [{ message_id: 0, message: 'old' }], floor0: { stat_data: { old: 1 } }, chat: { stat_data: { old: 2 } } };
  const before = clone(state);
  let readCount = 0;
  await assert.rejects(() => commitPortableResume(fixture, {
    getMessage0: () => clone(state.message0), getFloor0Variables: () => clone(state.floor0), getChatVariables: () => clone(state.chat),
    async setMessage0(value: any) { state.message0 = clone(value); },
    async setFloor0Variables(updater: any) { state.floor0 = clone(updater(clone(state.floor0))); },
    async setChatVariables(updater: any) { state.chat = clone(updater(clone(state.chat))); },
    // 快照阶段元数据可用，stat 写入完成后（第 2 次读取起）消失 → 表格写入前应明确失败并整体回滚
    getChatMetadata: () => (++readCount === 1 ? metadata : null),
    saveMetadata: async () => { throw new Error('should not be called'); },
    getCurrentChatId: () => 'new-chat-id',
  }), /聊天元数据不可用/);
  assert.equal(readCount >= 2, true);
  assert.deepEqual(state, before);
});

/* ─── legacy-v1 旧存储形态重建（顶层旧字段 + 隔离槽旧形态 + delta） ─── */

const legacyMemo = (rows: unknown[][]) => ({ name: '备忘录', content: [['row_id', '备忘标题'], ...rows] });
const legacySummary = (rows: unknown[][]) => ({ name: '纪要表', content: [['row_id', '纪要'], ...rows] });

test('reconstructLegacyV1SheetData 合并顶层旧字段：最新楼层胜出、多字段收集、身份标签与用户楼层跳过', () => {
  const records: any[] = [
    { user_name: 'u' },
    { is_user: false, mes: 'a', TavernDB_ACU_IndependentData: { sheet_memo: legacyMemo([['1', '旧版记忆']]) } },
    { is_user: false, mes: 'b', TavernDB_ACU_IndependentData: { sheet_memo: legacyMemo([['1', '更新的记忆'], ['2', '第二条']]) }, TavernDB_ACU_Data: { sheet_summary: legacySummary([['1', '某次委托']]) } },
    { is_user: false, mes: 'c', TavernDB_ACU_Identity: 'other-code', TavernDB_ACU_IndependentData: { sheet_isolated: legacyMemo([['1', '隔离数据']]) } },
    { is_user: true, mes: 'user', TavernDB_ACU_IndependentData: { sheet_user: legacyMemo([['1', '用户楼层']]) } },
  ];
  const result = reconstructLegacyV1SheetData(records)!;
  assert.equal(result.data != null, true);
  const data = result.data as Record<string, any>;
  assert.equal(result.mergedSheets, 2);
  assert.equal(data.mate.type, 'chatSheets');
  assert.equal(data.sheet_memo.content.length, 3, '最新楼层 wins（2 行数据）');
  assert.equal(data.sheet_memo.content[1][1], '更新的记忆');
  assert.equal(data.sheet_summary.content[1][1], '某次委托', 'TavernDB_ACU_Data 字段同样收集');
  assert.equal(data.sheet_isolated, undefined, '带身份标签的消息不收集');
  assert.equal(data.sheet_user, undefined, '用户楼层不收集');
  assert.equal(reconstructLegacyV1SheetData([{ user_name: 'u' }]).data, null);
});

test('reconstructLegacyV1SheetData 隔离槽旧形态：checkpoint 首写胜出 + delta 楼层按时序补合并', () => {
  const records: any[] = [
    { user_name: 'u' },
    { is_user: false, mes: 'base', TavernDB_ACU_IsolatedData: { '': { _acu_storage_mode: 'checkpoint', independentData: { sheet_summary: legacySummary([['1', '初始纪要']]) }, modifiedKeys: ['sheet_summary'] } } },
    { is_user: false, mes: 'd1', TavernDB_ACU_IsolatedData: { '': { _acu_storage_mode: 'delta', incrementalData: { sheet_summary: { metaChanged: { name: '纪要表（改）' }, rowDeltas: [{ op: 'upsert', row_id: '2', cells: ['2', '新增纪要'] }] } } } } },
    { is_user: false, mes: 'd2', TavernDB_ACU_IsolatedData: { '': { _acu_storage_mode: 'delta', incrementalData: { sheet_summary: { rowDeltas: [{ op: 'upsert', row_id: '1', cells: ['1', '被更新的纪要'] }, { op: 'delete', row_id: '2' }] } } } } },
  ];
  const result = reconstructLegacyV1SheetData(records)!;
  assert.equal(result.mergedSheets, 1);
  assert.equal(result.appliedDeltas, 2);
  const summary = (result.data as Record<string, any>).sheet_summary;
  assert.equal(summary.name, '纪要表（改）', 'delta metaChanged 生效');
  assert.deepEqual(
    summary.content.slice(1).map((r: any[]) => [r[0], r[1]]),
    [['1', '被更新的纪要']],
    'd2 upsert 覆盖 + delete 删除后只剩 1 行',
  );
});

test('parseChatExport 导入旧版顶层字段存档时得到重建后的表格，且 chat[0] 顶层 Guide 也能兜底提取', async () => {
  const stat = Schema.parse({ mode: 'pov', current_pov: 'hachiman', mainline_completed: false, campaign_completed: false });
  const guideOnFirstMessage = {
    TavernDB_ACU_InternalSheetGuide: { version: 3, tags: { '': { data: { sheet_memo: { uid: 'u9', name: '备忘录', content: [['row_id', '备忘标题']] } } } } },
    TavernDB_ACU_ScopedConfig: { version: 1, template: { name: 'Counterfeit适配表格' }, templateArchives: [] },
  };
  const raw = [
    JSON.stringify({ user_name: 'u', chat_metadata: { card_version: '0.5.1' }, ...guideOnFirstMessage }),
    JSON.stringify({ is_user: false, mes: 'a', variables: { stat_data: stat }, TavernDB_ACU_IndependentData: { sheet_memo: legacyMemo([['1', '旧版记忆']]), sheet_summary: legacySummary([['1', '某次委托']]) } }),
  ].join('\n');
  const parsed = await parseChatExport(new File([raw], 'legacy-v1.jsonl'));
  const snapshot = parsed.tableSheets![ACU_SHEET_DATA_KEY] as Record<string, any>;
  assert.equal(snapshot != null, true, '旧版字段表格被重建进 ACU_SHEET_DATA_KEY');
  assert.equal(snapshot.sheet_memo.content[1][1], '旧版记忆');
  assert.equal(parsed.tableSheets?.TavernDB_ACU_InternalSheetGuide != null, true, 'chat[0] 顶层 Guide 兜底提取');
  assert.equal(parsed.tableSheets?.TavernDB_ACU_ScopedConfig != null, true);
  assert.ok(parsed.warnings.some(w => w.includes('legacy-v1')), 'warnings 说明合并来源');
  const result = migrateParsedSave(parsed);
  assert.equal(result.report.tableSheetCount, 2);
});

/* ─── V2 重放：旧版 patch 日志 + 新版非 SQL 操作类型 ─── */

const patchCkptData = () => ({
  mate: { type: 'chatSheets', version: 1 },
  sheet_summary: { uid: 'u1', name: '纪要表', content: [['row_id', '纪要'], ['1', '初始纪要'], ['2', '第二条']] },
});
const patchFloor = (mes: string, frame: object, isUser = false) => ({
  is_user: isUser, mes, TavernDB_ACU_IsolatedData: { '': { storageFrame: { version: 2, headRevision: 0, ...frame } } },
});

test('reconstruct 支持旧版 patch 日志与新操作类型（row_upsert/row_delete/meta_update/sheet_replace/data_replace）', () => {
  const records: any[] = [
    { user_name: 'u' },
    patchFloor('楼层0', {
      checkpoint: { kind: 'full', data: patchCkptData() },
      logEntries: [{ seq: 1, patches: [{ sheetKey: 'sheet_summary', kind: 'row_upsert', rowId: '1', cells: ['1', '被 patch 覆盖'] }] }],
    }),
    patchFloor('楼层1', {
      logEntries: [
        { seq: 1, operations: [{ kind: 'row_upsert', sheetKey: 'sheet_summary', rowId: '9', cells: ['9', 'upsert 新增'] }] },
        { seq: 2, operations: [{ kind: 'meta_update', sheetKey: 'sheet_summary', meta: { name: '纪要表（改名）' } }] },
        { seq: 3, operations: [{ kind: 'row_delete', sheetKey: 'sheet_summary', rowId: '2' }] },
      ],
    }),
    patchFloor('楼层2', {
      logEntries: [{ seq: 1, operations: [{ kind: 'sheet_replace', sheetKey: 'sheet_summary', sheet: { name: '重置表', content: [['row_id', '纪要'], ['7', '重置后的纪要']] } }] }],
    }),
    patchFloor('楼层3', {
      logEntries: [{
        seq: 1,
        operations: [{
          kind: 'data_replace',
          data: { mate: { type: 'chatSheets', version: 1 }, sheet_summary: { name: '终局表', content: [['row_id', '纪要'], ['5', '终局纪要']] }, sheet_memo: { name: '备忘', content: [['row_id', '标题'], ['1', '某备忘']] } },
        }],
      }],
    }),
  ];
  const result = reconstructAcuSheetData(records)!;
  const summary = (result.data.sheet_summary as any);
  assert.equal(summary.name, '终局表', 'data_replace 接管后的最终状态');
  assert.deepEqual(summary.content.slice(1), [['5', '终局纪要']], '此前 patch/操作全部被 data_replace 覆盖');
  assert.equal((result.data.sheet_memo as any).content[1][1], '某备忘', 'data_replace 可新增整表');
  assert.deepEqual(result.warnings, [], '全部操作类型在语法边界内，不应有警告');
});

test('reconstruct 对未知 sheet 的 patch 只告警不中断', () => {
  const records: any[] = [
    { user_name: 'u' },
    patchFloor('楼层0', {
      checkpoint: { kind: 'full', data: patchCkptData() },
      logEntries: [{ seq: 1, patches: [{ sheetKey: 'sheet_unknown', kind: 'row_upsert', rowId: '1', cells: ['1', 'x'] }] }],
    }),
  ];
  const result = reconstructAcuSheetData(records)!;
  assert.equal((result.data.sheet_summary as any).content[1][1], '初始纪要', '合法数据不受影响');
  assert.ok(result.warnings.some(w => w.includes('sheet_unknown')));
});
