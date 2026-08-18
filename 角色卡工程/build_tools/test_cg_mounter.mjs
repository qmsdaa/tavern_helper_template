import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { buildCgArtifacts } from './build_cg_manifest.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const filename = path.join(root, '脚本', 'CG挂载.js');
const originalSource = fs.readFileSync(filename, 'utf8');
let source = originalSource.replace(
  "  const CONTAINER_PREFIX = 'counterfeit-cg--';",
  "  globalThis.__counterfeitCgV2 = { CG_MANIFEST, campaignIdOf, completedScene, hasCollectionUnlock, evaluateCgUnlockPredicate, isCgUnlocked, pickCgReveal };\n\n  const CONTAINER_PREFIX = 'counterfeit-cg--';",
);
assert.notEqual(source, originalSource, '未找到 CG v2 测试注入点');

const document = {
  createElement: () => ({ textContent: '', append() {}, setAttribute() {} }),
  head: { appendChild() {} },
  body: {},
  querySelector: () => null,
};
const sandbox = {
  console: { info() {}, warn() {}, error() {} },
  window: { top: { document } },
  document,
  MutationObserver: class { observe() {} },
  setTimeout() {},
  getChatMessages() { return []; },
  CSS: { escape: value => String(value) },
};
sandbox.globalThis = sandbox;
vm.runInNewContext(source, sandbox, { filename });

const runtime = sandbox.__counterfeitCgV2;
assert.ok(runtime);
const { CG_MANIFEST, evaluateCgUnlockPredicate, isCgUnlocked, pickCgReveal } = runtime;
assert.equal(CG_MANIFEST.schema_version, 2);
assert.equal(CG_MANIFEST.items.length, 42);
assert.match(CG_MANIFEST.asset_commit, /^[a-f0-9]{40}$/, 'release manifest must use a fixed asset commit');
assert.match(CG_MANIFEST.images_base, new RegExp(`@${CG_MANIFEST.asset_commit}/`), 'release images must resolve at asset_commit');

const sceneIndex = JSON.parse(fs.readFileSync(path.join(root, 'generated', 'scene-index.json'), 'utf8'));
const titles = new Map(sceneIndex.scenes.map(scene => [scene.id, scene.title]));
assert.equal(sceneIndex.scenes.filter(scene => scene.cg_ids.length > 0).length, 42, 'scene index must reference all manifest CG ids');
for (const item of CG_MANIFEST.items) {
  assert.match(item.id, /^main:\d+:default$/);
  assert.equal(item.campaign_id, 'main');
  assert.equal(item.title, titles.get(`main:${item.scene}`), `${item.id}: title must be the full scene-index title`);
  assert.ok(sceneIndex.scenes[item.scene - 1].cg_ids.includes(item.id), `${item.id}: scene index reverse reference missing`);
  assert.ok(item.alt.trim(), `${item.id}: alt is required`);
  assert.equal(JSON.stringify(item.unlock), JSON.stringify({ type: 'scene_completed', scene: item.scene }));
  assert.ok([1, 2, 3].includes(item.spoiler_level));
}

const emptyCollection = { version: 1, cg_unlocks: {}, ending_unlocks: {} };
assert.equal(
  pickCgReveal(
    CG_MANIFEST,
    { campaign_id: 'main', current_scene: 150, campaign_completed: false, mainline_completed: false, collection: emptyCollection },
    { campaign_id: 'main', current_scene: 150, campaign_completed: true, mainline_completed: true, collection: emptyCollection },
  )?.id,
  'main:150:default',
  'scene 150 requires explicit completion state',
);
assert.equal(
  pickCgReveal(
    CG_MANIFEST,
    { campaign_id: 'main', current_scene: 150, campaign_completed: true, collection: emptyCollection },
    { campaign_id: 'main', current_scene: 150, campaign_completed: true, collection: emptyCollection },
  ),
  null,
  'unchanged completion must not reveal twice',
);

assert.equal(
  pickCgReveal(
    CG_MANIFEST,
    { campaign_id: 'dlc_genderbend_hachiman', mode: 'free', current_scene: 1, collection: emptyCollection },
    { campaign_id: 'dlc_genderbend_hachiman', mode: 'free', current_scene: 150, campaign_completed: true, collection: emptyCollection },
  ),
  null,
  'DLC progress must never unlock fake mainline scenes',
);

const scene9 = CG_MANIFEST.items.find(item => item.scene === 9);
assert.equal(
  pickCgReveal(
    CG_MANIFEST,
    { campaign_id: 'main', current_scene: 1, collection: emptyCollection },
    { campaign_id: 'main', current_scene: 1, collection: { ...emptyCollection, cg_unlocks: { [scene9.id]: true } } },
  )?.id,
  scene9.id,
  'portable collection discovery must use the same predicate as scene progress',
);
assert.equal(isCgUnlocked(scene9, { campaign_id: 'main', current_scene: 1, collection: { cg_unlocks: { [scene9.id]: true } } }), true);

const dlcOpening = {
  id: 'dlc_genderbend_hachiman:opening:default',
  campaign_id: 'dlc_genderbend_hachiman',
  variant: 'default',
  file: 'DLC-性转八幡-开场.webp',
  title: '错位的日常·开场',
  alt: '八幡在卧室镜前发现身体变化',
  unlock: { type: 'opening_seen', unlock_id: 'dlc_genderbend_hachiman:opening_seen' },
  spoiler_level: 1,
};
const dlcManifest = { schema_version: 2, items: [dlcOpening] };
const dlcPrev = { campaign_id: 'dlc_genderbend_hachiman', mode: 'free', collection: { cg_unlocks: {} } };
const dlcCur = {
  campaign_id: 'dlc_genderbend_hachiman',
  mode: 'free',
  current_scene: 150,
  collection: { cg_unlocks: { 'dlc_genderbend_hachiman:opening_seen': true } },
};
assert.equal(pickCgReveal(dlcManifest, dlcPrev, dlcCur)?.id, dlcOpening.id, 'DLC uses stable opening discovery ID');
assert.equal(pickCgReveal(dlcManifest, dlcCur, dlcCur), null, 'stable DLC discovery does not repeat');
assert.equal(
  pickCgReveal(dlcManifest, dlcPrev, { ...dlcCur, campaign_id: 'dlc_body_swap_mrs_yukinoshita' }),
  null,
  'DLC discovery is campaign-isolated',
);
assert.equal(
  evaluateCgUnlockPredicate({ type: 'scene_completed', scene: 1 }, dlcCur, { ...dlcOpening, scene: 1 }),
  false,
  'DLC items cannot use fake scene completion',
);

const built = await buildCgArtifacts({ release: true });
assert.equal(JSON.parse(built.json).items.length, 42);
assert.equal(built.mounter, originalSource, 'embedded mounter manifest/predicate must be synchronized');

assert.doesNotMatch(originalSource, /raw\.githubusercontent\.com\/[^'"\s]+\/main\//, 'CG assets must not follow mutable main');
assert.doesNotMatch(originalSource, /container\.innerHTML\s*=/, 'manifest text must not use innerHTML');
assert.doesNotMatch(originalSource, /fetch\s*\(/, 'card-side manifest must be embedded, not fetched from a second authority');
assert.match(originalSource, /collection\.cg_unlocks\[itemId\]\s*=\s*true/, 'CG discovery must persist in client collection');
assert.match(originalSource, /type:\s*'message',\s*message_id:\s*mesid/, 'CG discovery must persist on the reveal floor');
assert.match(originalSource, /type:\s*'chat'/, 'CG discovery must persist in chat variables');

console.log('CG manifest/mounter v2 tests: 42 mainline items, campaign isolation, collection, scene150, and DLC stable unlock PASS');
