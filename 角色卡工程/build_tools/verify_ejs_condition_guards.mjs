import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const statePath = process.argv[2] ?? new URL('../tavern-cards-state.json', import.meta.url);
const cardRoot = path.dirname(fileURLToPath(statePath));
const state = JSON.parse(await readFile(statePath, 'utf8'));

function collectConditions(value, path = '$', result = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectConditions(item, `${path}[${index}]`, result));
    return result;
  }
  if (!value || typeof value !== 'object') return result;

  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (key === 'content' && typeof child === 'string' && child.startsWith('@@if ')) {
      const firstLine = child.split(/\r?\n/, 1)[0];
      result.push({ path: childPath, source: firstLine.slice('@@if '.length) });
    } else {
      collectConditions(child, childPath, result);
    }
  }
  return result;
}

const conditions = collectConditions(Array.isArray(state) ? state : state.entryManifest);

// 门控总数 tripwire：改动门控数量时必须同步这里，防止误增/误删条目门控。
// 当前构成 199（2026-08-15）：150 个 campaign=main 场景门控 + 原共享门控 +
// 5 个DLC写作条目 + 3 个隔离的main:118快照门控 + 雪之下夫人 3 条 + 性转八幡基础信息 1 条 + 尾声分支 7 条。
// 新增/删除门控必须显式更新此门槛。
assert.equal(conditions.length, 199, 'unexpected state-level @@if condition count');
const sceneConditions = conditions.filter(item => item.path.includes('.事件.场景'));
assert.equal(sceneConditions.length, 150, 'expected exactly 150 scripted scene conditions');
for (const condition of sceneConditions) {
  assert.ok(condition.source.includes("stat_data.campaign_id"), `${condition.path} missing campaign_id guard`);
  assert.ok(condition.source.includes("=== 'main'"), `${condition.path} must be isolated to main campaign`);
}

// —— 2026-08-06 门控改写：condition 不再依赖 generate_before 模板的 define()，
// 直接 getvar 读 stat_data 楼层变量（condition 求值先于 generate_before 执行，
// 且 mode 是酒馆内建生成类型变量，旧写法 typeof mode 短路失效导致 current_pov ReferenceError）。
// 本脚本模拟酒馆真实 condition 上下文：内建 mode（生成类型，如 'send'）+ 模板函数 getvar。
const ALL_CHARS = ['比企谷八幡', '雪之下雪乃', '由比滨结衣', '拉芙希妮·都柏林'];
const ctxChars = (presentList) =>
  Object.fromEntries(ALL_CHARS.map((n) => [n, { present: presentList.includes(n) }]));
const RUNTIME_CONTEXTS = [
  { label: 'main/pov/laff', stat: { campaign_id: 'main', mode: 'pov', current_pov: 'laff', characters: ctxChars([]) } },
  { label: 'main/pov/yukino', stat: { campaign_id: 'main', mode: 'pov', current_pov: 'yukino', characters: ctxChars([]) } },
  { label: 'main/pov/hachiman', stat: { campaign_id: 'main', mode: 'pov', current_pov: 'hachiman', characters: ctxChars([]) } },
  { label: 'main/pov/yui', stat: { campaign_id: 'main', mode: 'pov', current_pov: 'yui', characters: ctxChars([]) } },
  { label: 'main/free', stat: { campaign_id: 'main', mode: 'free', current_pov: null, characters: ctxChars(ALL_CHARS) } },
  { label: 'main/custom', stat: { campaign_id: 'main', mode: 'custom', current_pov: null, characters: ctxChars(ALL_CHARS) } },
  // 《错位的日常》多可扮演视角（2026-08-18）：性转八幡 DLC 专属 + 三主角 + 自建
  { label: 'dlc/genderbend/hachiman_f', stat: { campaign_id: 'dlc_genderbend_hachiman', mode: 'free', current_pov: 'hachiman_f', identity_state: { kind: 'transformation', current_body: 'hachiman_f' }, characters: ctxChars(ALL_CHARS) } },
  { label: 'dlc/genderbend/yukino', stat: { campaign_id: 'dlc_genderbend_hachiman', mode: 'free', current_pov: 'yukino', identity_state: null, characters: ctxChars(ALL_CHARS) } },
  { label: 'dlc/genderbend/yui', stat: { campaign_id: 'dlc_genderbend_hachiman', mode: 'free', current_pov: 'yui', identity_state: null, characters: ctxChars(ALL_CHARS) } },
  { label: 'dlc/genderbend/laff', stat: { campaign_id: 'dlc_genderbend_hachiman', mode: 'free', current_pov: 'laff', identity_state: null, characters: ctxChars(ALL_CHARS) } },
  { label: 'dlc/genderbend/custom', stat: { campaign_id: 'dlc_genderbend_hachiman', mode: 'free', current_pov: null, custom_protagonist: { name: '自建' }, identity_state: null, characters: ctxChars(ALL_CHARS) } },
  { label: 'dlc/swap/hachiman', stat: { campaign_id: 'dlc_body_swap_mrs_yukinoshita', mode: 'free', current_pov: 'hachiman', characters: ctxChars(ALL_CHARS) } },
  { label: 'dlc/swap/mrs', stat: { campaign_id: 'dlc_body_swap_mrs_yukinoshita', mode: 'free', current_pov: 'mrs_yukinoshita', characters: ctxChars(ALL_CHARS) } },
  // 尾声分支门控（2026-08-15）：mainline_completed=true + branch_choice 各值
  ...['八幡×雪乃', '八幡×结衣', '八幡×拉芙希妮', '雪乃×结衣', '雪乃×拉芙希妮', '拉芙希妮×结衣', '姐妹和解'].map(branch => ({
    label: `main/epilogue/${branch}`,
    stat: { campaign_id: 'main', mode: 'pov', current_pov: 'hachiman', mainline_completed: true, branch_choice: branch, characters: ctxChars(ALL_CHARS) },
  })),
];

/** 酒馆 getvar 语义：按路径读变量，带 defaults 回退；入参为完整 stat_data 对象 */
function makeGetvar(statData) {
  return (path, opts = {}) => {
    let cur = statData;
    for (const key of String(path).split('.')) {
      if (cur && typeof cur === 'object' && key in cur) {
        cur = cur[key];
      } else {
        return opts.defaults ?? undefined;
      }
    }
    return cur === undefined ? opts.defaults ?? undefined : cur;
  };
}

/** 模拟酒馆 condition 求值上下文：内建 mode（生成类型）+ getvar 模板函数 */
function runCondition(source, statData) {
  return vm.runInNewContext(source, {
    mode: 'send',
    getvar: makeGetvar(statData ?? {}),
    // 开局锚点还要求可见首条消息；本守卫只验证变量门控活性，消息原文由 opening tests 单独覆盖。
    matchChatMessages: () => true,
  });
}

for (const condition of conditions) {
  // 必须 getvar 直读 stat_data；禁止裸模板变量（酒馆 condition 上下文里 define 未生效、
  // 且 mode 是内建生成类型变量，裸引用会 ReferenceError 或语义错误）
  assert.match(
    condition.source,
    /getvar\('stat_data\./,
    `${condition.path} must read stat_data via getvar (no bare template variables)`,
  );
  for (const bare of ['current_pov ===', 'current_scene ===', 'laff_knows_fire_truth)', ' in characters', 'characters[']) {
    assert.ok(
      !condition.source.includes(bare),
      `${condition.path} has bare template variable (${bare}): ${condition.source}`,
    );
  }

  // 首次导入（stat_data 未初始化）行为按门控类型区分（酒馆内建 mode 遮蔽下不得抛错）：
  // - 纯在场门控（基础信息/二次解释·无 mode 分支）：fail-open——未建档时加载（首遇/初见覆盖）
  // - 带 POV 锁的在场门控（四主角三面性·free/custom 分支）与其余全部：fail-closed——MVU 未初始化不加载
  const isPresenceGate =
    condition.source.includes('stat_data.characters') &&
    !condition.source.includes("['free', 'custom']");
  const beforeInit = runCondition(condition.source, {});
  if (isPresenceGate) {
    assert.equal(beforeInit, true, `${condition.path} presence gate must fail open before MVU initialization`);
  } else {
    assert.equal(beforeInit, false, `${condition.path} must fail closed before MVU initialization`);
  }

  // 场景条目按自身场号求值；其余门控与场号无关。
  const scene = Number(condition.source.match(/getvar\('stat_data\.current_scene'[^)]*\) === (\d+)/)?.[1] ?? 123);

  const activeIn = RUNTIME_CONTEXTS.filter(context =>
    runCondition(condition.source, {
      stat_data: {
        current_scene: scene,
        laff_knows_fire_truth: true,
        ...context.stat,
      },
    }),
  ).map(context => context.label);

  assert.ok(
    activeIn.length > 0,
    `${condition.path} never activates in any runtime mode (dead entry): ${condition.source}`,
  );
}

console.log(`EJS condition guards verified: ${conditions.length}`);

// ══════════════════════════════════════════════════════════════
// 第二层守卫（2026-08-09）：扫描所有启用条目的 YAML/TXT 正文（含内联 contents），
// 禁止在 <% ... %> / <%= ... %> / <%- ... %> 代码块中裸用无明确预处理来源的状态变量：
//   mode / current_pov / current_scene / custom_protagonist / characters / world
// 合法来源（同文件内可验证）：
//   ① const|let|var NAME = …getvar('stat_data.…')（显式从楼层变量读取的本地变量）
//   ② define('NAME', getvar('stat_data.…'))（EJS预处理.txt 的模板变量定义）
// 反例（本守卫要捕获的）：已删除的「剧本日历」正文 `<%_ if (mode === 'pov') { _%>`——
// mode 在该文件内无任何 getvar/define 来源，酒馆 condition/模板上下文中是内建生成类型变量，
// 裸引用语义错乱（旧守卫只查 @@if 首行，漏检了正文裸用）。
// ══════════════════════════════════════════════════════════════
const BARE_FORBIDDEN = ['mode', 'current_pov', 'current_scene', 'custom_protagonist', 'characters', 'world'];

/** 收集条目正文文本：entry.path 文件 + contents 内联正文（不含 @@if 首行）+ contents 引用文件 */
async function collectEntryBodies(node, out = []) {
  if (!node || typeof node !== 'object') return out;
  for (const [name, entry] of Object.entries(node)) {
    if (!entry || typeof entry !== 'object') continue;
    if (typeof entry.uid !== 'number') {
      await collectEntryBodies(entry, out);
      continue;
    }
    if (entry.enabled === false) continue;
    const bodies = [];
    if (typeof entry.path === 'string') {
      try {
        bodies.push({ label: entry.path, text: await readFile(path.join(cardRoot, entry.path), 'utf8') });
      } catch {
        // path 指向的文件不存在时由其他守卫报告；这里不重复报错
      }
    }
    if (Array.isArray(entry.contents)) {
      for (const part of entry.contents) {
        if (typeof part?.content === 'string' && !part.content.startsWith('@@if ')) {
          bodies.push({ label: `${name}（内联）`, text: part.content });
        } else if (typeof part?.file === 'string') {
          try {
            bodies.push({ label: part.file, text: await readFile(path.join(cardRoot, part.file), 'utf8') });
          } catch {
            bodies.push({ label: part.file, text: '' });
          }
        }
      }
    }
    out.push({ name, bodies });
  }
  return out;
}

/** 剥离 EJS 代码块中的字符串与注释，避免字符串/注释里的同名文本误报 */
function stripStringsAndComments(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``');
}

/** 检查一段正文里的 EJS 代码块，返回裸变量违规列表 [{name, snippet}] */
function findBareVariableViolations(text) {
  const violations = [];
  const blocks = [];
  const blockRe = /<%[=\-_]?([\s\S]*?)[-_]?%>/g;
  let match;
  while ((match = blockRe.exec(text)) !== null) {
    blocks.push(match[1]);
  }
  if (blocks.length === 0) return violations;

  const fullCode = blocks.join('\n');
  // 同文件内可验证的预处理来源：本地 const/let/var 赋值为 getvar('stat_data.…)，或 define('名', getvar(…))
  const declared = new Set();
  for (const name of BARE_FORBIDDEN) {
    const localRe = new RegExp(`(?:const|let|var)\\s+${name}\\s*=[^;]*?getvar\\(\\s*['"]stat_data\\.`, 's');
    const defineRe = new RegExp(`define\\(\\s*['"]${name}['"]\\s*,\\s*getvar\\(\\s*['"]stat_data\\.`, 's');
    if (localRe.test(fullCode) || defineRe.test(fullCode)) declared.add(name);
  }

  for (const block of blocks) {
    const code = stripStringsAndComments(block);
    for (const name of BARE_FORBIDDEN) {
      if (declared.has(name)) continue;
      const useRe = new RegExp(`\\b${name}\\b`, 'g');
      let use;
      while ((use = useRe.exec(code)) !== null) {
        const before = code.slice(Math.max(0, use.index - 8), use.index).trimEnd();
        const after = code.slice(use.index + name.length).trimStart();
        // 属性访问（foo.mode）与对象字面量键（{ mode: x }）不算裸用
        if (before.endsWith('.')) continue;
        if ((before.endsWith('{') || before.endsWith(',')) && after.startsWith(':')) continue;
        violations.push({ name, snippet: code.slice(Math.max(0, use.index - 30), use.index + name.length + 30).trim() });
        break; // 每个块每个名字报一次即可
      }
    }
  }
  return violations;
}

const entryBodies = await collectEntryBodies(Array.isArray(state) ? state : state.entryManifest);
const bodyViolations = [];
for (const entry of entryBodies) {
  for (const body of entry.bodies) {
    for (const violation of findBareVariableViolations(body.text)) {
      bodyViolations.push({ entry: entry.name, label: body.label, ...violation });
    }
  }
}
assert.equal(
  bodyViolations.length,
  0,
  '启用条目正文存在无预处理来源的裸状态变量：\n' +
    bodyViolations.map(v => `  ${v.entry}（${v.label}）：裸用 ${v.name} → …${v.snippet}…`).join('\n'),
);

// 失败样例自检：模拟已删除的「剧本日历」正文裸用 mode——旧守卫（仅查 @@if 首行）漏检，
// 新守卫必须捕获；样例若不再被捕获，说明守卫退化，立即报错。
const CALENDAR_LIKE_SAMPLE = `<%_ if (mode === 'pov') { _%>\n剧本日历（150场·十幕）:\n  一幕·入部磨合（1-10）\n<%_ } _%>`;
const sampleViolations = findBareVariableViolations(CALENDAR_LIKE_SAMPLE);
assert.ok(
  sampleViolations.some(v => v.name === 'mode'),
  '守卫退化：模拟「剧本日历裸用 mode」样例未被捕获',
);
// 对照样例：同文件内 getvar 声明来源的写法必须放行（现网条目普遍用法）
const LEGIT_SAMPLE = `<%_ const mode = getvar('stat_data.mode', { defaults: null }); _%>\n<%_ if (mode === 'pov') { _%>正文<%_ } _%>`;
assert.equal(findBareVariableViolations(LEGIT_SAMPLE).length, 0, '误伤：getvar 声明来源的 mode 被判违规');

console.log(`EJS body bare-variable guard verified: ${entryBodies.length} enabled entries, 0 violations（失败样例已捕获）`);
