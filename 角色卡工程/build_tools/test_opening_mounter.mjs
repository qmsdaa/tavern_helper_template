import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const script = fs.readFileSync(new URL('../脚本/开场白挂载.template.js', import.meta.url), 'utf8');
assert.match(script, /，进入《错位的日常》。/, '缺少性转DLC可见路由标记');
assert.match(script, /比企谷八幡（性转）/, '缺少性转DLC角色名（POV_LABELS）');
assert.match(script, /我选择扮演比企谷八幡的意识，进入《君的名字？》。/, '缺少身体互换八幡意识标记');
assert.match(script, /我选择扮演雪之下夫人的意识，进入《君的名字？》。/, '缺少身体互换夫人意识标记');
assert.match(script, /参与主线剧情（参与方式：/, '缺少剧情自建可见路由标记');
assert.match(script, /'我将以自建角色'/, '自建标记丢失「我将以自建角色」前缀（isOpeningPayload 依赖）');
assert.match(script, /commitKind\s*===\s*['"]resume['"]/, '挂载器未区分存档续接提交');
const nodes = new Map();
const intervals = [];
const topListeners = new Map();
const calls = { generate: 0, triggerSlash: 0 };
const messages = [{ message_id: 0, role: 'assistant', message: '<OpeningUI/>' }];
const variables = new Map([
  [
    0,
    {
      stat_data: {
        campaign_id: 'main',
        campaign_revision: 1,
        campaign_completed: false,
        mode: 'pov',
        current_pov: 'yukino',
        characters: {
          比企谷八幡: {
            display_name: '八幡',
            present: false,
            known: true,
            relationship: { bond: 50, romance: 10, commitment: '未确认' },
          },
        },
      },
    },
  ],
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function makeElement(tagName) {
  return {
    tagName: tagName.toUpperCase(),
    id: '',
    style: {},
    srcdoc: '',
    remove() {
      if (this.id) nodes.delete(this.id);
    },
  };
}

const body = {
  appendChild(node) {
    if (node.id) nodes.set(node.id, node);
  },
};

const hostDocument = {
  body,
  createElement: makeElement,
  getElementById(id) {
    return nodes.get(id) ?? null;
  },
  querySelector() {
    return null;
  },
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
  addEventListener(type, callback) {
    topListeners.set(type, callback);
  },
};

const context = {
  TextDecoder,
  Uint8Array,
  atob,
  console,
  MutationObserver: FakeMutationObserver,
  setTimeout() {},
  fetch: async () => ({ ok: true, text: async () => '<!doctype html><html><body><div id="app"></div>' + 'x'.repeat(2048) + '</body></html>' }),
  setInterval(callback) {
    intervals.push(callback);
    return intervals.length;
  },
  getChatMessages(messageId) {
    return [messages[messageId]].filter(Boolean).map(clone);
  },
  getLastMessageId() {
    return messages.length - 1;
  },
  getVariables(options) {
    if (options?.type === 'message') return clone(variables.get(options.message_id) ?? {});
    return {};
  },
  async createChatMessages(nextMessages) {
    for (const item of nextMessages) {
      // 模拟酒馆消息清洗：剥除尖括号标签（2026-08-05 首条回复中止 bug 的真实触发条件）
      const sanitized = String(item.message ?? '').replace(/<[^>]*>/g, '');
      messages.push({ message_id: messages.length, ...clone(item), message: sanitized });
    }
  },
  async updateVariablesWith(updater, options) {
    const current = clone(variables.get(options.message_id) ?? {});
    variables.set(options.message_id, clone(updater(current)));
  },
  async generate() {
    calls.generate += 1;
  },
  async triggerSlash(command) {
    assert.equal(command, '/trigger');
    calls.triggerSlash += 1;
    messages.push({ message_id: messages.length, role: 'assistant', message: '自动生成的首条回复' });
  },
};
context.window = context;
context.top = topWindow;
context.parent = topWindow;
context.window.top = topWindow;
context.window.parent = topWindow;
context.window.window = context.window;

vm.runInNewContext(script, context, { filename: '开场白挂载.js' });
await new Promise(resolve => setImmediate(resolve));

const iframe = nodes.get('counterfeit-opening-iframe');
assert.ok(iframe, 'regex-less raw greeting did not mount the opening iframe');
assert.match(iframe.srcdoc, /counterfeit-opening-watchdog/, 'opening boot watchdog was not injected');
assert.match(iframe.srcdoc, /<div id="app"><\/div>/, 'embedded opening app is missing from iframe srcdoc');

const onTopMessage = topListeners.get('message');
assert.equal(typeof onTopMessage, 'function', 'commit-done listener was not registered');
onTopMessage({ data: { source: 'counterfeit-opening', type: 'commit-done' } });
await new Promise(resolve => setImmediate(resolve));
await new Promise(resolve => setImmediate(resolve));

const userMessage = messages.find(message => message.role === 'user');
assert.ok(userMessage, 'opening did not create a user floor');
assert.match(userMessage.message, /我选择扮演雪之下雪乃/, 'user floor is only a hidden XML marker');
assert.doesNotMatch(userMessage.message, /<counterfeit_opening/, 'route marker must not use angle-bracket tags (sanitized by host)');
assert.deepEqual(variables.get(userMessage.message_id)?.stat_data, variables.get(0)?.stat_data);
assert.equal(calls.generate, 0, 'generate() must not be used because it does not insert an assistant floor');
assert.equal(calls.triggerSlash, 1, '/trigger must be invoked exactly once');
assert.equal(messages.filter(message => message.role === 'assistant').length, 2, 'first assistant reply was not inserted');

onTopMessage({ data: { source: 'counterfeit-opening', type: 'commit-done' } });
await new Promise(resolve => setImmediate(resolve));
assert.equal(calls.triggerSlash, 1, 'duplicate commit-done created a second generation');

messages[0].message = '<opening_setup mode="pov"></opening_setup>';
for (const callback of intervals) callback();
assert.equal(nodes.has('counterfeit-opening-iframe'), false, 'committed opening did not unmount the opening iframe');

async function runResumeScenario() {
  const resumeListeners = new Map();
  const resumeMessages = [{ message_id: 0, role: 'assistant', message: '<counterfeit_resume_capsule version="1">{}</counterfeit_resume_capsule>' }];
  const resumeVariables = new Map([[0, clone(variables.get(0))]]);
  const resumeCalls = { triggerSlash: 0 };
  const resumeIntervals = [];
  const appended = [];
  let anchorPresent = false;
  const fakeAnchor = { id: 'counterfeit-opening-anchor', remove() { anchorPresent = false; } };
  const resumeDocument = {
    body: { appendChild(node) { appended.push(node); } },
    createElement: makeElement,
    getElementById() { return null; },
    querySelector(selector) { return anchorPresent && selector === '#counterfeit-opening-anchor' ? fakeAnchor : null; },
    addEventListener() {},
  };
  const resumeTop = {
    document: resumeDocument,
    addEventListener(type, callback) { resumeListeners.set(type, callback); },
  };
  const resumeContext = {
    TextDecoder, Uint8Array, atob, console, MutationObserver: FakeMutationObserver,
    setTimeout() {}, setInterval(callback) { resumeIntervals.push(callback); return resumeIntervals.length; },
    fetch: async () => ({ ok: true, text: async () => '' }),
    getChatMessages(messageId) { return [resumeMessages[messageId]].filter(Boolean).map(clone); },
    getLastMessageId() { return resumeMessages.length - 1; },
    getVariables(options) { return options?.type === 'message' ? clone(resumeVariables.get(options.message_id) ?? {}) : {}; },
    async createChatMessages(nextMessages) {
      for (const item of nextMessages) resumeMessages.push({ message_id: resumeMessages.length, ...clone(item), message: String(item.message ?? '').replace(/<[^>]*>/g, '') });
    },
    async updateVariablesWith(updater, options) {
      if (options?.type !== 'message') return;
      const current = clone(resumeVariables.get(options.message_id) ?? {});
      resumeVariables.set(options.message_id, clone(updater(current)));
    },
    async triggerSlash(command) {
      assert.equal(command, '/trigger');
      resumeCalls.triggerSlash += 1;
      resumeMessages.push({ message_id: resumeMessages.length, role: 'assistant', message: '续接回复' });
    },
  };
  resumeContext.window = resumeContext;
  resumeContext.top = resumeTop;
  resumeContext.parent = resumeTop;
  resumeContext.window.top = resumeTop;
  resumeContext.window.parent = resumeTop;
  resumeContext.window.window = resumeContext.window;
  vm.runInNewContext(script, resumeContext, { filename: '开场白挂载.resume.js' });
  await new Promise(resolve => setImmediate(resolve));
  const listener = resumeListeners.get('message');
  assert.equal(typeof listener, 'function', 'resume commit listener was not registered');
  listener({ data: { source: 'counterfeit-opening', type: 'commit-done', commitKind: 'resume' } });
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));
  const users = resumeMessages.filter(message => message.role === 'user');
  assert.equal(users.length, 1, 'resume must create exactly one user floor');
  assert.equal(users[0].message, '我已迁移旧档，请从存档中最后一个可观察时刻继续。');
  assert.doesNotMatch(users[0].message, /进入《|选择扮演/, 'resume marker must not enter a DLC or replay an opening');
  assert.equal(resumeCalls.triggerSlash, 1, 'resume must trigger exactly once');
  assert.deepEqual(resumeVariables.get(users[0].message_id)?.stat_data, resumeVariables.get(0)?.stat_data);
  listener({ data: { source: 'counterfeit-opening', type: 'commit-done', commitKind: 'resume' } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(resumeCalls.triggerSlash, 1, 'duplicate resume commit created a second generation');

  // 闩锁回归：迁移完成后锚点残留（0 楼未及时重渲染）绝不允许把开局界面挂回去
  assert.equal(anchorPresent, false, 'resume commit must remove a lingering regex anchor');
  anchorPresent = true;
  const appendsBefore = appended.length;
  for (const callback of resumeIntervals) callback();
  assert.equal(appended.length, appendsBefore, 'resume latch must block remount while a stale anchor lingers');
  anchorPresent = false;
}

await runResumeScenario();

console.log(
  JSON.stringify(
    {
      regex_anchor_present: false,
      raw_greeting_detected: true,
      iframe_mounted: true,
      watchdog_injected: true,
      visible_user_floor: true,
      generated_via_trigger: true,
      generated_via_generate_api: false,
      floor0_variables_copied: true,
      duplicate_generation_blocked: true,
      committed_opening_unmounted: true,
      resume_marker_exactly_once: true,
      resume_trigger_exactly_once: true,
      resume_dlc_opening_blocked: true,
    },
    null,
    2,
  ),
);
