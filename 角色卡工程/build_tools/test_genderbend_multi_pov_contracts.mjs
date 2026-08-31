import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const frontendRoot = path.resolve(root, '..', '前端工程');
const yamlUrl = new URL('../../../tavern_helper_template/node_modules/yaml/dist/index.js', import.meta.url);
const lodashUrl = new URL('../../../tavern_helper_template/node_modules/lodash/lodash.js', import.meta.url);
const [{ parse }, { default: lodash }] = await Promise.all([import(yamlUrl.href), import(lodashUrl.href)]);

const readCard = (relative) => readFile(path.join(root, ...relative.split('/')), 'utf8');
const readFrontend = (relative) => readFile(path.join(frontendRoot, ...relative.split('/')), 'utf8');

const [openingRoute, openingAnchorText, copyText, storeText, stateText, presenceText, updateRules] = await Promise.all([
  readCard('世界书/EJS预处理/开局场景路由.txt'),
  readCard('世界书/DLC/性转八幡/开局锚点.yaml'),
  readFrontend('src/Counterfeit/界面/开场白/copy.yaml'),
  readFrontend('src/Counterfeit/界面/开场白/store.ts'),
  readCard('tavern-cards-state.json'),
  readCard('世界书/EJS预处理/开放世界在场注入.txt'),
  readCard('世界书/MVU/更新规则.yaml'),
]);

const openingAnchor = parse(openingAnchorText).开局;
const copy = parse(copyText).openings;
const state = JSON.parse(stateText);

function openingBlock(pov) {
  const marker = `openingPov === '${pov}'`;
  const markerAt = openingRoute.indexOf(marker);
  assert.ok(markerAt >= 0, `missing opening route for ${pov}`);
  const openAt = openingRoute.indexOf('<opening_route>', markerAt);
  const closeAt = openingRoute.indexOf('</opening_route>', openAt);
  assert.ok(openAt >= 0 && closeAt > openAt, `malformed opening route for ${pov}`);
  return openingRoute.slice(openAt, closeAt);
}

const locationBlock = storeText.match(/const DLC_LOCATIONS:[\s\S]*?= \{([\s\S]*?)\n\};/)?.[1] ?? '';
function storeLocation(pov) {
  const match = locationBlock.match(new RegExp(`^\\s*${pov}:\\s*'([^']+)'`, 'm'));
  assert.ok(match, `store DLC location missing for ${pov}`);
  return match[1];
}

const routeCases = [
  {
    pov: 'yukino',
    anchorKey: '雪之下雪乃',
    copyKey: 'dlc_genderbend_yukino',
    required: ['普通的迪斯尼乐园邀约', '先泡红茶', '答应、婉拒、另约日期'],
    forbidden: ['截图', '传言', '刷屏', '变成女孩子'],
  },
  {
    pov: 'yui',
    anchorKey: '由比滨结衣',
    copyKey: 'dlc_genderbend_yui',
    required: ['遛完萨布雷', '发送一起去迪斯尼乐园的邀约', '先等回复'],
    forbidden: ['截图', '传言', '刷屏', '亲眼确认'],
  },
  {
    pov: 'laff',
    anchorKey: '拉芙希妮·都柏林',
    copyKey: 'dlc_genderbend_laff',
    required: ['成田机场到达口（从英国返回）', '已经来接机', '结衣第一个挥手欢迎'],
    forbidden: ['爱尔兰的家族宅邸', '回程机票', '改到最近一班', '改票', '小町的求助'],
  },
];

for (const testCase of routeCases) {
  const block = openingBlock(testCase.pov);
  const location = storeLocation(testCase.pov);
  const anchor = openingAnchor[testCase.anchorKey];
  assert.ok(String(anchor.地点).startsWith(location), `${testCase.pov}: anchor/store location mismatch`);
  assert.ok(block.includes(location), `${testCase.pov}: route/store location mismatch`);
  for (const text of testCase.required) assert.ok(block.includes(text), `${testCase.pov}: route missing ${text}`);
  for (const text of testCase.forbidden) assert.ok(!block.includes(text), `${testCase.pov}: stale conflicting premise ${text}`);
  assert.match(copy[testCase.copyKey], /迪斯尼乐园|成田机场/, `${testCase.pov}: copy premise drift`);
  assert.match(JSON.stringify(anchor), /迪斯尼乐园|成田机场/, `${testCase.pov}: anchor premise drift`);
}

function findEntry(value, key) {
  if (!value || typeof value !== 'object') return null;
  if (Object.prototype.hasOwnProperty.call(value, key)) return value[key];
  for (const child of Object.values(value)) {
    const found = findEntry(child, key);
    if (found) return found;
  }
  return null;
}

const basicInfoEntry = findEntry(state.entryManifest, 'DLC_错位的日常_基础信息_八幡');
assert.ok(basicInfoEntry, 'genderbend basic-info manifest entry missing');
assert.match(basicInfoEntry.abstract, /事件中心 NPC/);
assert.match(basicInfoEntry.abstract, /所有 POV 与自建路线均注入/);
const basicInfoGate = basicInfoEntry.contents.find(item => typeof item.content === 'string')?.content ?? '';
assert.match(basicInfoGate, /^@@if /);
assert.ok(!basicInfoGate.includes('current_pov'), 'genderbend basic info must not be limited to hachiman_f POV');

function getvarFor(statData) {
  return (sourcePath, options = {}) => {
    let value = { stat_data: statData };
    for (const key of String(sourcePath).split('.')) {
      if (!value || typeof value !== 'object' || !(key in value)) return options.defaults;
      value = value[key];
    }
    return value ?? options.defaults;
  };
}

const gateSource = basicInfoGate.slice('@@if '.length);
for (const current_pov of ['hachiman_f', 'yukino', 'yui', 'laff', null]) {
  const active = vm.runInNewContext(gateSource, {
    getvar: getvarFor({ campaign_id: 'dlc_genderbend_hachiman', current_pov }),
  });
  assert.equal(active, true, `basic info inactive for ${current_pov ?? 'custom'}`);
}
assert.equal(vm.runInNewContext(gateSource, { getvar: getvarFor({ campaign_id: 'main', current_pov: 'yukino' }) }), false);

assert.match(presenceText, /const owDisplayName = \(name\) => owCampaign === 'dlc_genderbend_hachiman'[\s\S]*?'比企谷八幡（性转）'/);
assert.ok(presenceText.includes("owLines.push('- ' + owDisplayName(name)"), 'presence rows must use genderbend display mapping');
assert.ok(presenceText.includes("owDisplayName(n) + '·' + w"), 'weather rows must use genderbend display mapping');

const renderPresence = lodash.template(presenceText.replace(/<%_/g, '<%').replace(/_%>/g, '%>'), { imports: { getvar: getvarFor({
  mode: 'free',
  campaign_id: 'dlc_genderbend_hachiman',
  current_pov: 'yukino',
  identity_state: null,
  world: { current_date: '2014-07-12', time_slot: '早晨', current_location: storeLocation('yukino') },
}) } });
const renderedPresence = renderPresence();
assert.match(renderedPresence, /^- 比企谷八幡（性转）:/m);
assert.doesNotMatch(renderedPresence, /^- 比企谷八幡:/m);
assert.match(renderedPresence, /比企谷八幡（性转）·雨:/);

for (const pov of ['hachiman_f', 'yukino', 'yui', 'laff', 'custom']) {
  assert.ok(updateRules.includes(`${pov}=${storeLocation(pov)}`), `update rules missing ${pov} opening location`);
}
assert.ok(!updateRules.includes('《错位的日常》为比企谷家·八幡房间'), 'stale one-location DLC rule remains');

console.log('Genderbend multi-POV contracts passed: routes, manifest gate, NPC naming, and opening locations');
