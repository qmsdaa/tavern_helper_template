// 真实浏览器运行时验证：独立 JSON 载荷在 headless Chrome 中完整走通
// 「挂载 → 主线桥自动注册 → 主线快照写入 → 打开 → 发消息 → 自动保存 → 关闭 → 刷新恢复」。
//
// 用法：node tests/runtime-verify.mjs
// 前置：先跑 node tests/prepare.mjs && python assets/tools/pack_phone_script.py
// 说明：宿主 API 用与酒馆助手同名同签名的桩函数替代（getVariables/updateVariablesWith/
//       eventOn/generateRaw…），手机 iframe 经 BRIDGE_SHIM 从宿主获取，行为与真实环境一致。

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const templateRoot = path.resolve(here, '..');
const projectRoot = path.resolve(templateRoot, '..');
const JSON_PATH = path.join(projectRoot, '酒馆助手脚本-手机助手-Counterfeit.json');
const OUT_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'counterfeit-phone-rt-'));
const HOST_HTML = path.join(OUT_DIR, 'host.html');
const CDP_PORT = 9333;

const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

/* —— 生成宿主测试页 —— */

const STUBS = `
(function () {
  // 桩函数会被手机 iframe 经 BRIDGE_SHIM 拷贝后在其上下文执行，
  // 因此一律经 window.top 访问宿主状态与 localStorage（srcdoc 同源）。
  const host = window.top;
  host.__events = host.__events || {};
  host.__floorVars = host.__floorVars || {};
  host.__phoneVarsRaw = host.localStorage.getItem('__phoneVars');
  host.__phoneVars = host.__phoneVarsRaw ? JSON.parse(host.__phoneVarsRaw) : {};
  host.__console = host.__console || [];

  function log(type, args) {
    host.__console.push({ type, text: String(args && args[0] !== undefined ? args[0] : '') });
  }

  host.getVariables = function (opt) {
    log('call', ['getVariables', JSON.stringify(opt)]);
    if (!opt) return {};
    if (opt.type === 'chat') return host.__phoneVars;
    if (opt.type === 'message') return host.__floorVars[opt.message_id ?? 'latest'] || {};
    return {};
  };
  host.updateVariablesWith = function (updater, opt) {
    log('call', ['updateVariablesWith', JSON.stringify(opt)]);
    const vars = host.getVariables(opt);
    const next = updater(vars);
    if (opt.type === 'chat') { host.__phoneVars = next; host.localStorage.setItem('__phoneVars', JSON.stringify(next)); }
    else if (opt.type === 'message') { host.__floorVars[opt.message_id ?? 'latest'] = next; }
    return next;
  };
  function cplSetPath(obj, path, value) {
    const keys = path.split('.');
    let cur = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      if (typeof cur[keys[i]] !== 'object' || cur[keys[i]] === null) cur[keys[i]] = {};
      cur = cur[keys[i]];
    }
    cur[keys[keys.length - 1]] = value;
  }
  host.insertOrAssignVariables = function (vars, opt) {
    log('call', ['insertOrAssignVariables', JSON.stringify(opt)]);
    const target = opt && opt.type === 'message' ? (host.__floorVars[opt.message_id ?? 'latest'] ??= {}) : host.__phoneVars;
    for (const k of Object.keys(vars || {})) cplSetPath(target, k, vars[k]);
    if (!opt || opt.type === 'chat') host.localStorage.setItem('__phoneVars', JSON.stringify(host.__phoneVars));
    return target;
  };
  host.deleteVariable = function (vpath, opt) {
    const target = opt && opt.type === 'message' ? (host.__floorVars[opt.message_id ?? 'latest'] ??= {}) : host.__phoneVars;
    const keys = vpath.split('.');
    let cur = target;
    for (let i = 0; i < keys.length - 1; i++) { if (!cur[keys[i]]) return { variables: target, delete_occurred: false }; cur = cur[keys[i]]; }
    const existed = cur[keys[keys.length - 1]] !== undefined;
    delete cur[keys[keys.length - 1]];
    if (!opt || opt.type === 'chat') host.localStorage.setItem('__phoneVars', JSON.stringify(host.__phoneVars));
    return { variables: target, delete_occurred: existed };
  };
  host.eventOn = function (event, handler) {
    log('call', ['eventOn', event]);
    (host.__events[event] = host.__events[event] || []).push(handler);
    return function () {};
  };
  host.tavern_events = {
    MESSAGE_SENT: 'message_sent', MESSAGE_RECEIVED: 'message_received', MESSAGE_EDITED: 'message_edited',
    MESSAGE_SWIPED: 'message_swiped', MESSAGE_DELETED: 'message_deleted', CHAT_CHANGED: 'chat_changed',
  };
  host.getChatMessages = function () { return []; };
  host.generateRaw = async function (params) {
    log('call', ['generateRaw', String(params && (params.user_input || '')).slice(0, 60)]);
    const input = String(params && (params.user_input || ''));
    if (input.includes('task=direct_reply')) return JSON.stringify({ messages: ['嗯，我记下了。'] });
    if (input.includes('task=mainline_ingest')) return JSON.stringify({ contacts: [], groups: [], important_facts: [], pending_appointments: [] });
    return '{}';
  };
  host.generate = host.generateRaw;
})();
`;

const SEED = `
(() => {
  const seeded = {
    version: 2,
    contacts: {
      '雪之下雪乃': { character: '雪之下雪乃', display_name: '雪之下雪乃', status: 'active', basis: '测试种子', source: 'seed', added_at: '2026-08-09T00:00:00.000Z', updated_at: '2026-08-09T00:00:00.000Z', removed_at: null, blocked_at: null }
    },
    threads: {
      'direct:雪之下雪乃': { id: 'direct:雪之下雪乃', type: 'direct', title: '雪之下雪乃', participants: ['玩家', '雪之下雪乃'], created_at: '2026-08-09T00:00:00.000Z', created_source: 'seed', last_message_at: null, unread: 1, summary: '', summarized_message_count: 0, important_facts: [], pending_appointments: [] }
    },
    messages: { 'direct:雪之下雪乃': [] },
    forum: { posts: [] },
    context: { active_snapshot: null, manual_queue: [], ingest_records: {}, facts: [], appointments: [] },
    requests: []
  };
  if (!localStorage.getItem('__phoneVars')) {
    window.__phoneVars = { stat_data: { phone: seeded } };
    localStorage.setItem('__phoneVars', JSON.stringify(window.__phoneVars));
  }
})();
`;

const payload = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
const loaderContent = payload.content;
// 预加载手机 iframe 同款 Vue CDN（与 index.html document.write 的 URL 完全一致），
// 让 iframe 启动时命中浏览器缓存——复刻真实酒馆环境的热缓存，消除 CDN 竞态。
const hostHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Counterfeit 手机助手 · 运行时验证宿主</title>
<script src="https://testingcf.jsdelivr.net/npm/vue@3/dist/vue.global.prod.js"></script>
<script>${STUBS}</script>
<script>${SEED}</script>
</head>
<body>
<h1>Counterfeit 手机助手 · 运行时验证宿主</h1>
<script>
${loaderContent}
</script>
</body>
</html>
`;
fs.writeFileSync(HOST_HTML, hostHtml, 'utf8');

/* —— CDP 客户端（Node 内置 WebSocket） —— */

class Cdp {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.seq = 0;
    this.pending = new Map();
    this.events = [];
  }
  async open() {
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });
    this.ws.onmessage = event => {
      const msg = JSON.parse(String(event.data));
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
      } else if (msg.method) {
        this.events.push(msg);
      }
    };
  }
  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.seq;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  close() {
    try {
      this.ws.close();
    } catch {
      /* 忽略 */
    }
  }
}

async function waitFor(cdp, expression, timeoutMs = 20000, every = 200) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    const result = await cdp.send('Runtime.evaluate', { expression, returnByValue: true });
    last = result.result?.value;
    if (last) return last;
    await sleep(every);
  }
  return last;
}

/**
 * 稳定窗口等待：表达式为真后仍需连续 stableMs 毫秒保持为真（防启动期偶发二次导航重置状态）。
 */
async function waitStable(cdp, expression, { timeoutMs = 90000, stableMs = 2500, every = 300 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let stableSince = 0;
  while (Date.now() < deadline) {
    const result = await cdp.send('Runtime.evaluate', { expression, returnByValue: true });
    if (result.result?.value) {
      if (stableSince === 0) stableSince = Date.now();
      else if (Date.now() - stableSince >= stableMs) return true;
    } else {
      stableSince = 0;
    }
    await sleep(every);
  }
  return false;
}

const EVENT_SET = ['message_sent', 'message_received', 'message_edited', 'message_swiped', 'message_deleted', 'mag_variable_update_ended', 'chat_changed'];
const EVENTS_ALL_REGISTERED = `(() => {
  const e = window.__events || {};
  return ${JSON.stringify(EVENT_SET)}.every(k => Array.isArray(e[k]) && e[k].length === 1);
})()`;

function assertExec(cdp, expression, name, predicate = v => Boolean(v), detail = '') {
  return cdp.send('Runtime.evaluate', { expression, returnByValue: true }).then(result => {
    const value = result.result?.value;
    const ok = predicate(value);
    check(name, ok, detail || JSON.stringify(value)?.slice(0, 120));
    return value;
  });
}

async function killTree(pid) {
  try {
    spawn('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
  } catch {
    /* 忽略 */
  }
}

/* —— 主流程 —— */

async function main() {
  const chromePath = CHROME_CANDIDATES.find(p => fs.existsSync(p));
  if (!chromePath) {
    console.error('未找到 Chrome/Edge，跳过真实浏览器运行时验证');
    process.exit(2);
  }
  // 清场：杀尽残留测试浏览器（上一轮 killTree 可能未完成）与占用端口的进程
  try {
    const stale = await new Promise(resolve => {
      const out = [];
      const child = spawn('wmic', ['process', 'where', "name='chrome.exe'", 'get', 'ProcessId,CommandLine'], { stdio: ['ignore', 'pipe', 'pipe'] });
      child.stdout.on('data', d => out.push(String(d)));
      child.stderr.on('data', () => undefined);
      child.on('close', () => resolve(out.join('')));
    });
    for (const line of stale.split(/\r?\n/)) {
      if (!line.includes('counterfeit-phone-rt')) continue;
      const pid = line.trim().split(/\s+/).pop();
      if (pid && /^\d+$/.test(pid)) {
        await killTree(Number(pid));
      }
    }
  } catch {
    /* 无 wmic 时忽略 */
  }
  await sleep(1200);

  const profileDir = path.join(OUT_DIR, 'profile');
  const chrome = spawn(
    chromePath,
    [
      '--headless=new',
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${profileDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu',
      '--allow-file-access-from-files',
      '--window-size=1280,900',
      'about:blank',
    ],
    { stdio: 'ignore' },
  );
  let cdp;
  try {
    // 等待 CDP 端口就绪
    let target = null;
    for (let i = 0; i < 60; i++) {
      await sleep(250);
      try {
        const list = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`).then(r => r.json());
        target = list.find(t => t.type === 'page');
        if (target) break;
      } catch {
        /* 未就绪 */
      }
    }
    if (!target) throw new Error('CDP 页面目标不可用');

    cdp = new Cdp(target.webSocketDebuggerUrl);
    await cdp.open();
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    // 由测试自己发起唯一一次导航，消除 headless 初始 URL 的偶发双重加载
    await cdp.send('Page.navigate', { url: `file:///${HOST_HTML.replace(/\\/g, '/')}` });
    await new Promise(resolve => {
      const timer = setTimeout(resolve, 30000);
      const check = () => {
        cdp.send('Runtime.evaluate', { expression: 'document.readyState', returnByValue: true })
          .then(r => {
            if (r.result?.value === 'complete') {
              clearTimeout(timer);
              resolve(undefined);
            } else {
              setTimeout(check, 200);
            }
          })
          .catch(() => setTimeout(check, 200));
      };
      check();
    });
    // 防呆：确认我们驱动的是本轮生成的宿主页
    const href = await cdp.send('Runtime.evaluate', { expression: 'location.href', returnByValue: true });
    if (!String(href.result?.value ?? '').includes('host.html')) {
      throw new Error('CDP 目标不是本轮 host.html：' + String(href.result?.value));
    }
    console.log('  宿主页：' + String(href.result?.value));

    /* 1) 加载器挂载（无需任何手动操作） */
    console.log('\n[1] 加载器挂载');
    const launcherReady = await waitStable(cdp, `document.getElementById('counterfeit-phone-launcher-root') !== null`);
    check('悬浮球已挂载到宿主', Boolean(launcherReady));
    const iframeReady = await waitStable(cdp, `document.getElementById('counterfeit-phone-iframe') !== null`);
    check('手机 iframe 已创建', Boolean(iframeReady));

    /* 2) 手机未打开时主线桥已自动挂载（7 个事件，无重复） */
    console.log('\n[2] 主线桥（手机未打开）');
    const apiPresence = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const f = document.getElementById('counterfeit-phone-iframe');
        const w = f && f.contentWindow;
        if (!w) return 'no-window';
        const names = ['getVariables', 'updateVariablesWith', 'insertOrAssignVariables', 'eventOn', 'tavern_events', 'generateRaw', 'getChatMessages'];
        return JSON.stringify(Object.fromEntries(names.map(n => [n, typeof w[n]])));
      })()`,
      returnByValue: true,
    });
    console.log('  （手机 iframe API 可用性：' + String(apiPresence.result?.value) + '）');
    // 稳定窗口内等 7 个事件全部注册（兼容启动期偶发二次导航）
    const armed = await waitStable(cdp, EVENTS_ALL_REGISTERED, { timeoutMs: 90000, stableMs: 2500 });
    check('主线桥已注册（手机未打开 · 7 事件各一次）', Boolean(armed));
    const eventsOk = await assertExec(
      cdp,
      `(() => { const e = window.__events; return JSON.stringify({ all: ${JSON.stringify(EVENT_SET)}.every(k => Array.isArray(e[k]) && e[k].length === 1), counts: Object.fromEntries(Object.entries(e).map(([k,v]) => [k, v.length])) }); })()`,
      '7 个事件各注册一次（无重复）',
      v => JSON.parse(v).all,
    );

    /* 3) 主线快照写入（MESSAGE_SENT 钩子） */
    const emitReady = await waitStable(cdp, `Array.isArray(window.__events['message_sent']) && window.__events['message_sent'].length === 1`);
    const emitResult = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        try {
          const handler = window.__events['message_sent'][0];
          if (!handler) return 'no-handler';
          handler(1);
          return 'emitted';
        } catch (e) {
          return 'threw:' + String(e && e.stack || e);
        }
      })()`,
      returnByValue: true,
    });
    console.log('  （MESSAGE_SENT 触发：' + String(emitResult.result?.value) + '）');
    const snapshotWritten = await waitFor(
      cdp,
      `window.__floorVars[1] && window.__floorVars[1].stat_data && window.__floorVars[1].stat_data.phone && window.__floorVars[1].stat_data.phone.context && typeof window.__floorVars[1].stat_data.phone.context.active_snapshot === 'object'`,
    );
    check('MESSAGE_SENT → active_snapshot 写入玩家楼层变量（无需打开手机）', Boolean(snapshotWritten));

    /* 4) 打开手机 */
    console.log('\n[3] 打开 / 关闭手机');
    await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const btn = document.getElementById('counterfeit-phone-launcher-root');
        const rect = btn.getBoundingClientRect();
        return JSON.stringify({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });
      })()`,
      returnByValue: true,
    }).then(async r => {
      const { x, y } = JSON.parse(r.result.value);
      await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    });
    const overlayOpen = await waitFor(
      cdp,
      `(() => { const f = document.getElementById('counterfeit-phone-iframe'); const d = f && f.contentDocument; return d && d.querySelector('.phone-overlay') !== null; })()`,
    );
    check('点击悬浮球 → 手机界面打开', Boolean(overlayOpen));

    /* 5) 打开消息 app → 打开会话 → 发消息 → 自动保存 */
    console.log('\n[4] 发送消息与自动保存');
    const openMessages = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const f = document.getElementById('counterfeit-phone-iframe');
        const d = f.contentDocument;
        const icons = [...d.querySelectorAll('.app-icon')];
        const msg = icons.find(i => (i.querySelector('.icon-label') || {}).textContent === '消息');
        if (msg) { msg.click(); return 'clicked'; }
        return 'not-found';
      })()`,
      returnByValue: true,
    });
    check('消息 app 打开', openMessages.result.value === 'clicked');
    const threadOpened = await waitFor(cdp, `(() => {
      const d = document.getElementById('counterfeit-phone-iframe').contentDocument;
      const item = d.querySelector('.thread-item');
      if (item) { item.click(); return true; }
      return false;
    })()`);
    check('种子会话可打开', Boolean(threadOpened));

    // 用 CDP 真实键盘输入（Vue v-model 可靠路径）：聚焦输入框 → 键入 → 回车发送
    const inputReady = await waitFor(cdp, `(() => {
      const d = document.getElementById('counterfeit-phone-iframe').contentDocument;
      const input = d.querySelector('.input-bar input');
      if (!input) return false;
      input.focus();
      return true;
    })()`);
    check('聊天输入框可聚焦', Boolean(inputReady));
    await cdp.send('Input.insertText', { text: '周末一起去看电影吗？' });
    const draftProbe = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const d = document.getElementById('counterfeit-phone-iframe').contentDocument;
        const input = d.querySelector('.input-bar input');
        const btn = d.querySelector('.send-btn');
        return JSON.stringify({ value: input ? input.value : null, sendDisabled: btn ? btn.disabled : null });
      })()`,
      returnByValue: true,
    });
    console.log('  （输入探针：' + String(draftProbe.result?.value) + '）');
    // 回车发送
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });

    const bubbles = await waitFor(cdp, `(() => {
      const d = document.getElementById('counterfeit-phone-iframe').contentDocument;
      const rows = [...d.querySelectorAll('.bubble-row')];
      return rows.length === 2 ? rows.map(r => r.textContent.trim()) : false;
    })()`, 30000);
    check('NPC 回复落盘（generateRaw 桩返回后消息成对）', Array.isArray(bubbles), bubbles ? bubbles.join(' | ') : '');

    const saved = await waitFor(cdp, `(() => {
      const d = document.getElementById('counterfeit-phone-iframe').contentDocument;
      const chip = d.querySelector('.save-chip');
      if (chip) return chip.textContent.trim();
      return false;
    })()`, 10000);
    check('界面显示自动保存提示（非只写 console）', typeof saved === 'string' && saved.includes('已自动保存'), saved || '');
    const varSaved = await assertExec(
      cdp,
      `(() => { const m = window.__phoneVars && window.__phoneVars.stat_data && window.__phoneVars.stat_data.phone && window.__phoneVars.stat_data.phone.messages && window.__phoneVars.stat_data.phone.messages['direct:雪之下雪乃'];
        return m ? m.length : -1; })()`,
      '聊天变量已持久化两条消息',
      v => v === 2,
    );

    /* 6) 清空会话对话框（备份入口 + 边界说明） */
    console.log('\n[5] 清空会话对话框');
    await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const d = document.getElementById('counterfeit-phone-iframe').contentDocument;
        const clearBtn = [...d.querySelectorAll('.clear-btn')].find(b => (b.title || '') === '清空聊天');
        if (clearBtn) clearBtn.click();
        return 'ok';
      })()`,
    });
    const clearDialog = await waitFor(cdp, `(() => {
      const d = document.getElementById('counterfeit-phone-iframe').contentDocument;
      const sheet = d.querySelector('.clear-actions');
      return sheet ? sheet.textContent : false;
    })()`);
    check(
      '清空对话框提供 导出备份并清空 / 直接清空 且带边界说明',
      typeof clearDialog === 'string' &&
        clearDialog.includes('导出备份并清空') &&
        clearDialog.includes('直接清空'),
    );
    const boundaryText = await cdp.send('Runtime.evaluate', {
      expression: `(() => { const d = document.getElementById('counterfeit-phone-iframe').contentDocument; const w = d.querySelector('.clear-warn'); return w ? w.textContent : ''; })()`,
      returnByValue: true,
    });
    check(
      '边界说明：联系人保留 / 不回滚主线 / 不删数据库记录',
      (boundaryText.result.value || '').includes('联系人') &&
        (boundaryText.result.value || '').includes('主线') &&
        (boundaryText.result.value || '').includes('数据库'),
    );
    await cdp.send('Runtime.evaluate', {
      expression: `(() => { const d = document.getElementById('counterfeit-phone-iframe').contentDocument; const btn = d.querySelector('.clear-cancel'); if (btn) btn.click(); return 'ok'; })()`,
    });

    /* 7) 关闭手机（点遮罩；对话框过渡期点击可能被吞，重试数次） */
    let closed = false;
    for (let attempt = 0; attempt < 5 && !closed; attempt++) {
      await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 5, y: 5, button: 'left', clickCount: 1 });
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 5, y: 5, button: 'left', clickCount: 1 });
      closed = await waitFor(
        cdp,
        `(() => { const f = document.getElementById('counterfeit-phone-iframe'); const d = f && f.contentDocument; return d && d.querySelector('.phone-overlay') === null; })()`,
        8000,
      );
      if (!closed) await sleep(600);
    }
    check('点遮罩 → 手机关闭', Boolean(closed));

    /* 8) 刷新恢复（Page.reload 后数据仍在） */
    console.log('\n[6] 刷新恢复');
    await cdp.send('Page.reload');
    await waitFor(cdp, `document.getElementById('counterfeit-phone-launcher-root') !== null`, 30000);
    // 悬浮球在 appReady 握手后才 display:flex；在此之前点击坐标为 0,0 会落空
    await waitFor(cdp, `(() => {
      const btn = document.getElementById('counterfeit-phone-launcher-root');
      return btn && btn.style.display === 'flex';
    })()`, 15000);
    const persisted = await assertExec(
      cdp,
      `(() => { const m = window.__phoneVars && window.__phoneVars.stat_data && window.__phoneVars.stat_data.phone && window.__phoneVars.stat_data.phone.messages && window.__phoneVars.stat_data.phone.messages['direct:雪之下雪乃']; return m ? m.length : -1; })()`,
      '刷新后聊天变量中的消息仍在（localStorage 持久化）',
      v => v === 2,
    );
    await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const btn = document.getElementById('counterfeit-phone-launcher-root');
        const rect = btn.getBoundingClientRect();
        return JSON.stringify({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });
      })()`,
      returnByValue: true,
    }).then(async r => {
      const { x, y } = JSON.parse(r.result.value);
      await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    });
    const reopenProbe = await waitFor(cdp, `(() => {
      const f = document.getElementById('counterfeit-phone-iframe');
      const d = f && f.contentDocument;
      const phone = window.__phoneVars && window.__phoneVars.stat_data && window.__phoneVars.stat_data.phone;
      return JSON.stringify({
        pointerEvents: f ? f.style.pointerEvents : null,
        overlay: d ? d.querySelector('.phone-overlay') !== null : false,
        threadCount: phone ? Object.keys(phone.threads || {}).length : -1,
        msgCount: phone && phone.messages && phone.messages['direct:雪之下雪乃'] ? phone.messages['direct:雪之下雪乃'].length : -1,
        appRendered: d ? d.querySelector('#app').children.length : -1,
      });
    })()`, 15000, 300).then(v => {
      console.log('  （reload 后打开探针：' + String(v) + '）');
      return v;
    });
    const overlayAfterReload = await waitFor(cdp, `(() => {
      const d = document.getElementById('counterfeit-phone-iframe').contentDocument;
      return d && d.querySelector('.phone-overlay') !== null;
    })()`, 15000);
    check('刷新后重新打开手机（手机界面再次打开）', Boolean(overlayAfterReload));
    // 手机停在主屏幕：先进消息 app，再进会话，验证消息完整恢复
    await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const d = document.getElementById('counterfeit-phone-iframe').contentDocument;
        const icons = [...d.querySelectorAll('.app-icon')];
        const msg = icons.find(i => (i.querySelector('.icon-label') || {}).textContent === '消息');
        if (msg) { msg.click(); return 'clicked'; }
        return 'not-found';
      })()`,
      returnByValue: true,
    });
    const reopened = await waitFor(cdp, `(() => {
      const d = document.getElementById('counterfeit-phone-iframe').contentDocument;
      const item = d.querySelector('.thread-item');
      if (!item) return false;
      item.click();
      return true;
    })()`);
    check('刷新后重新打开手机 → 会话仍在', Boolean(reopened));
    const messageCountAfterReload = await waitFor(cdp, `(() => {
      const d = document.getElementById('counterfeit-phone-iframe').contentDocument;
      const rows = [...d.querySelectorAll('.bubble-row')];
      return rows.length === 2 ? rows.length : false;
    })()`, 10000);
    check('刷新后消息完整恢复（2 条）', messageCountAfterReload === 2);

    /* 9) 控制台错误审计 */
    console.log('\n[7] 控制台审计');
    const errors = cdp.events
      .filter(e => e.method === 'Runtime.exceptionThrown')
      .map(e => e.params.exceptionDetails?.text || 'exception');
    const consoleErrors = cdp.events
      .filter(e => e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error')
      .map(e => String(e.params.args?.[0]?.value ?? e.params.args?.[0]?.description ?? 'console.error'));
    // 排除网络资源类噪音（headless 下 CDN 字体/图标可能超时，与脚本无关）
    const realErrors = [...errors, ...consoleErrors].filter(
      t => !/net::ERR|Failed to load resource|favicon/i.test(t),
    );
    check('无未捕获异常 / console.error', realErrors.length === 0, realErrors.slice(0, 3).join(' ; '));

    // 全量 console 事件转储（诊断用：手机侧 info/warn 均在这里）
    const consoleLines = cdp.events
      .filter(e => e.method === 'Runtime.consoleAPICalled')
      .map(e => {
        const type = e.params.type;
        const text = String(
          e.params.args?.map(a => a.value ?? a.description ?? '').join(' ') ?? '',
        ).slice(0, 160);
        return `[${type}] ${text}`;
      })
      .filter(t => /手机|主线桥|存档|错误|Error/i.test(t));
    console.log('  （console 事件摘录）');
    for (const line of consoleLines.slice(-16)) console.log(`    ${line}`);

    // 桩函数调用日志（诊断用）
    const stubLogs = await cdp.send('Runtime.evaluate', {
      expression: `(() => { const logs = (window.__console || []).filter(l => l.type === 'call'); return JSON.stringify(logs.slice(-16)); })()`,
      returnByValue: true,
    });
    console.log('  （API 桩调用摘录）');
    for (const entry of JSON.parse(String(stubLogs.result?.value ?? '[]'))) {
      console.log(`    ${entry.text}`);
    }
  } finally {
    if (cdp) cdp.close();
    await killTree(chrome.pid);
    await sleep(800);
  }

  console.log(`\n======== 运行时验证结果：${results.filter(r => r.ok).length}/${results.length} 通过 ========`);
  const failed = results.filter(r => !r.ok);
  if (failed.length) {
    console.log('失败项：');
    for (const f of failed) console.log(`  ✗ ${f.name} — ${f.detail}`);
  }
  try {
    fs.rmSync(OUT_DIR, { recursive: true, force: true });
  } catch {
    /* 忽略 */
  }
  process.exit(failed.length ? 1 : 0);
}

main().catch(error => {
  console.error('运行时验证崩溃：', error);
  process.exit(1);
});
