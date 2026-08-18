import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const cardRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const projectRoot = path.resolve(cardRoot, '..', '..');
const frontendRoot = path.join(projectRoot, 'tavern_helper_template');
const read = file => fs.readFileSync(file, 'utf8');
const card = relative => read(path.join(cardRoot, relative));
const frontend = relative => read(path.join(frontendRoot, relative));

const state = JSON.parse(card('tavern-cards-state.json'));
const entries = Object.entries(state.entryManifest).flatMap(([part, group]) =>
  Object.entries(group).map(([key, value]) => ({ part, key, ...value })),
);
assert.equal(entries.length, 246, 'v0.6 source manifest entry count drifted');
assert.equal(new Set(entries.map(entry => entry.uid)).size, entries.length, 'manifest UIDs must be unique');

const scenes = entries.filter(entry => /^场景/.test(entry.key));
assert.equal(scenes.length, 150, 'main campaign must register exactly 150 numbered scenes');
for (const entry of scenes) {
  const condition = entry.contents?.find(item => typeof item.content === 'string')?.content ?? '';
  assert.match(condition, /campaign_id.*=== 'main'/, `${entry.key} lacks fail-closed main campaign gate`);
}

for (const key of ['DLC_main118_共同快照', 'DLC_main118_八幡意识快照', 'DLC_main118_夫人意识快照']) {
  assert.ok(entries.some(entry => entry.key === key), `${key} is not registered`);
}
assert.ok(entries.some(entry => entry.key === '存档续接路由'), 'save resume route is not registered');
assert.ok(!entries.some(entry => entry.contents?.some(item => item.file === '世界书/剧情/main-118-snapshot.yaml')), 'combined private snapshot must never be injected');

for (const relative of ['schema.ts', path.join('脚本', 'Zod.txt')]) {
  const source = card(relative);
  for (const token of ['campaign_id', 'campaign_revision', 'campaign_completed', 'identity_state', 'collection', 'mrs_yukinoshita']) {
    assert.match(source, new RegExp(token), `${relative} lacks ${token}`);
  }
  assert.equal((source.match(/\.superRefine\(/g) ?? []).length, 1, `${relative} must have one root cross-field refinement`);
}
const frontendSchema = frontend(path.join('src', 'Counterfeit', 'schema.ts'));
assert.equal((frontendSchema.match(/\.superRefine\(/g) ?? []).length, 1, 'frontend schema must mirror root refinement');

const sceneTs = card(path.join('generated', 'scene-index.ts'));
assert.equal(sceneTs, frontend(path.join('src', 'Counterfeit', 'generated', 'scene-index.ts')), 'frontend scene index is stale');
assert.match(sceneTs, /"gap_days":48/, 'canonical gap data missing');
assert.equal((sceneTs.match(/"transition_id":"main:/g) ?? []).length, 37, 'all 37 long-gap transitions must be generated');

const playerFacing = [
  path.join('src', 'Counterfeit', '界面', '状态栏', 'App.vue'),
  path.join('src', 'Counterfeit', '界面', '状态栏', 'components', 'StatusHeader.vue'),
  path.join('src', 'Counterfeit', '界面', '手机', 'ScenesApp.vue'),
];
for (const relative of playerFacing) {
  const source = frontend(relative);
  assert.doesNotMatch(source, /\/\s*150\b/, `${relative} contains a player-facing hard-coded /150 total`);
  assert.doesNotMatch(source, /Math\.max\([^\n]*150/, `${relative} contains a hidden 150 fallback`);
}

for (const relative of [
  path.join('src', 'Counterfeit', '存档', 'parseChatExport.ts'),
  path.join('src', 'Counterfeit', '存档', 'migrations.ts'),
  path.join('src', 'Counterfeit', '存档', 'migrationLedger.ts'),
  path.join('src', 'Counterfeit', '存档', 'resumeCommit.ts'),
  path.join('src', 'Counterfeit', '界面', '开场白', 'SaveImportScreen.vue'),
]) assert.ok(fs.existsSync(path.join(frontendRoot, relative)), `${relative} missing`);
const migrationLedger = frontend(path.join('src', 'Counterfeit', '存档', 'migrationLedger.ts'));
for (const version of ['0.4.6', '0.5.0-preview', '0.5.1', '0.6.0']) {
  assert.match(migrationLedger, new RegExp(version.replaceAll('.', '\\.')), `migration ledger lacks ${version}`);
}
const migrations = frontend(path.join('src', 'Counterfeit', '存档', 'migrations.ts'));
for (const token of ['schemaVersion', 'migrationPath', 'addedFields', 'discardedFields', 'legacyEstablishedFacts', 'sceneAliases']) {
  assert.match(migrations, new RegExp(token), `save migration lacks ${token}`);
}

for (const relative of [
  path.join('build_tools', 'build_transition_runtime.mjs'),
  path.join('build_tools', 'transition_runtime_predicate.mjs'),
  path.join('build_tools', 'test_transition_runtime.mjs'),
]) assert.ok(fs.existsSync(path.join(cardRoot, relative)), `${relative} missing`);
assert.match(card(path.join('脚本', '状态栏挂载.template.js')), /counterfeit-transition-card/, 'statusbar transition runtime missing');
assert.match(card(path.join('脚本', '状态栏挂载.js')), /counterfeit-transition-card/, 'release embedded statusbar lacks transition runtime');

const manifest = JSON.parse(card(path.join('generated', 'cg-manifest.json')));
assert.equal(manifest.schema_version, 2);
assert.equal(manifest.items.length, 42);
assert.equal(new Set(manifest.items.map(item => item.id)).size, 42);
assert.ok(manifest.items.every(item => item.title && item.alt && item.campaign_id && item.unlock), 'CG manifest metadata incomplete');
assert.match(manifest.asset_commit, /^[a-f0-9]{40}$/, 'release CG assets must use a fixed commit');
for (const scene of [1, 33, 36, 80, 83]) {
  assert.ok(manifest.items.some(item => item.id === `main:${scene}:default`), `v0.6 art batch missing scene ${scene}`);
}
assert.match(frontend(path.join('src', 'Counterfeit', '界面', '开场白', 'store.ts')), /opening_seen/, 'DLC opening unlock producer missing');

assert.match(card(path.join('docs', 'superpowers', 'plans', '2026-08-13-counterfeit-v060-roadmap.md')), /37\/37 mainline gaps validated/);
console.log('v0.6.0 source contracts: PASS (246 entries, 150 campaign gates, 37 transitions, 42 CG items)');
