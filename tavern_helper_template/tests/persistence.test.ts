import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSaveTracker } from './.build/persistence.ts';

function defer<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/* —— 保存成功 —— */

test('保存成功：state=saved 且记录 lastSavedAt', async () => {
  const clock = 1000;
  const writes: string[] = [];
  const tracker = createSaveTracker<{ n: number }>(payload => {
    writes.push(String(payload.n));
  }, { now: () => clock });
  assert.equal(tracker.state, 'idle');
  const result = await tracker.save({ n: 1 });
  assert.equal(result, 'saved');
  assert.equal(tracker.state, 'saved');
  assert.equal(tracker.lastSavedAt, 1000);
  assert.equal(tracker.lastError, null);
  assert.deepEqual(writes, ['1']);
});

/* —— 保存失败 —— */

test('写入抛错：state=error 且记录 lastError', async () => {
  const tracker = createSaveTracker<{ n: number }>(() => {
    throw new Error('写入失败');
  });
  const result = await tracker.save({ n: 1 });
  assert.equal(result, 'error');
  assert.equal(tracker.state, 'error');
  assert.match(tracker.lastError ?? '', /写入失败/);
  assert.equal(tracker.lastSavedAt, null);
});

/* —— 异步写入与串行化 —— */

test('异步写入：saving 期间状态可见，完成后 saved', async () => {
  const gate = defer<void>();
  let released = false;
  const tracker = createSaveTracker<{ n: number }>(async () => {
    await gate.promise;
    released = true;
  });
  const pending = tracker.save({ n: 1 });
  assert.equal(tracker.state, 'saving');
  gate.resolve();
  await pending;
  assert.equal(tracker.state, 'saved');
  assert.equal(released, true);
});

test('并发保存串行执行，先发起的先落盘', async () => {
  const order: string[] = [];
  const first = defer<void>();
  let calls = 0;
  const tracker = createSaveTracker<{ n: number }>(async payload => {
    calls += 1;
    if (calls === 1) {
      await first.promise;
    }
    order.push(String(payload.n));
  });
  const p1 = tracker.save({ n: 1 });
  const p2 = tracker.save({ n: 2 });
  assert.equal(tracker.state, 'saving');
  first.resolve();
  await Promise.all([p1, p2]);
  assert.deepEqual(order, ['1', '2'], '第二个保存在第一个完成后才执行');
  assert.equal(tracker.state, 'saved');
});

/* —— 失败后恢复 —— */

test('失败后再次保存成功：状态恢复 saved', async () => {
  let fail = true;
  const tracker = createSaveTracker<{ n: number }>(() => {
    if (fail) throw new Error('boom');
  });
  assert.equal(await tracker.save({ n: 1 }), 'error');
  fail = false;
  assert.equal(await tracker.save({ n: 2 }), 'saved');
  assert.equal(tracker.state, 'saved');
  assert.equal(tracker.lastError, null);
});

/* —— reset —— */

test('reset 回到 idle', async () => {
  const tracker = createSaveTracker<{ n: number }>(() => undefined);
  await tracker.save({ n: 1 });
  assert.equal(tracker.state, 'saved');
  tracker.reset();
  assert.equal(tracker.state, 'idle');
});
