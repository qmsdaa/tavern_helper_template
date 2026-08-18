// 群像均衡审计：度量四个主角在全部场景中的叙事份额，暴露"个人传"残留。
// 默认报告模式（exit 0）；--strict 模式在触发阈值时 exit 1，可纳入回归套件。
// 修复推进过程中逐步收紧 THRESHOLDS；当前阈值记录的是修复完成后的目标态，不是现状。
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

const statePath = process.argv.find((a) => a.endsWith('.json')) ?? new URL('../tavern-cards-state.json', import.meta.url);
const strict = process.argv.includes('--strict');
const state = JSON.parse(await readFile(statePath, 'utf8'));

// ---- 阈值（修复目标态；现状见报告底部违规清单）----
const THRESHOLDS = {
  // 任一主角连续零事件焦点的最大场数（第八/九幕 OC 独角段除外，单独豁免登记）
  maxZeroFocusStreak: 10,
  // 任一主角的全卡焦点占比下限
  minFocusShare: 0.12,
  // 每个成长里程碑旗标在场景文件中的命名锚点下限（锚点=场景正文显式提及旗标名）
  minFlagAnchors: 1,
};
// 连续零焦点的幕级豁免：2026-08-17 第三批 C1 已为第八九幕补入日本侧平行线（121 送别三拍/
// 128 转群像/130 教练位与三人焦点），豁免按既定条件移除，两幕自此接受统一阈值。
const STREAK_EXEMPT_ACTS = new Set();

const CHARS = {
  hachiman: /八幡|比企谷/,
  yukino: /雪乃(?!同学)|雪之下雪乃/,
  yui: /结衣|由比滨/,
  laff: /拉芙/,
};
const CHAR_LABEL = { hachiman: '八幡', yukino: '雪乃', yui: '结衣', laff: '拉芙' };
const MILESTONES = {
  hachiman: ['asked_before_self_sacrifice', 'accepted_shared_cost', 'stated_personal_desire'],
  yukino: ['offered_resources_without_deciding', 'admitted_personal_wish', 'separated_self_from_family_standard'],
  yui: ['voiced_disagreement_publicly', 'did_not_retract_after_conflict', 'admitted_selfish_wish'],
  laff: ['expressed_preference', 'refused_without_explanation', 'chose_against_group_expectation', 'accepted_consequence_without_withdrawing_choice'],
};
const CN_ACT = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
const SCENE_RE = /^场景([零一二三四五六七八九十百]+)$/;

const scenes = [];
for (const cat of Object.values(state.entryManifest)) {
  for (const [name, entry] of Object.entries(cat)) {
    if (!SCENE_RE.test(name)) continue;
    const file = (entry.contents || []).map((c) => c.file).find(Boolean);
    if (!file) throw new Error(`场景条目缺文件引用: ${name}`);
    scenes.push({ name, file });
  }
}

const rows = [];
for (const { name, file } of scenes) {
  const text = await readFile(new URL(file, statePath), 'utf8');
  const num = parseInt(/^场景: (\d+)/m.exec(text)?.[1] ?? '0', 10);
  const act = CN_ACT[/^幕:\s*"?第(.)幕/m.exec(text)?.[1]] ?? 0;
  const focusType = /事件焦点:[\s\S]{0,40}?类型:\s*(\S+)/.exec(text)?.[1] ?? '';
  const focusBlock = /事件焦点:[\s\S]{0,200}?角色:\s*\n((?:\s+- .+\n)*)/.exec(text)?.[1] ?? '';
  const focus = [];
  for (const [key, re] of Object.entries(CHARS)) {
    if (re.test(focusBlock)) focus.push(key);
  }
  // 主场标记：标题里的 ★X主场 是唯一显式归属（场景呈现参考字段多数为空，不作依据）
  const leadRaw = /★([^\s·：:]{1,4}?)主场/.exec(text)?.[1] ?? '';
  let lead = '';
  for (const [key, re] of Object.entries(CHARS)) if (re.test(leadRaw)) lead = key;
  // 独占场：四 POV 路由中恰一个 在场: true
  const presence = {};
  for (const m of text.matchAll(/^  # <%_ if \(getvar\('stat_data\.current_pov', \{ defaults: null \}\) === "([a-z_]+)"\) \{ _%>\r?\n  [a-z_]+:\r?\n    在场: (true|false)/gm)) {
    presence[m[1]] = m[2] === 'true';
  }
  const presentKeys = Object.entries(presence).filter(([, v]) => v).map(([k]) => k);
  const solo = presentKeys.length === 1 ? presentKeys[0] : null;
  const flagAnchors = Object.values(MILESTONES).flat().filter((f) => text.includes(f));
  rows.push({ num, act, focusType, focus, lead, solo, flagAnchors });
}
rows.sort((a, b) => a.num - b.num);
if (rows.length !== 150) throw new Error(`expected 150 scenes, got ${rows.length}`);

// ---- 汇总 ----
const violations = [];
const acts = [...new Set(rows.map((r) => r.act))].sort((a, b) => a - b);
const totalFocus = Object.fromEntries(Object.keys(CHARS).map((k) => [k, 0]));
let ensembleFocus = 0;

console.log('幕 | 场次 | 焦点归属（八/雪/结/拉/群像）| 最长零焦点 streak');
for (const act of acts) {
  const rs = rows.filter((r) => r.act === act);
  const counts = Object.fromEntries(Object.keys(CHARS).map((k) => [k, 0]));
  let group = 0;
  for (const r of rs) {
    if (r.focusType === '群像') { group++; ensembleFocus++; }
    for (const c of r.focus) { counts[c]++; totalFocus[c]++; }
  }
  // 幕内最长零焦点 streak
  const streaks = [];
  for (const c of Object.keys(CHARS)) {
    let cur = 0, max = 0;
    for (const r of rs) {
      if (r.focus.includes(c) || r.focusType === '群像') { cur = 0; } else { cur++; max = Math.max(max, cur); }
    }
    if (max > 0) streaks.push(`${CHAR_LABEL[c]}${max}`);
  }
  console.log(
    `第${act}幕 (${String(rs.length).padStart(2)}场)  `
    + Object.keys(CHARS).map((k) => `${CHAR_LABEL[k]}${counts[k]}`).join('/')
    + `/群${group}  |  ${streaks.join(' ') || '—'}`,
  );
  if (!STREAK_EXEMPT_ACTS.has(act)) {
    for (const c of Object.keys(CHARS)) {
      let cur = 0, max = 0, maxEnd = 0;
      for (const r of rs) {
        if (r.focus.includes(c) || r.focusType === '群像') { cur = 0; } else { cur++; if (cur > max) { max = cur; maxEnd = r.num; } }
      }
      if (max > THRESHOLDS.maxZeroFocusStreak) {
        violations.push(`第${act}幕: ${CHAR_LABEL[c]} 连续零焦点 ${max} 场（止于场景${maxEnd}），阈值 ${THRESHOLDS.maxZeroFocusStreak}`);
      }
    }
  }
}

console.log('\n=== 全卡焦点份额 ===');
const focusTotal = Object.values(totalFocus).reduce((a, b) => a + b, 0) + ensembleFocus;
for (const [k, v] of Object.entries(totalFocus)) {
  const share = v / focusTotal;
  console.log(`${CHAR_LABEL[k]}: ${v} 场 (${(share * 100).toFixed(1)}%)`);
  if (share < THRESHOLDS.minFocusShare) violations.push(`${CHAR_LABEL[k]} 全卡焦点占比 ${(share * 100).toFixed(1)}% 低于阈值 ${THRESHOLDS.minFocusShare * 100}%`);
}
console.log(`群像: ${ensembleFocus} 场 (${((ensembleFocus / focusTotal) * 100).toFixed(1)}%)`);

console.log('\n=== 主场标记（★X主场，仅标题显式登记） ===');
for (const k of Object.keys(CHARS)) {
  const leads = rows.filter((r) => r.lead === k).map((r) => r.num);
  console.log(`${CHAR_LABEL[k]}: ${leads.length ? leads.join(',') : '（无）'}`);
}

console.log('\n=== 独占场（四 POV 恰一人在场） ===');
for (const k of Object.keys(CHARS)) {
  const solos = rows.filter((r) => r.solo === k).map((r) => r.num);
  console.log(`${CHAR_LABEL[k]}: ${solos.length} 场${solos.length ? ' — ' + solos.join(',') : ''}`);
}

console.log('\n=== 成长里程碑旗标的场景锚点（正文显式提及旗标名的场景） ===');
for (const [charKey, flags] of Object.entries(MILESTONES)) {
  for (const flag of flags) {
    const hits = rows.filter((r) => r.flagAnchors.includes(flag)).map((r) => r.num);
    console.log(`${charKey}.${flag}: ${hits.length ? hits.join(',') : '⚠ 零锚点'}`);
    if (hits.length < THRESHOLDS.minFlagAnchors) violations.push(`旗标 ${charKey}.${flag} 无任何场景锚点`);
  }
}

console.log('\n=== 违规清单（strict 模式判定依据） ===');
if (violations.length === 0) {
  console.log('（无）');
} else {
  for (const v of violations) console.log(`✗ ${v}`);
}
console.log(`\n审计完成: ${rows.length} 场, ${violations.length} 项阈值违规${strict && violations.length ? '（strict: FAIL）' : ''}`);
if (strict && violations.length) process.exit(1);
