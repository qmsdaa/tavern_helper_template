export type ContactStatus = 'active' | 'removed' | 'blocked';
export type ThreadKind = 'direct' | 'group';
export type PhoneMessageSource =
  | 'player'
  | 'direct_reply'
  | 'group_reply'
  | 'proactive_message'
  | 'mainline_ingest'
  | 'migration';
export type VisibilityKind = 'private' | 'group' | 'player';

export interface PhoneContact {
  character: string;
  display_name: string;
  status: ContactStatus;
  basis: string;
  source: string;
  added_at: string;
  updated_at: string;
  removed_at: string | null;
  blocked_at: string | null;
}

export interface PhoneMemoryFact {
  id: string;
  text: string;
  participants: string[];
  visibility: VisibilityKind;
  source: string;
  active: boolean;
  created_at: string;
}

export interface PhoneAppointment {
  id: string;
  text: string;
  due_story_time: string | null;
  participants: string[];
  visibility: VisibilityKind;
  source: string;
  status: 'pending' | 'done' | 'cancelled';
  created_at: string;
}

export interface PhoneThread {
  id: string;
  type: ThreadKind;
  title: string;
  participants: string[];
  created_at: string;
  created_source: string;
  last_message_at: string | null;
  unread: number;
  summary: string;
  summarized_message_count: number;
  important_facts: PhoneMemoryFact[];
  pending_appointments: PhoneAppointment[];
}

export interface PhoneMessage {
  id: string;
  thread_id: string;
  sender: string;
  text: string;
  story_time: string;
  participants: string[];
  visibility: VisibilityKind;
  source: PhoneMessageSource;
  created_at: string;
  consumed_by_mainline: boolean;
}

export interface ForumReply {
  id: string;
  author: string;
  body: string;
  story_time: string;
  created_at: string;
}

export interface ForumPost {
  id: string;
  board: string;
  type: string;
  title: string;
  author: string;
  body: string;
  story_time: string;
  heat: number;
  status: 'active' | 'resolved' | 'locked';
  created_at: string;
  replies: ForumReply[];
}

export interface PhoneContextSnapshot {
  id: string;
  mainline_user_message_id: number | null;
  created_at: string;
  new_message_ids: string[];
  text: string;
}

export interface MainlineIngestRecord {
  message_id: number;
  fingerprint: string;
  source: string;
  previous_contacts: Record<string, PhoneContact | null>;
  created_thread_ids: string[];
  added_fact_ids: string[];
  added_appointment_ids: string[];
  parsed_at: string;
}

export interface PhoneContextState {
  active_snapshot: PhoneContextSnapshot | null;
  manual_queue: number[];
  ingest_records: Record<string, MainlineIngestRecord>;
  facts: PhoneMemoryFact[];
  appointments: PhoneAppointment[];
}

export interface PhoneData {
  version: 2;
  contacts: Record<string, PhoneContact>;
  threads: Record<string, PhoneThread>;
  messages: Record<string, PhoneMessage[]>;
  forum: {
    posts: ForumPost[];
  };
  context: PhoneContextState;
}

export interface LegacyChatMessage {
  from?: 'me' | 'them';
  text?: string;
  t?: string;
}

const CANONICAL_ALIASES: Record<string, string> = {
  拉芙希妮: '拉芙希妮·都柏林',
  八幡: '比企谷八幡',
  雪乃: '雪之下雪乃',
  结衣: '由比滨结衣',
  一色: '一色彩羽',
};

const IDENTITY_CONTACTS: Record<string, string[]> = {
  比企谷八幡: ['雪之下雪乃', '由比滨结衣'],
  雪之下雪乃: ['比企谷八幡', '由比滨结衣'],
  由比滨结衣: ['比企谷八幡', '雪之下雪乃'],
  '拉芙希妮·都柏林': [],
};

export function canonicalName(name: string): string {
  const trimmed = String(name ?? '').trim();
  return CANONICAL_ALIASES[trimmed] ?? trimmed;
}

export function createPhoneData(): PhoneData {
  return {
    version: 2,
    contacts: {},
    threads: {},
    messages: {},
    forum: { posts: [] },
    context: {
      active_snapshot: null,
      manual_queue: [],
      ingest_records: {},
      facts: [],
      appointments: [],
    },
  };
}

export function makeId(prefix: string): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `${prefix}:${crypto.randomUUID()}`;
    }
  } catch {
    /* 使用时间戳兜底 */
  }
  return `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 10)}`;
}

export function directThreadId(character: string): string {
  return `direct:${canonicalName(character)}`;
}

export function normalizePhoneData(
  raw: unknown,
  legacySessions: Record<string, LegacyChatMessage[]> = {},
  playerName = '玩家',
  storyTime = '',
): PhoneData {
  const data = createPhoneData();
  if (raw && typeof raw === 'object') {
    const source = raw as Partial<PhoneData> & { wallpaper?: unknown };
    if (source.version === 2) {
      data.contacts = isRecord(source.contacts) ? (source.contacts as Record<string, PhoneContact>) : {};
      data.threads = isRecord(source.threads) ? (source.threads as Record<string, PhoneThread>) : {};
      data.messages = isRecord(source.messages) ? (source.messages as Record<string, PhoneMessage[]>) : {};
      data.forum =
        source.forum && Array.isArray(source.forum.posts)
          ? { posts: source.forum.posts as ForumPost[] }
          : { posts: [] };
      data.context = normalizeContext(source.context);
    } else {
      const oldMessages = isRecord((source as { messages?: unknown }).messages)
        ? ((source as { messages: Record<string, LegacyChatMessage[]> }).messages ?? {})
        : {};
      migrateLegacySessions(data, oldMessages, playerName, storyTime);
    }
  }
  migrateLegacySessions(data, legacySessions, playerName, storyTime);
  applyIdentityPreset(data, playerName, storyTime);
  repairPhoneData(data);
  return data;
}

function normalizeContext(raw: unknown): PhoneContextState {
  if (!raw || typeof raw !== 'object') {
    return createPhoneData().context;
  }
  const source = raw as Partial<PhoneContextState>;
  return {
    active_snapshot:
      source.active_snapshot && typeof source.active_snapshot === 'object'
        ? (source.active_snapshot as PhoneContextSnapshot)
        : null,
    manual_queue: Array.isArray(source.manual_queue)
      ? source.manual_queue.filter((id): id is number => Number.isInteger(id))
      : [],
    ingest_records: isRecord(source.ingest_records)
      ? (source.ingest_records as Record<string, MainlineIngestRecord>)
      : {},
    facts: Array.isArray(source.facts) ? (source.facts as PhoneMemoryFact[]) : [],
    appointments: Array.isArray(source.appointments) ? (source.appointments as PhoneAppointment[]) : [],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function migrateLegacySessions(
  data: PhoneData,
  sessions: Record<string, LegacyChatMessage[]>,
  playerName: string,
  storyTime: string,
) {
  for (const [rawName, list] of Object.entries(sessions)) {
    const character = canonicalName(rawName);
    if (!character || !Array.isArray(list) || data.messages[directThreadId(character)]?.length) {
      continue;
    }
    ensureContact(data, character, '旧版手机消息记录迁移', 'migration', storyTime);
    const thread = ensureDirectThread(data, character, playerName, storyTime, 'migration');
    for (const item of list) {
      const text = String(item?.text ?? '').trim();
      if (!text) continue;
      addPhoneMessage(data, {
        threadId: thread.id,
        sender: item.from === 'me' ? playerName : character,
        text,
        storyTime,
        participants: thread.participants,
        visibility: 'private',
        source: 'migration',
        createdAt: item.t || new Date().toISOString(),
        consumedByMainline: true,
      });
    }
  }
}

function applyIdentityPreset(data: PhoneData, playerName: string, storyTime: string) {
  for (const character of IDENTITY_CONTACTS[canonicalName(playerName)] ?? []) {
    if (!data.contacts[character]) {
      ensureContact(data, character, 'POV身份预设中已经持有联系方式', 'identity_preset', storyTime);
    }
  }
}

function repairPhoneData(data: PhoneData) {
  for (const [key, contact] of Object.entries(data.contacts)) {
    const canonical = canonicalName(contact.character || key);
    contact.character = canonical;
    contact.display_name ||= canonical;
    contact.status = ['active', 'removed', 'blocked'].includes(contact.status) ? contact.status : 'active';
    contact.removed_at ??= null;
    contact.blocked_at ??= null;
    if (canonical !== key) {
      data.contacts[canonical] = contact;
      delete data.contacts[key];
    }
  }
  for (const thread of Object.values(data.threads)) {
    thread.participants = Array.from(new Set((thread.participants ?? []).map(canonicalName).filter(Boolean)));
    thread.important_facts ??= [];
    thread.pending_appointments ??= [];
    thread.summary ??= '';
    thread.unread = Number(thread.unread ?? 0);
    thread.summarized_message_count = Number(thread.summarized_message_count ?? 0);
    data.messages[thread.id] = Array.isArray(data.messages[thread.id]) ? data.messages[thread.id] : [];
  }
  data.forum.posts = Array.isArray(data.forum.posts) ? data.forum.posts.slice(-120) : [];
}

export function ensureContact(
  data: PhoneData,
  rawCharacter: string,
  basis: string,
  source: string,
  storyTime: string,
): PhoneContact {
  const character = canonicalName(rawCharacter);
  const now = new Date().toISOString();
  const existing = data.contacts[character];
  if (existing) {
    existing.status = existing.status === 'blocked' ? 'blocked' : 'active';
    existing.basis = basis || existing.basis;
    existing.source = source || existing.source;
    existing.updated_at = now;
    existing.removed_at = null;
    return existing;
  }
  const contact: PhoneContact = {
    character,
    display_name: character,
    status: 'active',
    basis,
    source,
    added_at: storyTime || now,
    updated_at: now,
    removed_at: null,
    blocked_at: null,
  };
  data.contacts[character] = contact;
  return contact;
}

export function setContactStatus(data: PhoneData, rawCharacter: string, status: ContactStatus): PhoneContact | null {
  const character = canonicalName(rawCharacter);
  const contact = data.contacts[character];
  if (!contact) return null;
  const now = new Date().toISOString();
  contact.status = status;
  contact.updated_at = now;
  contact.removed_at = status === 'removed' ? now : null;
  contact.blocked_at = status === 'blocked' ? now : null;
  return contact;
}

export function ensureDirectThread(
  data: PhoneData,
  rawCharacter: string,
  playerName: string,
  storyTime: string,
  source = 'phone',
): PhoneThread {
  const character = canonicalName(rawCharacter);
  const id = directThreadId(character);
  if (data.threads[id]) return data.threads[id];
  const thread: PhoneThread = {
    id,
    type: 'direct',
    title: character,
    participants: [canonicalName(playerName), character],
    created_at: storyTime || new Date().toISOString(),
    created_source: source,
    last_message_at: null,
    unread: 0,
    summary: '',
    summarized_message_count: 0,
    important_facts: [],
    pending_appointments: [],
  };
  data.threads[id] = thread;
  data.messages[id] = [];
  return thread;
}

export function createGroupThread(
  data: PhoneData,
  title: string,
  members: string[],
  playerName: string,
  storyTime: string,
  source = 'player',
): PhoneThread {
  const participants = Array.from(
    new Set([canonicalName(playerName), ...members.map(canonicalName)].filter(Boolean)),
  );
  const id = makeId('group');
  const thread: PhoneThread = {
    id,
    type: 'group',
    title: String(title || '新群聊').trim().slice(0, 30) || '新群聊',
    participants,
    created_at: storyTime || new Date().toISOString(),
    created_source: source,
    last_message_at: null,
    unread: 0,
    summary: '',
    summarized_message_count: 0,
    important_facts: [],
    pending_appointments: [],
  };
  data.threads[id] = thread;
  data.messages[id] = [];
  return thread;
}

export function addPhoneMessage(
  data: PhoneData,
  input: {
    threadId: string;
    sender: string;
    text: string;
    storyTime: string;
    participants: string[];
    visibility: VisibilityKind;
    source: PhoneMessageSource;
    createdAt?: string;
    consumedByMainline?: boolean;
  },
): PhoneMessage {
  const message: PhoneMessage = {
    id: makeId('msg'),
    thread_id: input.threadId,
    sender: canonicalName(input.sender),
    text: String(input.text).trim(),
    story_time: input.storyTime,
    participants: Array.from(new Set(input.participants.map(canonicalName))),
    visibility: input.visibility,
    source: input.source,
    created_at: input.createdAt || new Date().toISOString(),
    consumed_by_mainline: input.consumedByMainline ?? false,
  };
  data.messages[input.threadId] ??= [];
  const list = data.messages[input.threadId];
  list.push(message);
  // 截断到 120 条：必须同步 summarized_message_count，否则 maybeDigestThread 的
  // 判断 `messages.length - summarized_message_count < 8` 会因丢消息后差距变小而永远成立，
  // 新消息永远不再被归纳进 summary/important_facts（摘要死锁）。
  if (list.length > 120) {
    const dropped = list.length - 120;
    data.messages[input.threadId] = list.slice(-120);
    const threadForCount = data.threads[input.threadId];
    if (threadForCount) {
      threadForCount.summarized_message_count = Math.max(0, threadForCount.summarized_message_count - dropped);
    }
  }
  const thread = data.threads[input.threadId];
  if (thread) thread.last_message_at = message.created_at;
  return message;
}

export function clearThreadMessages(data: PhoneData, threadId: string) {
  data.messages[threadId] = [];
  const thread = data.threads[threadId];
  if (thread) {
    thread.last_message_at = null;
    thread.summary = '';
    thread.summarized_message_count = 0;
    thread.important_facts = [];
    thread.pending_appointments = [];
  }
}

export function activeContacts(data: PhoneData): PhoneContact[] {
  return Object.values(data.contacts)
    .filter(contact => contact.status === 'active')
    .sort((a, b) => a.display_name.localeCompare(b.display_name, 'zh-CN'));
}

export function visibleThreads(data: PhoneData): PhoneThread[] {
  return Object.values(data.threads).sort((a, b) =>
    String(b.last_message_at ?? b.created_at).localeCompare(String(a.last_message_at ?? a.created_at)),
  );
}

export function buildContextSnapshot(
  data: PhoneData,
  mainlineUserMessageId: number | null,
): PhoneContextSnapshot {
  const newMessages = Object.values(data.messages)
    .flat()
    .filter(message => !message.consumed_by_mainline)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const lines: string[] = [];
  if (newMessages.length) {
    lines.push('上次主线推进后新发生的手机互动：');
    for (const message of newMessages.slice(-30)) {
      const thread = data.threads[message.thread_id];
      const scope = thread?.type === 'group' ? `群聊“${thread.title}”` : `私聊“${thread?.title ?? ''}”`;
      lines.push(`- [${message.story_time || '故事当前时间'}][${scope}] ${message.sender}：${message.text}`);
    }
  }
  const facts = [
    ...data.context.facts.filter(fact => fact.active),
    ...Object.values(data.threads).flatMap(thread => thread.important_facts.filter(fact => fact.active)),
  ];
  if (facts.length) {
    lines.push('仍然有效的重要事实：');
    for (const fact of facts.slice(-30)) {
      lines.push(`- ${fact.text}（知情范围：${fact.participants.join('、') || '仅玩家'}）`);
    }
  }
  const appointments = [
    ...data.context.appointments.filter(item => item.status === 'pending'),
    ...Object.values(data.threads).flatMap(thread =>
      thread.pending_appointments.filter(item => item.status === 'pending'),
    ),
  ];
  if (appointments.length) {
    lines.push('尚未完成的约定：');
    for (const item of appointments.slice(-20)) {
      lines.push(
        `- ${item.text}${item.due_story_time ? `（约定时间：${item.due_story_time}）` : ''}（参与者：${item.participants.join('、')}）`,
      );
    }
  }
  if (lines.length) {
    lines.push('知识边界：私聊只属于其参与者；群聊只属于当时群成员。不得让未参与角色自动知情。');
  }
  return {
    id: makeId('snapshot'),
    mainline_user_message_id: mainlineUserMessageId,
    created_at: new Date().toISOString(),
    new_message_ids: newMessages.map(message => message.id),
    text: lines.join('\n'),
  };
}

export function markSnapshotConsumed(data: PhoneData, snapshot: PhoneContextSnapshot) {
  const ids = new Set(snapshot.new_message_ids);
  for (const message of Object.values(data.messages).flat()) {
    if (ids.has(message.id)) message.consumed_by_mainline = true;
  }
}
