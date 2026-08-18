// 量化门控省 token：对比「卡面静态总量」（SillyTavern 卡面/世界书面板显示的固定值）
// 与「各运行模式单轮实际注入量」（酒馆助手在生成时按 @@if 条件求值 + EJS 正文渲染后的真实注入）。
// 三种口径分开报告：
//   ① 静态字符量：条目原始文本总长（含未渲染的全部 EJS 分支，永不减少）
//   ② 门控前上界：@@if 条件通过后按原始文本计入（未渲染 EJS 分支全部算入，是注入量的上界）
//   ③ 实际渲染量：对正文做迷你 EJS 渲染（if/else 分支按当前模式求值、只保留生效分支，
//      getvar/define 按当前模式 stat_data 提供），不把未渲染分支误算为注入
// 用法：node build_tools/estimate_gated_tokens.mjs [tavern-cards-state.json 路径] [场号]
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const statePath = process.argv[2] ?? new URL('../tavern-cards-state.json', import.meta.url);
const cardRoot = path.dirname(fileURLToPath(statePath));
const sceneAt = Number(process.argv[3] ?? 75);
const state = JSON.parse(await readFile(statePath, 'utf8'));

const ALL_CHARS = ['比企谷八幡', '雪之下雪乃', '由比滨结衣', '拉芙希妮·都柏林'];
const ctxChars = (presentList) =>
  Object.fromEntries(ALL_CHARS.map((n) => [n, { present: presentList.includes(n) }]));
const RUNTIME_CONTEXTS = [
  { label: 'pov/laff', stat: { mode: 'pov', current_pov: 'laff', characters: ctxChars([]) } },
  { label: 'pov/yukino', stat: { mode: 'pov', current_pov: 'yukino', characters: ctxChars([]) } },
  { label: 'pov/hachiman', stat: { mode: 'pov', current_pov: 'hachiman', characters: ctxChars([]) } },
  { label: 'pov/yui', stat: { mode: 'pov', current_pov: 'yui', characters: ctxChars([]) } },
  { label: 'free', stat: { mode: 'free', current_pov: null, characters: ctxChars(ALL_CHARS) } },
  { label: 'custom', stat: { mode: 'custom', current_pov: null, characters: ctxChars(ALL_CHARS) } },
];

function makeGetvar(statData) {
  return (p, opts = {}) => {
    let cur = statData;
    for (const key of String(p).split('.')) {
      if (cur && typeof cur === 'object' && key in cur) cur = cur[key];
      else return opts.defaults ?? undefined;
    }
    return cur === undefined ? opts.defaults ?? undefined : cur;
  };
}
const runCondition = (source, statData) =>
  vm.runInNewContext(source, { mode: 'send', getvar: makeGetvar(statData ?? {}) });

// 中文为主的文本：经验比约 1 token ≈ 1.8 字符（cl100k），仅作数量级参考
const toTokens = (chars) => Math.round(chars / 1.8);

// ── 迷你 EJS 渲染（只支持本卡正文实际使用的子集：<% js %> / <%= expr %> / <%- expr %> /
//    <%_ _%> 空白控制近似忽略、getvar/define 模板函数）──
// 渲染失败的条目回落为原始文本并计入 renderFailures，绝不静默吞掉。
function renderEjsBody(body, statData) {
  let output = '';
  const sandbox = {
    getvar: makeGetvar(statData ?? {}),
    define(name, value) {
      sandbox[name] = value;
      return value;
    },
    print(value) {
      output += value == null ? '' : String(value);
    },
    JSON,
    Number,
    String,
    Boolean,
    Array,
    Object,
    Math,
    RegExp,
    Date,
    console: { info() {}, warn() {}, error() {}, log() {} },
  };
  const segments = [];
  const re = /<%([=\-_]?)([\s\S]*?)[-_]?%>/g;
  let last = 0;
  let match;
  while ((match = re.exec(body)) !== null) {
    if (match.index > last) segments.push({ type: 'text', value: body.slice(last, match.index) });
    segments.push({ type: match[1] === '=' || match[1] === '-' ? 'expr' : 'code', value: match[2] });
    last = match.index + match[0].length;
  }
  if (last < body.length) segments.push({ type: 'text', value: body.slice(last) });
  const script = segments
    .map(segment => {
      if (segment.type === 'text') return `print(${JSON.stringify(segment.value)});`;
      if (segment.type === 'expr') return `print((${segment.value}));`;
      return segment.value;
    })
    .join('\n');
  vm.runInNewContext(script, sandbox, { timeout: 5000 });
  return output;
}

/** 收集全部清单条目（uid 为准）：contents 型（content/file）与 path 型统一处理。
 *  返回 { name, uid, enabled, condition, body } —— body 为条目正文（不含 @@if 门控行）。 */
async function collectEntries(node, out = []) {
  if (!node || typeof node !== 'object') return out;
  for (const [name, entry] of Object.entries(node)) {
    if (!entry || typeof entry !== 'object') continue;
    if (typeof entry.uid !== 'number') {
      await collectEntries(entry, out);
      continue;
    }
    let condition = null;
    let body = '';
    if (Array.isArray(entry.contents)) {
      for (const part of entry.contents) {
        if (typeof part?.content === 'string') {
          if (part.content.startsWith('@@if ')) {
            condition = part.content.split(/\r?\n/, 1)[0].slice('@@if '.length);
            const rest = part.content.split(/\r?\n/).slice(1).join('\n');
            if (rest.trim()) body += rest + '\n';
          } else {
            body += part.content + '\n';
          }
        } else if (typeof part?.file === 'string') {
          try {
            body += await readFile(path.join(cardRoot, part.file), 'utf8');
          } catch {
            console.warn(`  ⚠ 无法读取 ${part.file}（${name}），按 0 计`);
          }
        }
      }
    }
    if (!body && typeof entry.path === 'string') {
      try {
        body = await readFile(path.join(cardRoot, entry.path), 'utf8');
      } catch {
        console.warn(`  ⚠ 无法读取 ${entry.path}（${name}），按 0 计`);
      }
    }
    out.push({ name, uid: entry.uid, enabled: entry.enabled !== false, condition, body });
  }
  return out;
}

const allEntries = await collectEntries(state.entryManifest);
const entries = allEntries.filter(e => e.enabled);
const disabled = allEntries.filter(e => !e.enabled);

// 条目数 tripwire：统计口径必须覆盖全部启用清单条目（contents 型 + path 型），
// 与 verify_ejs_condition_guards.mjs 的计数保持一致；不一致说明收集逻辑漏条目。
const expectedEnabled = (() => {
  let count = 0;
  const walk = node => {
    for (const entry of Object.values(node ?? {})) {
      if (!entry || typeof entry !== 'object') continue;
      if (typeof entry.uid === 'number') {
        if (entry.enabled !== false) count++;
      } else walk(entry);
    }
  };
  walk(state.entryManifest);
  return count;
})();
if (entries.length !== expectedEnabled) {
  throw new Error(`entry collection mismatch: collected ${entries.length}, manifest enabled ${expectedEnabled}`);
}

const gated = entries.filter(e => e.condition);
const ungated = entries.filter(e => !e.condition);

const staticTotal = entries.reduce((s, e) => s + e.body.length, 0);
const ungatedTotal = ungated.reduce((s, e) => s + e.body.length, 0);

console.log(`条目总数（启用）${entries.length}（带 @@if 门控 ${gated.length}，无门控 ${ungated.length}；另有停用 ${disabled.length} 条不计入）`);
console.log(`① 静态字符量（= 酒馆内显示的世界书字符数，含未渲染 EJS 全部分支，永不减少）: ${staticTotal} 字符 ≈ ${toTokens(staticTotal)} tok`);
console.log(`   其中无门控部分（任何模式都进入第二轮渲染）: ${ungatedTotal} 字符 ≈ ${toTokens(ungatedTotal)} tok`);
console.log(`\n=== 单轮注入估算（场景号 = ${sceneAt}，四人全部在场、关键词均命中的上限口径） ===`);

for (const context of RUNTIME_CONTEXTS) {
  const statData = {
    stat_data: {
      current_scene: sceneAt,
      laff_knows_fire_truth: true,
      laff_reed_authorized_yukino: false,
      ...context.stat,
    },
  };
  // ② 门控前上界：条件通过的条目按原始文本全量计入
  let upperBound = ungatedTotal;
  const passed = [...ungated];
  for (const entry of gated) {
    if (runCondition(entry.condition, statData)) {
      upperBound += entry.body.length;
      passed.push(entry);
    }
  }
  // ③ 实际渲染量：对通过门控的条目正文做 EJS 渲染，只保留生效分支
  let rendered = 0;
  let renderFailures = 0;
  for (const entry of passed) {
    if (!entry.body.includes('<%')) {
      rendered += entry.body.length;
      continue;
    }
    try {
      rendered += renderEjsBody(entry.body, statData.stat_data).length;
    } catch {
      renderFailures++;
      rendered += entry.body.length; // 渲染失败回落上界，不静默吞掉
    }
  }
  console.log(
    `${context.label.padEnd(14)} ②门控前上界 ${String(upperBound).padStart(7)} 字符 ≈ ${String(toTokens(upperBound)).padStart(6)} tok` +
      `   ③实际渲染 ${String(rendered).padStart(7)} 字符 ≈ ${String(toTokens(rendered)).padStart(6)} tok` +
      `   较静态省 ${staticTotal - rendered} 字符 ≈ ${toTokens(staticTotal - rendered)} tok` +
      (renderFailures ? `   ⚠ ${renderFailures} 条渲染失败已按上界计入` : ''),
  );
}

console.log('\n说明：① 是卡面/世界书面板的静态求和（含未渲染 EJS 分支）；② 是 @@if 门控裁剪后的上界；');
console.log('③ 在 ② 基础上对正文做迷你 EJS 渲染（未生效分支不计入），最接近真实注入；请以对 API 实际发出的 prompt 为准。');
