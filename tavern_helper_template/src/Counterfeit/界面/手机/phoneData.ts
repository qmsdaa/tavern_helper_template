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
  /** 手机简介（LLM 提炼一次并缓存的联系人描述；缺省时 UI 回退世界书资料） */
  profile_bio?: string;
}

export interface PhoneMemoryFact {
  id: string;
  text: string;
  participants: string[];
  visibility: VisibilityKind;
  source: string;
  active: boolean;
  created_at: string;
  /** 来源主线消息楼层号（mainline_ingest 记录；撤回该楼层时可据此溯源） */
  source_message_id?: number | null;
  /** 事实依据：主线原文里支持该事实的一句话（LLM 提炼的 basis/evidence） */
  evidence?: string;
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
  /** 备忘录表同步状态：pending＝已写入且悬而未决 · done＝已在表中收束；空＝未同步 */
  memo_state?: 'pending' | 'done';
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
  /** 已归档进数据库纪要表的消息计数（防重复归档水位线） */
  archived_count?: number;
  important_facts: PhoneMemoryFact[];
  pending_appointments: PhoneAppointment[];
  /**
   * 超过 120 条上限被裁剪、但尚未进入摘要的旧消息行（带参与者范围前缀）。
   * 摘要失败时内容保留在这里，不会静默永久丢失；下次摘要成功即清空。
   */
  pending_trim?: string[];
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
  /** 超上限时旧帖被折叠：正文截断 + 标记（仅用于省存档体积，不改变语义） */
  folded?: boolean;
}

export interface PhoneContextSnapshot {
  id: string;
  mainline_user_message_id: number | null;
  created_at: string;
  new_message_ids: string[];
  text: string;
}

/** 奉仕部委托（开放世界事件方向提示）：由 LLM 结合上下文/世界书 NPC/数据库摘要生成 */
export interface PhoneRequest {
  id: string;
  /** 委托标题（如「帮忙寻找走失的猫」） */
  title: string;
  /** 委托人（世界书 NPC 全名或匿名身份描述） */
  client: string;
  /** 委托内容（发生了什么、需要什么帮助） */
  body: string;
  /** 发展方向提示（这事可以怎么推进/会牵出谁） */
  hint: string;
  /** 相关地点 */
  location: string;
  story_time: string;
  status: 'open' | 'accepted' | 'done' | 'dropped';
  /** auto＝主线回复后自动生成 · manual＝玩家手动刷新 */
  source: 'auto' | 'manual';
  created_at: string;
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
  /** 奉仕部委托列表（新字段；旧存档缺省时由 normalize 补空数组） */
  requests: PhoneRequest[];
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
    requests: [],
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

/** 论坛保留上限：超过时最旧帖折叠为摘要，防止聊天存档持续膨胀 */
export const FORUM_POST_LIMIT = 60;
/** 折叠帖正文保留长度 */
const FOLDED_BODY_KEEP = 120;

/** 单会话消息保留上限：超过时裁剪最旧消息（未进摘要的部分保留到 pending_trim） */
export const THREAD_MESSAGE_LIMIT = 120;
/** pending_trim 行数上限（防极端刷屏下存档膨胀） */
const PENDING_TRIM_MAX = 40;

export function foldOldForumPosts(posts: ForumPost[]): ForumPost[] {
  const kept = posts.slice(-FORUM_POST_LIMIT);
  for (const post of kept) {
    const body = String(post.body ?? '');
    if (body.length > FOLDED_BODY_KEEP) {
      post.folded = true;
      post.body = `${body.slice(0, FOLDED_BODY_KEEP).trim()}…（旧帖已折叠）`;
    }
  }
  return kept;
}

/**
 * 论坛快照（供主线注入使用）。
 * 只取最近 N 帖的标题+正文摘要，明确标注"匿名发言≠事实"，让主 AI 在玩家引用论坛时能辟谣。
 */
export function buildForumSnapshot(data: PhoneData, limit: number): string {
  const posts = data.forum.posts.slice(-limit).reverse();
  if (!posts.length) {
    return '';
  }
  const lines = posts.map(post => {
    const snippet = String(post.body ?? '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120);
    return `- 【${post.board}】${post.title}（热度 ${post.heat} · ${post.status === 'active' ? '讨论中' : post.status}）作者「${post.author}」：${snippet}`;
  });
  return [
    '最近校园匿名论坛动态（以下均为匿名帖与传闻，不代表事实，仅作世界氛围；玩家在剧情中引用时，可按主线真相澄清或否认）：',
    ...lines,
  ].join('\n');
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
      data.requests = Array.isArray(source.requests) ? (source.requests as PhoneRequest[]) : [];
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
    // 渲染必需字段兜底：缺 title/type/created_at 会让消息页/会话列表渲染期抛错（2026-08-10 修复）
    if (!thread.title) thread.title = thread.participants[0] ?? thread.id;
    if (thread.type !== 'group') thread.type = 'direct';
    if (typeof thread.created_at !== 'string' || !thread.created_at) {
      thread.created_at = thread.last_message_at ?? new Date().toISOString();
    }
    thread.important_facts ??= [];
    thread.pending_appointments ??= [];
    thread.pending_trim = Array.isArray(thread.pending_trim) ? thread.pending_trim : [];
    thread.summary ??= '';
    thread.unread = Number(thread.unread ?? 0);
    thread.summarized_message_count = Number(thread.summarized_message_count ?? 0);
    data.messages[thread.id] = Array.isArray(data.messages[thread.id]) ? data.messages[thread.id] : [];
  }
  for (const list of Object.values(data.messages)) {
    for (const message of list) {
      // 缺 created_at 会让主线快照排序（buildContextSnapshot）抛错
      if (typeof message.created_at !== 'string' || !message.created_at) {
        message.created_at = new Date().toISOString();
      }
      message.text = String(message.text ?? '');
    }
  }
  // 缺 participants 会让主线快照/匹配逻辑的 .join/.map 抛错
  for (const fact of data.context.facts) {
    fact.text = String(fact.text ?? '');
    fact.participants = Array.isArray(fact.participants) ? fact.participants.map(String) : [];
  }
  for (const appointment of data.context.appointments) {
    appointment.text = String(appointment.text ?? '');
    appointment.participants = Array.isArray(appointment.participants)
      ? appointment.participants.map(String)
      : [];
  }
  data.forum.posts = foldOldForumPosts(
    Array.isArray(data.forum.posts) ? data.forum.posts : [],
  );
  data.requests = repairRequests(data.requests);
}

/** 委托保留上限：超过时优先丢弃最旧的 done/dropped，防止聊天存档持续膨胀 */
export const REQUEST_LIMIT = 30;

function repairRequests(requests: PhoneRequest[]): PhoneRequest[] {
  const list = (Array.isArray(requests) ? requests : []).filter(item => item && typeof item === 'object');
  for (const item of list) {
    item.title = String(item.title ?? '').trim();
    item.client = String(item.client ?? '').trim() || '匿名委托';
    item.body = String(item.body ?? '').trim();
    item.hint = String(item.hint ?? '').trim();
    item.location = String(item.location ?? '').trim();
    item.status = ['open', 'accepted', 'done', 'dropped'].includes(item.status) ? item.status : 'open';
    item.source = item.source === 'auto' ? 'auto' : 'manual';
  }
  const alive = list.filter(item => item.title && item.body);
  if (alive.length <= REQUEST_LIMIT) return alive;
  const active = alive.filter(item => item.status === 'open' || item.status === 'accepted');
  const closed = alive.filter(item => item.status === 'done' || item.status === 'dropped');
  return [...active, ...closed].slice(-REQUEST_LIMIT);
}

/** 当前需要呈现在界面/注入主线的委托（open + accepted） */
export function activeRequests(data: PhoneData): PhoneRequest[] {
  return data.requests.filter(item => item.status === 'open' || item.status === 'accepted');
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
  // 裁剪前保证旧内容已进入摘要，或明确保留待处理状态（pending_trim，带参与者范围），
  // 摘要失败时不会静默永久丢失。
  if (list.length > THREAD_MESSAGE_LIMIT) {
    const overflow = list.length - THREAD_MESSAGE_LIMIT;
    const threadForCount = data.threads[input.threadId];
    const covered = threadForCount?.summarized_message_count ?? 0;
    const dropped = list.slice(0, overflow);
    // 已被摘要覆盖的旧消息可以安心丢弃；未被覆盖的进入 pending_trim 等待下次摘要
    const uncoveredStart = Math.min(overflow, covered);
    if (threadForCount && uncoveredStart < dropped.length) {
      const scope = threadForCount.type === 'group' ? `群聊“${threadForCount.title}”` : '私聊';
      const pending = dropped
        .slice(uncoveredStart)
        .map(
          item =>
            `[${item.story_time || '故事当前时间'}][${scope}] ${item.sender}：${item.text}`,
        );
      threadForCount.pending_trim = [...(threadForCount.pending_trim ?? []), ...pending].slice(
        -PENDING_TRIM_MAX,
      );
    }
    data.messages[input.threadId] = list.slice(-THREAD_MESSAGE_LIMIT);
    if (threadForCount) {
      threadForCount.summarized_message_count = Math.max(0, covered - overflow);
      threadForCount.archived_count = Math.max(0, (threadForCount.archived_count ?? 0) - overflow);
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
    thread.archived_count = 0;
    thread.important_facts = [];
    thread.pending_appointments = [];
    thread.pending_trim = [];
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

/**
 * 主线注入快照。
 * 修复"30 条丢失"：只把实际注入文本的消息列入 new_message_ids——注入的只有最近
 * 未消费消息的前 30 条（从最旧开始，避免旧消息永久饥饿），其余保留未消费，
 * 下一轮主线继续注入；绝不把未注入的消息标记为已消费。
 */
export function buildContextSnapshot(
  data: PhoneData,
  mainlineUserMessageId: number | null,
): PhoneContextSnapshot {
  const INJECT_MESSAGE_LIMIT = 30;
  const newMessages = Object.values(data.messages)
    .flat()
    .filter(message => !message.consumed_by_mainline)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const injectedMessages = newMessages.slice(0, INJECT_MESSAGE_LIMIT);
  const backlogCount = Math.max(0, newMessages.length - injectedMessages.length);
  const lines: string[] = [];
  if (injectedMessages.length) {
    lines.push('上次主线推进后新发生的手机互动：');
    for (const message of injectedMessages) {
      const thread = data.threads[message.thread_id];
      const scope = thread?.type === 'group' ? `群聊“${thread.title}”` : `私聊“${thread?.title ?? ''}”`;
      lines.push(`- [${message.story_time || '故事当前时间'}][${scope}] ${message.sender}：${message.text}`);
    }
    if (backlogCount > 0) {
      lines.push(`（另有 ${backlogCount} 条更早的手机消息尚未注入主线，将在后续轮次补入）`);
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
  const requests = activeRequests(data);
  const acceptedRequests = requests.filter(item => item.status === 'accepted');
  const openRequestList = requests.filter(item => item.status === 'open');
  if (acceptedRequests.length) {
    lines.push(
      '玩家已接受的奉仕部委托（玩家明确选择的当前目标：除非玩家当轮输入另有指示，后续场景应朝这些委托的线索自然推进——让相关人物、地点与矛盾登场，把"去推进委托"当作当前剧情的优先方向；委托是否完成由剧情中的实际进展决定，不得直接宣告完成）：',
    );
    for (const item of acceptedRequests.slice(-5)) {
      lines.push(
        `- ${item.title}（委托人：${item.client}${item.location ? ` · 地点：${item.location}` : ''}）：${item.body}${item.hint ? `（推进方向：${item.hint}）` : ''}`,
      );
    }
  }
  if (openRequestList.length) {
    lines.push('奉仕部待接委托（开放世界事件方向提示——是"可以去推进的线索"，不是已经发生的事实；玩家未接受前不必主动展开）：');
    for (const item of openRequestList.slice(-8)) {
      lines.push(
        `- ${item.title}（委托人：${item.client}${item.location ? ` · 地点：${item.location}` : ''}）：${item.body}${item.hint ? `（方向提示：${item.hint}）` : ''}`,
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
    new_message_ids: injectedMessages.map(message => message.id),
    text: lines.join('\n'),
  };
}

export function markSnapshotConsumed(data: PhoneData, snapshot: PhoneContextSnapshot) {
  const ids = new Set(snapshot.new_message_ids);
  for (const message of Object.values(data.messages).flat()) {
    if (ids.has(message.id)) message.consumed_by_mainline = true;
  }
}

/**
 * 与参与者匹配的主线记忆（手机回复上下文用）。
 * 只把角色亲历、被告知或合理可知的事实送给该角色：
 * - 事实的全部参与者都必须在当前线程里（私聊事实不会泄漏给第三人）；
 * - 群聊事实只对包含当时全部成员的线程可见；
 * - 仅玩家知情（visibility=player）的事实不进入 NPC 回复上下文。
 */
export function matchedMainlineFacts(
  data: PhoneData,
  thread: PhoneThread,
): PhoneMemoryFact[] {
  const memberSet = new Set(thread.participants.map(canonicalName));
  return data.context.facts.filter(fact => {
    if (!fact.active) return false;
    if (fact.visibility === 'player') return false;
    const known = new Set((fact.participants ?? []).map(canonicalName));
    if (!known.size) return false;
    for (const name of known) {
      if (!memberSet.has(name)) return false;
    }
    return true;
  });
}

/** 与参与者匹配的主线约定（规则同 matchedMainlineFacts） */
export function matchedMainlineAppointments(
  data: PhoneData,
  thread: PhoneThread,
): PhoneAppointment[] {
  const memberSet = new Set(thread.participants.map(canonicalName));
  return data.context.appointments.filter(item => {
    if (item.status !== 'pending') return false;
    if (item.visibility === 'player') return false;
    const known = new Set((item.participants ?? []).map(canonicalName));
    if (!known.size) return false;
    for (const name of known) {
      if (!memberSet.has(name)) return false;
    }
    return true;
  });
}

/** 摘要成功落盘后调用：推进水位线并清空待处理裁剪行（幂等，供 store 与测试共用） */
export function markThreadDigested(thread: PhoneThread, messageCount: number) {
  thread.summarized_message_count = Math.max(thread.summarized_message_count, messageCount);
  thread.pending_trim = [];
}
