import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  exportPhoneDataToBackup,
  exportThreadToMarkdown,
  mdEscape,
  mergePhoneBackup,
  overwritePhoneBackup,
  validatePhoneBackup,
  BACKUP_VERSION,
} from './.build/backup.ts';
import { createPhoneData, ensureContact, ensureDirectThread } from './.build/phoneData.ts';

const PLAYER = '比企谷八幡';
const OTHER = '雪之下雪乃';

function sampleData() {
  const data = createPhoneData();
  ensureContact(data, OTHER, '测试交换号码', 'test', '2013-05-20');
  const thread = ensureDirectThread(data, OTHER, PLAYER, '2013-05-20', 'test');
  data.threads[thread.id].summary = '两人在聊周末的安排';
  data.threads[thread.id].summarized_message_count = 3;
  data.threads[thread.id].archived_count = 2;
  data.messages[thread.id].push({
    id: 'msg:1',
    thread_id: thread.id,
    sender: PLAYER,
    text: '周末有空吗？',
    story_time: '2013-05-20',
    participants: [PLAYER, OTHER],
    visibility: 'private',
    source: 'player',
    created_at: '2026-01-01T00:00:00.000Z',
    consumed_by_mainline: false,
  });
  data.messages[thread.id].push({
    id: 'msg:2',
    thread_id: thread.id,
    sender: OTHER,
    text: '有。',
    story_time: '2013-05-20',
    participants: [PLAYER, OTHER],
    visibility: 'private',
    source: 'direct_reply',
    created_at: '2026-01-01T00:01:00.000Z',
    consumed_by_mainline: false,
  });
  data.context.facts.push({
    id: 'fact:1',
    text: '雪乃说周末有空',
    participants: [PLAYER, OTHER],
    visibility: 'private',
    source: 'mainline:3',
    active: true,
    created_at: '',
    source_message_id: 3,
    evidence: '雪乃回答"有。"',
  });
  data.context.appointments.push({
    id: 'appt:1',
    text: '周末看电影',
    due_story_time: null,
    participants: [PLAYER, OTHER],
    visibility: 'private',
    source: 'mainline:3',
    status: 'pending',
    created_at: '',
  });
  data.requests.push({
    id: 'req:1',
    title: '帮忙找猫',
    client: '匿名学生',
    body: '猫丢了',
    hint: '在公园方向',
    location: '公园',
    story_time: '2013-05-20',
    status: 'open',
    source: 'auto',
    created_at: '',
  });
  return data;
}

/* —— JSON 导出结构 —— */

test('导出包含 version/contacts/threads/messages/summaries/facts/appointments/context/requests', () => {
  const backup = exportPhoneDataToBackup(sampleData());
  assert.equal(backup.version, BACKUP_VERSION);
  assert.equal(typeof backup.exported_at, 'string');
  assert.ok(backup.contacts['雪之下雪乃']);
  assert.ok(backup.threads['direct:雪之下雪乃']);
  assert.equal((backup.messages['direct:雪之下雪乃'] as unknown[]).length, 2);
  assert.equal(backup.summaries['direct:雪之下雪乃'].summarized_message_count, 3);
  assert.equal(backup.summaries['direct:雪之下雪乃'].archived_count, 2);
  assert.equal((backup.facts as unknown[]).length, 1);
  assert.equal((backup.appointments as unknown[]).length, 1);
  assert.equal((backup.requests as unknown[]).length, 1);
  assert.ok(backup.context);
});

/* —— 严格校验 —— */

test('校验拒绝：版本错误 / 缺 message_id / thread_id 不一致 / participants 非法', () => {
  const good = exportPhoneDataToBackup(sampleData());
  assert.equal(validatePhoneBackup(good).ok, true);

  const badVersion = { ...good, version: 99 };
  assert.equal(validatePhoneBackup(badVersion).ok, false);

  const badMessage = structuredClone(good);
  const list = (badMessage.messages['direct:雪之下雪乃'] as Record<string, unknown>[]);
  delete list[0].id;
  const v1 = validatePhoneBackup(badMessage);
  assert.equal(v1.ok, false);
  assert.ok(v1.errors.some(e => e.includes('缺少 id')));

  const badThreadId = structuredClone(good);
  (badThreadId.messages['direct:雪之下雪乃'] as Record<string, unknown>[])[1].thread_id = 'other';
  assert.equal(validatePhoneBackup(badThreadId).ok, false);

  const badParticipants = structuredClone(good);
  (badParticipants.threads['direct:雪之下雪乃'] as Record<string, unknown>).participants = ['只有一个人'];
  assert.equal(validatePhoneBackup(badParticipants).ok, false);

  assert.equal(validatePhoneBackup(null).ok, false);
  assert.equal(validatePhoneBackup('string').ok, false);
});

/* —— 合并导入：冲突不静默覆盖 —— */

test('合并导入：新内容并入，ID 冲突跳过并记录', () => {
  const current = sampleData();
  const backup = exportPhoneDataToBackup(sampleData());
  // 备份里加一条新消息与一个新联系人
  const list = backup.messages['direct:雪之下雪乃'] as Record<string, unknown>[];
  list.push({
    id: 'msg:3',
    thread_id: 'direct:雪之下雪乃',
    sender: PLAYER,
    text: '那说好了',
    story_time: '2013-05-20',
    participants: [PLAYER, OTHER],
    visibility: 'private',
    source: 'player',
    created_at: '2026-01-01T00:02:00.000Z',
    consumed_by_mainline: false,
  });
  backup.contacts['由比滨结衣'] = {
    character: '由比滨结衣',
    display_name: '由比滨结衣',
    status: 'active',
    basis: '备份导入',
    source: 'backup',
    added_at: '',
    updated_at: '',
    removed_at: null,
    blocked_at: null,
  };
  const report = mergePhoneBackup(current, backup);

  assert.equal(report.contactsAdded, 1);
  assert.equal(report.messagesAdded, 1);
  assert.equal(report.threadsSkipped, 1, '同 id 会话跳过');
  assert.equal(report.messagesSkipped, 2, '同 id 消息跳过');
  assert.equal(report.factsSkipped, 1);
  assert.equal(report.appointmentsSkipped, 1);
  assert.equal(report.requestsSkipped, 1);
  assert.ok(report.conflicts.length >= 3, '冲突必须被明确记录');
  assert.ok(report.conflicts.some(c => c.includes('消息 msg:1 已存在')));
  // 原消息内容未被覆盖
  assert.equal(current.messages['direct:雪之下雪乃'][0].text, '周末有空吗？');
  // 新消息已并入
  assert.equal(current.messages['direct:雪之下雪乃'].some(m => m.id === 'msg:3'), true);
});

test('合并导入：新会话（含 summaries 重建）并入', () => {
  const current = sampleData();
  const backup = exportPhoneDataToBackup(sampleData());
  const threadId = 'direct:由比滨结衣';
  backup.threads[threadId] = {
    id: threadId,
    type: 'direct',
    title: '由比滨结衣',
    participants: [PLAYER, '由比滨结衣'],
    created_at: '',
    created_source: 'test',
    last_message_at: null,
    unread: 0,
    summary: '旧摘要',
    summarized_message_count: 0,
    important_facts: [],
    pending_appointments: [],
  };
  backup.summaries[threadId] = { summary: '和结衣聊了泳装', summarized_message_count: 5, archived_count: 2 };
  backup.messages[threadId] = [
    {
      id: 'msg:y1',
      thread_id: threadId,
      sender: '由比滨结衣',
      text: '今天好热',
      story_time: '2013-05-21',
      participants: [PLAYER, '由比滨结衣'],
      visibility: 'private',
      source: 'direct_reply',
      created_at: '2026-01-02T00:00:00.000Z',
      consumed_by_mainline: false,
    },
  ];
  const report = mergePhoneBackup(current, backup);
  assert.equal(report.threadsAdded, 1);
  assert.equal(report.messagesAdded, 1);
  const thread = current.threads[threadId];
  assert.ok(thread);
  assert.equal(thread.summary, '和结衣聊了泳装');
  assert.equal(thread.summarized_message_count, 5);
  assert.equal(thread.archived_count, 2);
});

/* —— 覆盖导入 —— */

test('覆盖导入：整体替换并重建 summaries/facts/appointments', () => {
  const current = sampleData();
  const backup = exportPhoneDataToBackup(sampleData());
  const result = overwritePhoneBackup(current, backup);
  const data = result.data;
  assert.equal(Object.keys(data.contacts).length, 1);
  assert.ok(data.threads['direct:雪之下雪乃']);
  assert.equal((data.messages['direct:雪之下雪乃'] ?? []).length, 2);
  assert.equal(data.context.facts.length, 1);
  assert.equal(data.context.appointments.length, 1);
  assert.equal(data.requests.length, 1);
  assert.equal(data.threads['direct:雪之下雪乃'].summary, '两人在聊周末的安排');
});

/* —— Markdown 导出：内容完整 + 转义正确 —— */

test('Markdown 导出包含标题/参与者/故事时间/发言者/完整消息', () => {
  const data = sampleData();
  const md = exportThreadToMarkdown(data, 'direct:雪之下雪乃', PLAYER, { includeSummary: true });
  assert.match(md, /^# 雪之下雪乃/m);
  assert.match(md, /参与者：比企谷八幡、雪之下雪乃/);
  assert.match(md, /故事时间：2013-05-20 ～ 2013-05-20/);
  assert.match(md, /- 我（2013-05-20）：周末有空吗？/);
  assert.match(md, /- 雪之下雪乃（2013-05-20）：有。/);
  assert.match(md, /## 滚动摘要/);
  assert.match(md, /两人在聊周末的安排/);
  // 完整消息：两条都在（消息行前缀为「- 我（…）：」/「- 雪之下雪乃（…）：」）
  const messageLines = md.match(/^- (?:我|雪之下雪乃)（2013-05-20）：/gm) ?? [];
  assert.equal(messageLines.length, 2);
});

test('Markdown 转义正确：特殊字符不会破坏文档结构', () => {
  assert.equal(mdEscape('a#b'), 'a\\#b');
  assert.equal(mdEscape('a*b'), 'a\\*b');
  assert.equal(mdEscape('a_b'), 'a\\_b');
  assert.equal(mdEscape('[x](y)'), '\\[x\\](y)');
  assert.equal(mdEscape('a|b'), 'a\\|b');
  assert.equal(mdEscape('a<b>'), 'a\\<b\\>');
  assert.equal(mdEscape('a`b'), 'a\\`b');
  assert.equal(mdEscape('a\\b'), 'a\\\\b');

  const data = sampleData();
  const last = data.messages['direct:雪之下雪乃'][1];
  last.text = '用 # 强调 *星星* 和 `代码` 还有 | 分隔';
  const md = exportThreadToMarkdown(data, 'direct:雪之下雪乃', PLAYER);
  assert.match(md, /\\# 强调 \\\*星星\\\* 和 \\`代码\\` 还有 \\| 分隔/);
  // 转义后原文内容仍可逆（取最后一条消息行，去转义等于原文）
  const lines = [...md.matchAll(/：(.+)$/gm)];
  const raw = lines.at(-1)?.[1] ?? '';
  const unescaped = raw.replace(/\\([\\`*_{}[\]<>|#])/g, '$1');
  assert.equal(unescaped, '用 # 强调 *星星* 和 `代码` 还有 | 分隔');
});
