// Counterfeit · 对话渲染解析器无头测试（node --test）
// 覆盖：合法行解析 / 内心标记 / 情绪词池命中 / 未知情绪 / 未知角色占位 /
//       非法行不渲染（竖线缺失、方括号嵌套、行内混入文字）/ <update> 块共存 /
//       <p> 包裹与 <br> 分隔两种落位 / HTML 转义防注入
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const { parseBubbleLine, renderBubblesInHtml, renderMessageHtml, parseSceneHeader, buildInjectionText, MOOD_MAP, AVATAR_TABLE, KNOWN_NO_AVATAR } = require(
  path.join(here, '..', '脚本', '对话渲染.js'),
);

test('parseBubbleLine 解析标准台词行', () => {
  const got = parseBubbleLine('@bubble:雪之下雪乃|平静|[车来了。]');
  assert.deepEqual(got, { name: '雪之下雪乃', mood: '平静', text: '车来了。', isInner: false });
});

test('parseBubbleLine 解析内心行（外层 *...*）', () => {
  const got = parseBubbleLine('@bubble:比企谷八幡|无奈|[*（又来了，这种气氛。）*]');
  assert.deepEqual(got, { name: '比企谷八幡', mood: '无奈', text: '（又来了，这种气氛。）', isInner: true });
});

test('parseBubbleLine 容忍全角竖线与首尾空白', () => {
  const got = parseBubbleLine('  @bubble:由比滨结衣｜开心｜[小企来了哦～]  ');
  assert.equal(got.name, '由比滨结衣');
  assert.equal(got.mood, '开心');
  assert.equal(got.isInner, false);
});

test('parseBubbleLine 拒绝缺段/嵌套方括号/空情绪', () => {
  assert.equal(parseBubbleLine('@bubble:雪之下雪乃|[没有情绪段]'), null);
  assert.equal(parseBubbleLine('@bubble:雪之下雪乃|平静|[套[娃]括号]'), null);
  assert.equal(parseBubbleLine('@bubble:雪之下雪乃||[空情绪]'), null);
  assert.equal(parseBubbleLine('普通叙述行，不带标记'), null);
  assert.equal(parseBubbleLine('@bubble: |平静|[空名字]'), null);
});

test('renderBubblesInHtml 渲染 <p> 包裹的气泡行', () => {
  const input = '<p>她放下茶杯。</p><p>@bubble:雪之下雪乃|平静|[车来了。]</p>';
  const { html, count } = renderBubblesInHtml(input, name => AVATAR_TABLE[name] || null);
  assert.equal(count, 1);
  assert.match(html, /class="cf-bub"/);
  assert.match(html, /雪之下雪乃/);
  assert.match(html, /车来了。/);
  assert.match(html, /yukino\.webp/);
  assert.match(html, /<p>她放下茶杯。<\/p>/); // 叙述段落原样保留
});

test('renderBubblesInHtml 渲染 <br> 分隔的独立行', () => {
  const input = '八幡叹了口气。<br>@bubble:比企谷八幡|无奈|[知道了知道了。]<br>他站起身。';
  const { html, count } = renderBubblesInHtml(input, () => null);
  assert.equal(count, 1);
  assert.match(html, /cf-bub-bubble/);
  assert.match(html, /八幡叹了口气。<br>/);
  assert.match(html, /<br>他站起身。/);
});

test('renderBubblesInHtml 内心行带 inner 变体与虚线标签', () => {
  const input = '<p>@bubble:比企谷八幡|平静|[*（无所谓。）*]</p>';
  const { html, count } = renderBubblesInHtml(input, () => null);
  assert.equal(count, 1);
  assert.match(html, /cf-bub-inner/);
  assert.match(html, /内心/);
  assert.doesNotMatch(html, /\*（/); // 星号标记不进入渲染产物
});

test('renderBubblesInHtml 行内混入其他文字时不渲染（保原文）', () => {
  const input = '<p>然后她说 @bubble:雪之下雪乃|平静|[车来了。] 就转身了</p>';
  const { html, count } = renderBubblesInHtml(input, () => null);
  assert.equal(count, 0);
  assert.equal(html, input);
});

test('renderBubblesInHtml 不触碰 <update> 变量块', () => {
  const update = '<update><stat_data><characters><雪之下雪乃><bond>42</bond></雪之下雪乃></characters></stat_data></update>';
  const input = `<p>@bubble:户冢彩加|开心|[赢了！]</p>${update}`;
  const { html, count } = renderBubblesInHtml(input, name => AVATAR_TABLE[name] || null);
  assert.equal(count, 1);
  assert.ok(html.includes(update), 'update 块必须逐字节保留');
});

test('renderBubblesInHtml 未知角色渲染首字占位而非崩图', () => {
  const input = '<p>@bubble:男同学A|慌张|[清、清野同学来了！]</p>';
  const { html, count } = renderBubblesInHtml(input, name => AVATAR_TABLE[name] || null);
  assert.equal(count, 1);
  assert.match(html, /cf-bub-avatar-fallback/);
  assert.match(html, />男</); // 占位用名字首字
});

test('renderBubblesInHtml 未知情绪用灰描边，词池情绪用组色', () => {
  const known = renderBubblesInHtml('<p>@bubble:一色彩羽|心动|[……前辈你个笨蛋。]</p>', () => null);
  assert.match(known.html, new RegExp(MOOD_MAP['心动'].color.replace('#', '#')));
  const unknown = renderBubblesInHtml('<p>@bubble:一色彩羽|微妙|[不在词池的词]</p>', () => null);
  assert.equal(unknown.count, 1); // 仍渲染
  assert.match(unknown.html, /#b8a6ab/); // 灰 fallback
});

test('renderBubblesInHtml 含尖括号的台词行不渲染（不引入新注入面）', () => {
  const input = '<p>@bubble:雪之下雪乃|平静|[<img src=x onerror=alert(1)>]</p>';
  const { html, count } = renderBubblesInHtml(input, () => null);
  assert.equal(count, 0); // 正则拒绝跨 < 匹配，整行原样保留，交由酒馆自身的 sanitize 处理
  assert.equal(html, input);
});

test('renderBubblesInHtml 台词中的引号与 & 被转义', () => {
  const input = '<p>@bubble:雪之下雪乃|平静|[他说 "你好" & 再见]</p>';
  const { html, count } = renderBubblesInHtml(input, () => null);
  assert.equal(count, 1);
  assert.match(html, /&quot;你好&quot;/);
  assert.match(html, /&amp;/);
  assert.doesNotMatch(html, /\[他说/); // 方括号标记不进入产物
});

/* ── markdown（showdown）容错：酒馆消息先过 markdown，[*内心*] 会被吃成 <em> ── */

test('renderBubblesInHtml <em> 整段包裹 ≡ 内心标记（showdown 吃掉星号的实测形态）', () => {
  const input = '<p>@bubble:雪之下雪乃|嫌弃|[<em>这种多余的关注，真是不知所谓。</em>]</p>';
  const { html, count } = renderBubblesInHtml(input, () => null);
  assert.equal(count, 1);
  assert.match(html, /cf-bub-inner/);
  assert.match(html, /这种多余的关注，真是不知所谓。/);
  assert.doesNotMatch(html, /@bubble/); // 行已被替换
});

test('renderBubblesInHtml <em>+星号双重包裹也识别为内心', () => {
  const input = '<p>@bubble:比企谷八幡|无奈|[<em>*（又来了。）*</em>]</p>';
  const { html, count } = renderBubblesInHtml(input, () => null);
  assert.equal(count, 1);
  assert.match(html, /cf-bub-inner/);
  assert.match(html, /（又来了。）/);
  assert.doesNotMatch(html, /\*/);
});

test('renderBubblesInHtml 台词中段 <em> 保留为斜体且仍是台词气泡', () => {
  const input = '<p>@bubble:雪之下雪乃|平静|[你的借口，我觉得<em>很低级</em>。]</p>';
  const { html, count } = renderBubblesInHtml(input, () => null);
  assert.equal(count, 1);
  assert.doesNotMatch(html, /cf-bub-inner/); // 不是内心
  assert.match(html, /<em class="cf-bub-em">很低级<\/em>/); // 强调保留为斜体
  assert.doesNotMatch(html, /&lt;em/); // 标签不裸露
});

test('renderBubblesInHtml 全角冒号 @bubble： 同权接受', () => {
  const input = '<p>@bubble：雪之下雪乃|平静|[车来了。]</p>';
  const { html, count } = renderBubblesInHtml(input, () => null);
  assert.equal(count, 1);
  assert.match(html, /cf-bub-bubble/);
});

test('renderBubblesInHtml \\n 分隔的混排段落（不开 simpleLineBreaks 的 showdown 形态）', () => {
  const input = '<p>她走过来。\n@bubble:雪之下雪乃|嫌弃|[<em>这种多余的关注。</em>]\n观察她的外观：金发。</p>';
  const { html, count } = renderBubblesInHtml(input, () => null);
  assert.equal(count, 1);
  assert.match(html, /cf-bub-inner/);
  assert.match(html, /她走过来。\n/); // 前后叙述原样保留
  assert.match(html, /\n观察她的外观：金发。<\/p>/);
});

test('renderBubblesInHtml <p> 开头即气泡行的混排段落也能命中（<p> 边界）', () => {
  const input = '<p>@bubble:由比滨结衣|开心|[小企！]\n她挥了挥手。</p>';
  const { html, count } = renderBubblesInHtml(input, () => null);
  assert.equal(count, 1);
  assert.match(html, /\n她挥了挥手。<\/p>/);
});

test('renderBubblesInHtml 非 em/i 的标签仍拒绝渲染（注入面不扩大）', () => {
  const input = '<p>@bubble:雪之下雪乃|平静|[<span onclick=alert(1)>x</span>]</p>';
  const { html, count } = renderBubblesInHtml(input, () => null);
  assert.equal(count, 0);
  assert.equal(html, input);
});

/* ── 场景头横幅：【时间|地点|天气|氛围】 ── */

test('parseSceneHeader 解析四段式场景头，首段为时间', () => {
  const got = parseSceneHeader('【2013年5月20日 08:35 |总武高中·2年J班教室|晴朗|略带松散的好奇】');
  assert.equal(got.time, '2013年5月20日 08:35');
  assert.deepEqual(got.meta, ['总武高中·2年J班教室', '晴朗', '略带松散的好奇']);
});

test('parseSceneHeader 拒绝单段/两段与含尖括号', () => {
  assert.equal(parseSceneHeader('【2013年5月20日】'), null);
  assert.equal(parseSceneHeader('【时间|地点】'), null);
  assert.equal(parseSceneHeader('【时间|地<b>点</b>|天气】'), null);
  assert.equal(parseSceneHeader('普通行'), null);
});

test('renderMessageHtml 场景头渲染为横幅且旁白段落原样保留', () => {
  const input = '<p>【2013年5月20日 10:45|总武高中中庭|晴|安静的试探】</p><p>阳光穿过繁密的叶隙。</p>';
  const { html, count, banners } = renderMessageHtml(input, () => null);
  assert.equal(count, 0);
  assert.equal(banners, 1);
  assert.match(html, /cf-scene-banner/);
  assert.match(html, /cf-scene-time">2013年5月20日 10:45</);
  assert.match(html, /总武高中中庭/);
  assert.match(html, /<p>阳光穿过繁密的叶隙。<\/p>/);
});

test('renderMessageHtml 同一条消息里场景头 + 多个气泡 + 旁白共存', () => {
  const input = '<p>【2013年5月20日 10:45|总武高中中庭|晴|安静的试探】</p>'
    + '<p>一阵脚步声由远及近。</p>'
    + '<p>@bubble:拉芙希妮·都柏林|平静|[……雪之下同学。]</p>'
    + '<p>我停了半拍。</p>'
    + '<p>@bubble:雪之下雪乃|平静|[距离第三节课的预备铃还有三分钟。]</p>'
    + '<p>@bubble:雪之下雪乃|冷静|[<em>这行译文显得有些哀伤。</em>]</p>';
  const { html, count, banners } = renderMessageHtml(input, () => null);
  assert.equal(banners, 1);
  assert.equal(count, 3, '同一条消息的多个气泡必须全部渲染');
  assert.match(html, /cf-scene-banner/);
  assert.match(html, /cf-bub-inner/); // em 包裹的内心
  assert.match(html, /<p>一阵脚步声由远及近。<\/p>/);
  assert.match(html, /<p>我停了半拍。<\/p>/);
});

test('renderMessageHtml 单竖线【】不误判为场景头', () => {
  const input = '<p>【奉仕部】的门开着。</p>';
  const { html, banners } = renderMessageHtml(input, () => null);
  assert.equal(banners, 0);
  assert.equal(html, input);
});

/* ── 注入文本：NPC 台词也必须走 @bubble（2026-08-18 用户实报班主任台词没渲染） ── */

test('buildInjectionText 要求 NPC 台词走 @bubble 且正文不直写引号台词', () => {
  const text = buildInjectionText();
  assert.match(text, /NPC（班主任、店员、乘务员等）同样适用/);
  assert.match(text, /凡是对白一律改写成 @bubble 行/);
  assert.match(text, /身份占位名（班主任／店员／乘务员/);
  assert.match(text, /？？？/);
});

test('buildInjectionText 保留契约兼容声明与完整情绪词池', () => {
  const text = buildInjectionText();
  assert.match(text, /第一人称视点、内心触发机制（未命中不写内心）、MVU 变量更新块/);
  assert.match(text, /雀跃/); // 词池抽查
  assert.match(text, /雪之下雪乃/); // 具名角色清单
  assert.match(text, /变量更新块与其他系统标签原样输出/);
});

test('头像表与无头像名单不重叠且键名齐全', () => {
  for (const name of KNOWN_NO_AVATAR) {
    assert.equal(AVATAR_TABLE[name], undefined, `${name} 不应有预置头像`);
  }
  for (const required of ['比企谷八幡', '雪之下雪乃', '由比滨结衣', '拉芙希妮·都柏林', '材木座义辉', '海老名姬菜', '相模南', '折本香织', '户部翔', '雪之下夫人']) {
    assert.ok(AVATAR_TABLE[required], `缺少 ${required} 的预置头像`);
    assert.match(AVATAR_TABLE[required], /^https:\/\/cdn\.jsdelivr\.net\//);
  }
});
