import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMainlineBridge } from './.build/mainlineBridge.ts';

interface RegisteredHandler {
  event: string;
  handler: (messageId: number, type?: string) => void;
}

function makeEnv(overrides: { apiReady?: boolean; maxAttempts?: number; retryDelayMs?: number } = {}) {
  const registrations: RegisteredHandler[] = [];
  let apiReady = overrides.apiReady ?? true;
  const scheduled: { fn: () => void; handle: number }[] = [];
  let handleSeq = 0;

  const env = {
    apiReady,
    registrations,
    scheduled,
    setApiReady(value: boolean) {
      apiReady = value;
    },
    tickAll() {
      const tasks = scheduled.splice(0);
      for (const task of tasks) task.fn();
    },
    tickOne() {
      const task = scheduled.shift();
      if (task) task.fn();
    },
    get pendingCount() {
      return scheduled.length;
    },
    events: {
      MESSAGE_SENT: 'message_sent',
      MESSAGE_RECEIVED: 'message_received',
      MESSAGE_EDITED: 'message_edited',
      MESSAGE_SWIPED: 'message_swiped',
      MESSAGE_DELETED: 'message_deleted',
      CHAT_CHANGED: 'chat_changed',
    },
  };

  const bridgeEnv = {
    getEventOn: () =>
      apiReady
        ? (event: string, handler: (messageId: number, type?: string) => void) => {
            registrations.push({ event, handler });
          }
        : undefined,
    getTavernEvents: () => (apiReady ? env.events : undefined),
    isApiReady: () => apiReady,
    schedule: (fn: () => void, delayMs: number) => {
      const handle = ++handleSeq;
      scheduled.push({ fn, handle });
      return handle;
    },
    cancel: handle => {
      const index = scheduled.findIndex(task => task.handle === handle);
      if (index >= 0) scheduled.splice(index, 1);
    },
    maxAttempts: overrides.maxAttempts,
    retryDelayMs: overrides.retryDelayMs,
  };
  return { env, bridgeEnv };
}

function makeHandlers(log: string[]) {
  return {
    onMessageSent: id => log.push(`sent:${id}`),
    onMessageReceived: (id, type) => log.push(`received:${id}:${type ?? ''}`),
    onMessageEdited: id => log.push(`edited:${id}`),
    onMessageSwiped: id => log.push(`swiped:${id}`),
    onMessageDeleted: id => log.push(`deleted:${id}`),
    onMvuUpdateEnded: () => log.push('mvu'),
    onChatChanged: () => log.push('chat-changed'),
  };
}

/* —— 手机未打开时主线桥仍能工作（arm 与 isOpen 无关） —— */

test('arm() 与手机是否打开无关：脚本初始化后调用即注册全部 7 个事件', () => {
  const { env, bridgeEnv } = makeEnv({ apiReady: true });
  const log: string[] = [];
  const bridge = createMainlineBridge(bridgeEnv, makeHandlers(log));
  bridge.arm();
  assert.equal(bridge.isArmed(), true);
  assert.equal(env.registrations.length, 7);
  const events = env.registrations.map(r => r.event);
  assert.ok(events.includes('message_sent'));
  assert.ok(events.includes('message_received'));
  assert.ok(events.includes('message_edited'));
  assert.ok(events.includes('message_swiped'));
  assert.ok(events.includes('message_deleted'));
  assert.ok(events.includes('mag_variable_update_ended'));
  assert.ok(events.includes('chat_changed'));
});

/* —— 事件不会重复注册 —— */

test('重复 arm() 不重复注册事件', () => {
  const { env, bridgeEnv } = makeEnv({ apiReady: true });
  const bridge = createMainlineBridge(bridgeEnv, makeHandlers([]));
  bridge.arm();
  bridge.arm();
  bridge.arm();
  assert.equal(env.registrations.length, 7, '事件只注册一次');
});

test('事件触发正确分发到各回调', () => {
  const { env, bridgeEnv } = makeEnv({ apiReady: true });
  const log: string[] = [];
  const bridge = createMainlineBridge(bridgeEnv, makeHandlers(log));
  bridge.arm();
  const byEvent = Object.fromEntries(env.registrations.map(r => [r.event, r.handler]));
  byEvent['message_sent'](42);
  byEvent['message_received'](43, 'regenerate');
  byEvent['message_edited'](44);
  byEvent['message_swiped'](45);
  byEvent['message_deleted'](46);
  byEvent['mag_variable_update_ended']();
  byEvent['chat_changed']();
  assert.deepEqual(log, [
    'sent:42',
    'received:43:regenerate',
    'edited:44',
    'swiped:45',
    'deleted:46',
    'mvu',
    'chat-changed',
  ]);
});

/* —— API 未就绪时有界重试 —— */

test('API 未就绪：有界重试，就绪后自动挂载且不重复注册', () => {
  const { env, bridgeEnv } = makeEnv({ apiReady: false, maxAttempts: 5, retryDelayMs: 100 });
  const log: string[] = [];
  const bridge = createMainlineBridge(bridgeEnv, makeHandlers(log));
  bridge.arm();
  assert.equal(bridge.isArmed(), false);
  assert.equal(bridge.retryCount(), 1, '已调度第一次重试');

  // 前两次仍未就绪
  env.tickOne();
  assert.equal(bridge.isArmed(), false);
  env.tickOne();
  assert.equal(bridge.isArmed(), false);

  // 第三次重试时 API 就绪
  env.setApiReady(true);
  env.tickOne();
  assert.equal(bridge.isArmed(), true);
  assert.equal(env.registrations.length, 7);
  assert.equal(env.pendingCount, 0, '挂载成功后不再重试');
});

test('API 长期未就绪：重试次数有界，不会无限循环', () => {
  const { env, bridgeEnv } = makeEnv({ apiReady: false, maxAttempts: 3, retryDelayMs: 100 });
  const bridge = createMainlineBridge(bridgeEnv, makeHandlers([]));
  bridge.arm();
  env.tickOne();
  env.tickOne();
  env.tickOne();
  assert.equal(bridge.isArmed(), false);
  assert.equal(bridge.retryCount(), 3, '恰好消耗 maxAttempts 次');
  assert.equal(env.pendingCount, 0, '重试已停止');
  // 之后 API 就绪也不会自动注册（已放弃；下次显式 arm 才会）
  env.setApiReady(true);
  assert.equal(env.registrations.length, 0);
  bridge.arm();
  assert.equal(bridge.isArmed(), true);
  assert.equal(env.registrations.length, 7);
});

/* —— dispose 取消待办重试 —— */

test('dispose 取消未完成的重试', () => {
  const { env, bridgeEnv } = makeEnv({ apiReady: false, maxAttempts: 10, retryDelayMs: 100 });
  const bridge = createMainlineBridge(bridgeEnv, makeHandlers([]));
  bridge.arm();
  assert.equal(env.pendingCount, 1);
  bridge.dispose();
  assert.equal(env.pendingCount, 0);
  assert.equal(bridge.isWaiting(), false);
  bridge.arm();
  assert.equal(env.pendingCount, 0, 'dispose 后 arm 不再生效');
});

/* —— 注册途中抛错视为未挂载并进入重试 —— */

test('eventOn 抛错时走重试而不是半臂态', () => {
  const registrations: string[] = [];
  let failNext = true;
  const bridgeEnv = {
    getEventOn: () => (event: string) => {
      if (failNext) {
        failNext = false;
        throw new Error('注册失败');
      }
      registrations.push(event);
    },
    getTavernEvents: () => ({
      MESSAGE_SENT: 'message_sent',
      MESSAGE_RECEIVED: 'message_received',
      MESSAGE_EDITED: 'message_edited',
      MESSAGE_SWIPED: 'message_swiped',
      MESSAGE_DELETED: 'message_deleted',
      CHAT_CHANGED: 'chat_changed',
    }),
    isApiReady: () => true,
    schedule: (fn: () => void) => {
      fn();
      return 1;
    },
    cancel: () => undefined,
    maxAttempts: 5,
    retryDelayMs: 0,
  };
  const bridge = createMainlineBridge(bridgeEnv, makeHandlers([]));
  bridge.arm();
  assert.equal(bridge.isArmed(), true, '抛出后重试成功挂载');
  assert.equal(registrations.length, 7);
});
