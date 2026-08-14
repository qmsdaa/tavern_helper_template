import { File } from 'node:buffer';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Schema } from './.save-build/schema.ts';
import { migrateParsedSave } from './.save-build/存档/migrations.ts';
import { parseChatExport, MAX_SAVE_BYTES } from './.save-build/存档/parseChatExport.ts';
import { commitPortableResume } from './.save-build/存档/resumeCommit.ts';
import { MIGRATION_LEDGER } from './.save-build/存档/migrationLedger.ts';
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
    mode: 'free', current_pov: 'hachiman', campaign_id: 'dlc_genderbend_hachiman', current_scene: 1,
    identity_state: { kind: 'transformation', current_body: 'hachiman', presentation: 'female', legal_identity: '比企谷八幡', self_naming: '八幡', cause_status: 'unknown', disclosure: {} },
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
  return { report: { status: 'exact', sourceVersion: '0.6.0', schemaVersion: 1, campaignId: 'main', campaignRevision: 1, playerViewpoint: 'hachiman', scene: 1, date: stat.world.current_date, location: stat.world.current_location, recoveredFloor: 1, messageCount: 2, migrationSteps: [], addedFields: [], discardedFields: [], conflicts: [], warnings: [] }, statData: stat, resumeTail: [{ role: 'assistant', text: '最后可见时刻' }], legacyEstablishedFacts: [], provenance: parsedSource(stat) };
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
