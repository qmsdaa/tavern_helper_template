import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const state = JSON.parse(await readFile(new URL('tavern-cards-state.json', root), 'utf8'));
const common = await readFile(new URL('世界书/机制/攻略难度.yaml', root), 'utf8');

const targets = [
  ['由比滨结衣', '世界书/角色/由比滨结衣/性格调色盘.yaml'],
  ['比企谷八幡', '世界书/角色/比企谷八幡/性格调色盘.yaml'],
  ['雪之下雪乃', '世界书/角色/雪之下雪乃/性格调色盘.yaml'],
  ['拉芙希妮', '世界书/角色/拉芙希妮/性格调色盘.yaml'],
  ['一色彩羽', '世界书/角色/一色彩羽/性格调色盘.yaml'],
  ['雪之下阳乃', '世界书/角色/雪之下阳乃/性格调色盘.yaml'],
  ['爱布拉娜', '世界书/角色/爱布拉娜/性格调色盘.yaml'],
  ['平冢静', '世界书/角色/平冢静/性格调色盘.yaml'],
  ['户冢彩加', '世界书/NPC/户冢彩加.yaml'],
  ['三浦优美子', '世界书/NPC/三浦优美子.yaml'],
  ['海老名姬菜', '世界书/NPC/海老名姬菜.yaml'],
  ['川崎沙希', '世界书/NPC/川崎沙希.yaml'],
  ['比企谷小町', '世界书/NPC/比企谷小町.yaml'],
  ['鹤见留美', '世界书/NPC/鹤见留美.yaml'],
];

const forbidden = /羁绊线|永久锁|romance\s*恒\s*0|血缘锁|毕业前锁|不可翻转恋人|恋爱线开放|上限\s*40/;
assert.ok(common.length <= 1800, `common romance guide is still too large: ${common.length} chars`);
assert.doesNotMatch(common, forbidden, 'common guide still contains a legacy romance restriction');

for (const [name, relativePath] of targets) {
  const content = await readFile(new URL(relativePath, root), 'utf8');
  assert.match(content, new RegExp(`攻略提示_${name}:`), `${name} is missing its local guide`);
  assert.match(content, /路线基调:/, `${name} is missing route tone`);
  assert.match(content, /容易心动的瞬间:/, `${name} is missing heart moments`);
  assert.match(content, /会拉开距离的做法:/, `${name} is missing distance triggers`);
  assert.match(content, /关系确认信号:/, `${name} is missing confirmation signal`);
  assert.doesNotMatch(content, forbidden, `${name} still contains a legacy romance restriction`);
}

const registered = new Map();
for (const category of Object.values(state.entryManifest)) {
  for (const [name, entry] of Object.entries(category)) registered.set(name, entry);
}
for (const [name] of targets) {
  const entry = [...registered.entries()].find(([entryName]) => entryName === name || entryName.startsWith(`${name}_`))?.[1];
  assert.ok(entry, `${name} has no registered character entry`);
  assert.equal(entry.strategy?.type, 'selective', `${name} must remain selective`);
}

const aiblana = registered.get('爱布拉娜_性格调色盘');
// 2026-08-06 门控 getvar 化后条件为 getvar('stat_data.mode', {defaults: null}) === 'pov' || … === 'free'
assert.match(aiblana.contents[0].content, /getvar\('stat_data\.mode', \{defaults: null\}\) === 'free'/, 'Aiblana palette must render in free mode');
console.log(`Romance guide split verified: common=${common.length} chars, targets=${targets.length}`);
