import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildArtifacts, renderGuardedSceneForTest, selectPlayerRoute } from './build_scene_index.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifacts = await buildArtifacts();
const indexPath = path.join(root, 'generated', 'scene-index.json');
const built = JSON.parse(artifacts.get(indexPath));

assert.equal(built.scenes.length, 150);
assert.equal(built.scenes[0].id, 'main:1');
assert.equal(built.scenes.at(-1).id, 'main:150');
assert.deepEqual(built.scenes.map((scene) => scene.number), Array.from({ length: 150 }, (_, i) => i + 1));
assert.ok(built.scenes.every((scene) => scene.player_route_keys.length === 4));
assert.ok(built.scenes.every((scene) => !Object.hasOwn(scene, 'player_routes')), 'public index must not duplicate model-facing routes');
assert.ok(
  built.scenes.every((scene) => typeof scene.teaser === 'string' && scene.teaser.length >= 8 && scene.teaser.length <= 60),
  'every scene needs a one-sentence teaser (8..60 chars)',
);
assert.ok(
  built.scenes.every((scene) => scene.teaser !== scene.title && !scene.teaser.includes('\n')),
  'teaser must differ from the spoilery design title',
);
assert.ok(
  built.scenes.every((scene) => !/[★🔨⛈🍵🔥🧸Ω]/.test(scene.teaser) && !/HAMMER/i.test(scene.teaser)),
  'teaser must not leak design markers',
);

const renderPath = path.join(root, 'generated', 'scene-render-lookup.json');
const lookup = JSON.parse(artifacts.get(renderPath)).scenes;
for (const [sceneId, player] of [['main:44', 'hachiman'], ['main:49', 'yukino'], ['main:48', 'laff']]) {
  const selected = selectPlayerRoute({ id: sceneId, ...lookup[sceneId] }, player);
  assert.equal(typeof selected.current_player_route, 'string');
  assert.match(selected.current_player_route, /^在场:\s*(?:true|false)/m);
  assert.deepEqual(Object.keys(selected).sort(), ['current_player_route', 'event_focus']);
}
assert.equal(lookup['main:48'].event_focus.type, 'ensemble');
assert.throws(() => selectPlayerRoute({ id: 'main:44', ...lookup['main:44'] }, 'mrs_yukinoshita'), /没有对应玩家入口/);

const registryPath = path.join(root, 'generated', 'campaigns.json');
const campaigns = JSON.parse(artifacts.get(registryPath)).campaigns;
assert.equal(campaigns.main.total_scenes, 150);
assert.equal(campaigns.dlc_genderbend_hachiman.campaign_type, 'open_world');
assert.ok(!Object.hasOwn(campaigns.dlc_genderbend_hachiman, 'total_scenes'));
assert.ok(!Object.hasOwn(campaigns.dlc_body_swap_mrs_yukinoshita, 'total_scenes'));

const snapshotPath = path.join(root, 'generated', 'campaign-snapshots', 'main-118.json');
const snapshot = JSON.parse(artifacts.get(snapshotPath));
assert.equal(snapshot.snapshot_id, 'main:118');
assert.ok(snapshot.player_snapshots.hachiman);
assert.ok(snapshot.player_snapshots.mrs_yukinoshita);
assert.notDeepEqual(snapshot.player_snapshots.hachiman.relationship_baseline, snapshot.player_snapshots.mrs_yukinoshita.relationship_baseline);

const sourceFiles = await Promise.all(
  built.scenes.map((scene) => readFile(path.join(root, ...scene.source.split('/')), 'utf8')),
);
for (const [index, text] of sourceFiles.entries()) {
  assert.doesNotMatch(text, /^(?:主场POV|POV适配(?:（.*）)?|POV):/m, `${built.scenes[index].source}: ambiguous viewpoint label remains`);
  const routeGuards = [...text.matchAll(/^  # <%_ if \(getvar\('stat_data\.current_pov', \{ defaults: null \}\) === "([a-z_]+)"\) \{ _%>$/gm)].map((match) => match[1]);
  assert.deepEqual([...routeGuards].sort(), ['hachiman', 'laff', 'yui', 'yukino'], `${built.scenes[index].source}: four runtime route guards required`);
  // 剧情自建路由：custom guard 恰好 1 处；unavailable guard 必须排除带参与方式的剧情自建
  const customGuards = [...text.matchAll(/^  # <%_ if \(getvar\('stat_data\.mode', \{ defaults: null \}\) === "custom" && getvar\('stat_data\.custom_protagonist\.participation\.track', \{ defaults: null \}\) !== null\) \{ _%>$/gm)];
  assert.equal(customGuards.length, 1, `${built.scenes[index].source}: custom route guard must appear exactly once`);
  assert.match(
    text,
    /^  # <%_ if \(!\["hachiman","yukino","yui","laff"\]\.includes\(getvar\('stat_data\.current_pov', \{ defaults: null \}\)\) && !\(getvar\('stat_data\.mode', \{ defaults: null \}\) === "custom"/m,
    `${built.scenes[index].source}: unavailable guard must exclude story-custom players`,
  );
}

// 剧情自建渲染：currentPov='custom' 时只渲染 custom 路由
const scene44Custom = renderGuardedSceneForTest(sourceFiles[43], 'custom', built.scenes[43].source);
const customBlock = /^玩家入口:\s*$([\s\S]*?)(?=^[^\s#][^\n]*:\s*(?:.*)?$)/m.exec(`${scene44Custom}\n__END__:`)?.[1] ?? '';
assert.deepEqual([...customBlock.matchAll(/^  ([a-z_]+):\s*$/gm)].map((match) => match[1]), ['custom'], 'custom render must contain exactly the custom route');
assert.match(customBlock, /参与方式轨道/);
assert.match(customBlock, /事件焦点与NPC动机不因玩家改变/);

for (const [sceneNumber, currentPov] of [[44, 'hachiman'], [49, 'yukino'], [48, 'laff']]) {
  const source = built.scenes[sceneNumber - 1].source;
  const rendered = renderGuardedSceneForTest(sourceFiles[sceneNumber - 1], currentPov, source);
  const routeBlock = /^玩家入口:\s*$([\s\S]*?)(?=^[^\s#][^\n]*:\s*(?:.*)?$)/m.exec(`${rendered}\n__END__:`)?.[1] ?? '';
  const renderedKeys = [...routeBlock.matchAll(/^  ([a-z_]+):\s*$/gm)].map((match) => match[1]);
  assert.deepEqual(renderedKeys, [currentPov], `${source}: model-facing text must contain exactly the selected player route`);
  assert.doesNotMatch(routeBlock, /事件焦点|event_focus/, `${source}: route rendering must not substitute event focus`);
}

const scene149Blocked = renderGuardedSceneForTest(sourceFiles[148], null, built.scenes[148].source);
const blockedRoute = /^玩家入口:\s*$([\s\S]*?)(?=^[^\s#][^\n]*:\s*(?:.*)?$)/m.exec(`${scene149Blocked}\n__END__:`)?.[1] ?? '';
assert.deepEqual([...blockedRoute.matchAll(/^  ([a-z_]+):\s*$/gm)].map((match) => match[1]), ['unavailable']);
assert.match(blockedRoute, /禁止借用事件焦点或其他角色入口继续剧情/);
assert.doesNotMatch(blockedRoute, /^\s*(?:hachiman|yukino|yui|laff|custom|事件焦点|event_focus):/m);
assert.doesNotMatch(scene149Blocked, /throw new Error\("场景一百四十九/);

const scene44 = sourceFiles[43];
const scene44WithoutHachiman = scene44.replace(
  /^  # <%_ if \(getvar\('stat_data\.current_pov', \{ defaults: null \}\) === "hachiman"\) \{ _%>[\s\S]*?^  # <%_ \} _%>\r?\n/m,
  '',
);
assert.throws(
  () => renderGuardedSceneForTest(scene44WithoutHachiman, 'hachiman', built.scenes[43].source),
  /完整覆盖|没有对应玩家入口/,
  'missing current player route must fail without event-focus fallback',
);

const longGaps = built.scenes.filter((scene) => scene.gap_days >= 7);
assert.equal(longGaps.length, 37, 'canonical scene-date gap-count tripwire changed');
assert.equal(longGaps.filter((scene) => scene.gap_days >= 21).length, 5);
assert.equal(Math.max(...longGaps.map((scene) => scene.gap_days)), 48);
assert.ok(longGaps.every((scene) => scene.transition && scene.transition.visible_lines.length > 0), 'every long gap needs generated transition content');
const authoredTransitions = longGaps.filter((scene) => scene.transition.mode === 'authored');
assert.equal(authoredTransitions.length, 5);
for (const scene of authoredTransitions) {
  assert.ok(scene.transition.established_changes.length > 0);
  assert.ok(scene.transition.stable_facts.length > 0);
  assert.ok(Object.keys(scene.transition.player_observation).length > 0);
  assert.ok(scene.transition.unresolved.length > 0);
}

console.log('Scene index tests passed: 150 guarded player routes, main:118 snapshot, and 37 complete transition contracts');
