/**
 * Counterfeit · 对话渲染系统 v1.0（精简定制版）
 * 参考别卡「对话渲染系统 v7.1」的机制，按 Counterfeit 的闭世界观与输出契约裁剪：
 *   - 格式注入：injectPrompts 三层降级（→ setExtensionPrompt → 警告），CHAT_CHANGED 重注
 *   - DOM 渲染：MutationObserver + 酒馆助手事件双驱动，把 @bubble 行渲染成樱花护眼气泡
 *   - 正文美化：渲染过气泡的消息整体铺羊皮纸卡片（可切 羊皮纸/暗夜/豆沙绿 三主题，面板切换）
 *   - 头像：20 名角色 CDN 预置（状态栏同源 512×512）+ 面板自定义（URL / 本地上传 IndexedDB）
 *   - 不做：情绪差分头像、CG 图库、字体管理（v7.1 的这些模块本卡用不上）
 * 与卡内契约的兼容：MVU <update> 变量块、第一人称视点、内心触发机制全部照旧——
 * 注入文本里显式声明"只改排版不改规则"，渲染只匹配 @bubble 行，不触碰其他内容。
 *
 * 纯函数段（parseBubbleLine / renderBubblesInHtml / MOOD_MAP / AVATAR_TABLE）
 * 以 UMD 尾导出，供 build_tools/test_dialogue_renderer.mjs 无头测试。
 */

// ████████████████████████████████████████████████████████████
// █  Part 0: 纯函数段（node 可测，无 DOM 依赖）               █
// ████████████████████████████████████████████████████████████

/** 情绪词池：8 组 108 词（与注入文本逐字一致，改词必须两边同步） */
const MOOD_GROUPS = Object.freeze([
  { id: 'joy',     label: '喜悦', color: '#e8a13d', words: ['开心', '欢喜', '欣喜', '愉悦', '满足', '幸福', '甜蜜', '狂喜', '兴奋', '雀跃', '畅快', '陶醉', '得意', '骄傲', '自豪', '自信'] },
  { id: 'anger',   label: '愤怒', color: '#d9534f', words: ['愤怒', '暴怒', '气愤', '愤慨', '暴躁', '怨恨', '敌意', '恼火', '窝火', '生气', '烦躁', '烦闷'] },
  { id: 'sad',     label: '悲伤', color: '#5b8dd9', words: ['难过', '伤心', '心酸', '忧伤', '惆怅', '失落', '低落', '沮丧', '悲伤', '心痛', '悲痛', '痛苦', '委屈', '不甘', '失望', '受伤', '孤独', '寂寞', '落寞'] },
  { id: 'anxious', label: '紧张', color: '#c9a227', words: ['焦虑', '紧张', '不安', '忐忑', '担忧', '慌张', '焦躁', '害怕', '恐惧', '惊恐', '畏惧', '胆怯', '心慌', '警惕', '戒备'] },
  { id: 'calm',    label: '平和', color: '#58a86b', words: ['平静', '淡然', '冷静', '沉稳', '从容', '坦然', '淡定', '温馨', '舒畅', '惬意', '温暖', '欣慰', '释然', '感动', '感恩'] },
  { id: 'shy',     label: '害羞', color: '#45b3c4', words: ['害羞', '尴尬', '窘迫', '难堪', '困惑', '迷茫', '疑惑', '纠结', '犹豫', '无奈', '无语'] },
  { id: 'disgust', label: '嫌弃', color: '#9b7ed9', words: ['厌恶', '嫌弃', '鄙视', '反感', '排斥', '抗拒', '不屑', '冷淡', '冷漠', '疏离', '麻木'] },
  { id: 'love',    label: '爱恋', color: '#e87a90', words: ['喜欢', '爱慕', '迷恋', '倾慕', '宠溺', '依恋', '心动', '认真'] },
]);

/** 情绪词 → {color, label, groupId} */
const MOOD_MAP = (() => {
  const map = {};
  for (const group of MOOD_GROUPS) {
    for (const word of group.words) {
      map[word] = { color: group.color, label: group.label, group: group.id };
    }
  }
  return Object.freeze(map);
})();

/** CDN 头像根（与 前端工程/src/Counterfeit/config.ts 的 STATUS_AVATAR_BASE 同仓库同 commit，改 commit 两边同步） */
const AVATAR_BASE = 'https://cdn.jsdelivr.net/gh/qmsdaa/tavern_helper_template_cdn@0fa8d8a2aea96fb68f9877263ab3b5fe8c0ee353/assets/Counterfeit/状态栏/avatars';

/** 规范全名 → 头像文件名（与 状态栏/utils.ts PORTRAIT_KEYS 同构，缺素材的角色不在此列） */
const AVATAR_KEYS = Object.freeze({
  '比企谷八幡': 'hachiman',
  '雪之下雪乃': 'yukino',
  '由比滨结衣': 'yui',
  '拉芙希妮·都柏林': 'laff',
  '一色彩羽': 'iroha',
  '三浦优美子': 'yumiko',
  '叶山隼人': 'hayama',
  '平冢静': 'shizuka',
  '户冢彩加': 'saika',
  '雪之下阳乃': 'haruno',
  '爱布拉娜·都柏林': 'eblana',
  '爱布拉娜': 'eblana',
  '比企谷小町': 'komachi',
  '川崎沙希': 'saki',
  '雪之下夫人': 'mrs_yukinoshita',
  '材木座义辉': 'zaimokuza',
  '海老名姬菜': 'ebina',
  '相模南': 'sagami',
  '折本香织': 'orimoto',
  '户部翔': 'tobe',
});

/** 预置头像表：规范全名 → 完整 URL */
const AVATAR_TABLE = (() => {
  const table = {};
  for (const [name, key] of Object.entries(AVATAR_KEYS)) {
    table[name] = `${AVATAR_BASE}/${key}.webp`;
  }
  return Object.freeze(table);
})();

/** 其他可识别但无预置头像的具名角色（渲染为首字占位，注入清单里列出以便模型使用全名） */
const KNOWN_NO_AVATAR = Object.freeze(['大和', '大冈', '城廻巡', '玉绳', '由比滨母亲', '鹤见留美', '川崎京华']);

/**
 * 解析单行 @bubble 标记。
 * 合法形态：@bubble:名字|情绪|[台词]  ·  @bubble:名字|情绪|[*内心*]
 * 名字/情绪允许竖线、尖括号以外的任意非空白符；台词不允许嵌套方括号。
 * markdown 容错（showdown 实测行为，2026-08-18）：
 *   - 内心标记 [*...*] 的星号会被 markdown 吃成 <em>：[@bubble:…|[<em>内心</em>]]
 *     → 整段 <em>/<i> 包裹 ≡ 内心标记，照内心渲染；
 *   - 台词中段的 *强调* 会变成残留 <em> 标签 → 渲染时还原为斜体，不影响匹配；
 *   - 模型偶发全角冒号 @bubble： → 与半角同权接受。
 * @returns {{name:string, mood:string, text:string, isInner:boolean} | null}
 */
/** 内容段字符集：禁嵌套方括号/换行/其他标签，仅放行 <em>/<i>（markdown 强调残留） */
const BUBBLE_CONTENT_SRC = '((?:[^\\[\\]<>\\n]|<\\/?(?:em|i)>)*)';
const BUBBLE_LINE_RE = new RegExp(`^@bubble[:：]([^|｜<\\s][^|｜<]*)[|｜]([^|｜<\\s][^|｜<]*)[|｜]\\[${BUBBLE_CONTENT_SRC}\\]\\s*$`, 'i');

function parseBubbleLine(line) {
  if (typeof line !== 'string') return null;
  const trimmed = line.trim();
  const match = BUBBLE_LINE_RE.exec(trimmed);
  if (!match) return null;
  const [, rawName, rawMood, rawText] = match;
  const name = rawName.trim();
  const mood = rawMood.trim();
  if (!name || !mood) return null;
  let text = rawText;
  let isInner = false;
  // 整段 <em>/<i> 包裹 = markdown 吃掉星号后的内心标记
  const emWrap = /^\s*<(?:em|i)>([\s\S]*?)<\/(?:em|i)>\s*$/i.exec(text);
  if (emWrap) {
    isInner = true;
    text = emWrap[1];
  }
  const starWrap = /^\s*\*([\s\S]*)\*\s*$/.exec(text);
  if (starWrap) {
    isInner = true;
    text = starWrap[1];
  }
  return { name, mood, text, isInner };
}

/** HTML 转义（渲染用户/模型文本时必须过这道） */
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 台词文本渲染：残留的 <em>/<i> 还原为安全斜体标签，其余一律转义（占位符两步走，防注入） */
function renderBubbleText(raw) {
  const OPEN = '\u0001';
  const CLOSE = '\u0002';
  const placeholdered = String(raw)
    .replace(/<(?:em|i)>/gi, OPEN)
    .replace(/<\/(?:em|i)>/gi, CLOSE);
  return escapeHtml(placeholdered)
    .replaceAll(OPEN, '<em class="cf-bub-em">')
    .replaceAll(CLOSE, '</em>');
}

/** 单条气泡的 HTML（avatarUrl 为 null 时渲染首字占位；url 也过转义防注入） */
function bubbleHtml(bubble, avatarUrl) {
  const mood = MOOD_MAP[bubble.mood];
  const ringColor = mood ? mood.color : '#b8a6ab';
  const moodLabel = mood ? mood.label : '情绪未定';
  const safeName = escapeHtml(bubble.name);
  const avatarPart = avatarUrl
    ? `<img class="cf-bub-avatar-img" src="${escapeHtml(avatarUrl)}" alt="${safeName}" loading="lazy" />`
    : `<span class="cf-bub-avatar-fallback">${escapeHtml(bubble.name.replace(/[？\s]/g, '').charAt(0) || '？')}</span>`;
  const innerClass = bubble.isInner ? ' cf-bub-inner' : '';
  const innerTag = bubble.isInner ? '<span class="cf-bub-inner-tag">内心</span>' : '';
  return `<div class="cf-bub${innerClass}" data-name="${safeName}">`
    + `<div class="cf-bub-avatar" style="--cf-ring:${ringColor}" title="${safeName} · ${moodLabel}">${avatarPart}</div>`
    + `<div class="cf-bub-main">`
    + `<div class="cf-bub-plate"><span class="cf-bub-name">${safeName}</span>`
    + `<span class="cf-bub-mood" style="--cf-mood:${ringColor}">${escapeHtml(bubble.mood)}</span>${innerTag}</div>`
    + `<div class="cf-bub-bubble">${renderBubbleText(bubble.text)}</div>`
    + `</div></div>`;
}

/**
 * 在一条消息的 HTML 里渲染全部 @bubble 行（纯字符串变换，DOM 侧与测试共用）。
 * 匹配落位：独占 <p> 段落、<br> 分隔的独立行、\n 分隔的独立行（showdown 不开
 * simpleLineBreaks 时单行换行保留为字面 \n）；不匹配行中混入其他文字的情况（保原文）。
 * 匹配是"宽松圈定 + parseBubbleLine 严格校验"两道门：<em> 包裹的内心、全角冒号都能过，
 * 混入其他标签/文字的行保原文。<update> 等系统块不含 @bubble 行，天然不受影响。
 * @param {string} html 消息 innerHTML
 * @param {(name:string)=>(string|null)} avatarOf 头像解析（可注入自定义表）
 * @returns {{html:string, count:number}} count=0 表示没有任何替换
 */
function renderBubblesInHtml(html, avatarOf) {
  if (typeof html !== 'string' || (html.indexOf('@bubble:') === -1 && html.indexOf('@bubble：') === -1)) {
    return { html, count: 0 };
  }
  let count = 0;
  const resolve = typeof avatarOf === 'function' ? avatarOf : () => null;
  const replaceLine = (whole, line) => {
    const bubble = parseBubbleLine(line);
    if (!bubble) return whole;
    count += 1;
    return bubbleHtml(bubble, resolve(bubble.name));
  };
  // 段落包裹形态：<p>@bubble:...</p>（宽松圈定段落内容，严格校验交给 parseBubbleLine）
  let out = html.replace(
    /<p>((?:\s|&nbsp;)*@bubble[:：][\s\S]*?)<\/p>/gi,
    (whole, inner) => replaceLine(whole, inner.replace(/&nbsp;/g, ' ')),
  );
  // 独立行形态：行首（<br> 后 / <p> 后 / \n 后 / 串首）到行尾（<br> 前 / </p> 前 / \n 前 / 串尾）
  out = out.replace(
    /(^|<br\s*\/?>|<p[^>]*>|\r?\n)((?:[ \t]|&nbsp;)*@bubble[:：][^\n]*?)(?=<br\s*\/?>|<\/p>|\r?\n|$)/gi,
    (whole, br, line) => {
      const cleaned = line.replace(/&nbsp;/g, ' ');
      const bubble = parseBubbleLine(cleaned);
      if (!bubble) return whole;
      count += 1;
      return br + bubbleHtml(bubble, resolve(bubble.name));
    },
  );
  return { html: out, count };
}

/* ===== 场景头横幅：【时间|地点|天气|氛围】（≥2 竖线、单行、不含尖括号） ===== */
const SCENE_HEADER_RE = /^【((?:[^【】|｜<\n]+[|｜]){2,}[^【】|｜<\n]+)】$/;
const SCENE_HEADER_BODY_SRC = '【(?:[^【】|｜<\\n]+[|｜]){2,}[^【】|｜<\\n]+】';

function parseSceneHeader(line) {
  if (typeof line !== 'string') return null;
  const m = SCENE_HEADER_RE.exec(line.trim());
  if (!m) return null;
  const fields = m[1].split(/[|｜]/).map(s => s.trim()).filter(Boolean);
  if (fields.length < 3) return null;
  return { time: fields[0], meta: fields.slice(1) };
}

function sceneHeaderHtml(header) {
  const meta = header.meta.map(escapeHtml).join('<span class="cf-scene-sep">·</span>');
  return `<div class="cf-scene-banner"><span class="cf-scene-time">${escapeHtml(header.time)}</span><span class="cf-scene-meta">${meta}</span></div>`;
}

/**
 * 消息级渲染组合：场景头横幅 + @bubble 气泡（旁白段落样式由 DOM 侧 cf-bub-host 类承担）。
 * 两种标记不相交，顺序无关；都没有时原样返回。
 * @returns {{html:string, count:number, banners:number}}
 */
function renderMessageHtml(html, avatarOf) {
  if (typeof html !== 'string') return { html, count: 0, banners: 0 };
  let banners = 0;
  // 场景头落位一：独占 <p> 段落
  let out = html.replace(
    new RegExp(`<p>((?:\\s|&nbsp;)*${SCENE_HEADER_BODY_SRC}(?:\\s|&nbsp;)*)<\\/p>`, 'g'),
    (whole, inner) => {
      const header = parseSceneHeader(inner.replace(/&nbsp;/g, ' '));
      if (!header) return whole;
      banners += 1;
      return sceneHeaderHtml(header);
    },
  );
  // 场景头落位二：独立行（<br> / <p> / \n 边界）
  out = out.replace(
    new RegExp(`(^|<br\\s*\\/?>|<p[^>]*>|\\r?\\n)((?:[ \\t]|&nbsp;)*${SCENE_HEADER_BODY_SRC})(?=<br\\s*\\/?>|<\\/p>|\\r?\\n|$)`, 'g'),
    (whole, br, line) => {
      const header = parseSceneHeader(line.replace(/&nbsp;/g, ' '));
      if (!header) return whole;
      banners += 1;
      return br + sceneHeaderHtml(header);
    },
  );
  const { html: bubbled, count } = renderBubblesInHtml(out, avatarOf);
  return { html: bubbled, count, banners };
}

// node 无头测试导出（酒馆沙箱里 module 不存在，跳过即可）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { parseBubbleLine, renderBubblesInHtml, renderBubbleText, renderMessageHtml, parseSceneHeader, buildInjectionText, MOOD_GROUPS, MOOD_MAP, AVATAR_TABLE, KNOWN_NO_AVATAR, escapeHtml };
}

// ████████████████████████████████████████████████████████████
// █  Part 1: 注入文本（Counterfeit 定制格式规则）             █
// ████████████████████████████████████████████████████████████

const PROMPT_INJECTION_ID = 'counterfeit-bubble-format';

/**
 * 设置面板 URL。
 * 发布到社区前，请把 DEFAULT_PANEL_URL 替换为你上传的 CDN 地址。
 * 本地开发时可在浏览器控制台执行：
 *   localStorage.setItem('cf_bubble_panel_url', 'http://localhost:6621/dist/Counterfeit/界面/对话渲染/index.html')
 * 然后刷新页面即可覆盖。
 */
const DEFAULT_PANEL_URL = 'https://cdn.jsdelivr.net/gh/qmsdaa/tavern_helper_template_cdn@latest/dist/Counterfeit/界面/对话渲染/index.html';
const PANEL_URL = (() => {
  try {
    return localStorage.getItem('cf_bubble_panel_url') || DEFAULT_PANEL_URL;
  } catch (_) {
    return DEFAULT_PANEL_URL;
  }
})();
const PANEL_ORIGIN = new URL(PANEL_URL).origin;

function buildMoodPoolText() {
  return MOOD_GROUPS.map(group => `【${group.label}】${group.words.join('、')}`).join('\n');
}

function buildInjectionText() {
  const castNames = Object.keys(AVATAR_KEYS).filter(name => name !== '爱布拉娜').concat([...KNOWN_NO_AVATAR]);
  return `[对话气泡排版规则——在既有输出契约之上叠加，优先级低于一切世界观/禁则/视点规则]
本规则只改变台词与内心的排版，其余一切照旧：第一人称视点、内心触发机制（未命中不写内心）、MVU 变量更新块、称呼规范与禁则全部不受影响。

1. 任何角色开口说话，台词都必须单独占一行，写成：@bubble:角色名|情绪|[台词]——这条对只出场一次的 NPC（班主任、店员、乘务员等）同样适用；正文里不要出现用引号直接包裹的台词，凡是对白一律改写成 @bubble 行
2. 视点角色的内心活动仅在内心触发机制命中时输出，写成：@bubble:视点角色全名|情绪|[*内心内容*]（外层 *...* 是内心标记）
3. 情绪字段必填且只能从下方词池逐字选一个，禁止自造、改写、组合（"微笑""冷笑""有点开心"都不合法）：
${buildMoodPoolText()}
4. 具名角色必须写规范全名（例如写 雪之下雪乃 不写 雪乃），可用的具名角色：${castNames.join('、')}；NPC 用身份占位名（班主任／店员／乘务员／男同学A／女同学A 这类），完全无法辨认身份的用 ？？？
5. 叙述、动作、心理铺垫、环境描写保持原有写法，不加任何标记
6. 台词文本内不得出现 | ｜ [ ] 四种符号（用近义标点替代）
7. 变量更新块与其他系统标签原样输出，不要给它们加 @bubble 标记`;
}

// ████████████████████████████████████████████████████████████
// █  Part 2: 样式（樱花 + 护眼）                              █
// ████████████████████████████████████████████████████████████

const STYLE_TEXT = `
/* 主题变量：默认羊皮纸（var 回退值即羊皮纸色，无主题类也有护眼纸感）；dark/green 由面板切换 */
#chat.cf-theme-dark{--cf-bub-bg:#2c2226;--cf-bub-text:#e9ded9;--cf-bub-border:#524047;
  --cf-inner-bg:#292021;--cf-inner-border:#4a3d3a;--cf-inner-text:#d8c8c2;
  --cf-avatar-bg:#3a2f34;--cf-accent:#ec92a6;--cf-accent-soft:#c08a97;--cf-accent-bright:#f0a3b5;
  --cf-page-bg:#231b1f;--cf-page-text:#e6dbd5;--cf-page-border:#45343c;--cf-page-shadow:rgba(0,0,0,.35)}
#chat.cf-theme-green{--cf-bub-bg:#f1f8ec;--cf-bub-text:#44513f;--cf-bub-border:#d8e6ca;
  --cf-inner-bg:#eef5e4;--cf-inner-border:#cfdcbb;--cf-inner-text:#5c6a52;
  --cf-avatar-bg:#fbfdf6;--cf-accent:#c05a72;--cf-accent-soft:#a5737f;--cf-accent-bright:#d97a92;
  --cf-page-bg:#e6f1da;--cf-page-text:#475341;--cf-page-border:#cfdfc0;--cf-page-shadow:rgba(90,120,80,.12)}
/* 统一字体栈：优先现代系统字体，保持中文清晰可读 */
.cf-bub-host,.cf-bub{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei","WenQuanYi Micro Hei",sans-serif}
.cf-bub{display:flex;gap:12px;margin:14px 4px;align-items:flex-start;font-size:var(--cf-bubble-fs,15px);line-height:var(--cf-line-height,1.7)}
.cf-bub-avatar{flex:0 0 auto;width:36px;height:52px;border-radius:8px;padding:2px;background:var(--cf-avatar-bg,#fdfaf4);
  box-shadow:0 0 0 2px var(--cf-ring,#b8a6ab),0 2px 8px rgba(120,90,100,.12);overflow:hidden;
  display:flex;align-items:center;justify-content:center}
.cf-bub-avatar-img{width:100%;height:100%;object-fit:cover;border-radius:6px;display:block}
.cf-bub-avatar-fallback{font-size:18px;color:var(--cf-accent-soft,#a5737f);font-weight:600;user-select:none}
.cf-bub-main{flex:1 1 auto;min-width:0;max-width:80%}
.cf-bub-plate{display:flex;align-items:baseline;gap:8px;margin:0 0 5px 4px}
.cf-bub-name{color:var(--cf-accent,#c05a72);font-weight:700;font-size:14px;letter-spacing:.5px}
.cf-bub-mood{font-size:10.5px;color:var(--cf-mood,#b8a6ab);border:1px solid currentColor;border-radius:10px;
  padding:1px 7px;line-height:15px;opacity:.9;font-weight:500}
.cf-bub-inner-tag{font-size:10.5px;color:var(--cf-accent-soft,#a5737f);border:1px dashed #d9b8c0;border-radius:10px;padding:1px 7px;line-height:15px;font-weight:500}
.cf-bub-bubble{position:relative;background:var(--cf-bub-bg,#fbf5ec);color:var(--cf-bub-text,#5b4a4f);
  border:1px solid var(--cf-bub-border,#efe0e3);border-radius:4px 16px 16px 16px;
  padding:10px 14px;box-shadow:0 1px 4px rgba(140,100,110,.08);word-break:break-word;white-space:pre-wrap;
  font-size:var(--cf-bubble-fs,15px);line-height:var(--cf-line-height,1.7)}
.cf-bub-bubble::before{content:"";position:absolute;left:-6px;top:0;width:10px;height:10px;
  background:var(--cf-bub-bg,#fbf5ec);border-left:1px solid var(--cf-bub-border,#efe0e3);
  border-top:1px solid var(--cf-bub-border,#efe0e3);border-radius:2px 0 0 0;transform:skewX(-12deg)}
.cf-bub-inner .cf-bub-bubble{background:var(--cf-inner-bg,#f7f3e8);border-style:dashed;
  border-color:var(--cf-inner-border,#e3d3c6);font-style:italic;color:var(--cf-inner-text,#6b5a58)}
.cf-bub-em{font-style:italic}
/* 场景头横幅（樱粉标题 + 半透明细线，三色主题通用） */
.cf-scene-banner{text-align:center;margin:16px 8px 14px;padding:8px 4px;letter-spacing:2px;
  border-top:1px solid rgba(192,90,114,.35);border-bottom:1px solid rgba(192,90,114,.35)}
.cf-scene-time{display:block;font-size:14px;font-weight:600;color:var(--cf-accent-bright,#d97a92)}
.cf-scene-meta{display:block;font-size:11.5px;opacity:.75;margin-top:3px;letter-spacing:1px}
.cf-scene-sep{margin:0 6px;opacity:.6}
/* 正文羊皮纸卡片：渲染过气泡/横幅的消息整体铺纸感底色（与气泡同套变量，风格统一），
   纯文本段落按小说排版（首行缩进+两端对齐+舒适行距），图片段落豁免；
   #chat 前缀压过酒馆核心样式的 ID 选择器 */
#chat .cf-bub-host{background:var(--cf-page-bg,#f6efdc);color:var(--cf-page-text,#5b4a4f);
  border:1px solid var(--cf-page-border,#e7dbc0);border-radius:12px;padding:14px 16px;margin:8px 0;
  box-shadow:0 1px 6px var(--cf-page-shadow,rgba(140,110,80,.10))}
#chat .cf-bub-host>p:not(:has(img)){text-indent:2em;text-align:justify;line-height:var(--cf-line-height,1.75);margin:8px 2px;font-size:var(--cf-narrative-fs,13.5px);opacity:.95}
.cf-bub-inner .cf-bub-bubble::before{background:var(--cf-inner-bg,#f7f3e8);
  border-color:var(--cf-inner-border,#e3d3c6);border-left-style:dashed;border-top-style:dashed}
.cf-bub-inner .cf-bub-name{color:var(--cf-accent,#b0708a)}
/* 面板 */
.cf-panel-mask{position:fixed;inset:0;background:rgba(60,40,50,.35);z-index:99990}
.cf-panel-iframe{position:fixed;top:8vh;left:50%;transform:translateX(-50%);width:min(520px,92vw);height:min(680px,84vh);border:none;border-radius:14px;z-index:99991;box-shadow:0 8px 40px rgba(90,60,70,.25);background:#fdfaf4}
`;

// ████████████████████████████████████████████████████████████
// █  Part 3: 存储（localStorage 配置 + IndexedDB 上传图）     █
// ████████████████████████████████████████████████████████████

const LS_CONFIG_KEY = 'cf_bubble_config_v1';
const LS_URL_KEY = 'cf_bubble_custom_urls_v1';
const IDB_NAME = 'CounterfeitBubbleAvatars';
const IDB_STORE = 'uploads';

function loadConfig() {
  const defaults = { enabled: true, theme: 'parchment', bubbleFontSize: 15, narrativeFontSize: 13.5, lineHeight: 1.7 };
  try {
    const raw = localStorage.getItem(LS_CONFIG_KEY);
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
  } catch (_) {
    return defaults;
  }
}

function saveConfig(config) {
  try { localStorage.setItem(LS_CONFIG_KEY, JSON.stringify(config)); } catch (_) {}
}

function loadCustomUrls() {
  try {
    return JSON.parse(localStorage.getItem(LS_URL_KEY) || '{}') || {};
  } catch (_) {
    return {};
  }
}

function saveCustomUrls(map) {
  try { localStorage.setItem(LS_URL_KEY, JSON.stringify(map)); } catch (_) {}
}

function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(IDB_STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(name, blob) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(blob, name);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbGet(name) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const req = db.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(name);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function idbDelete(name) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(name);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ████████████████████████████████████████████████████████████
// █  Part 4: 头像解析（自定义 URL > 上传图 > 预置表 > 占位）  █
// ████████████████████████████████████████████████████████████

const uploadUrlCache = new Map(); // name → objectURL

async function resolveAvatar(name) {
  const customUrls = loadCustomUrls();
  if (customUrls[name]) return customUrls[name];
  if (uploadUrlCache.has(name)) return uploadUrlCache.get(name);
  try {
    const blob = await idbGet(name);
    if (blob) {
      const url = URL.createObjectURL(blob);
      uploadUrlCache.set(name, url);
      return url;
    }
  } catch (_) {}
  return AVATAR_TABLE[name] || null;
}

/** 同步版（渲染循环用）：只看内存层，异步预取在 renderAll 前完成 */
function resolveAvatarSync(name) {
  const customUrls = loadCustomUrls();
  if (customUrls[name]) return customUrls[name];
  if (uploadUrlCache.has(name)) return uploadUrlCache.get(name);
  return AVATAR_TABLE[name] || null;
}

async function warmUploadCache(names) {
  for (const name of names) {
    if (uploadUrlCache.has(name) || AVATAR_TABLE[name] || loadCustomUrls()[name]) continue;
    try {
      const blob = await idbGet(name);
      if (blob) uploadUrlCache.set(name, URL.createObjectURL(blob));
    } catch (_) {}
  }
}

// ████████████████████████████████████████████████████████████
// █  Part 5: DOM 渲染引擎                                    █
// ████████████████████████████████████████████████████████████

// dataset 键必须是合法驼峰（带 '-' 会抛 TypeError 中断整轮渲染），落盘属性仍是 data-cf-bub-done
const RENDER_MARK = 'cfBubDone';
const originalHtmlCache = new WeakMap(); // mes_text → 最近一次“外部原文” innerHTML
const lastRenderedHtmlCache = new WeakMap(); // mes_text → 我们上一次写入的渲染产物（自写识别）

/**
 * 处理单条消息体：自写识别 + 外部写入刷新原文缓存 + 幂等重渲染。
 * 流式关键路径：流式推进时 DOM 文本变长（current !== 我们上次写入的产物）→
 * 必须把当前 DOM 重新收为原文缓存，否则拿旧缓存重渲染会把后到的正文与气泡吞掉
 * （2026-08-18 实报：同一条消息只渲染第一个气泡，后续内容不显示）。
 * force=true 跳过自写短路（头像上传图异步就位后的补渲轮用）。
 */
function processMessageElement(mesText, doc, force = false) {
  if (!(mesText instanceof doc.defaultView.Element)) return 0;
  const current = mesText.innerHTML;
  const lastRendered = lastRenderedHtmlCache.get(mesText);
  if (!force && lastRendered !== undefined && current === lastRendered) return 0; // 自写/无变化
  if (current !== lastRendered) {
    // 外部写入（流式推进 / 编辑 / 换 swipe）：当前 DOM 才是新原文
    if (!originalHtmlCache.has(mesText) && mesText.querySelector('.cf-bub')) {
      // 热重载残局：DOM 已是渲染产物但无原文缓存，跳过防叠套；但旁白排版类要补上
      originalHtmlCache.set(mesText, current);
      lastRenderedHtmlCache.set(mesText, current);
      mesText.classList.add('cf-bub-host');
      return 0;
    }
    originalHtmlCache.set(mesText, current);
  }
  const original = originalHtmlCache.get(mesText);
  const hasWork = typeof original === 'string'
    && (original.indexOf('@bubble') !== -1 || /【[^【】\n]*[|｜]/.test(original));
  if (!hasWork) {
    if (lastRendered !== current) lastRenderedHtmlCache.set(mesText, current);
    return 0;
  }
  const { html, count, banners } = renderMessageHtml(original, resolveAvatarSync);
  const total = count + banners;
  if (total > 0 && mesText.innerHTML !== html) {
    mesText.innerHTML = html;
    lastRenderedHtmlCache.set(mesText, html);
    mesText.dataset[RENDER_MARK] = '1';
    mesText.classList.add('cf-bub-host');
  } else if (total === 0 && lastRendered !== current) {
    // 有标记但无可渲染产物（如畸形 @bubble 行）：标记本轮已检查，避免每次变更都重渲染
    lastRenderedHtmlCache.set(mesText, current);
  }
  return total;
}

// 遍历宿主文档全部消息，渲染并收集出现过的角色名
function renderAllMessages(doc, force = false) {
  ensureStyle(doc);
  applyTheme(doc);
  applyConfig(doc);
  const seen = new Set();
  let rendered = 0;
  for (const mesText of doc.querySelectorAll('#chat .mes_text, #chat .mes-text')) {
    try {
      rendered += processMessageElement(mesText, doc, force);
    } catch (err) {
      // 单条消息异常不得中断整轮清扫（2026-08-18 实报：dataset 键名抛错导致后续消息延迟一轮才渲染）
      console.warn('[CF-Bubble] 渲染单条消息失败，已跳过:', err);
    }
    const source = originalHtmlCache.get(mesText) || mesText.innerHTML || '';
    for (const match of source.matchAll(/@bubble[:：]([^|｜<\n]+)[|｜]/g)) {
      seen.add(match[1].trim());
    }
  }
  return { rendered, seen };
}

let observer = null;
let debounceTimer = null;

/* 三套主题（面板切换，配置持久化在 localStorage；parchment=默认羊皮纸，变量回退值即其配色） */
const THEME_IDS = ['parchment', 'dark', 'green'];

function applyTheme(doc) {
  const chat = doc.getElementById('chat');
  if (!chat) return;
  const theme = loadConfig().theme || 'parchment';
  for (const id of THEME_IDS) {
    chat.classList.toggle(`cf-theme-${id}`, id === theme);
  }
}

function applyConfig(doc) {
  const cfg = loadConfig();
  const chat = doc.getElementById('chat');
  if (!chat) return;
  chat.style.setProperty('--cf-bubble-fs', `${cfg.bubbleFontSize}px`);
  chat.style.setProperty('--cf-narrative-fs', `${cfg.narrativeFontSize}px`);
  chat.style.setProperty('--cf-line-height', cfg.lineHeight);
}

function scheduleRender(doc) {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    if (!loadConfig().enabled) return;
    const { seen } = renderAllMessages(doc);
    warmUploadCache([...seen]).then(() => {
      // 上传图就位后强制补一轮（同步解析首轮 miss 的头像）
      if (uploadUrlCache.size > 0) renderAllMessages(doc, true);
    });
  }, 350);
}

function findHostDocument() {
  const candidates = [];
  try { if (window.top && window.top.document) candidates.push(window.top.document); } catch (_) {}
  try { if (window.parent && window.parent.document) candidates.push(window.parent.document); } catch (_) {}
  candidates.push(document);
  for (const doc of candidates) {
    try { if (doc.getElementById('chat')) return doc; } catch (_) {}
  }
  return null;
}

function ensureStyle(doc) {
  if (doc.getElementById('cf-bubble-style')) return;
  const style = doc.createElement('style');
  style.id = 'cf-bubble-style';
  style.textContent = STYLE_TEXT;
  (doc.head || doc.documentElement).appendChild(style);
}

function startObserver(doc) {
  stopObserver();
  const chat = doc.getElementById('chat');
  if (!chat) return;
  observer = new doc.defaultView.MutationObserver(mutations => {
    for (const m of mutations) {
      if (m.target && m.target.closest && m.target.closest('.cf-bub')) return; // 自身写入不回流
    }
    scheduleRender(doc);
  });
  observer.observe(chat, { childList: true, subtree: true, characterData: true });
}

function stopObserver() {
  if (observer) { observer.disconnect(); observer = null; }
}

// ████████████████████████████████████████████████████████████
// █  Part 6: 格式注入（三层降级，抄 v7.1 作业）               █
// ████████████████████████████████████████████████████████████

let injectionHandle = null;

function applyInjection() {
  if (injectionHandle) {
    try { injectionHandle.uninject(); } catch (_) {}
    injectionHandle = null;
  }
  if (!loadConfig().enabled) {
    console.log('[CF-Bubble] 已禁用，跳过注入');
    return;
  }
  const content = buildInjectionText();
  if (typeof injectPrompts === 'function') {
    try {
      injectionHandle = injectPrompts([{
        id: PROMPT_INJECTION_ID,
        position: 'in_chat',
        depth: 0,
        role: 'system',
        content,
        should_scan: false,
      }]);
      console.log('[CF-Bubble] 格式规则已通过 injectPrompts 注入');
      return;
    } catch (err) {
      console.warn('[CF-Bubble] injectPrompts 失败，尝试回退:', err);
    }
  }
  try {
    const ctx = typeof getContext === 'function' ? getContext() : null;
    if (ctx && typeof ctx.setExtensionPrompt === 'function') {
      ctx.setExtensionPrompt(PROMPT_INJECTION_ID, content, 0, 0, false, 0);
      console.log('[CF-Bubble] 格式规则已通过 setExtensionPrompt 注入');
      return;
    }
  } catch (err) {
    console.warn('[CF-Bubble] setExtensionPrompt 失败:', err);
  }
  console.warn('[CF-Bubble] ⚠ 注入未生效：injectPrompts 与 setExtensionPrompt 均不可用');
}

// ████████████████████████████████████████████████████████████
// █  Part 7: 设置与头像自定义面板                             █
// ████████████████████████████████████████████████████████████

// 当前面板 iframe 引用，用于 data URL 场景的 source 校验
let currentPanelIframe = null;

function openPanel(doc) {
  if (doc.getElementById('cf-bubble-panel-mask')) return;

  const mask = doc.createElement('div');
  mask.id = 'cf-bubble-panel-mask';
  mask.className = 'cf-panel-mask';

  const iframe = doc.createElement('iframe');
  iframe.id = 'cf-bubble-panel-iframe';
  iframe.className = 'cf-panel-iframe';
  iframe.src = `${PANEL_URL}?v=${Date.now()}`;
  iframe.setAttribute('allow', 'clipboard-read; clipboard-write');
  currentPanelIframe = iframe;

  const close = () => {
    mask.remove();
    iframe.remove();
    currentPanelIframe = null;
  };
  mask.addEventListener('click', close);

  doc.body.appendChild(mask);
  doc.body.appendChild(iframe);
}

function closePanel(doc) {
  doc.getElementById('cf-bubble-panel-mask')?.remove();
  doc.getElementById('cf-bubble-panel-iframe')?.remove();
  currentPanelIframe = null;
}

function onPanelMessage(event) {
  // data URL 面板的 origin 为 null，改用 iframe 实例校验，防止其他 iframe 冒用消息
  if (currentPanelIframe && event.source !== currentPanelIframe.contentWindow) return;
  const data = event.data;
  if (!data || data.source !== 'cf-bubble-panel') return;
  const doc = findHostDocument();
  if (!doc) return;
  if (data.type === 'config-update') {
    saveConfig({ ...loadConfig(), ...data.config });
    applyTheme(doc);
    applyConfig(doc);
    if (loadConfig().enabled) renderAllMessages(doc, true);
  } else if (data.type === 'close-panel') {
    closePanel(doc);
  } else if (data.type === 'request-config') {
    event.source.postMessage({ source: 'cf-bubble-script', type: 'init-config', config: loadConfig() }, '*');
  }
}

// ████████████████████████████████████████████████████████████
// █  Part 8: 启动                                            █
// ████████████████████████████████████████████████████████████

/**
 * 直接把「对话气泡」入口注入到 SillyTavern 魔棒菜单 DOM 中。
 * 这是从「对话渲染系统 v7.1」学到的做法：仅注册 eventOn 按钮事件并不足以让按钮
 * 在魔棒 UI 中显示，还需要在 #extensionsMenu 中 append 一个 list-group-item。
 */
function injectWandMenuItem() {
  const BTN_NAME = '对话气泡';
  const BTN_ID = 'cf-bubble-wand-btn';

  let hostDoc = null;
  const candidates = [];
  try { if (typeof window !== 'undefined' && window.top && window.top.document) candidates.push(window.top.document); } catch (_) {}
  try { if (typeof window !== 'undefined' && window.parent && window.parent.document && window.parent.document !== document) candidates.push(window.parent.document); } catch (_) {}
  candidates.push(document);

  let menu = null;
  for (const d of candidates) {
    try {
      menu = d.getElementById('extensionsMenu')
        || d.getElementById('extensions_menu')
        || d.querySelector('#extensionsMenu')
        || d.querySelector('.extensions_block .list-group');
      if (menu) { hostDoc = d; break; }
    } catch (_) {}
  }

  if (!menu) {
    setTimeout(injectWandMenuItem, 1000);
    return;
  }

  // 移除旧按钮（防止重复注入或热重载后事件失效）
  const oldBtn = hostDoc.getElementById(BTN_ID);
  if (oldBtn) oldBtn.remove();

  const mi = hostDoc.createElement('a');
  mi.id = BTN_ID;
  mi.className = 'list-group-item';
  mi.href = 'javascript:void(0)';
  mi.innerHTML = `<span class="fa-solid fa-comments"></span> ${BTN_NAME}`;
  mi.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const doc = findHostDocument();
    if (!doc) {
      console.warn('[CF-Bubble] 找不到宿主文档，无法打开面板');
      return;
    }
    openPanel(doc);
    try { menu.parentElement?.click?.(); } catch (_) {}
  });
  menu.appendChild(mi);
  console.info('[CF-Bubble] 魔棒菜单项「对话气泡」已注入');
}

function registerBubbleButton() {
  const BTN_NAME = '对话气泡';

  const tryRegister = () => {
    const on = typeof eventOn === 'function' ? eventOn : (typeof window !== 'undefined' && typeof window.eventOn === 'function' ? window.eventOn : null);
    const getBtn = typeof getButtonEvent === 'function' ? getButtonEvent : (typeof window !== 'undefined' && typeof window.getButtonEvent === 'function' ? window.getButtonEvent : null);
    if (typeof on !== 'function' || typeof getBtn !== 'function') return false;

    on(getBtn(BTN_NAME), () => {
      const doc = findHostDocument();
      if (!doc) {
        console.warn('[CF-Bubble] 找不到宿主文档，无法打开面板');
        return;
      }
      openPanel(doc);
    });
    console.info('[CF-Bubble] 魔棒按钮事件「对话气泡」已注册');
    return true;
  };

  // 全局兜底：用户可在控制台输入 openBubblePanel() 手动打开
  if (typeof window !== 'undefined' && !window.openBubblePanel) {
    window.openBubblePanel = () => {
      const doc = findHostDocument();
      if (!doc) {
        console.warn('[CF-Bubble] 找不到宿主文档，无法打开面板');
        return;
      }
      openPanel(doc);
      console.info('[CF-Bubble] 已通过 openBubblePanel() 打开面板');
    };
  }

  if (tryRegister()) return;
  const events = typeof tavern_events !== 'undefined' ? tavern_events : (typeof window !== 'undefined' ? window.tavern_events : undefined);
  if (events && events.APP_READY) {
    const on = typeof eventOn === 'function' ? eventOn : (typeof window !== 'undefined' && typeof window.eventOn === 'function' ? window.eventOn : null);
    if (typeof on === 'function') {
      on(events.APP_READY, () => {
        if (!tryRegister()) console.warn('[CF-Bubble] APP_READY 后按钮事件注册仍失败');
      });
      return;
    }
  }
  console.warn('[CF-Bubble] 按钮事件注册条件不满足，将在 2 秒后重试');
  setTimeout(registerBubbleButton, 2000);
}

function boot() {
  const doc = findHostDocument();
  if (!doc) {
    setTimeout(boot, 1200);
    return;
  }
  ensureStyle(doc);
  applyInjection();
  if (loadConfig().enabled) scheduleRender(doc);
  startObserver(doc);
  doc.defaultView.addEventListener('message', onPanelMessage);

  // 酒馆助手按钮：与文档查找解耦，确保在 API 就绪后注册
  registerBubbleButton();
  injectWandMenuItem();

  // 聊天切换：重注入 + 重渲染（injectPrompts 注入仅对当前聊天有效）
  try {
    const events = typeof tavern_events !== 'undefined' ? tavern_events : (typeof window !== 'undefined' ? window.tavern_events : undefined);
    const on = typeof eventOn === 'function' ? eventOn : (typeof window !== 'undefined' && typeof window.eventOn === 'function' ? window.eventOn : null);
    if (events && events.CHAT_CHANGED && typeof on === 'function') {
      on(events.CHAT_CHANGED, () => {
        applyInjection();
        const nextDoc = findHostDocument() || doc;
        if (loadConfig().enabled) scheduleRender(nextDoc);
      });
    }
  } catch (err) {
    console.warn('[CF-Bubble] CHAT_CHANGED 监听失败:', err);
  }
}

if (typeof module === 'undefined' || !module.exports) {
  if (typeof $ === 'function' && $.fn) {
    $(boot);
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}
