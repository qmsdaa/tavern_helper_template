import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRuntimeArtifacts, buildTransitionCards } from './build_transition_runtime.mjs';
import { selectTransitionRuntime } from './transition_runtime_predicate.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const index = JSON.parse(await readFile(path.join(root, 'generated', 'scene-index.json'), 'utf8'));
const transitionScenes = index.scenes.filter((scene) => scene.campaign_id === 'main' && scene.transition);
const cards = await buildTransitionCards();

assert.equal(transitionScenes.length, 37, 'scene index must expose exactly 37 transition destinations');
assert.equal(Object.keys(cards).length, 37, 'runtime card map must mirror all 37 transition destinations');

const normal = selectTransitionRuntime(cards, { campaign_id: 'main', current_scene: 6 }, { campaign_id: 'main', current_scene: 7 });
assert.equal(normal.id, 'main:6>7');
assert.equal(normal.skipped_scene_count, 0);

const jump = selectTransitionRuntime(cards, { campaign_id: 'main', current_scene: 6 }, { campaign_id: 'main', current_scene: 9 });
assert.equal(jump.id, 'main:8>9', 'multi-scene jump must select only the destination transition');
assert.equal(jump.skipped_scene_count, 2, 'multi-scene jump must expose skipped scene count');

assert.equal(selectTransitionRuntime(cards, { current_scene: 9 }, { current_scene: 9 }), null, 'same-scene turns must not repeat');
assert.equal(selectTransitionRuntime(cards, { current_scene: 9 }, { current_scene: 8 }), null, 'rewinds must not reveal a transition');
assert.equal(selectTransitionRuntime(cards, null, { current_scene: 7 }), null, 'a transition requires an adjacent previous AI snapshot');
assert.equal(selectTransitionRuntime(cards, { campaign_id: 'main', current_scene: 6 }, { campaign_id: 'dlc_genderbend_hachiman', current_scene: 7 }), null, 'campaign changes must not reveal main transitions');
assert.equal(selectTransitionRuntime(cards, { campaign_id: 'dlc_body_swap_mrs_yukinoshita', current_scene: 6 }, { campaign_id: 'dlc_body_swap_mrs_yukinoshita', current_scene: 7 }), null, 'DLC snapshots must not use numbered main transitions');

for (const scene of transitionScenes) {
  const source = await readFile(path.join(root, ...scene.source.split('/')), 'utf8');
  const start = `# TRANSITION_RUNTIME_GUARD_START ${scene.id}`;
  const end = `# TRANSITION_RUNTIME_GUARD_END ${scene.id}`;
  assert.equal(source.split(start).length - 1, 1, `${scene.id}: transition guard start must be unique`);
  assert.equal(source.split(end).length - 1, 1, `${scene.id}: transition guard end must be unique`);
  assert.match(source, new RegExp(`__cfTransitionCurrentScene${scene.number} === __cfTransitionTarget${scene.number}`), `${scene.id}: guard must target the active destination`);
  assert.match(source, new RegExp(`__cfTransitionPreviousScene${scene.number} < __cfTransitionCurrentScene${scene.number}`), `${scene.id}: guard must require a forward crossing`);
  assert.match(source, /role: 'assistant', include_swipes: false/, `${scene.id}: guard must read AI snapshots without swipe history`);
  assert.match(source, new RegExp(`skipped_scene_count: "<%= __cfTransitionSkipped${scene.number} %>"`), `${scene.id}: model layer must receive skipped count`);
  assert.ok(source.indexOf(start) < source.indexOf('转场:'), `${scene.id}: guard must wrap the whole transition block`);
  assert.ok(source.indexOf('转场:') < source.indexOf(end), `${scene.id}: guard must close after the transition block`);
}

const artifacts = await buildRuntimeArtifacts();
for (const [file, expected] of artifacts) {
  assert.equal(await readFile(file, 'utf8'), expected, `${path.relative(root, file)} must be generated-current`);
}

const template = await readFile(path.join(root, '脚本', '状态栏挂载.template.js'), 'utf8');
assert.match(template, /function selectTransitionRuntime\(/, 'statusbar template must embed the shared pure selector');
assert.match(template, /const cardId = TRANSITION_PREFIX \+ mesid;/, 'visible cards must use a stable per-message id');
assert.match(template, /existing\?\.dataset\.transitionKey === runtimeKey/, 'same floor/swipe evaluation must reuse an identical card');
assert.match(template, /if \(existing\) existing\.remove\(\);/, 'changed or no-longer-valid snapshots must replace/remove stale cards');
assert.match(template, /mesEl\.querySelector\('\.mes_text'\)\.after\(card\);/, 'cards must live inside their AI floor so delete/rewind removes them with the DOM');
assert.match(template, /ensureFloor\(mesEl\);\s+ensureTransitionCard\(mesEl\);/, 'each AI floor must run exactly one transition mount pass');
assert.match(template, /已略过 \$\{selection\.skipped_scene_count\} 个中间场景/, 'multi-scene cards must show skipped count');

console.log('Transition runtime tests passed: 37 guards, pure selection, destination-only jumps, and DOM dedupe contract');
