// Counterfeit · POV 身份守护测试（2026-08-09）
// 在 vm 沙箱中运行待嵌入的 v0.6 源模板，模拟酒馆助手 API，
// 验证守护对 <UpdateVariable>/<JSONPatch> 内 JSON Patch 数组的解析、违规身份 op 删除、
// 合法 op 保留、快照修复、防重入与去抖。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const script = fs.readFileSync(new URL('../脚本/开场白挂载.template.js', import.meta.url), 'utf8');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const clone = value => JSON.parse(JSON.stringify(value));

// ── 模拟酒馆状态 ──
const BASE_STAT = {
  campaign_id: 'main',
  campaign_revision: 1,
  campaign_completed: false,
  mode: 'custom',
  current_pov: null,
  custom_protagonist: {
    name: '测试员',
    gender: '女',
    className: '2年F班',
    identity: '普通学生',
    past: '',
    personality: '',
    appearance: '',
  },
  difficulty: '普通',
  identity_state: null,
  collection: { version: 1, cg_unlocks: {}, ending_unlocks: {} },
  current_scene: 1,
  world: { current_date: '2013-05-20', current_location: '未确认' },
  characters: {},
};

const messages = [
  { message_id: 0, role: 'assistant', message: '开局已完成的开场白正文（占位符已替换）。' },
  { message_id: 1, role: 'assistant', message: '已经开局的第一段剧情。' },
];
const floorVars = new Map([
  [0, { stat_data: clone(BASE_STAT) }],
  [1, { stat_data: clone(BASE_STAT) }],
]);
let chatVars = { stat_data: clone(BASE_STAT) };

const eventHandlers = new Map();
const calls = { setChatMessages: 0, updateVariablesWith: 0 };

function makeElement(tagName) {
  return {
    tagName: tagName.toUpperCase(),
    id: '',
    style: {},
    srcdoc: '',
    remove() {},
  };
}
const hostDocument = {
  body: { appendChild() {} },
  createElement: makeElement,
  getElementById: () => null,
  querySelector: () => null,
  addEventListener() {},
};
class FakeMutationObserver {
  constructor(callback) {
    this.callback = callback;
  }
  observe() {}
}
const topWindow = {
  document: hostDocument,
  addEventListener() {},
  visualViewport: undefined,
};

const context = {
  TextDecoder,
  Uint8Array,
  atob,
  console,
  Date,
  JSON,
  MutationObserver: FakeMutationObserver,
  setTimeout: (cb, ms) => {
    const id = setTimeout(cb, ms);
    id.unref?.();
    return id;
  },
  clearTimeout: id => clearTimeout(id),
  setInterval: cb => {
    const id = setInterval(cb, 1500);
    id.unref?.();
    return id;
  },
  tavern_events: { MESSAGE_RECEIVED: 'MESSAGE_RECEIVED', CHAT_CHANGED: 'CHAT_CHANGED', APP_READY: 'APP_READY' },
  eventOn(name, cb) {
    if (!eventHandlers.has(name)) eventHandlers.set(name, []);
    eventHandlers.get(name).push(cb);
  },
  getChatMessages(range) {
    if (typeof range === 'string' && range.includes('-')) {
      const [a, b] = range.split('-').map(Number);
      return messages.filter(m => m.message_id >= a && m.message_id <= b).map(clone);
    }
    return [messages[range]].filter(Boolean).map(clone);
  },
  getLastMessageId: () => messages.length - 1,
  getVariables(options) {
    if (options?.type === 'message') return clone(floorVars.get(options.message_id) ?? {});
    if (options?.type === 'chat') return clone(chatVars);
    return {};
  },
  async setChatMessages(next, _options) {
    calls.setChatMessages += 1;
    for (const item of next) {
      const idx = messages.findIndex(m => m.message_id === item.message_id);
      if (idx >= 0 && typeof item.message === 'string') messages[idx].message = item.message;
    }
  },
  async updateVariablesWith(updater, options) {
    calls.updateVariablesWith += 1;
    if (options?.type === 'chat') {
      chatVars = clone(updater(clone(chatVars)));
      return;
    }
    const id = options?.message_id;
    floorVars.set(id, clone(updater(clone(floorVars.get(id) ?? {}))));
  },
  async createChatMessages() {},
  async triggerSlash() {},
  showToast() {},
};
context.window = context;
context.top = topWindow;
context.parent = topWindow;
context.window.top = topWindow;
context.window.parent = topWindow;
context.window.window = context.window;

vm.runInNewContext(script, context, { filename: '开场白挂载.js' });

// ── 测试辅助 ──
function fire(name) {
  for (const cb of eventHandlers.get(name) ?? []) cb();
}

function updateBlock(patchArrayText) {
  return `<UpdateVariable>\n<Analysis>\n- 测试更新\n</Analysis>\n<JSONPatch>\n${patchArrayText}\n</JSONPatch>\n</UpdateVariable>`;
}

/** 推入一条 AI 消息并建立干净楼层快照，然后把身份污染写进楼层与聊天级变量（模拟 MVU 已应用违规 op） */
function pushPollutedAiMessage(text, pollute) {
  const id = messages.length;
  messages.push({ message_id: id, role: 'assistant', message: text });
  floorVars.set(id, { stat_data: clone(BASE_STAT) });
  if (pollute) {
    pollute(floorVars.get(id).stat_data);
    pollute(chatVars.stat_data);
  }
  return id;
}

function messageText(id) {
  return messages[id].message;
}

async function settle() {
  fire('mag_variable_update_ended');
  await sleep(2400); // 自身回写窗口 1000ms + 去抖 800ms + 余量
}

const results = [];
async function caseRun(name, fn) {
  const before = calls.setChatMessages;
  await fn();
  results.push({ name, ok: true, history_writes: calls.setChatMessages - before });
  console.info(`  ✓ ${name}`);
}

// 等守护脚本初始化 + 首次加载检查（2s 调度）完成
await sleep(2400);
assert.ok(eventHandlers.has('mag_variable_update_ended'), '守护未注册 mag_variable_update_ended');
assert.ok(eventHandlers.has('MESSAGE_RECEIVED'), '守护未注册 MESSAGE_RECEIVED 兜底');
assert.ok(eventHandlers.has('CHAT_CHANGED'), '守护未注册 CHAT_CHANGED');
const writesAfterInit = calls.setChatMessages;
assert.equal(writesAfterInit, 0, '干净开局不应触发历史改写');

// 1) 自建角色被根路径 /current_pov = "hachiman" 污染（混合数组：合法 op 必须保留）
await caseRun('根路径 /current_pov 污染被删除，合法 current_scene 保留', async () => {
  const id = pushPollutedAiMessage(
    '正文。\n' +
      updateBlock(`[
  { "op": "replace", "path": "/current_scene", "value": 2 },
  { "op": "replace", "path": "/current_pov", "value": "hachiman" }
]`),
    s => {
      s.current_pov = 'hachiman';
      s.current_scene = 2;
    });
  await settle();
  assert.ok(!messageText(id).includes('current_pov'), '违规 op 仍残留在消息原文');
  assert.ok(messageText(id).includes('/current_scene'), '合法 current_scene op 被误删');
  assert.equal(floorVars.get(id).stat_data.current_pov, null, '楼层快照未改回基线');
  assert.equal(floorVars.get(id).stat_data.current_scene, 2, '合法变量被快照修复误伤');
  assert.equal(chatVars.stat_data.current_pov, null, 'chat 级快照未改回基线');
});

// 2) /custom_protagonist 被 null 覆盖（value=null 必须能解析并删除）
await caseRun('/custom_protagonist 被 null 覆盖', async () => {
  const id = pushPollutedAiMessage(
    '正文。\n' + updateBlock('[{ "op": "replace", "path": "/custom_protagonist", "value": null }]'),
    s => {
      s.custom_protagonist = null;
    });
  await settle();
  assert.ok(!messageText(id).includes('custom_protagonist'), 'null 覆盖 op 残留');
  assert.deepEqual(floorVars.get(id).stat_data.custom_protagonist, BASE_STAT.custom_protagonist);
  assert.deepEqual(chatVars.stat_data.custom_protagonist, BASE_STAT.custom_protagonist);
});

// 3) /custom_protagonist/name 子路径污染
await caseRun('/custom_protagonist/name 子路径污染', async () => {
  const id = pushPollutedAiMessage(
    '正文。\n' + updateBlock('[{ "op": "replace", "path": "/custom_protagonist/name", "value": "比企谷八幡" }]'),
    s => {
      s.custom_protagonist = { ...s.custom_protagonist, name: '比企谷八幡' };
    });
  await settle();
  assert.ok(!messageText(id).includes('custom_protagonist'), '子路径 op 残留');
  assert.equal(floorVars.get(id).stat_data.custom_protagonist.name, '测试员');
  assert.equal(chatVars.stat_data.custom_protagonist.name, '测试员');
});

// 4) /mode 被修改
await caseRun('/mode 被修改', async () => {
  const id = pushPollutedAiMessage(
    '正文。\n' + updateBlock('[{ "op": "replace", "path": "/mode", "value": "pov" }]'),
    s => {
      s.mode = 'pov';
    });
  await settle();
  assert.ok(!messageText(id).includes('"/mode"'), 'mode op 残留');
  assert.equal(floorVars.get(id).stat_data.mode, 'custom');
  assert.equal(chatVars.stat_data.mode, 'custom');
});

await caseRun('campaign 与 collection 均由客户端守护', async () => {
  const id = pushPollutedAiMessage(
    '正文。\n' +
      updateBlock(`[
  { "op": "replace", "path": "/campaign_id", "value": "dlc_genderbend_hachiman" },
  { "op": "replace", "path": "/campaign_revision", "value": 99 },
  { "op": "insert", "path": "/collection/cg_unlocks/main:9:default", "value": true },
  { "op": "replace", "path": "/current_scene", "value": 2 }
]`),
    s => {
      s.campaign_id = 'dlc_genderbend_hachiman';
      s.campaign_revision = 99;
      s.collection.cg_unlocks['main:9:default'] = true;
      s.current_scene = 2;
    },
  );
  await settle();
  const text = messageText(id);
  assert.ok(!text.includes('campaign_id') && !text.includes('campaign_revision') && !text.includes('/collection'), '客户端所有字段仍残留');
  assert.ok(text.includes('/current_scene'), '合法场景推进被误删');
  assert.equal(floorVars.get(id).stat_data.campaign_id, 'main');
  assert.equal(floorVars.get(id).stat_data.campaign_revision, 1);
  assert.deepEqual(floorVars.get(id).stat_data.collection, BASE_STAT.collection);
});

// 5) 换场景清场（present=false）等合法 op 与违规身份 op 同数组：合法全部保留
await caseRun('换场景 present=false 合法 op 保留', async () => {
  const id = pushPollutedAiMessage(
    '正文。\n' +
      updateBlock(`[
  { "op": "replace", "path": "/current_scene", "value": 3 },
  { "op": "replace", "path": "/characters/比企谷八幡/present", "value": false },
  { "op": "replace", "path": "/characters/雪之下雪乃/present", "value": true },
  { "op": "replace", "path": "/world/current_location", "value": "总武高中·奉仕部活动室" },
  { "op": "replace", "path": "/difficulty", "value": "困难" }
]`),
    s => {
      s.difficulty = '困难';
      s.current_scene = 3;
    });
  await settle();
  const text = messageText(id);
  assert.ok(!text.includes('difficulty'), '违规 difficulty op 残留');
  assert.ok(text.includes('present'), '换场景清场 present op 被误删');
  assert.ok(text.includes('current_location'), '地点更新被误删');
  assert.equal(floorVars.get(id).stat_data.difficulty, '普通', '难度被改且未修复');
  assert.equal(floorVars.get(id).stat_data.current_scene, 3, '合法场景推进被误伤');
});

// 6) op/path/value 字段顺序打乱 + value 为对象/数组
await caseRun('字段顺序打乱 + value 为对象/数组', async () => {
  const id = pushPollutedAiMessage(
    '正文。\n' +
      updateBlock(`[
  { "path": "/current_pov", "value": "hachiman", "op": "replace" },
  { "value": { "name": "比企谷八幡", "gender": "男" }, "op": "replace", "path": "/custom_protagonist" },
  { "op": "insert", "path": "/custom_protagonist/past/-", "value": "伪造经历" },
  { "value": ["MAX咖啡"], "path": "/player/carried_items", "op": "replace" }
]`),
    s => {
      s.current_pov = 'hachiman';
    });
  await settle();
  const text = messageText(id);
  assert.ok(!text.includes('current_pov') && !text.includes('custom_protagonist'), '乱序/对象/子路径 op 残留');
  assert.ok(text.includes('carried_items'), '数组 value 的合法 op 被误删');
  assert.equal(floorVars.get(id).stat_data.current_pov, null);
});

// 7) 同一消息含多个 UpdateVariable 块（一块干净一块脏）
await caseRun('同一消息多个更新块', async () => {
  const id = pushPollutedAiMessage(
    '正文。\n' +
      updateBlock('[{ "op": "replace", "path": "/current_scene", "value": 4 }]') +
      '\n更多正文。\n' +
      updateBlock('[{ "op": "replace", "path": "/mode", "value": "pov" }]'),
    s => {
      s.mode = 'pov';
    });
  await settle();
  const text = messageText(id);
  assert.ok(!text.includes('"/mode"'), '第二块违规 op 残留');
  assert.ok(text.includes('current_scene'), '第一块合法 op 被误删');
  assert.equal((text.match(/<UpdateVariable>/g) ?? []).length, 2, '更新块结构被破坏');
  assert.equal(floorVars.get(id).stat_data.mode, 'custom');
});

// 8) 尾逗号宽容解析
await caseRun('尾逗号 JSON 宽容解析', async () => {
  const id = pushPollutedAiMessage(
    '正文。\n' + updateBlock('[{ "op": "replace", "path": "/current_pov", "value": "yui", },]'),
    s => {
      s.current_pov = 'yui';
    });
  await settle();
  assert.ok(!messageText(id).includes('current_pov'), '尾逗号块中的违规 op 残留');
  assert.equal(floorVars.get(id).stat_data.current_pov, null);
});

// 9) 完全无法解析的块：提到违规路径 → 置空；未提到 → 原样保留
await caseRun('不可解析块的安全降级', async () => {
  const benign = '正文。\n' + updateBlock('[{op: replace, path: /current_scene, value: 5}]');
  const garbage = '正文。\n' + updateBlock('[{op: replace, path: /current_pov, value: hachiman}]');
  const id2 = pushPollutedAiMessage(benign, null);
  const id = pushPollutedAiMessage(garbage, s => {
    s.current_pov = 'hachiman';
  });
  await settle();
  assert.ok(!messageText(id).includes('current_pov'), '不可解析块中的违规路径未清除');
  assert.ok(messageText(id).includes('[]'), '不可解析违规块未被置空');
  assert.ok(messageText(id2).includes('/current_scene'), '未提违规路径的不可解析块被误伤');
  assert.equal(floorVars.get(id).stat_data.current_pov, null);
  assert.equal(chatVars.stat_data.current_pov, null, 'chat 级污染未独立修复');
});

// 10) move 的 from 路径同样受保护
await caseRun('move op 的 from/path 双向保护', async () => {
  const id = pushPollutedAiMessage(
    '正文。\n' +
      updateBlock(`[
  { "op": "move", "from": "/custom_protagonist", "path": "/characters/比企谷八幡" },
  { "op": "move", "from": "/player/carried_items", "path": "/current_pov" },
  { "op": "replace", "path": "/current_scene", "value": 6 }
]`),
    s => {
      s.current_pov = 'hachiman';
    });
  await settle();
  const text = messageText(id);
  assert.ok(!text.includes('move'), '违规 move op 残留');
  assert.ok(text.includes('current_scene'), '合法 op 被误删');
});

// 11) 干净消息不触发任何历史改写
await caseRun('干净消息零改写', async () => {
  const id = pushPollutedAiMessage('正文。\n' + updateBlock('[{ "op": "replace", "path": "/current_scene", "value": 7 }]'), null);
  const before = calls.setChatMessages;
  await settle();
  assert.equal(calls.setChatMessages, before, '干净消息触发了历史改写');
  assert.ok(messageText(id).includes('current_scene'));
});

// 12) 历史重放不复发：修复后再次触发事件，不再产生新的改写
await caseRun('修复后历史重放不复发', async () => {
  const id = pushPollutedAiMessage(
    '正文。\n' + updateBlock('[{ "op": "replace", "path": "/current_pov", "value": "laff" }]'),
    s => {
      s.current_pov = 'laff';
    });
  await settle();
  assert.ok(!messageText(id).includes('current_pov'));
  const writes = calls.setChatMessages;
  await settle();
  await settle();
  assert.equal(calls.setChatMessages, writes, '修复后仍重复改写历史');
});

// 13) 去抖：连续事件合并为一次扫描
await caseRun('事件去抖合并', async () => {
  const id = pushPollutedAiMessage(
    '正文。\n' + updateBlock('[{ "op": "replace", "path": "/mode", "value": "pov" }]'),
    s => {
      s.mode = 'pov';
    });
  const before = calls.setChatMessages;
  fire('mag_variable_update_ended');
  fire('MESSAGE_RECEIVED');
  fire('mag_variable_update_ended');
  await sleep(2400);
  assert.ok(calls.setChatMessages - before <= 1, '连续事件未去抖（多次历史改写）');
  assert.ok(!messageText(id).includes('"/mode"'));
});

// 14) CHAT_CHANGED 后重查：POV 存档基线重载 + 污染修复
await caseRun('CHAT_CHANGED 重查（POV 存档基线重载）', async () => {
  // 把 0 楼基线换成 POV/雪乃存档（模拟加载另一份存档）
  floorVars.set(0, { stat_data: { ...clone(BASE_STAT), mode: 'pov', current_pov: 'yukino', custom_protagonist: null } });
  chatVars = { stat_data: { ...clone(BASE_STAT), mode: 'pov', current_pov: 'yukino', custom_protagonist: null } };
  const id = pushPollutedAiMessage(
    '正文。\n' + updateBlock('[{ "op": "replace", "path": "/current_pov", "value": "hachiman" }]'),
    s => {
      s.current_pov = 'hachiman';
    });
  fire('CHAT_CHANGED');
  await sleep(1600 + 900); // CHAT_CHANGED 调度 1500ms + 去抖余量
  assert.ok(!messageText(id).includes('current_pov'), 'CHAT_CHANGED 后未清理违规 op');
  assert.equal(floorVars.get(id).stat_data.current_pov, 'yukino', 'POV 存档基线未按 0 楼重载');
  assert.equal(chatVars.stat_data.current_pov, 'yukino');
});

console.log(JSON.stringify({ cases: results.length, all_passed: true, results }, null, 2));
process.exit(0);
