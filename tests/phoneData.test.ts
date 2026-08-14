import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addPhoneMessage,
  buildContextSnapshot,
  canonicalName,
  clearThreadMessages,
  createPhoneData,
  ensureContact,
  ensureDirectThread,
  markSnapshotConsumed,
  markThreadDigested,
  matchedMainlineAppointments,
  matchedMainlineFacts,
  normalizePhoneData,
  THREAD_MESSAGE_LIMIT,
} from './.build/phoneData.ts';

const PLAYER = '比企谷八幡';
const OTHER = '雪之下雪乃';
const THIRD = '由比滨结衣';

function makeData() {
  const data = createPhoneData();
  const thread = ensureDirectThread(data, OTHER, PLAYER, '2013-05-20', 'test');
  return { data, thread };
}

function add(data: ReturnType<typeof createPhoneData>, threadId: string, sender: string, text: string, at: string) {
  const thread = data.threads[threadId];
  return addPhoneMessage(data, {
    threadId,
    sender,
    text,
    storyTime: '2013-05-20',
    participants: thread.participants,
    visibility: thread.type === 'group' ? 'group' : 'private',
    source: 'player',
    createdAt: at,
  });
}

/* —— 31 条及以上未消费消息不会丢失 —— */

test('35 条未消费消息：只注入 30 条，其余保留到后续轮次', () => {
  const { data, thread } = makeData();
  for (let i = 0; i < 35; i++) {
    add(data, thread.id, i % 2 ? OTHER : PLAYER, `消息 ${i}`, `2026-01-01T00:${String(i).padStart(2, '0')}:00.000Z`);
  }
  const snapshot = buildContextSnapshot(data, 100);
  const pending = Object.values(data.messages)
    .flat()
    .filter(m => !m.consumed_by_mainline);
  assert.equal(pending.length, 35);
  assert.equal(snapshot.new_message_ids.length, 30, 'new_message_ids 必须只含实际注入的消息');
  assert.match(snapshot.text, /另有 5 条更早的手机消息尚未注入主线/);
  assert.equal(snapshot.new_message_ids[0], pending[0].id, '从最旧消息开始注入');
  assert.equal(snapshot.new_message_ids[29], pending[29].id);

  // 只消费实际注入的 30 条
  markSnapshotConsumed(data, snapshot);
  const stillPending = Object.values(data.messages)
    .flat()
    .filter(m => !m.consumed_by_mainline);
  assert.equal(stillPending.length, 5, '未注入的消息绝不能标记为已消费');

  // 下一轮快照包含剩余 5 条
  const next = buildContextSnapshot(data, 101);
  assert.equal(next.new_message_ids.length, 5);
  assert.deepEqual(new Set(next.new_message_ids), new Set(stillPending.map(m => m.id)));
  assert.doesNotMatch(next.text, /另有/);
});

/* —— 清空会话：archived_count 与快照同步重置 —— */

test('清空会话重置 summary/summarized_message_count/archived_count/important_facts/pending_appointments/pending_trim', () => {
  const { data, thread } = makeData();
  thread.summary = '旧摘要';
  thread.summarized_message_count = 50;
  thread.archived_count = 40;
  thread.important_facts = [{ id: 'f1', text: '事实', participants: [PLAYER], visibility: 'private', source: 'x', active: true, created_at: '' }];
  thread.pending_appointments = [{ id: 'a1', text: '约定', due_story_time: null, participants: [PLAYER], visibility: 'private', source: 'x', status: 'pending', created_at: '' }];
  thread.pending_trim = ['[旧消息]'];
  for (let i = 0; i < 5; i++) add(data, thread.id, OTHER, `m${i}`, `2026-01-01T00:0${i}:00.000Z`);

  clearThreadMessages(data, thread.id);

  assert.deepEqual(data.messages[thread.id], []);
  assert.equal(thread.summary, '');
  assert.equal(thread.summarized_message_count, 0);
  assert.equal(thread.archived_count, 0);
  assert.deepEqual(thread.important_facts, []);
  assert.deepEqual(thread.pending_appointments, []);
  assert.deepEqual(thread.pending_trim, []);
  assert.equal(thread.last_message_at, null);

  // 清空后重建的快照不再包含旧消息
  const snapshot = buildContextSnapshot(data, null);
  assert.equal(snapshot.new_message_ids.length, 0);
  assert.doesNotMatch(snapshot.text, /m0/);
});

/* —— 120 条裁剪：未进摘要的内容保留为待处理状态 —— */

test('130 条未摘要：裁剪只保留 120 条，未覆盖内容进入 pending_trim 不丢失', () => {
  const { data, thread } = makeData();
  for (let i = 0; i < 130; i++) {
    add(data, thread.id, i % 2 ? OTHER : PLAYER, `内容 ${i}`, `2026-01-01T00:${String(i).padStart(2, '0')}:00.000Z`);
  }
  const list = data.messages[thread.id];
  assert.equal(list.length, THREAD_MESSAGE_LIMIT);
  assert.equal(list[0].text, '内容 10', '保留的是最后 120 条');
  assert.equal(thread.summarized_message_count, 0);
  // 未覆盖的 10 条进入 pending_trim（带参与者范围前缀）
  assert.equal((thread.pending_trim ?? []).length, 10);
  assert.match(thread.pending_trim![0], /内容 0/);
  assert.match(thread.pending_trim![0], /私聊/);

  // 摘要成功：清空 pending_trim、推进水位线
  markThreadDigested(thread, list.length);
  assert.equal(thread.summarized_message_count, 120);
  assert.deepEqual(thread.pending_trim, []);

  // 再发 1 条触发裁剪：全部已被摘要覆盖，不产生新 pending
  add(data, thread.id, OTHER, '内容 130', '2026-01-01T01:00:00.000Z');
  assert.equal(data.messages[thread.id].length, THREAD_MESSAGE_LIMIT);
  assert.equal((thread.pending_trim ?? []).length, 0);
  assert.equal(thread.summarized_message_count, 119);
});

test('已覆盖的旧消息裁剪时不会进入 pending_trim，且 archived_count 同步下调', () => {
  const { data, thread } = makeData();
  for (let i = 0; i < 100; i++) {
    add(data, thread.id, OTHER, `内容 ${i}`, `2026-01-01T00:${String(i).padStart(2, '0')}:00.000Z`);
  }
  thread.summarized_message_count = 80;
  thread.archived_count = 70;
  for (let i = 100; i < 140; i++) {
    add(data, thread.id, OTHER, `内容 ${i}`, `2026-01-01T00:${String(i).padStart(2, '0')}:00.000Z`);
  }
  assert.equal(data.messages[thread.id].length, THREAD_MESSAGE_LIMIT);
  // 裁剪 20 条：其中 80 条已覆盖 → 裁剪全部覆盖，无 pending
  assert.equal((thread.pending_trim ?? []).length, 0);
  assert.equal(thread.summarized_message_count, 60);
  assert.equal(thread.archived_count, 50);
});

/* —— 参与者知情范围 —— */

test('私聊事实不会泄漏给第三人', () => {
  const { data, thread } = makeData();
  ensureContact(data, OTHER, '测试', 'test', '2013-05-20');
  const ab = ensureDirectThread(data, OTHER, PLAYER, '2013-05-20', 'test');
  ensureContact(data, THIRD, '测试', 'test', '2013-05-20');
  const group = createGroupThreadForTest(data);
  const groupThread = data.threads[group];
  data.context.facts.push({
    id: 'f-private-ab',
    text: '雪乃私下告诉八幡的秘密',
    participants: [PLAYER, OTHER],
    visibility: 'private',
    source: 'mainline:1',
    active: true,
    created_at: '',
  });
  data.context.facts.push({
    id: 'f-player-only',
    text: '只有玩家知道的秘密',
    participants: [PLAYER],
    visibility: 'player',
    source: 'mainline:2',
    active: true,
    created_at: '',
  });
  data.context.facts.push({
    id: 'f-group',
    text: '三人小群里说的事',
    participants: [PLAYER, OTHER, THIRD],
    visibility: 'group',
    source: 'mainline:3',
    active: true,
    created_at: '',
  });

  // 私聊线程 AB：能看到 private(AB)；player-only 不给 NPC；群聊事实需要全部成员在场
  const abFacts = matchedMainlineFacts(data, ab);
  assert.deepEqual(new Set(abFacts.map(f => f.id)), new Set(['f-private-ab']));

  // 玩家与第三人私聊线程：看不到 private(AB)，也看不到成员不全的群聊事实
  const thirdThread = ensureDirectThread(data, THIRD, PLAYER, '2013-05-20', 'test');
  const thirdFacts = matchedMainlineFacts(data, thirdThread);
  assert.deepEqual(new Set(thirdFacts.map(f => f.id)), new Set([]));

  // 群聊线程（三人）：私聊事实与群聊事实都只在全部知情者在场时可见
  const groupFacts = matchedMainlineFacts(data, groupThread);
  assert.deepEqual(new Set(groupFacts.map(f => f.id)), new Set(['f-private-ab', 'f-group']));
  // 群聊事实只对当时成员可见：含第四人的事实在三人群里不可见
  data.context.facts.push({
    id: 'f-four',
    text: '四人场面',
    participants: [PLAYER, OTHER, THIRD, '一色彩羽'],
    visibility: 'group',
    source: 'mainline:4',
    active: true,
    created_at: '',
  });
  assert.equal(matchedMainlineFacts(data, groupThread).some(f => f.id === 'f-four'), false);
});

test('约定同样受参与者知情范围约束', () => {
  const { data, thread } = makeData();
  data.context.appointments.push({
    id: 'a-ab',
    text: '周末和雪乃看电影',
    due_story_time: null,
    participants: [PLAYER, OTHER],
    visibility: 'private',
    source: 'mainline:1',
    status: 'pending',
    created_at: '',
  });
  data.context.appointments.push({
    id: 'a-player',
    text: '玩家自己的安排',
    due_story_time: null,
    participants: [PLAYER],
    visibility: 'player',
    source: 'mainline:2',
    status: 'pending',
    created_at: '',
  });
  const ab = ensureDirectThread(data, OTHER, PLAYER, '2013-05-20', 'test');
  const thirdThread = ensureDirectThread(data, THIRD, PLAYER, '2013-05-20', 'test');
  assert.deepEqual(matchedMainlineAppointments(data, ab).map(a => a.id), ['a-ab']);
  assert.deepEqual(matchedMainlineAppointments(data, thirdThread).map(a => a.id), []);
});

/* —— 归一化兼容新字段 —— */

test('normalizePhoneData 保留 pending_trim 与事实溯源字段', () => {
  const raw = {
    version: 2,
    contacts: {},
    threads: {
      'direct:雪之下雪乃': {
        id: 'direct:雪之下雪乃',
        type: 'direct',
        title: '雪之下雪乃',
        participants: [PLAYER, OTHER],
        created_at: '',
        created_source: 'test',
        last_message_at: null,
        unread: 0,
        summary: '',
        summarized_message_count: 0,
        important_facts: [],
        pending_appointments: [],
        pending_trim: ['[旧] x'],
      },
    },
    messages: {},
    forum: { posts: [] },
    context: {
      active_snapshot: null,
      manual_queue: [],
      ingest_records: {},
      facts: [
        {
          id: 'f1',
          text: '面对面见过面',
          participants: [PLAYER, OTHER],
          visibility: 'private',
          source: 'mainline:5',
          active: true,
          created_at: '',
          source_message_id: 5,
          evidence: '主线原文依据',
        },
      ],
      appointments: [],
    },
    requests: [],
  };
  const normalized = normalizePhoneData(raw, {}, PLAYER, '2013-05-20');
  assert.deepEqual(normalized.threads['direct:雪之下雪乃'].pending_trim, ['[旧] x']);
  const fact = normalized.context.facts[0];
  assert.equal(fact.source_message_id, 5);
  assert.equal(fact.evidence, '主线原文依据');
});

function createGroupThreadForTest(data: ReturnType<typeof createPhoneData>): string {
  const thread = {
    id: 'group:test',
    type: 'group' as const,
    title: '测试群',
    participants: [canonicalName(PLAYER), canonicalName(OTHER), canonicalName(THIRD)],
    created_at: '',
    created_source: 'test',
    last_message_at: null,
    unread: 0,
    summary: '',
    summarized_message_count: 0,
    important_facts: [],
    pending_appointments: [],
  };
  data.threads[thread.id] = thread;
  data.messages[thread.id] = [];
  return thread.id;
}
