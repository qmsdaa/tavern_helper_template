import {
  contentDirectorPromptBlock,
  DEFAULT_LLM_CONFIG,
  DEFAULT_NPC_SETTINGS,
  loadContentPrompt,
  loadLlmConfig,
  loadNpcSettings,
  saveContentPrompt,
  saveLlmConfig,
  saveNpcSettings,
  type LlmConfig,
  type NpcSettings,
} from './settings';
import {
  activeContacts,
  activeRequests,
  addPhoneMessage,
  buildContextSnapshot,
  buildForumSnapshot,
  canonicalName,
  clearThreadMessages,
  createGroupThread,
  directThreadId,
  ensureContact,
  ensureDirectThread,
  foldOldForumPosts,
  makeId,
  markSnapshotConsumed,
  markThreadDigested,
  matchedMainlineAppointments,
  matchedMainlineFacts,
  normalizePhoneData,
  setContactStatus,
  visibleThreads,
  type LegacyChatMessage,
  type MainlineIngestRecord,
  type PhoneContact,
  type PhoneData,
  type PhoneMemoryFact,
  type PhoneRequest,
  type PhoneThread,
} from './phoneData';
import { callPhoneTask } from './phoneLlm';
import {
  buildDirectorPlanBlock,
  COL_AM_CODE,
  COL_CHARACTER_NAME,
  COL_MEMO_TITLE,
  COL_SUMMARY_CHRONICLE,
  COL_SUMMARY_KEY_DIALOGUE,
  COL_SUMMARY_OVERVIEW,
  COL_SUMMARY_TIME_SPAN,
  readSummaryRows,
  SHEET_CHARACTERS,
  SHEET_MEMO,
  SHEET_ROMANCE_DIARY,
  SHEET_ROMANCE_TARGET,
  SHEET_SUMMARY,
  findSheet,
  insertTableRow,
  nextAmCode,
  pickHeader,
  readShujukuDigest,
  updateRowWhere,
} from './shujuku';
import {
  cnDate,
  loadPersonaMap,
  povDisplayName,
  readMvuSnapshot,
  relationshipTier,
  stageText,
  type MvuSnapshot,
} from './vars';
import { createMainlineBridge } from './mainlineBridge';
import { createSaveTracker } from './persistence';
import {
  downloadText,
  exportPhoneDataToBackup,
  exportThreadToMarkdown,
  mergePhoneBackup,
  overwritePhoneBackup,
  validatePhoneBackup,
  type ImportReport,
  type PhoneBackup,
} from './backup';

export interface WallpaperChoice {
  type: 'default' | 'preset' | 'custom';
  /** preset＝素材相对路径 · custom＝dataURL · default＝'' */
  value: string;
}

interface DirectReplyResult {
  messages?: string[];
}

interface GroupReplyResult {
  messages?: { sender?: string; text?: string }[];
}

interface DigestResult {
  summary?: string;
  important_facts?: { text?: string; participants?: string[] }[];
  pending_appointments?: { text?: string; due_story_time?: string | null; participants?: string[] }[];
}

interface MainlineIngestResult {
  contacts?: { character?: string; basis?: string }[];
  groups?: { title?: string; members?: string[]; basis?: string }[];
  important_facts?: {
    text?: string;
    participants?: string[];
    visibility?: 'private' | 'group' | 'player';
    evidence?: string;
  }[];
  pending_appointments?: {
    text?: string;
    due_story_time?: string | null;
    participants?: string[];
    visibility?: 'private' | 'group' | 'player';
  }[];
}

/**
 * 主线解析的可见结果。
 * 手动触发解析时，界面必须能区分"解析成功但剧情里确实没有新联系人"
 * 与"解析根本没跑成功"——两者过去都表现为界面毫无变化。
 */
export interface IngestOutcome {
  status: 'ok' | 'busy' | 'no-message' | 'already-parsed' | 'error';
  /** 本次新建档的联系人规范全名（已存在的不计入） */
  addedContacts: string[];
  addedGroups: number;
  addedFacts: number;
  addedAppointments: number;
  error?: string;
}

interface ForumBatchResult {
  posts?: {
    board?: string;
    type?: string;
    title?: string;
    author?: string;
    body?: string;
    heat?: number;
    status?: 'active' | 'resolved' | 'locked';
  }[];
}

interface ForumReplyResult {
  replies?: { author?: string; body?: string }[];
}

interface RequestBatchResult {
  requests?: {
    title?: string;
    client?: string;
    body?: string;
    hint?: string;
    location?: string;
  }[];
}

/** 会话归档 LLM 结果：先判重要性，重要才产出纪要字段与可选日记 */
interface SessionArchiveResult {
  significant?: boolean;
  overview?: string;
  chronicle?: string;
  key_dialogue?: string;
  diary?: {
    should_write?: boolean;
    character?: string;
    content?: string;
  };
}

const WALLPAPER_LS_KEY = 'counterfeit.phone.wallpaper';
const LEGACY_MESSAGES_LS_KEY = 'counterfeit.phone.messages';
const PREVIEW_DATA_LS_KEY = 'counterfeit.phone.preview-v2';
const PHONE_DATA_VERSION = 2;
/** 论坛快照注入条数（Bug8：主 AI 能看到最近论坛动态以辟谣） */
const FORUM_SNAPSHOT_LIMIT = 5;
/** 论坛自动刷新时顺手追加回复的热帖数上限（Bug9） */
const FORUM_AUTO_REPLY_MAX = 2;

/** 提示词泄漏特征（Bug7）：LLM 把任务 envelope/JSON 围栏当帖子正文输出时剔除 */
const TASK_LEAK_PATTERNS = [
  /\[Counterfeit 手机助手独立任务\]/,
  /task=(direct_reply|group_reply|mainline_ingest|context_digest|proactive_message|forum_batch|contact_bio|request_batch|session_archive)/,
  /无状态、单任务调用/,
  /只输出符合指定 JSON Schema/,
  /JSON Schema 的 JSON 对象/,
  /^\s*```(?:json)?\s*$/im,
  /\{\s*"posts"\s*:/,
  /\{\s*"replies"\s*:/,
  /\{\s*"requests"\s*:/,
];

function looksLikeTaskLeak(text: string): boolean {
  const value = String(text ?? '');
  return TASK_LEAK_PATTERNS.some(pattern => pattern.test(value));
}

/** 轻量路径写入（不依赖 lodash `_`，手机 iframe 里未必有） */
function setVar(obj: any, path: string, value: any) {
  const keys = path.split('.');
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (typeof cur[keys[i]] !== 'object' || cur[keys[i]] === null) cur[keys[i]] = {};
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = value;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function storyTimeOf(snapshot: MvuSnapshot): string {
  return snapshot.date || new Date().toISOString().slice(0, 10);
}

function playerNameOf(snapshot: MvuSnapshot): string {
  return canonicalName(snapshot.customName || povDisplayName(snapshot.pov) || '玩家');
}

function fingerprint(text: string): string {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function loadLegacySessions(): Record<string, LegacyChatMessage[]> {
  try {
    const raw = localStorage.getItem(LEGACY_MESSAGES_LS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, LegacyChatMessage[]>) : {};
  } catch {
    return {};
  }
}

function loadRawPhoneData(): unknown {
  try {
    if (typeof getVariables === 'function') {
      const variables = getVariables({ type: 'chat' } as any) ?? {};
      return (variables as any).stat_data?.phone;
    }
  } catch {
    /* 独立预览回退 */
  }
  try {
    const raw = localStorage.getItem(PREVIEW_DATA_LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export const usePhoneStore = defineStore('counterfeit-phone', () => {
  const initialSnapshot = readMvuSnapshot();
  const initialData = normalizePhoneData(
    loadRawPhoneData(),
    loadLegacySessions(),
    playerNameOf(initialSnapshot),
    storyTimeOf(initialSnapshot),
  );

  /** 手机是否展开 */
  const isOpen = ref(false);
  /** 当前 app（'home' = 主屏幕） */
  const currentApp = ref<string>('home');
  /** MVU 快照（打开时刷新） */
  const snapshot = ref<MvuSnapshot>(initialSnapshot);
  /** 当前壁纸（设备偏好；聊天变量仅保留兼容副本） */
  const wallpaper = ref<WallpaperChoice>(loadWallpaper());
  /** 好友 persona（从角色/手机世界书条目动态汇总） */
  const personas = ref<Record<string, string>>({});
  /** 按聊天存档隔离的手机数据 */
  const phone = reactive<PhoneData>(initialData);
  /** 消息 app 跳转目标 thread_id */
  const pendingThread = ref('');
  /** LLM 模型配置（设备级 localStorage） */
  const llm = ref<LlmConfig>(loadLlmConfig());
  /** NPC 与主线同步设置（设备级 localStorage） */
  const npc = ref<NpcSettings>(loadNpcSettings());
  /** 内容导演提示词（主动来信与论坛） */
  const contentPrompt = ref(loadContentPrompt());
  const bridgeArmed = ref(false);
  const ingesting = reactive<Record<number, boolean>>({});
  let proactiveCooldownUntil = 0;
  let forumAutoRefreshCooldownUntil = 0;
  let requestAutoRefreshCooldownUntil = 0;

  /* —— 自动保存状态（可观察：saving/saved/error/lastSavedAt） —— */

  const saveState = ref<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const saveError = ref('');
  const lastSavedAt = ref<number | null>(null);
  const saveTracker = createSaveTracker<PhoneData>(async payload => {
    try {
      if (typeof getVariables === 'function' && typeof updateVariablesWith === 'function') {
        const result = updateVariablesWith(
          (variables: Record<string, any>) => {
            const current = variables.stat_data?.phone ?? {};
            setVar(variables, 'stat_data.phone', { ...current, ...payload, version: PHONE_DATA_VERSION });
            return variables;
          },
          { type: 'chat' },
        ) as unknown;
        if (result instanceof Promise) {
          await result;
        }
        return;
      }
    } catch (error) {
      console.warn('[手机·存档] 聊天变量写入失败', error);
      throw error;
    }
    try {
      localStorage.setItem(PREVIEW_DATA_LS_KEY, JSON.stringify(payload));
    } catch {
      /* 预览数据不重要 */
    }
  });
  // 镜像 tracker 状态到响应式 ref（界面显示「已自动保存」/错误提示）
  const persistPhone = (): Promise<void> =>
    saveTracker.save(clone(phone)).then(result => {
      saveState.value = result === 'saved' ? 'saved' : 'error';
      saveError.value = saveTracker.lastError ?? '';
      lastSavedAt.value = saveTracker.lastSavedAt;
    });

  const resetSaveIndicator = () => {
    saveTracker.reset();
    saveState.value = 'idle';
  };

  const contacts = computed(() => activeContacts(phone));
  const allContacts = computed(() =>
    Object.values(phone.contacts).sort((a, b) => a.display_name.localeCompare(b.display_name, 'zh-CN')),
  );
  const threads = computed(() => visibleThreads(phone));
  const unreadTotal = computed(() => Object.values(phone.threads).reduce((sum, thread) => sum + thread.unread, 0));
  const forumPosts = computed(() => phone.forum.posts);
  const requests = computed(() => phone.requests);
  const openRequests = computed(() => activeRequests(phone));

  function replacePhone(next: PhoneData) {
    for (const key of Object.keys(phone)) {
      delete (phone as unknown as Record<string, unknown>)[key];
    }
    Object.assign(phone, next);
  }

  /**
   * 手机脚本初始化后自动挂载主线桥（不要求玩家先打开一次手机界面）。
   * API 尚未就绪时有界重试；armed 标志保证事件绝不重复注册。
   */
  const mainlineBridge = createMainlineBridge(
    {
      getEventOn: () => (typeof eventOn === 'function' ? eventOn : undefined),
      getTavernEvents: () =>
        typeof tavern_events === 'object' && tavern_events !== null ? tavern_events : undefined,
      schedule: (fn, ms) => window.setTimeout(fn, ms),
      cancel: handle => window.clearTimeout(handle as number),
    },
    {
      onMessageSent: messageId => {
        snapshot.value = readMvuSnapshot();
        // Bug1 修复：MESSAGE_SENT 不再标记旧快照已消费——
        // 上一轮生成的 active_snapshot 要留给本轮 AI 注入，连发消息也不会提前清空。
        // 直接为本轮生成新快照（含上次注入后新发生的手机互动）并写入玩家消息楼层，
        // 世界书条目在 AI 生成前 getvar 到的最新值就是它。
        refreshPendingSnapshot(messageId);
        void persistPhone();
        writeFloorSnapshot(messageId);
      },
      onMessageReceived: (messageId, type) => {
        snapshot.value = readMvuSnapshot();
        // 本轮 AI 已经用完快照（正常回复），此刻才消费并生成下一轮快照。
        // swipe/regenerate 会再次触发 MESSAGE_RECEIVED，重生成注入的仍是上一份快照，无影响。
        if (type !== 'extension') {
          const active = phone.context.active_snapshot;
          if (active) {
            markSnapshotConsumed(phone, active);
          }
          refreshPendingSnapshot(messageId);
          void persistPhone();
          writeFloorSnapshot(messageId);
        }
        if (npc.value.mainlineSyncMode === 'auto' && type !== 'extension') {
          void ingestMainlineMessage(messageId, type === 'regenerate' || type === 'swipe');
        } else if (npc.value.mainlineSyncMode === 'manual') {
          queueManualIngest(messageId);
        }
        void maybeProactiveMessage();
        void maybeAutoRefreshForum();
        void maybeAutoGenerateRequests();
      },
      onMessageEdited: messageId => {
        if (npc.value.mainlineSyncMode === 'auto') void ingestMainlineMessage(messageId, true);
        else if (npc.value.mainlineSyncMode === 'manual') queueManualIngest(messageId);
      },
      onMessageSwiped: messageId => {
        if (npc.value.mainlineSyncMode === 'auto') void ingestMainlineMessage(messageId, true);
        else if (npc.value.mainlineSyncMode === 'manual') queueManualIngest(messageId);
      },
      onMessageDeleted: messageId => undoMainlineIngest(messageId),
      onMvuUpdateEnded: () => {
        // MESSAGE_RECEIVED 与 MVU 更新的先后顺序并不固定；以更新完成事件再次刷新最终楼层快照。
        snapshot.value = readMvuSnapshot();
        // 兜底：MVU 更新块可能整体替换 AI 楼层的变量表（覆盖掉 phone 注入路径），补写一次。
        writeFloorSnapshot('latest');
      },
      onChatChanged: () => {
        reloadPhone();
        void refreshPersonas();
      },
    },
  );

  /**
   * Bug1 注入层级修复：把 active_snapshot（+论坛快照）双写进消息楼层变量。
   * 世界书「手机上下文注入」条目用 getvar 读楼层变量；此前只写 chat 级导致注入恒为空/旧值。
   * 写入是路径级插入（lodash set 语义），不会破坏楼层里 MVU 更新块写入的 stat_data 其他字段。
   */
  function writeFloorSnapshot(messageId: number | 'latest' | null) {
    const active = phone.context.active_snapshot;
    if (!active) {
      return;
    }
    try {
      if (typeof insertOrAssignVariables !== 'function') {
        return;
      }
      const payload: Record<string, unknown> = {
        'stat_data.phone.context.active_snapshot': clone(active),
      };
      const forumSnapshot = buildForumSnapshot(phone, FORUM_SNAPSHOT_LIMIT);
      if (forumSnapshot) {
        payload['stat_data.phone.context.forum_snapshot'] = forumSnapshot;
      }
      insertOrAssignVariables(payload, { type: 'message', message_id: messageId ?? 'latest' });
    } catch (error) {
      console.warn('[手机·注入] 楼层变量写入失败', error);
    }
  }

  function reloadPhone() {
    snapshot.value = readMvuSnapshot();
    replacePhone(
      normalizePhoneData(
        loadRawPhoneData(),
        loadLegacySessions(),
        playerNameOf(snapshot.value),
        storyTimeOf(snapshot.value),
      ),
    );
    void persistPhone();
  }

  function updateLlmConfig(config: LlmConfig) {
    llm.value = { ...config };
    saveLlmConfig(llm.value);
  }

  function updateNpcSettings(settings: NpcSettings) {
    npc.value = { ...settings };
    saveNpcSettings(npc.value);
  }

  function updateContentPrompt(value: string) {
    contentPrompt.value = saveContentPrompt(value);
  }

  function resetContentPrompt() {
    updateContentPrompt('');
  }

  function resetNpcSettings() {
    npc.value = { ...DEFAULT_NPC_SETTINGS };
    saveNpcSettings(npc.value);
  }

  function resetLlmConfig() {
    llm.value = { ...DEFAULT_LLM_CONFIG };
    saveLlmConfig(llm.value);
  }

  function open() {
    reloadPhone();
    isOpen.value = true;
    void refreshPersonas();
    armMainlineBridge();
  }

  function close() {
    isOpen.value = false;
    currentApp.value = 'home';
    // 收起手机后重置保存提示（避免下次打开还挂着旧状态）
    resetSaveIndicator();
  }

  function goHome() {
    currentApp.value = 'home';
  }

  function openApp(id: string) {
    if (id === 'home') return goHome();
    snapshot.value = readMvuSnapshot();
    currentApp.value = id;
  }

  function refresh() {
    reloadPhone();
  }

  async function refreshPersonas() {
    personas.value = await loadPersonaMap();
  }

  function setWallpaper(choice: WallpaperChoice) {
    wallpaper.value = choice;
    persistWallpaper(choice);
  }

  function messagesOf(threadId: string) {
    return phone.messages[threadId] ?? [];
  }

  function clearUnread(threadId: string) {
    const thread = phone.threads[threadId];
    if (!thread) return;
    thread.unread = 0;
    void persistPhone();
  }

  function openDirectThread(character: string): PhoneThread {
    const thread = ensureDirectThread(
      phone,
      character,
      playerNameOf(snapshot.value),
      storyTimeOf(snapshot.value),
      'phone',
    );
    void persistPhone();
    return thread;
  }

  function createGroup(title: string, members: string[]): PhoneThread {
    const thread = createGroupThread(
      phone,
      title,
      members,
      playerNameOf(snapshot.value),
      storyTimeOf(snapshot.value),
      'player',
    );
    recordContextFact(
      `玩家创建群聊“${thread.title}”，初始成员为${thread.participants.join('、')}`,
      thread.participants,
      'group',
      'player',
    );
    refreshPendingSnapshot(null);
    void persistPhone();
    return thread;
  }

  function updateContactStatus(character: string, status: PhoneContact['status']) {
    const contact = setContactStatus(phone, character, status);
    if (!contact) return;
    contact.source = 'phone_action';
    const action = status === 'removed' ? '删除联系人' : status === 'blocked' ? '屏蔽联系人' : '恢复联系人';
    recordContextFact(
      `玩家在手机中${action}：${contact.display_name}`,
      [playerNameOf(snapshot.value), contact.character],
      'private',
      'player',
    );
    refreshPendingSnapshot(null);
    void persistPhone();
  }

  /**
   * 清空会话：消息、摘要、水位线（summarized_message_count / archived_count）、
   * 重要事实、未完成约定、待处理裁剪行与当前待注入快照全部同步重置。
   * 联系人与会话壳保留；不回滚已经发生的主线；不删除已写入数据库的纪要/日记/备忘。
   */
  async function clearThread(threadId: string) {
    clearThreadMessages(phone, threadId);
    phone.context.active_snapshot = null;
    refreshPendingSnapshot(null);
    await persistPhone();
  }

  function recordContextFact(
    text: string,
    participants: string[],
    visibility: 'private' | 'group' | 'player',
    source: string,
  ): PhoneMemoryFact {
    const fact: PhoneMemoryFact = {
      id: makeId('fact'),
      text,
      participants: Array.from(new Set(participants.map(canonicalName))),
      visibility,
      source,
      active: true,
      created_at: new Date().toISOString(),
    };
    phone.context.facts.push(fact);
    return fact;
  }

  function refreshPendingSnapshot(mainlineUserMessageId: number | null) {
    phone.context.active_snapshot = buildContextSnapshot(phone, mainlineUserMessageId);
  }

  async function sendThreadMessage(threadId: string, text: string): Promise<void> {
    const thread = phone.threads[threadId];
    const clean = text.trim();
    if (!thread || !clean) return;
    const playerName = playerNameOf(snapshot.value);
    const blockedDirect =
      thread.type === 'direct' &&
      thread.participants.some(name => name !== playerName && phone.contacts[name]?.status === 'blocked');
    if (blockedDirect) throw new Error('该联系人已被屏蔽');

    addPhoneMessage(phone, {
      threadId,
      sender: playerName,
      text: clean,
      storyTime: storyTimeOf(snapshot.value),
      participants: thread.participants,
      visibility: thread.type === 'group' ? 'group' : 'private',
      source: 'player',
    });
    refreshPendingSnapshot(null);
    await persistPhone();

    if (thread.type === 'direct') {
      await requestDirectReply(thread);
    } else {
      await requestGroupReply(thread);
    }
    await maybeDigestThread(thread);
    refreshPendingSnapshot(null);
    await persistPhone();
  }

  function historyBlock(thread: PhoneThread): string {
    const recent = messagesOf(thread.id)
      .slice(-Math.max(2, npc.value.historyLength))
      .map(message => `${message.sender}：${message.text}`)
      .join('\n');
    const facts = thread.important_facts
      .filter(fact => fact.active)
      .slice(-8)
      .map(fact => `- ${fact.text}`)
      .join('\n');
    const appointments = thread.pending_appointments
      .filter(item => item.status === 'pending')
      .slice(-6)
      .map(item => `- ${item.text}${item.due_story_time ? `（${item.due_story_time}）` : ''}`)
      .join('\n');
    // 与参与者匹配的主线记忆（只送角色亲历/被告知/合理可知的部分，私聊事实不泄漏给第三人）
    const mainlineFacts = matchedMainlineFacts(phone, thread)
      .slice(-6)
      .map(fact => `- ${fact.text}${fact.evidence ? `（依据：${fact.evidence.slice(0, 60)}）` : ''}`)
      .join('\n');
    const mainlineAppointments = matchedMainlineAppointments(phone, thread)
      .slice(-4)
      .map(item => `- ${item.text}${item.due_story_time ? `（${item.due_story_time}）` : ''}`)
      .join('\n');
    return [
      thread.summary ? `滚动摘要：${thread.summary}` : '',
      facts ? `重要事实：\n${facts}` : '',
      mainlineFacts ? `主线里共同经历/已知的事（仅在参与者知情范围内）：\n${mainlineFacts}` : '',
      appointments ? `未完成约定：\n${appointments}` : '',
      mainlineAppointments ? `主线中尚未完成的约定（参与者知情范围内）：\n${mainlineAppointments}` : '',
      `最近消息：\n${recent}`,
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  async function requestDirectReply(thread: PhoneThread) {
    const playerName = playerNameOf(snapshot.value);
    const character = thread.participants.find(name => name !== playerName);
    if (!character) return;
    const persona = (personas.value[character] ?? '').slice(0, 2200);
    const result = await callPhoneTask<DirectReplyResult>(
      'direct_reply',
      [
        `你扮演“${character}”，正在与“${playerName}”进行世界内真实发生的私聊。`,
        persona ? `角色资料：\n${persona}` : '',
        buildDbEnrichBlock([character]),
        `只有${thread.participants.join('、')}知道这段私聊。`,
        historyBlock(thread),
        '根据最后一条玩家消息决定自然回复。输出 JSON：{"messages":["第一条短消息","可选的第二条短消息"]}。允许只回复一条；不得输出旁白或角色名前缀。',
      ]
        .filter(Boolean)
        .join('\n\n'),
      llm.value,
    );
    for (const text of result.messages ?? []) {
      if (!String(text).trim()) continue;
      addPhoneMessage(phone, {
        threadId: thread.id,
        sender: character,
        text: String(text),
        storyTime: storyTimeOf(snapshot.value),
        participants: thread.participants,
        visibility: 'private',
        source: 'direct_reply',
      });
    }
  }

  async function requestGroupReply(thread: PhoneThread) {
    const playerName = playerNameOf(snapshot.value);
    const npcMembers = thread.participants.filter(name => name !== playerName);
    const personaBlock = npcMembers
      .map(name => {
        const persona = (personas.value[name] ?? '').slice(0, 1000);
        return persona ? `【${name}】\n${persona}` : `【${name}】无额外资料`;
      })
      .join('\n\n');
    const result = await callPhoneTask<GroupReplyResult>(
      'group_reply',
      [
        `群聊“${thread.title}”，成员：${thread.participants.join('、')}。这是世界内真实发生的群聊。`,
        personaBlock,
        buildDbEnrichBlock(npcMembers),
        historyBlock(thread),
        '一次调用统一决定谁回复、谁沉默以及回复顺序。只能由群成员发言，不要求每个人都回复。',
        '输出 JSON：{"messages":[{"sender":"成员全名","text":"短消息"}]}。messages 可以为空；不得为玩家代发消息。',
      ].join('\n\n'),
      llm.value,
    );
    for (const item of result.messages ?? []) {
      const sender = canonicalName(String(item.sender ?? ''));
      const text = String(item.text ?? '').trim();
      if (!text || sender === playerName || !npcMembers.includes(sender)) continue;
      addPhoneMessage(phone, {
        threadId: thread.id,
        sender,
        text,
        storyTime: storyTimeOf(snapshot.value),
        participants: thread.participants,
        visibility: 'group',
        source: 'group_reply',
      });
    }
  }

  async function maybeDigestThread(thread: PhoneThread) {
    const messages = messagesOf(thread.id);
    const pendingTrim = thread.pending_trim ?? [];
    const hasNewSinceSummary = messages.length - thread.summarized_message_count >= 8;
    if (messages.length < 12 || (!hasNewSinceSummary && !pendingTrim.length)) return;
    try {
      const result = await callPhoneTask<DigestResult>(
        'context_digest',
        [
          `会话：${thread.title}；类型：${thread.type}；参与者：${thread.participants.join('、')}。`,
          thread.summary ? `旧摘要：${thread.summary}` : '',
          pendingTrim.length
            ? `待归纳的已裁剪旧消息（尚未进入摘要，带参与者范围）：\n${pendingTrim.join('\n')}`
            : '',
          `待归纳消息：\n${messages
            .slice(Math.max(0, thread.summarized_message_count - 2))
            .map(message => `${message.sender}：${message.text}`)
            .join('\n')}`,
          '提取实际说过且值得长期记住的内容，不得推测关系变化。',
          '输出 JSON：{"summary":"滚动摘要","important_facts":[{"text":"事实","participants":["知情者"]}],"pending_appointments":[{"text":"约定","due_story_time":null,"participants":["参与者"]}]}。',
        ]
          .filter(Boolean)
          .join('\n\n'),
        llm.value,
      );
      thread.summary = String(result.summary ?? thread.summary).slice(0, 1800);
      markThreadDigested(thread, messages.length);
      for (const item of result.important_facts ?? []) {
        const text = String(item.text ?? '').trim();
        if (!text || thread.important_facts.some(fact => fact.text === text && fact.active)) continue;
        thread.important_facts.push({
          id: makeId('fact'),
          text,
          participants: (item.participants ?? thread.participants).map(canonicalName),
          visibility: thread.type === 'group' ? 'group' : 'private',
          source: 'context_digest',
          active: true,
          created_at: new Date().toISOString(),
        });
      }
      for (const item of result.pending_appointments ?? []) {
        const text = String(item.text ?? '').trim();
        if (!text || thread.pending_appointments.some(appointment => appointment.text === text)) continue;
        thread.pending_appointments.push({
          id: makeId('appointment'),
          text,
          due_story_time: item.due_story_time ? String(item.due_story_time) : null,
          participants: (item.participants ?? thread.participants).map(canonicalName),
          visibility: thread.type === 'group' ? 'group' : 'private',
          source: 'context_digest',
          status: 'pending',
          created_at: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.info('[手机·记忆] 摘要任务暂未完成', error);
    }
    // 摘要推进后联动数据库：重要会话归档纪要表（含恋爱日记），约定同步备忘录
    void maybeArchiveThread(thread);
    void syncAppointmentsToMemo();
  }

  interface ContactBioResult {
    bio?: string;
  }

  /**
   * Bug10：生成并缓存联系人"手机简介"（姓名/关系/性格一句话/最近互动）。
   * 只有玩家主动触发才调 LLM；生成一次后缓存到 contact.profile_bio，不再重复提炼。
   */
  async function generateContactBio(character: string): Promise<string | null> {
    const contact = phone.contacts[character];
    if (!contact) return null;
    if (contact.profile_bio) return contact.profile_bio;
    const thread = phone.threads[directThreadId(character)];
    const recentLines = thread
      ? messagesOf(thread.id)
          .slice(-Math.max(2, npc.value.historyLength))
          .map(message => `${message.sender}：${message.text}`)
          .join('\n')
      : '';
    const persona = (personas.value[character] ?? '').slice(0, 1200);
    try {
      const result = await callPhoneTask<ContactBioResult>(
        'contact_bio',
        [
          `为“${character}”写一段手机通讯录里会显示的简介（约 1-3 句，60 字内）。`,
          '内容只需：与玩家的关系、性格的一句话概括、最近一次明显互动。不得包含主线隐私、未来走向或未经玩家知晓的秘密。',
          persona ? `角色资料：\n${persona}` : '',
          recentLines ? `最近互动：\n${recentLines}` : '',
          '只输出 JSON：{"bio":"简介文本"}。若资料不足，可只写关系与性格一句话。',
        ]
          .filter(Boolean)
          .join('\n\n'),
        llm.value,
      );
      const bio = String(result.bio ?? '').trim().slice(0, 120);
      if (!bio) return null;
      contact.profile_bio = bio;
      contact.updated_at = new Date().toISOString();
      void persistPhone();
      return bio;
    } catch (error) {
      console.warn('[手机·简介] 生成失败', error);
      return null;
    }
  }

  async function maybeProactiveMessage() {
    const settings = npc.value;
    if (!settings.proactiveEnabled || Date.now() < proactiveCooldownUntil) return;
    if (Math.random() * 100 >= settings.proactiveChance) return;
    const candidates = contacts.value.filter(contact => contact.status === 'active');
    if (!candidates.length) return;
    proactiveCooldownUntil = Date.now() + settings.cooldownMinutes * 60 * 1000;
    const contact = candidates[Math.floor(Math.random() * candidates.length)];
    const thread = ensureDirectThread(
      phone,
      contact.character,
      playerNameOf(snapshot.value),
      storyTimeOf(snapshot.value),
      'proactive_message',
    );
    try {
      const result = await callPhoneTask<DirectReplyResult>(
        'proactive_message',
        [
          `“${contact.character}”准备主动给“${playerNameOf(snapshot.value)}”发手机消息。`,
          (personas.value[contact.character] ?? '').slice(0, 1600),
          buildDbEnrichBlock([contact.character]),
          historyBlock(thread),
          `当前公开时间：${cnDate(snapshot.value.date)}；阶段：${stageText(snapshot.value)}。`,
          contentDirectorPromptBlock(contentPrompt.value),
          '自然决定是否来信。输出 JSON：{"messages":["一条短消息"]}；若此刻没有合理来信，输出 {"messages":[]}。',
        ]
          .filter(Boolean)
          .join('\n\n'),
        llm.value,
      );
      for (const text of result.messages ?? []) {
        if (!String(text).trim()) continue;
        addPhoneMessage(phone, {
          threadId: thread.id,
          sender: contact.character,
          text: String(text),
          storyTime: storyTimeOf(snapshot.value),
          participants: thread.participants,
          visibility: 'private',
          source: 'proactive_message',
        });
        thread.unread += 1;
      }
      refreshPendingSnapshot(null);
      void persistPhone();
    } catch (error) {
      console.info('[手机·来信] 生成失败', error);
    }
  }

  async function generateForumBatch() {
    const result = await callPhoneTask<ForumBatchResult>(
      'forum_batch',
      [
        '生成总武高及周边学生使用的正常匿名论坛新帖。论坛与主线完全独立，不得把论坛猜测当成事实，也不得改变关系、结局或主线。',
        `公开时间：${cnDate(snapshot.value.date) || '未确认'}；学期阶段：${stageText(snapshot.value) || '普通校园日常'}。只使用日期、季节、学期与公开校园常识，不引用私聊、群聊或主线隐私。`,
        '帖子生态需要混合：夸张标题、高讨论度话题、求助、失物招领、学习、树洞、投票、交易、灌水、校园传闻。普通学生是主体，具名角色只允许留下有限公共痕迹。',
        contentDirectorPromptBlock(contentPrompt.value),
        '输出 JSON：{"posts":[{"board":"版块","type":"求助/讨论/失物/树洞/投票/交易/灌水/传闻","title":"标题","author":"匿名网名","body":"正文","heat":0,"status":"active"}]}。生成 4-6 条。',
      ]
        .filter(Boolean)
        .join('\n\n'),
      llm.value,
    );
    for (const item of result.posts ?? []) {
      const title = String(item.title ?? '').trim();
      const body = String(item.body ?? '').trim();
      // Bug7：LLM 异常回显任务 envelope/JSON 围栏时整条丢弃，不当帖子落盘
      if (!title || !body || looksLikeTaskLeak(title) || looksLikeTaskLeak(body)) continue;
      phone.forum.posts.push({
        id: makeId('post'),
        board: String(item.board ?? '校园综合'),
        type: String(item.type ?? '讨论'),
        title,
        author: String(item.author ?? '匿名希望'),
        body,
        story_time: storyTimeOf(snapshot.value),
        heat: Math.max(0, Math.round(Number(item.heat ?? 0))),
        status: item.status ?? 'active',
        created_at: new Date().toISOString(),
        replies: [],
      });
    }
    // Bug6：上限收紧 + 最旧帖折叠为摘要，控制聊天存档体积
    phone.forum.posts = foldOldForumPosts(phone.forum.posts);
    void persistPhone();
  }

  async function generateForumReplies(postId: string) {
    const post = phone.forum.posts.find(item => item.id === postId);
    if (!post) return;
    const result = await callPhoneTask<ForumReplyResult>(
      'forum_batch',
      [
        `论坛帖子：标题“${post.title}”；作者“${post.author}”；正文“${post.body}”。`,
        `公开时间：${cnDate(snapshot.value.date) || '未确认'}。`,
        `已有回复：\n${post.replies.map((reply, index) => `${index + 2}楼 ${reply.author}：${reply.body}`).join('\n') || '无'}`,
        '追加 3-5 条自然回复：可以附和、歪楼、质疑、求细节或给建议。论坛言论不等于事实，不得泄露主线隐私。',
        contentDirectorPromptBlock(contentPrompt.value),
        '输出 JSON：{"replies":[{"author":"匿名网名","body":"回复"}]}。',
      ]
        .filter(Boolean)
        .join('\n\n'),
      llm.value,
    );
    for (const item of result.replies ?? []) {
      const body = String(item.body ?? '').trim();
      // Bug7：回复同样过滤任务 envelope/JSON 泄漏
      if (!body || looksLikeTaskLeak(body)) continue;
      post.replies.push({
        id: makeId('reply'),
        author: String(item.author ?? '匿名希望'),
        body,
        story_time: storyTimeOf(snapshot.value),
        created_at: new Date().toISOString(),
      });
    }
    post.heat += (result.replies ?? []).length;
    void persistPhone();
  }

  /* —— 奉仕部委托（开放世界事件方向） —— */

  /** 委托生成面向开放世界：free/custom 模式完整启用；pov 剧本模式仅可查看既有委托 */
  function requestsEnabled(): boolean {
    return snapshot.value.mode !== 'pov';
  }

  /**
   * 生成一批奉仕部委托（2-4 条）。
   * 取材：MVU 当前状态（日期/地点/在场角色与关系档）+ 手机联系人 + 世界书 NPC 资料
   *      + 最近论坛动态（公开传闻可作引子）+ 数据库只读摘要（shujuku 全局快照表格，可选）。
   * 委托是"可以去推进的方向提示"，不是已发生事实；主线注入时也是这个口径。
   */
  async function generateRequests(source: 'auto' | 'manual'): Promise<number> {
    if (!requestsEnabled()) return 0;
    const snap = snapshot.value;
    // 在场/已建档角色的关系档位，让委托牵出的对象贴近当前人际状态
    const characterLines = Object.entries(snap.characters)
      .filter(([, value]) => value.known || value.present)
      .map(([name, value]) => `- ${name}（${relationshipTier(value.relationship)}${value.present ? ' · 在场' : ''}）`)
      .join('\n');
    // NPC 取材：手机联系人之外的世界书条目人物（含 NPC），每人只给一小段防 prompt 膨胀
    const contactNames = new Set(Object.keys(phone.contacts));
    const npcLines = Object.entries(personas.value)
      .filter(([name]) => !contactNames.has(name))
      .slice(0, 8)
      .map(([name, text]) => `【${name}】${text.replace(/\s+/g, ' ').slice(0, 220)}`)
      .join('\n');
    const forumRumors = phone.forum.posts
      .slice(-5)
      .map(post => `- ${post.title}`)
      .join('\n');
    const existing = activeRequests(phone)
      .map(item => `- ${item.title}`)
      .join('\n');
    const dbDigest = npc.value.shujukuEnabled ? readShujukuDigest() : '';

    const result = await callPhoneTask<RequestBatchResult>(
      'request_batch',
      [
        '为「奉仕部」生成新的委托。这是总武高奉仕部接受学生求助的社团设定：委托是学生带来的小事件（寻人寻物、和解调解、活动筹备、烦恼咨询等），不是战斗任务，不涉及任何"能力"。',
        `当前公开时间：${cnDate(snap.date) || '未确认'}；阶段：${stageText(snap) || '开放世界'}；当前地点：${snap.location || '未确认'}。`,
        characterLines ? `主要角色当前状态：\n${characterLines}` : '',
        npcLines ? `可取材的登场人物（世界书资料）：\n${npcLines}` : '',
        forumRumors ? `最近校园公开传闻（可作委托引子，但传闻不等于事实）：\n${forumRumors}` : '',
        dbDigest ? `数据库表格摘要（当前存档的角色/事件/备忘记录，可作取材）：\n${dbDigest}` : '',
        existing ? `已存在的委托（不得重复或换皮复刻）：\n${existing}` : '',
        '每条委托都要给出：谁委托（优先使用上面取材到的人物，也可以是合理的匿名学生）、发生什么、在哪里、可以往哪个方向发展（牵出谁、在哪推进）。委托必须贴合当前日期/地点/人物状态，不得剧透主线未来，不得改变关系变量。',
        '输出 JSON：{"requests":[{"title":"短标题","client":"委托人","body":"委托内容一两句","hint":"发展方向提示一句","location":"相关地点"}]}。生成 2-4 条；素材不足时宁少勿滥。',
      ]
        .filter(Boolean)
        .join('\n\n'),
      llm.value,
    );

    let added = 0;
    for (const item of result.requests ?? []) {
      const title = String(item.title ?? '').trim();
      const body = String(item.body ?? '').trim();
      if (!title || !body || looksLikeTaskLeak(title) || looksLikeTaskLeak(body)) continue;
      if (phone.requests.some(existingItem => existingItem.title === title && existingItem.status !== 'dropped')) {
        continue;
      }
      phone.requests.push({
        id: makeId('request'),
        title,
        client: String(item.client ?? '').trim() || '匿名委托',
        body,
        hint: String(item.hint ?? '').trim(),
        location: String(item.location ?? '').trim(),
        story_time: storyTimeOf(snap),
        status: 'open',
        source,
        created_at: new Date().toISOString(),
      });
      added += 1;
    }
    if (added > 0) {
      refreshPendingSnapshot(null);
      void persistPhone();
      // 立即写入楼层变量：委托生成/变化若不落楼层，世界书条目下一轮生成时读不到，
      // 主线就无法承接（注入断链的根因）
      writeFloorSnapshot('latest');
    }
    return added;
  }

  /** 主线回复后按概率/冷却自动生成（共享 MESSAGE_RECEIVED 钩子，与论坛自动刷新并列） */
  async function maybeAutoGenerateRequests() {
    const settings = npc.value;
    if (!settings.requestAutoRefreshEnabled || !requestsEnabled()) return;
    if (Date.now() < requestAutoRefreshCooldownUntil) return;
    if (Math.random() * 100 >= settings.requestAutoRefreshChance) return;
    requestAutoRefreshCooldownUntil = Date.now() + settings.requestAutoRefreshCooldownMinutes * 60 * 1000;
    try {
      await generateRequests('auto');
    } catch (error) {
      console.info('[手机·委托] 自动刷新失败', error);
    }
  }

  /** 接受/完成/放弃委托；状态变化即时写入楼层变量，下一轮主线注入的快照即包含新状态 */
  function setRequestStatus(id: string, status: PhoneRequest['status']) {
    const item = phone.requests.find(entry => entry.id === id);
    if (!item || item.status === status) return;
    item.status = status;
    refreshPendingSnapshot(null);
    void persistPhone();
    writeFloorSnapshot('latest');
  }

  /* —— 数据库写入联动：纪要归档 / 恋爱日记 / 备忘录同步 —— */

  /** 时段 → 小时区间（纪要表「时间跨度」列的格式要求） */
  function timeSpanOf(snap: MvuSnapshot): string {
    const date = snap.date || new Date().toISOString().slice(0, 10);
    const ranges: Record<string, [string, string]> = {
      早晨: ['06:00', '09:00'],
      上午: ['09:00', '12:00'],
      午休: ['12:00', '14:00'],
      放课后: ['15:00', '18:00'],
      傍晚: ['18:00', '20:00'],
      晚间: ['20:00', '23:00'],
    };
    const [start, end] = (snap.timeSlot && ranges[snap.timeSlot]) || ['09:00', '21:00'];
    return `${date} ${start} ~ ${date} ${end}`;
  }

  /** 恋爱对象校验：表里有数据就按表校验（恋爱对象表命中 / 角色表类型含"恋爱"）；表未填时交给 LLM 准入判断 */
  function isRomanceCharacter(character: string): boolean {
    const targetSheet = findSheet(SHEET_ROMANCE_TARGET);
    if (targetSheet?.rows.length) {
      const nameCol = pickHeader(targetSheet.headers, COL_CHARACTER_NAME) ?? '姓名';
      return targetSheet.rows.some(row => String(row[nameCol] ?? '').includes(character));
    }
    const charSheet = findSheet(SHEET_CHARACTERS);
    if (charSheet?.rows.length) {
      const nameCol = pickHeader(charSheet.headers, COL_CHARACTER_NAME) ?? '姓名';
      const typeCol = pickHeader(charSheet.headers, ['角色类型', '类型']);
      return charSheet.rows.some(
        row =>
          String(row[nameCol] ?? '').includes(character) && (!typeCol || String(row[typeCol] ?? '').includes('恋爱')),
      );
    }
    return true;
  }

  /**
   * 会话归档：摘要推进后把"值得作为世界事件记住"的会话段写入纪要表（AM 码自动递增），
   * 恋爱向且符合准入时补写第一人称恋爱日记（绑同一 AM 码）。
   * 来源标记【手机】写进当前模板真实存在的列（纪要正文前缀；概览列存在时才单独写入概览），
   * 绝不写入不存在的"概览"列。失败不推进 archived_count 水位线，下次摘要时重试。
   */
  async function maybeArchiveThread(thread: PhoneThread) {
    const settings = npc.value;
    if (!settings.shujukuEnabled || !settings.dbWriteSummaryEnabled) return;
    const summarySheet = findSheet(SHEET_SUMMARY);
    if (!summarySheet) return;
    const archived = thread.archived_count ?? 0;
    if (thread.summarized_message_count <= archived) return;
    const messages = messagesOf(thread.id);
    const segment = messages.slice(Math.max(0, archived - 2));
    if (!segment.length) {
      thread.archived_count = thread.summarized_message_count;
      void persistPhone();
      return;
    }
    const playerName = playerNameOf(snapshot.value);
    const npcMembers = thread.participants.filter(name => name !== playerName);
    try {
      const result = await callPhoneTask<SessionArchiveResult>(
        'session_archive',
        [
          `判断这段手机${thread.type === 'group' ? `群聊“${thread.title}”` : `私聊（与${npcMembers.join('、')}）`}是否值得作为世界内真实发生的事件归档进剧情数据库。`,
          `参与者：${thread.participants.join('、')}；玩家角色：${playerName}；故事日期：${cnDate(snapshot.value.date) || '未确认'}。`,
          thread.summary ? `会话滚动摘要：${thread.summary}` : '',
          `会话消息：\n${segment.map(message => `${message.sender}：${message.text}`).join('\n')}`,
          '准入：发生了影响关系、透露关键信息、形成或改变约定、明显情绪转折的对话才归档；普通寒暄、灌水、问答式闲聊不归档（significant=false）。拿不准就不归档。',
          '归档时输出：overview（≤30字一句话概括，不要出现"手机"二字）、chronicle（300-480字，第三人称中立客观记录实际发生的对话，移除修辞与评论，结尾随事件自然停下、不做收束）、key_dialogue（摘录1-5句直接推动关系或揭示关键信息的原文台词并标说话人，没有就空串）。',
          '日记判断：仅当对话直接影响某位NPC对玩家的好感、信任、期待、误会、心动或距离感，且存在不适合写进客观纪要的主观心绪时 diary.should_write=true：character 必须是上述NPC参与者之一，content 为ta的第一人称日记（120-240字，符合其性格与说话习惯，只写ta自己知道、看见、猜到或误解的事，不上帝视角，不下确定结论，至少保留两种可能）。普通互动一律 false。',
          '输出 JSON：{"significant":true/false,"overview":"","chronicle":"","key_dialogue":"","diary":{"should_write":false,"character":"","content":""}}。significant=false 时其余字段留空。',
        ]
          .filter(Boolean)
          .join('\n\n'),
        llm.value,
      );
      if (!result.significant || !String(result.chronicle ?? '').trim()) {
        thread.archived_count = thread.summarized_message_count;
        void persistPhone();
        return;
      }
      const amCode = nextAmCode();
      // 来源标记必须写进当前模板真实存在的列：纪要正文前缀【手机】（适配表格没有"概览"列）；
      // 若模板确有概览列，则概览写概览列、正文写正文列。
      const amHeader = pickHeader(summarySheet.headers, COL_AM_CODE) ?? '编码索引';
      const timeSpanHeader = pickHeader(summarySheet.headers, COL_SUMMARY_TIME_SPAN) ?? '时间跨度';
      const chronicleHeader = pickHeader(summarySheet.headers, COL_SUMMARY_CHRONICLE) ?? '纪要';
      const overviewHeader = pickHeader(summarySheet.headers, COL_SUMMARY_OVERVIEW);
      const keyDialogueHeader = pickHeader(summarySheet.headers, COL_SUMMARY_KEY_DIALOGUE);
      const overview = String(result.overview ?? '').trim().slice(0, 26);
      const chronicle = String(result.chronicle).trim().slice(0, 500);
      const keyDialogue = String(result.key_dialogue ?? '').trim() || null;
      const row: Record<string, unknown> = {
        [amHeader]: amCode,
        [timeSpanHeader]: timeSpanOf(snapshot.value),
      };
      if (overviewHeader && overviewHeader !== chronicleHeader) {
        row[overviewHeader] = overview;
        row[chronicleHeader] = `【手机】${chronicle}`.slice(0, 520);
      } else {
        row[chronicleHeader] = `【手机】${overview ? `${overview}；` : ''}${chronicle}`.slice(0, 520);
      }
      if (keyDialogueHeader) {
        row[keyDialogueHeader] = keyDialogue;
      }
      const summaryResult = await insertTableRow(SHEET_SUMMARY, row);
      if (!summaryResult.ok) {
        console.info('[手机·归档] 纪要写入失败', summaryResult.message);
        return;
      }
      if (settings.dbWriteDiaryEnabled && result.diary?.should_write) {
        const character = canonicalName(String(result.diary.character ?? ''));
        const content = String(result.diary.content ?? '').trim();
        if (character && content && npcMembers.includes(character) && isRomanceCharacter(character)) {
          await insertTableRow(SHEET_ROMANCE_DIARY, {
            写作角色: character,
            关联角色: playerName,
            关联AM码: amCode,
            日记内容: content.slice(0, 260),
            发生时间: cnDate(snapshot.value.date) || snapshot.value.date,
          });
        }
      }
      thread.archived_count = thread.summarized_message_count;
      void persistPhone();
    } catch (error) {
      console.info('[手机·归档] 会话归档失败', error);
    }
  }

  /** 约定 ↔ 备忘录双向状态同步：新约定插入备忘录，兑现/取消回写状态（标题唯一，重名跳过） */
  async function syncAppointmentsToMemo() {
    const settings = npc.value;
    if (!settings.shujukuEnabled || !settings.dbWriteMemoEnabled) return;
    const memoSheet = findSheet(SHEET_MEMO);
    if (!memoSheet) return;
    const titleCol = pickHeader(memoSheet.headers, COL_MEMO_TITLE) ?? '备忘标题';
    const existingTitles = new Set(memoSheet.rows.map(row => String(row[titleCol] ?? '').trim()));
    const playerName = playerNameOf(snapshot.value);
    const all = [
      ...phone.context.appointments,
      ...Object.values(phone.threads).flatMap(thread => thread.pending_appointments),
    ];
    let changed = false;
    for (const appt of all) {
      const title = `【手机】${appt.text.slice(0, 18)}`;
      if (appt.status === 'pending' && !appt.memo_state) {
        if (existingTitles.has(title)) {
          appt.memo_state = 'pending'; // 表里已有同名条目，视为已同步
          changed = true;
          continue;
        }
        const result = await insertTableRow(SHEET_MEMO, {
          备忘标题: title,
          相关角色: Array.from(new Set([playerName, ...appt.participants])).join(','),
          详细内容: `${appt.text}${appt.due_story_time ? `（约定时间：${appt.due_story_time}）` : ''}`,
          当前状态: '等待兑现',
          相关时间: cnDate(snapshot.value.date) || snapshot.value.date,
        });
        if (result.ok) {
          appt.memo_state = 'pending';
          existingTitles.add(title);
          changed = true;
        }
      } else if (appt.status !== 'pending' && appt.memo_state === 'pending') {
        const result = await updateRowWhere(SHEET_MEMO, COL_MEMO_TITLE, title, {
          当前状态: appt.status === 'done' ? '已兑现' : '已取消',
        });
        if (result.ok) {
          appt.memo_state = 'done';
          changed = true;
        }
      }
    }
    if (changed) void persistPhone();
  }

  /**
   * 数据库上下文分层读取（总预算约 1400 字符）：
   * ① 角色表/日记：角色自己的状态与心绪，可作扮演依据（dbReadCharEnabled）
   * ② 剧情纪要：已发生事实参考，角色仍只知道自己亲历/被告知/合理可知的部分（dbReadSummaryEnabled · 默认开）
   * ③ 导演大纲：导演层资料，不是角色记忆——不得复述、不得泄露未发生内容（dbReadDirectorEnabled · 默认关）
   * 各层独立降级：表/列/插件缺失都不影响普通聊天。
   */
  function buildDbEnrichBlock(characterNames: string[]): string {
    const settings = npc.value;
    if (!settings.shujukuEnabled) return '';
    let budget = 1400;
    const parts: string[] = [];
    if (settings.dbReadCharEnabled) {
      const charSheet = findSheet(SHEET_CHARACTERS);
      const diarySheet = findSheet(SHEET_ROMANCE_DIARY);
      for (const name of characterNames.slice(0, 4)) {
        const lines: string[] = [];
        if (charSheet) {
          const nameCol = pickHeader(charSheet.headers, COL_CHARACTER_NAME) ?? '姓名';
          const row = charSheet.rows.find(item => String(item[nameCol] ?? '').includes(name));
          if (row) {
            const bits = ['在场状态', '人际关系', '当下想法']
              .map(col => {
                const header = pickHeader(charSheet.headers, [col]);
                const value = header ? String(row[header] ?? '').trim() : '';
                return value ? `${col}：${value.slice(0, 60)}` : '';
              })
              .filter(Boolean)
              .join('；');
            if (bits) lines.push(`角色表：${bits}`);
          }
        }
        if (diarySheet) {
          const writerCol = pickHeader(diarySheet.headers, ['写作角色', '角色', '姓名']) ?? '写作角色';
          const contentCol = pickHeader(diarySheet.headers, ['日记内容', '内容']) ?? '日记内容';
          for (const entry of diarySheet.rows.filter(item => String(item[writerCol] ?? '').includes(name)).slice(-2)) {
            lines.push(`其近期日记：${String(entry[contentCol] ?? '').slice(0, 120)}`);
          }
        }
        if (lines.length) {
          const block = `【${name}】\n${lines.join('\n')}`;
          if (budget - block.length < 0) break;
          parts.push(block);
          budget -= block.length;
        }
      }
    }
    if (settings.dbReadSummaryEnabled) {
      const summaries = readSummaryRows({
        limit: 4,
        date: snapshot.value.date || '',
        participantNames: characterNames,
        budget: Math.min(600, Math.floor(budget * 0.55)),
      });
      if (summaries.length && budget > 80) {
        const block = `最近剧情纪要（已发生事实参考：角色仍只能知道自己亲历、被告知或合理可知的部分，不得据此知晓没参与的事）：\n${summaries.join('\n')}`;
        if (budget - block.length >= 0) {
          parts.push(block);
          budget -= block.length;
        }
      }
    }
    if (settings.dbReadDirectorEnabled) {
      const block = buildDirectorPlanBlock({ limit: 2, budget: Math.min(600, budget) });
      if (block && budget > 80) {
        parts.push(block);
      }
    }
    if (!parts.length) return '';
    return [
      '数据库中的上下文资料（用于保持状态连续）：',
      ...parts.map(part => part.split('\n').map(line => `  ${line}`).join('\n')),
    ].join('\n');
  }

  /* —— 记录保存与备份 —— */

  /** 导出当前会话为 Markdown（含标题/参与者/故事时间/发言者/完整保留消息），返回文件名 */
  function exportThreadMarkdown(threadId: string): string | null {
    const thread = phone.threads[threadId];
    if (!thread) return null;
    const markdown = exportThreadToMarkdown(phone, threadId, playerNameOf(snapshot.value), {
      includeSummary: true,
    });
    const date = snapshot.value.date || '未知日期';
    downloadText(`Counterfeit手机-${thread.title}-${date}.md`, markdown, 'text/markdown');
    return markdown;
  }

  /** 导出全部手机数据为 JSON（version/contacts/threads/messages/summaries/facts/appointments/context/requests） */
  function exportAllPhoneJson(): PhoneBackup {
    const backup = exportPhoneDataToBackup(phone);
    const date = snapshot.value.date || '未知日期';
    downloadText(`Counterfeit手机数据备份-${date}.json`, JSON.stringify(backup, null, 2), 'application/json');
    return backup;
  }

  /** 导入前自动导出现有备份（返回现有备份对象，供界面提示） */
  function backupBeforeImport(): PhoneBackup {
    const backup = exportPhoneDataToBackup(phone);
    const date = snapshot.value.date || '未知日期';
    downloadText(`Counterfeit手机导入前备份-${date}.json`, JSON.stringify(backup, null, 2), 'application/json');
    return backup;
  }

  /** 解析并严格校验备份 JSON；返回 { ok, errors, backup } */
  function parsePhoneBackup(rawText: string): { ok: boolean; errors: string[]; backup: PhoneBackup | null } {
    try {
      const parsed = JSON.parse(rawText) as unknown;
      const validation = validatePhoneBackup(parsed);
      if (!validation.ok) {
        return { ok: false, errors: validation.errors, backup: null };
      }
      return { ok: true, errors: [], backup: parsed as PhoneBackup };
    } catch (error) {
      return { ok: false, errors: [`JSON 解析失败：${error instanceof Error ? error.message : String(error)}`], backup: null };
    }
  }

  /** 合并导入：逐条并入，ID 冲突跳过并记录（绝不静默覆盖）；返回报告并持久化 */
  async function importPhoneBackup(backup: PhoneBackup, mode: 'merge' | 'overwrite'): Promise<ImportReport> {
    const report = mode === 'merge' ? mergePhoneBackup(phone, backup) : overwritePhoneBackup(phone, backup);
    // 导入数据必须与正常加载路径一样过清洗层：备份/分享文件可能缺渲染必需字段
    // （display_name/title/created_at/participants 等），直接进响应式会在渲染期抛错导致黑屏（2026-08-10 修复）。
    replacePhone(
      normalizePhoneData(clone(report.data), {}, playerNameOf(snapshot.value), storyTimeOf(snapshot.value)),
    );
    refreshPendingSnapshot(null);
    await persistPhone();
    return report;
  }

  /** 数据统计（设置页显示会话数/消息数/存档体积） */
  function dataStats(): { threadCount: number; messageCount: number; bytes: number } {
    const threadCount = Object.keys(phone.threads).length;
    let messageCount = 0;
    for (const list of Object.values(phone.messages)) {
      messageCount += Array.isArray(list) ? list.length : 0;
    }
    let bytes = 0;
    try {
      bytes = JSON.stringify(phone).length;
    } catch {
      /* 忽略 */
    }
    return { threadCount, messageCount, bytes };
  }

  /** 手动触发手机内保存（设置页"立即保存"用） */
  async function saveNow(): Promise<void> {
    await persistPhone();
  }

  function queueManualIngest(messageId: number) {
    if (!phone.context.manual_queue.includes(messageId)) phone.context.manual_queue.push(messageId);
    void persistPhone();
  }

  function undoMainlineIngest(messageId: number) {
    const key = String(messageId);
    const record = phone.context.ingest_records[key];
    if (!record) return;
    for (const [character, previous] of Object.entries(record.previous_contacts)) {
      const current = phone.contacts[character];
      if (current?.source !== record.source) continue;
      if (previous) phone.contacts[character] = previous;
      else delete phone.contacts[character];
    }
    for (const threadId of record.created_thread_ids) {
      const thread = phone.threads[threadId];
      if (thread?.created_source === record.source && !(phone.messages[threadId]?.length ?? 0)) {
        delete phone.threads[threadId];
        delete phone.messages[threadId];
      }
    }
    phone.context.facts = phone.context.facts.filter(fact => !record.added_fact_ids.includes(fact.id));
    phone.context.appointments = phone.context.appointments.filter(
      item => !record.added_appointment_ids.includes(item.id),
    );
    delete phone.context.ingest_records[key];
    phone.context.manual_queue = phone.context.manual_queue.filter(id => id !== messageId);
    void persistPhone();
  }

  async function ingestMainlineMessage(messageId: number, force = false): Promise<IngestOutcome> {
    const outcome: IngestOutcome = { status: 'ok', addedContacts: [], addedGroups: 0, addedFacts: 0, addedAppointments: 0 };
    if (ingesting[messageId]) return { ...outcome, status: 'busy' };
    const messageArr = getChatMessages(messageId);
    const message = Array.isArray(messageArr) ? messageArr[0] : null;
    if (!message || message.role !== 'assistant') return { ...outcome, status: 'no-message' };
    const text = String(message.message ?? '').trim();
    if (!text) return { ...outcome, status: 'no-message' };
    const key = String(messageId);
    const currentFingerprint = fingerprint(text);
    const existing = phone.context.ingest_records[key];
    if (!force && existing?.fingerprint === currentFingerprint) {
      phone.context.manual_queue = phone.context.manual_queue.filter(id => id !== messageId);
      void persistPhone();
      return { ...outcome, status: 'already-parsed' };
    }
    ingesting[messageId] = true;
    if (existing) undoMainlineIngest(messageId);
    try {
      // 主线 user-assistant 的 message_id 不一定相差 1（swipe/regenerate/branch 会跳号）。
      // 先试 messageId-1，若不是 user 再向上回溯几条找最近一条 user 消息。
      let previous = getChatMessages(messageId - 1)[0];
      if (!previous || previous.role !== 'user') {
        for (let i = messageId - 2; i >= Math.max(0, messageId - 20); i--) {
          const candidate = getChatMessages(i)[0];
          if (candidate && candidate.role === 'user') {
            previous = candidate;
            break;
          }
        }
      }
      const result = await callPhoneTask<MainlineIngestResult>(
        'mainline_ingest',
        [
          '从刚刚完成的主线互动中，只提取明确发生的手机相关事实与值得未来手机聊天记住的面对面互动。不得根据聊天次数或友善语气修改关系变量。',
          previous?.role === 'user' ? `玩家输入：\n${previous.message}` : '',
          `主线回复：\n${text}`,
          '可提取：明确交换/获得联系方式；被拉入或创建群聊；明确说出且值得记住的重要事实（含已经明确发生的面对面互动：见面、谈话、事件——只要对后续手机聊天有意义）；尚未完成的约定。不要把“认识某人”当成“拥有联系方式”。',
          '事实字段要求：text=事实本身；participants=全部知情者（规范全名，至少包含玩家与直接在场者）；visibility=private（仅知情者）/group（群组）/player（仅玩家）；evidence=主线原文里支持该事实的一句话依据。',
          '只提取角色亲历、被告知或合理可知的内容；没有明确依据的内容一律不提取。',
          '输出 JSON：{"contacts":[{"character":"世界书规范全名","basis":"明确依据"}],"groups":[{"title":"群名","members":["规范全名"],"basis":"依据"}],"important_facts":[{"text":"事实","participants":["知情者"],"visibility":"private/group/player","evidence":"依据原文"}],"pending_appointments":[{"text":"约定","due_story_time":null,"participants":["参与者"],"visibility":"private/group/player"}]}。无内容时输出空数组。',
        ]
          .filter(Boolean)
          .join('\n\n'),
        llm.value,
      );
      const source = `mainline:${messageId}`;
      const record: MainlineIngestRecord = {
        message_id: messageId,
        fingerprint: currentFingerprint,
        source,
        previous_contacts: {},
        created_thread_ids: [],
        added_fact_ids: [],
        added_appointment_ids: [],
        parsed_at: new Date().toISOString(),
      };
      for (const item of result.contacts ?? []) {
        const character = canonicalName(String(item.character ?? ''));
        // basis 缺失不再整条丢弃：模型常只回 character 而漏 basis，
        // 过去这会让联系人被静默扔掉、通讯录始终为空。人名有效即足以建档。
        const basis = String(item.basis ?? '').trim() || '主线剧情中获得联系方式';
        if (!character || character === playerNameOf(snapshot.value)) continue;
        record.previous_contacts[character] = phone.contacts[character] ? clone(phone.contacts[character]) : null;
        const isNew = !phone.contacts[character];
        ensureContact(phone, character, basis, source, storyTimeOf(snapshot.value));
        if (isNew) outcome.addedContacts.push(character);
      }
      for (const item of result.groups ?? []) {
        const members = (item.members ?? []).map(name => canonicalName(String(name))).filter(Boolean);
        if (members.length < 1) continue;
        const normalizedMembers = Array.from(new Set([playerNameOf(snapshot.value), ...members])).sort();
        const existingThread = Object.values(phone.threads).find(
          thread =>
            thread.type === 'group' &&
            [...thread.participants].sort().join('|') === normalizedMembers.join('|') &&
            thread.title === String(item.title ?? '').trim(),
        );
        if (existingThread) continue;
        const thread = createGroupThread(
          phone,
          String(item.title ?? '群聊'),
          members,
          playerNameOf(snapshot.value),
          storyTimeOf(snapshot.value),
          source,
        );
        record.created_thread_ids.push(thread.id);
        outcome.addedGroups += 1;
      }
      for (const item of result.important_facts ?? []) {
        const factText = String(item.text ?? '').trim();
        if (!factText) continue;
        const fact: PhoneMemoryFact = {
          id: makeId('fact'),
          text: factText,
          participants: (item.participants ?? [playerNameOf(snapshot.value)]).map(canonicalName),
          visibility: item.visibility ?? 'player',
          source,
          active: true,
          created_at: new Date().toISOString(),
          source_message_id: messageId,
          evidence: String(item.evidence ?? '').trim().slice(0, 200) || undefined,
        };
        phone.context.facts.push(fact);
        record.added_fact_ids.push(fact.id);
        outcome.addedFacts += 1;
      }
      for (const item of result.pending_appointments ?? []) {
        const appointmentText = String(item.text ?? '').trim();
        if (!appointmentText) continue;
        const appointment = {
          id: makeId('appointment'),
          text: appointmentText,
          due_story_time: item.due_story_time ? String(item.due_story_time) : null,
          participants: (item.participants ?? [playerNameOf(snapshot.value)]).map(canonicalName),
          visibility: item.visibility ?? ('player' as const),
          source,
          status: 'pending' as const,
          created_at: new Date().toISOString(),
        };
        phone.context.appointments.push(appointment);
        record.added_appointment_ids.push(appointment.id);
        outcome.addedAppointments += 1;
      }
      phone.context.ingest_records[key] = record;
      phone.context.manual_queue = phone.context.manual_queue.filter(id => id !== messageId);
      void persistPhone();
      // 主线解析可能新增约定，同步进备忘录表
      void syncAppointmentsToMemo();
      return outcome;
    } catch (error) {
      console.warn('[手机·主线解析] 失败', error);
      queueManualIngest(messageId);
      return { ...outcome, status: 'error', error: error instanceof Error ? error.message : String(error) };
    } finally {
      ingesting[messageId] = false;
    }
  }

  /**
   * 手动解析最近一条主线回复。
   * 返回解析结果供调用方给出可见反馈——过去这里只 console.warn，
   * 界面上成功与失败完全无法区分，玩家只会看到"通讯录还是空的"。
   */
  async function parseLatestMainline(): Promise<IngestOutcome> {
    const empty: IngestOutcome = { status: 'ok', addedContacts: [], addedGroups: 0, addedFacts: 0, addedAppointments: 0 };
    try {
      const arr = getChatMessages('0-{{lastMessageId}}', { role: 'assistant' });
      const latestAssistant = Array.isArray(arr) ? arr.at(-1) : null;
      if (!latestAssistant) return { ...empty, status: 'no-message' };
      return await ingestMainlineMessage(latestAssistant.message_id, true);
    } catch (error) {
      console.warn('[手机·主线解析] parseLatestMainline 失败', error);
      return { ...empty, status: 'error', error: error instanceof Error ? error.message : String(error) };
    }
  }

  /** 幂等挂载主线桥（open()/App onMounted/初始化都会调，事件只注册一次） */
  function armMainlineBridge() {
    mainlineBridge.arm();
    bridgeArmed.value = mainlineBridge.isArmed();
  }

  async function maybeAutoRefreshForum() {
    const settings = npc.value;
    if (!settings.forumAutoRefreshEnabled || Date.now() < forumAutoRefreshCooldownUntil) return;
    if (Math.random() * 100 >= settings.forumAutoRefreshChance) return;
    forumAutoRefreshCooldownUntil = Date.now() + settings.forumAutoRefreshCooldownMinutes * 60 * 1000;
    try {
      // Bug9：自动刷新除了生成新帖批次，还随机挑 1-2 个 active 热帖追加回复（共享冷却）
      await generateForumBatch();
      const hot = phone.forum.posts
        .filter(post => post.status === 'active')
        .sort((a, b) => b.heat - a.heat)
        .slice(0, FORUM_AUTO_REPLY_MAX);
      const targets =
        hot.length > 1 && Math.random() < 0.5
          ? [hot[0], hot[1]].sort(() => Math.random() - 0.5)
          : [hot[0]];
      for (const post of targets) {
        if (!post) continue;
        if (Math.random() < 0.4) continue; // 不是每次都回复，保持"有人刷但不规律"的观感
        await generateForumReplies(post.id);
      }
    } catch (error) {
      console.info('[手机·论坛] 自动刷新失败', error);
    }
  }

  return {
    isOpen,
    currentApp,
    snapshot,
    wallpaper,
    personas,
    phone,
    contacts,
    allContacts,
    threads,
    forumPosts,
    unreadTotal,
    pendingThread,
    llm,
    npc,
    contentPrompt,
    bridgeArmed,
    ingesting,
    saveState,
    saveError,
    lastSavedAt,
    updateLlmConfig,
    updateNpcSettings,
    updateContentPrompt,
    resetLlmConfig,
    resetNpcSettings,
    resetContentPrompt,
    open,
    close,
    goHome,
    openApp,
    refresh,
    refreshPersonas,
    setWallpaper,
    persistPhone,
    saveNow,
    messagesOf,
    clearUnread,
    openDirectThread,
    createGroup,
    updateContactStatus,
    clearThread,
    sendThreadMessage,
    maybeProactiveMessage,
    generateContactBio,
    generateForumBatch,
    generateForumReplies,
    requests,
    openRequests,
    requestsEnabled,
    generateRequests,
    setRequestStatus,
    queueManualIngest,
    undoMainlineIngest,
    ingestMainlineMessage,
    parseLatestMainline,
    armMainlineBridge,
    exportThreadMarkdown,
    exportAllPhoneJson,
    backupBeforeImport,
    parsePhoneBackup,
    importPhoneBackup,
    dataStats,
  };
});

function loadWallpaper(): WallpaperChoice {
  try {
    if (typeof getVariables === 'function') {
      const variables = getVariables({ type: 'chat' } as any) ?? {};
      const wallpaper = (variables as any).stat_data?.phone?.wallpaper;
      if (wallpaper && typeof wallpaper === 'object' && typeof wallpaper.type === 'string') {
        return wallpaper as WallpaperChoice;
      }
    }
  } catch {
    /* 使用设备设置 */
  }
  try {
    const raw = localStorage.getItem(WALLPAPER_LS_KEY);
    if (raw) return JSON.parse(raw) as WallpaperChoice;
  } catch {
    /* 默认壁纸 */
  }
  return { type: 'default', value: '' };
}

function persistWallpaper(choice: WallpaperChoice) {
  try {
    localStorage.setItem(WALLPAPER_LS_KEY, JSON.stringify(choice));
  } catch {
    /* 忽略 */
  }
  try {
    if (typeof updateVariablesWith === 'function') {
      updateVariablesWith(
        variables => {
          setVar(variables, 'stat_data.phone.wallpaper', choice);
          return variables;
        },
        { type: 'chat' },
      );
    }
  } catch (error) {
    console.info('[手机·壁纸] 聊天变量写入失败', error);
  }
}
