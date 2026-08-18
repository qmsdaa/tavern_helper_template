import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const statePath = process.argv[2] ?? new URL('../tavern-cards-state.json', import.meta.url);
const state = JSON.parse(await readFile(statePath, 'utf8'));

// 场景条目必填字段（行首前缀匹配；字段名后允许带括号变体，如 "NPC动机（xxx）:"）
const REQUIRED_FIELDS = [
  '场景:',
  '幕:',
  '时间:',
  '索引日期:',
  '地点:',
  '人物:',
  '事件焦点:',
  '场景功能:',
  '进入状态:',
  '世界推动:',
  'NPC动机',
  '信息边界:',
  '玩家入口:',
  'POV平行动向:',
  '玩家控制边界:',
  '可用节拍',
  '偏离处理:',
  '推进边界:',
  '完成后事实:',
  '氛围锚点:',
  '禁止提前:',
];

// 场景字段豁免表。
// v5.0 A4 已于 2026-08-06 全部补齐（原 41 处豁免 → 0）：第四幕/第五幕（72、76-90）的
// 「偏离处理」「推进边界」与第七幕/第九幕（107、108、112、113、115、116、118、133、134）
// 的「禁止提前」均已落盘，脚本转正为全量强制校验。新增场景若需临时豁免，在此登记并注明补齐计划。
const EXEMPTIONS = {};

const SCENE_RE = /^场景([零一二三四五六七八九十百]+)$/;
const CN = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

function toChineseNumber(n) {
  if (n <= 10) return n === 10 ? '十' : CN[n];
  if (n < 100) {
    const tens = Math.floor(n / 10);
    const units = n % 10;
    return (tens === 1 ? '' : CN[tens]) + '十' + (units ? CN[units] : '');
  }
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  return CN[hundreds] + '百' + (rest ? (rest < 10 ? CN[rest] : toChineseNumber(rest)) : '');
}

function sceneNumber(name) {
  const m = SCENE_RE.exec(name);
  if (!m) return null;
  let result = 0;
  let section = 0;
  let number = 0;
  for (const seg of m[1]) {
    if (seg === '百') {
      section += (number || 1) * 100;
      number = 0;
    } else if (seg === '十') {
      section += (number || 1) * 10;
      number = 0;
    } else {
      number = CN.indexOf(seg);
    }
  }
  return section + number;
}

// 收集事件条目 → 文件路径
const sceneEntries = [];
for (const cat of Object.values(state.entryManifest)) {
  for (const [name, entry] of Object.entries(cat)) {
    if (!SCENE_RE.test(name)) continue;
    const file = (entry.contents || []).map((c) => c.file).find(Boolean);
    if (!file) throw new Error(`场景条目缺文件引用: ${name}`);
    sceneEntries.push({ name, num: sceneNumber(name), file });
  }
}
sceneEntries.sort((a, b) => a.num - b.num);
assert.equal(sceneEntries.length, 150, 'expected exactly 150 scene entries');

const missing = new Map(); // field -> [sceneNum, ...]
const missingAll = new Map(); // sceneNum -> [field, ...]
for (const entry of sceneEntries) {
  const text = await readFile(new URL(entry.file, statePath), 'utf8');
  assert.doesNotMatch(
    text,
    /^(?:主场POV|POV适配(?:（.*）)?|POV):/m,
    `${entry.name}: ambiguous legacy viewpoint field remains`,
  );
  const routeBlock = /^玩家入口:\s*$([\s\S]*?)(?=^[^\s#][^\n]*:\s*(?:.*)?$)/m.exec(`${text}\n__END__:`)?.[1] ?? '';
  const unavailableGuards = routeBlock.match(/^  # <%_ if \(!\[[^\]]+\]\.includes\(getvar\('stat_data\.current_pov', \{ defaults: null \}\)\) && !\(getvar\('stat_data\.mode', \{ defaults: null \}\) === "custom" && getvar\('stat_data\.custom_protagonist\.participation\.track', \{ defaults: null \}\) !== null\)\) \{ _%>$/gm) ?? [];
  assert.equal(unavailableGuards.length, 1, `${entry.name}: expected one graceful unavailable current_pov guard`);
  assert.match(routeBlock, /^  unavailable:\r?\n    在场: false\r?\n    演绎入口:\r?\n      - .*禁止借用事件焦点/m, `${entry.name}: unavailable route must block story without event-focus fallback`);
  assert.doesNotMatch(routeBlock, /throw new Error/, `${entry.name}: runtime player-route guard must not throw`);
  const routeGuards = [...routeBlock.matchAll(/^  # <%_ if \(getvar\('stat_data\.current_pov', \{ defaults: null \}\) === "([a-z_]+)"\) \{ _%>$/gm)].map((match) => match[1]);
  assert.deepEqual([...routeGuards].sort(), ['hachiman', 'laff', 'yui', 'yukino'], `${entry.name}: expected four current_pov route guards`);
  // hotfix5 起全部 150 场景统一为 6 段结构：unavailable + 四 POV + custom 参与路由
  const customGuards = routeBlock.match(/^  # <%_ if \(getvar\('stat_data\.mode', \{ defaults: null \}\) === "custom" && getvar\('stat_data\.custom_protagonist\.participation\.track', \{ defaults: null \}\) !== null\) \{ _%>$/gm) ?? [];
  assert.equal(customGuards.length, 1, `${entry.name}: expected one custom-participation route guard`);
  assert.match(routeBlock, /^  # <%_ if \(getvar\('stat_data\.mode', \{ defaults: null \}\) === "custom" && getvar\('stat_data\.custom_protagonist\.participation\.track', \{ defaults: null \}\) !== null\) \{ _%>\r?\n  custom:$/m, `${entry.name}: custom route key must be immediately inside its guard`);
  const closeGuards = routeBlock.match(/^  # <%_ \} _%>$/gm) ?? [];
  assert.equal(closeGuards.length, 6, `${entry.name}: expected unavailable plus four route plus custom guard closures`);
  for (const key of routeGuards) {
    assert.match(
      routeBlock,
      new RegExp(`^  # <%_ if \\(getvar\\('stat_data\\.current_pov', \\{ defaults: null \\}\\) === "${key}"\\) \\{ _%>\\r?\\n  ${key}:$`, 'm'),
      `${entry.name}: ${key} route key must be immediately inside its guard`,
    );
  }
  for (const field of REQUIRED_FIELDS) {
    const re = new RegExp(`^${field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'm');
    if (re.test(text)) continue;
    const exempt = EXEMPTIONS[field]?.has(entry.num);
    if (exempt) continue;
    if (!missing.has(field)) missing.set(field, []);
    missing.get(field).push(entry.num);
    if (!missingAll.has(entry.num)) missingAll.set(entry.num, []);
    missingAll.get(entry.num).push(field);
  }
}

if (missing.size > 0) {
  console.error('场景字段缺口（未豁免）：');
  for (const [field, nums] of [...missing.entries()].sort()) {
    console.error(`  ${field} 缺 ${nums.length} 场: ${nums.map(toChineseNumber).map((n) => `场景${n}`).join('、')}`);
  }
  console.error(`\n涉及场景 ${missingAll.size} 场（豁免清单之外的简写段，需补齐后从 EXEMPTIONS 移除豁免）`);
  process.exit(1);
}

const exemptionCount = Object.values(EXEMPTIONS).reduce((sum, s) => sum + s.size, 0);
console.log(
  `Scene fields verified: ${sceneEntries.length}/${sceneEntries.length} entries complete` +
    (exemptionCount ? ` (${exemptionCount} known exemptions)` : ' (no exemptions — v5.0 A4 closed)'),
);
