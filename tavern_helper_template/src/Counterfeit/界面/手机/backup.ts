// 手机助手 · 记录保存与备份（纯逻辑模块，无 Vue/酒馆依赖，可在 node:test 中直接测试）。
// 本批次能力：
//   ① 导出全部手机数据为 JSON（version/contacts/threads/messages/summaries/facts/appointments/context/requests）
//   ② 导入：合并 / 覆盖；导入前由调用方先导出现有备份
//   ③ 严格校验 version、thread_id、message_id、participants；ID 冲突时不得静默覆盖
//   ④ 导出当前会话为 Markdown（会话标题/参与者/故事时间/发言者/完整消息，正文转义）
// 本批次不实现单条消息删除（涉及重建摘要、重要事实、已消费快照与数据库来源，另行独立功能）。

import {
  canonicalName,
  createPhoneData,
  type PhoneAppointment,
  type PhoneContextSnapshot,
  type PhoneData,
  type PhoneMemoryFact,
  type PhoneMessage,
  type PhoneRequest,
  type PhoneThread,
} from './phoneData';

/** 备份文件版本（与 PhoneData 内部 version 相互独立） */
export const BACKUP_VERSION = 1;

export interface PhoneBackup {
  version: number;
  exported_at: string;
  contacts: Record<string, unknown>;
  threads: Record<string, unknown>;
  messages: Record<string, unknown[]>;
  summaries: Record<string, { summary: string; summarized_message_count: number; archived_count?: number }>;
  facts: unknown[];
  appointments: unknown[];
  context: {
    active_snapshot: PhoneContextSnapshot | null;
    manual_queue: number[];
    ingest_records: Record<string, unknown>;
  };
  requests: unknown[];
}

export interface ImportReport {
  /** 新增计数 */
  contactsAdded: number;
  threadsAdded: number;
  messagesAdded: number;
  factsAdded: number;
  appointmentsAdded: number;
  requestsAdded: number;
  /** 冲突（跳过未覆盖）计数 */
  contactsSkipped: number;
  threadsSkipped: number;
  messagesSkipped: number;
  factsSkipped: number;
  appointmentsSkipped: number;
  requestsSkipped: number;
  /** 冲突明细（ID 冲突不静默覆盖，全部列出来由界面反馈） */
  conflicts: string[];
  /** 导入后的完整数据（merge 为合并结果；overwrite 为全新数据） */
  data: PhoneData;
}

export function emptyImportReport(data: PhoneData): ImportReport {
  return {
    contactsAdded: 0,
    threadsAdded: 0,
    messagesAdded: 0,
    factsAdded: 0,
    appointmentsAdded: 0,
    requestsAdded: 0,
    contactsSkipped: 0,
    threadsSkipped: 0,
    messagesSkipped: 0,
    factsSkipped: 0,
    appointmentsSkipped: 0,
    requestsSkipped: 0,
    conflicts: [],
    data,
  };
}

/** 导出全部手机数据为备份 JSON（含 per-thread summaries 快照，导入时可重建） */
export function exportPhoneDataToBackup(data: PhoneData): PhoneBackup {
  const summaries: PhoneBackup['summaries'] = {};
  for (const [id, thread] of Object.entries(data.threads)) {
    summaries[id] = {
      summary: thread.summary ?? '',
      summarized_message_count: thread.summarized_message_count ?? 0,
      archived_count: thread.archived_count ?? 0,
    };
  }
  return {
    version: BACKUP_VERSION,
    exported_at: new Date().toISOString(),
    contacts: clone(data.contacts),
    threads: clone(data.threads),
    messages: clone(data.messages),
    summaries,
    facts: clone(data.context.facts),
    appointments: clone(data.context.appointments),
    context: {
      active_snapshot: data.context.active_snapshot ? clone(data.context.active_snapshot) : null,
      manual_queue: [...(data.context.manual_queue ?? [])],
      ingest_records: clone(data.context.ingest_records),
    },
    requests: clone(data.requests),
  };
}

/** 严格校验备份结构：version / thread_id / message_id / participants 缺一不可 */
export function validatePhoneBackup(raw: unknown): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!raw || typeof raw !== 'object') {
    return { ok: false, errors: ['备份不是有效对象'] };
  }
  const backup = raw as Record<string, unknown>;
  if (backup.version !== BACKUP_VERSION) {
    errors.push(`版本不匹配：期望 ${BACKUP_VERSION}，实际 ${String(backup.version)}`);
  }
  if (backup.contacts === undefined || typeof backup.contacts !== 'object' || Array.isArray(backup.contacts)) {
    errors.push('缺少 contacts 对象');
  } else {
    for (const [key, value] of Object.entries(backup.contacts as Record<string, unknown>)) {
      if (!value || typeof value !== 'object') errors.push(`联系人 ${key} 不是对象`);
      else if (typeof (value as { character?: unknown }).character !== 'string' || !(value as { character?: unknown }).character) {
        errors.push(`联系人 ${key} 缺少 character`);
      } else if (
        (value as { display_name?: unknown }).display_name !== undefined &&
        typeof (value as { display_name?: unknown }).display_name !== 'string'
      ) {
        errors.push(`联系人 ${key} 的 display_name 非法`);
      }
    }
  }
  if (backup.threads === undefined || typeof backup.threads !== 'object' || Array.isArray(backup.threads)) {
    errors.push('缺少 threads 对象');
  } else {
    for (const [id, value] of Object.entries(backup.threads as Record<string, unknown>)) {
      if (!value || typeof value !== 'object') {
        errors.push(`会话 ${id} 不是对象`);
        continue;
      }
      const thread = value as { id?: unknown; participants?: unknown; title?: unknown; type?: unknown; created_at?: unknown };
      if (thread.id !== id) errors.push(`会话 ${id} 的 id 字段不一致`);
      if (
        !Array.isArray(thread.participants) ||
        thread.participants.length < 2 ||
        thread.participants.some(p => typeof p !== 'string' || !p)
      ) {
        errors.push(`会话 ${id} 的 participants 非法（需至少 2 名参与者）`);
      }
      // 渲染必需字段：缺失会让消息页/会话列表渲染期抛错（黑屏），导入前直接拒绝
      if (typeof thread.title !== 'string' || !thread.title) errors.push(`会话 ${id} 缺少 title`);
      if (thread.type !== 'direct' && thread.type !== 'group') errors.push(`会话 ${id} 的 type 非法`);
      if (typeof thread.created_at !== 'string' || !thread.created_at) {
        errors.push(`会话 ${id} 缺少 created_at`);
      }
    }
  }
  if (backup.messages === undefined || typeof backup.messages !== 'object' || Array.isArray(backup.messages)) {
    errors.push('缺少 messages 对象');
  } else {
    for (const [threadId, list] of Object.entries(backup.messages as Record<string, unknown>)) {
      if (!Array.isArray(list)) {
        errors.push(`会话 ${threadId} 的消息不是数组`);
        continue;
      }
      for (const item of list) {
        if (!item || typeof item !== 'object') {
          errors.push(`会话 ${threadId} 含非法消息`);
          continue;
        }
        const message = item as {
          id?: unknown;
          thread_id?: unknown;
          sender?: unknown;
          participants?: unknown;
          text?: unknown;
          created_at?: unknown;
        };
        if (typeof message.id !== 'string' || !message.id) errors.push(`会话 ${threadId} 消息缺少 id`);
        if (message.thread_id !== threadId) errors.push(`会话 ${threadId} 消息 thread_id 与所属数组不一致`);
        if (typeof message.sender !== 'string' || !message.sender) errors.push(`会话 ${threadId} 消息缺少 sender`);
        if (!Array.isArray(message.participants) || message.participants.some(p => typeof p !== 'string')) {
          errors.push(`会话 ${threadId} 消息 participants 非法`);
        }
        // 渲染/快照必需字段：缺 text 会显示空白，缺 created_at 会让主线快照排序抛错
        if (typeof message.text !== 'string') errors.push(`会话 ${threadId} 消息缺少 text`);
        if (typeof message.created_at !== 'string' || !message.created_at) {
          errors.push(`会话 ${threadId} 消息缺少 created_at`);
        }
      }
    }
  }
  for (const field of ['facts', 'appointments', 'requests'] as const) {
    if (backup[field] === undefined || !Array.isArray(backup[field])) {
      errors.push(`缺少 ${field} 数组`);
    }
  }
  if (!backup.context || typeof backup.context !== 'object') {
    errors.push('缺少 context 对象');
  }
  if (!backup.summaries || typeof backup.summaries !== 'object') {
    errors.push('缺少 summaries 对象');
  }
  return { ok: errors.length === 0, errors };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** 合并导入：逐条并入，ID 冲突一律跳过并记录，绝不静默覆盖 */
export function mergePhoneBackup(current: PhoneData, backup: PhoneBackup): ImportReport {
  const report = emptyImportReport(current);
  const data = current;
  const backupContacts = backup.contacts as Record<string, Record<string, unknown>>;
  for (const [key, value] of Object.entries(backupContacts ?? {})) {
    if (!value || typeof value !== 'object') continue;
    const character = canonicalName(String((value as { character?: unknown }).character ?? key));
    if (data.contacts[character]) {
      report.contactsSkipped += 1;
      report.conflicts.push(`联系人 ${character} 已存在，保留现有`);
      continue;
    }
    const contact = clone(value as Record<string, unknown>);
    (contact as { character?: string }).character = character;
    (contact as { display_name?: string }).display_name = String(contact.display_name || character);
    data.contacts[character] = contact as PhoneData['contacts'][string];
    report.contactsAdded += 1;
  }
  const backupThreads = backup.threads as Record<string, Record<string, unknown>>;
  for (const [id, value] of Object.entries(backupThreads ?? {})) {
    if (!value || typeof value !== 'object') continue;
    if (data.threads[id]) {
      report.threadsSkipped += 1;
      report.conflicts.push(`会话 ${id} 已存在，保留现有`);
      continue;
    }
    const thread = clone(value) as PhoneThread;
    thread.important_facts = Array.isArray(thread.important_facts) ? thread.important_facts : [];
    thread.pending_appointments = Array.isArray(thread.pending_appointments) ? thread.pending_appointments : [];
    thread.pending_trim = Array.isArray(thread.pending_trim) ? thread.pending_trim : [];
    thread.summary = String(thread.summary ?? '');
    thread.summarized_message_count = Number(thread.summarized_message_count ?? 0);
    const summary = (backup.summaries ?? {})[id];
    if (summary && typeof summary === 'object') {
      thread.summary = String((summary as { summary?: unknown }).summary ?? thread.summary);
      thread.summarized_message_count = Number(
        (summary as { summarized_message_count?: unknown }).summarized_message_count ?? thread.summarized_message_count,
      );
      const archived = (summary as { archived_count?: unknown }).archived_count;
      if (typeof archived === 'number') thread.archived_count = archived;
    }
    data.threads[id] = thread;
    data.messages[id] = [];
    report.threadsAdded += 1;
  }
  const backupMessages = backup.messages as Record<string, unknown[]>;
  for (const [threadId, list] of Object.entries(backupMessages ?? {})) {
    if (!Array.isArray(list)) continue;
    if (!data.threads[threadId] && !backupThreads?.[threadId]) {
      report.messagesSkipped += list.length;
      report.conflicts.push(`会话 ${threadId} 的消息因会话缺失被跳过`);
      continue;
    }
    const target = (data.messages[threadId] ??= []);
    const existingIds = new Set(target.map(m => m.id));
    for (const item of list) {
      if (!item || typeof item !== 'object') continue;
      const message = item as PhoneMessage;
      if (!message.id || typeof message.id !== 'string') continue;
      if (existingIds.has(message.id)) {
        report.messagesSkipped += 1;
        report.conflicts.push(`消息 ${message.id} 已存在，保留现有`);
        continue;
      }
      existingIds.add(message.id);
      target.push(clone(message));
      report.messagesAdded += 1;
    }
    if (data.threads[threadId]) {
      data.threads[threadId].last_message_at = data.threads[threadId].last_message_at ?? target.at(-1)?.created_at ?? null;
    }
  }
  report.factsAdded += mergeById(data.context.facts, backup.facts, report, '事实');
  report.appointmentsAdded += mergeById(data.context.appointments, backup.appointments, report, '约定');
  report.requestsAdded += mergeById(data.requests, backup.requests, report, '委托');
  return report;
}

function mergeById<T extends { id: string }>(
  target: T[],
  incoming: unknown[] | undefined,
  report: ImportReport,
  label: string,
): number {
  if (!Array.isArray(incoming)) return 0;
  const existingIds = new Set(target.map(item => item.id));
  let added = 0;
  for (const item of incoming) {
    if (!item || typeof item !== 'object') continue;
    const record = item as T;
    if (!record.id || typeof record.id !== 'string') continue;
    if (existingIds.has(record.id)) {
      if (label === '事实') {
        report.factsSkipped += 1;
        report.conflicts.push(`${label} ${record.id} 已存在，保留现有`);
      } else if (label === '约定') {
        report.appointmentsSkipped += 1;
        report.conflicts.push(`${label} ${record.id} 已存在，保留现有`);
      } else {
        report.requestsSkipped += 1;
        report.conflicts.push(`${label} ${record.id} 已存在，保留现有`);
      }
      continue;
    }
    existingIds.add(record.id);
    target.push(clone(record));
    added += 1;
  }
  return added;
}

/** 覆盖导入：整体替换（备份内容先行通过 validatePhoneBackup 校验） */
export function overwritePhoneBackup(_current: PhoneData, backup: PhoneBackup): ImportReport {
  const data = createPhoneData();
  const report = emptyImportReport(data);
  const backupContacts = (backup.contacts ?? {}) as Record<string, Record<string, unknown>>;
  const backupThreads = (backup.threads ?? {}) as Record<string, Record<string, unknown>>;
  for (const [key, value] of Object.entries(backupContacts)) {
    if (!value || typeof value !== 'object') continue;
    const contact = clone(value);
    const character = canonicalName(String((contact as { character?: unknown }).character ?? key));
    (contact as { character?: string }).character = character;
    // 与 merge 路径对齐：display_name 缺失时回退 canonical 名，缺字段备份导入后联系人列表不崩
    (contact as { display_name?: string }).display_name = String(contact.display_name || character);
    data.contacts[character] = contact as PhoneData['contacts'][string];
    report.contactsAdded += 1;
  }
  for (const [id, value] of Object.entries(backupThreads)) {
    if (!value || typeof value !== 'object') continue;
    const thread = clone(value) as PhoneThread;
    thread.important_facts ??= [];
    thread.pending_appointments ??= [];
    thread.pending_trim = Array.isArray(thread.pending_trim) ? thread.pending_trim : [];
    thread.summary = String(thread.summary ?? '');
    thread.summarized_message_count = Number(thread.summarized_message_count ?? 0);
    const summary = (backup.summaries ?? {})[id];
    if (summary && typeof summary === 'object') {
      thread.summary = String((summary as { summary?: unknown }).summary ?? thread.summary);
      thread.summarized_message_count = Number(
        (summary as { summarized_message_count?: unknown }).summarized_message_count ?? thread.summarized_message_count,
      );
      const archived = (summary as { archived_count?: unknown }).archived_count;
      if (typeof archived === 'number') thread.archived_count = archived;
    }
    data.threads[id] = thread;
    data.messages[id] = [];
    report.threadsAdded += 1;
  }
  const backupMessages = (backup.messages ?? {}) as Record<string, unknown[]>;
  for (const [threadId, list] of Object.entries(backupMessages)) {
    if (!Array.isArray(list) || !data.threads[threadId]) continue;
    const target = (data.messages[threadId] = []);
    for (const item of list) {
      if (!item || typeof item !== 'object') continue;
      const message = item as PhoneMessage;
      if (!message.id || typeof message.id !== 'string') continue;
      target.push(clone(message));
      report.messagesAdded += 1;
    }
  }
  data.context.facts = (backup.facts as PhoneMemoryFact[] | undefined)?.filter(isEntity) ?? [];
  report.factsAdded = data.context.facts.length;
  data.context.appointments = (backup.appointments as PhoneAppointment[] | undefined)?.filter(isEntity) ?? [];
  report.appointmentsAdded = data.context.appointments.length;
  data.requests = (backup.requests as PhoneRequest[] | undefined)?.filter(isEntity) ?? [];
  report.requestsAdded = data.requests.length;
  const context = backup.context as PhoneBackup['context'] | undefined;
  if (context) {
    data.context.active_snapshot =
      context.active_snapshot && typeof context.active_snapshot === 'object' ? clone(context.active_snapshot) : null;
    data.context.manual_queue = Array.isArray(context.manual_queue) ? context.manual_queue.filter(Number.isInteger) : [];
    if (context.ingest_records && typeof context.ingest_records === 'object') {
      data.context.ingest_records = clone(context.ingest_records);
    }
  }
  return report;
}

function isEntity(value: unknown): value is { id: string } {
  return Boolean(value && typeof value === 'object' && typeof (value as { id?: unknown }).id === 'string');
}

/* —— Markdown 导出（当前会话） —— */

/** Markdown 转义：消息正文与标题字段统一走这里，避免用户/AI 内容破坏文档结构 */
export function mdEscape(text: string): string {
  return String(text ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\*/g, '\\*')
    .replace(/_/g, '\\_')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/</g, '\\<')
    .replace(/>/g, '\\>')
    .replace(/\|/g, '\\|')
    .replace(/#/g, '\\#');
}

/** 导出当前会话为 Markdown：标题 / 参与者 / 故事时间 / 发言者 / 完整当前保留消息 */
export function exportThreadToMarkdown(
  data: PhoneData,
  threadId: string,
  playerName: string,
  opts: { includeSummary?: boolean } = {},
): string {
  const thread = data.threads[threadId];
  if (!thread) return '';
  const messages = (data.messages[threadId] ?? []).slice();
  const times = messages.map(m => m.story_time).filter(Boolean);
  const lines: string[] = [];
  lines.push(`# ${mdEscape(thread.title)}`);
  lines.push('');
  lines.push(`- 参与者：${thread.participants.map(mdEscape).join('、')}`);
  lines.push(`- 会话类型：${thread.type === 'group' ? '群聊' : '私聊'}`);
  lines.push(
    `- 故事时间：${times.length ? `${times[0]} ～ ${times[times.length - 1]}` : '未记录'}`,
  );
  lines.push(`- 导出时间：${new Date().toISOString()}`);
  lines.push('');
  if (opts.includeSummary && thread.summary) {
    lines.push(`## 滚动摘要\n\n${mdEscape(thread.summary)}`);
    lines.push('');
  }
  lines.push('## 消息');
  lines.push('');
  for (const message of messages) {
    const sender = message.sender === canonicalName(playerName) ? '我' : message.sender;
    const time = message.story_time ? `（${message.story_time}）` : '';
    lines.push(`- ${mdEscape(sender)}${mdEscape(time)}：${mdEscape(message.text)}`);
  }
  return `${lines.join('\n')}\n`;
}

/** 触发浏览器下载（导出 JSON / Markdown 共用） */
export function downloadText(filename: string, text: string, mime = 'application/octet-stream') {
  try {
    const blob = new Blob([text], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.setTimeout(() => URL.revokeObjectURL(url), 3000);
  } catch {
    /* 预览环境无 DOM 时放弃 */
  }
}
