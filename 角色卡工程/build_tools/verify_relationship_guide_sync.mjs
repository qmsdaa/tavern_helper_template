import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const frontendRoot = new URL('../../tavern_helper_template/src/Counterfeit/界面/状态栏/', root);

const targets = [
  ['比企谷八幡', '世界书/角色/比企谷八幡/性格调色盘.yaml'],
  ['雪之下雪乃', '世界书/角色/雪之下雪乃/性格调色盘.yaml'],
  ['由比滨结衣', '世界书/角色/由比滨结衣/性格调色盘.yaml'],
  ['拉芙希妮', '世界书/角色/拉芙希妮/性格调色盘.yaml'],
  ['一色彩羽', '世界书/角色/一色彩羽/性格调色盘.yaml'],
  ['平冢静', '世界书/角色/平冢静/性格调色盘.yaml'],
  ['雪之下阳乃', '世界书/角色/雪之下阳乃/性格调色盘.yaml'],
  ['爱布拉娜', '世界书/角色/爱布拉娜/性格调色盘.yaml'],
  ['三浦优美子', '世界书/NPC/三浦优美子.yaml'],
  ['户冢彩加', '世界书/NPC/户冢彩加.yaml'],
  ['川崎沙希', '世界书/NPC/川崎沙希.yaml'],
  ['海老名姬菜', '世界书/NPC/海老名姬菜.yaml'],
  ['比企谷小町', '世界书/NPC/比企谷小町.yaml'],
  ['鹤见留美', '世界书/NPC/鹤见留美.yaml'],
];

const profile = await readFile(new URL('profile.ts', frontendRoot), 'utf8');
const modal = await readFile(new URL('components/CharacterModal.vue', frontendRoot), 'utf8');
const embeddedScript = await readFile(new URL('脚本/状态栏挂载.js', root), 'utf8');
const embeddedMatch = embeddedScript.match(/const EMBEDDED_HTML_B64 = '([A-Za-z0-9+/=]+)'/);
assert.ok(embeddedMatch, 'statusbar embedded payload is missing');
const embeddedHtml = Buffer.from(embeddedMatch[1], 'base64').toString('utf8');
const fieldMap = [
  ['路线基调', 'routeTone'],
  ['容易心动的瞬间', 'heartMoments'],
  ['会拉开距离的做法', 'distanceTriggers'],
  ['关系确认信号', 'confirmationSignal'],
];
const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

for (const [name, relativePath] of targets) {
  const content = await readFile(new URL(relativePath, root), 'utf8');
  assert.doesNotMatch(content, /接住/, `${name}: contains banned wording 接住`);
  assert.match(content, new RegExp(`攻略提示_${name}:`), `${name}: missing guide heading`);
  for (const [yamlField, tsField] of fieldMap) {
    const match = content.match(new RegExp(`^  ${yamlField}: (.+)$`, 'm'));
    assert.ok(match, `${name}: missing ${yamlField}`);
    assert.doesNotMatch(
      match[1],
      /真正困难的|真正能推进|这条路线靠|才是这条路线|只对.{0,10}成立|明确(?:表达|确认|告诉|说明)|不靠.{0,20}(?:而)?靠/,
      `${name}: ${yamlField} contains templated phrasing`,
    );
    assert.match(profile, new RegExp(`${tsField}:\\s*'${escapeRegExp(match[1])}'`), `${name}: ${yamlField} is not mirrored verbatim in profile.ts`);
    assert.ok(embeddedHtml.includes(match[1]), `${name}: ${yamlField} is missing from embedded statusbar`);
  }
}

assert.doesNotMatch(profile, /\b(?:note|positive|negative|commitment):/, 'profile.ts still uses legacy guide field names');
assert.doesNotMatch(modal, /有效证据|负面证据|关系翻转|接近说明|已翻转|未翻转/, 'CharacterModal still displays report-like guide labels');
for (const label of ['角色攻略', '路线基调', '心动瞬间', '退避雷区', '确认信号', '关系已确认', '朋友路线', '路线进行中']) {
  assert.ok(modal.includes(label), `CharacterModal is missing label: ${label}`);
  assert.ok(embeddedHtml.includes(label), `embedded statusbar is missing label: ${label}`);
}
assert.doesNotMatch(embeddedHtml, /有效证据|负面证据|关系翻转|接近说明|已翻转|未翻转/, 'embedded statusbar still contains report-like guide labels');

console.log(`Relationship guide sync verified: targets=${targets.length}, fields=${fieldMap.length}, embedded=true`);
