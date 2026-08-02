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
  addPhoneMessage,
  buildContextSnapshot,
  canonicalName,
  clearThreadMessages,
  createGroupThread,
  ensureContact,
  ensureDirectThread,
  makeId,
  markSnapshotConsumed,
  normalizePhoneData,
  setContactStatus,
  visibleThreads,
  type LegacyChatMessage,
  type MainlineIngestRecord,
  type PhoneContact,
  type PhoneData,
  type PhoneMemoryFact,
  type PhoneThread,
} from './phoneData';
import { callPhoneTask } from './phoneLlm';
import {
  actNameOf,
  cnDate,
  loadPersonaMap,
  povDisplayName,
  readMvuSnapshot,
  type MvuSnapshot,
} from './vars';

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

const WALLPAPER_LS_KEY = 'counterfeit.phone.wallpaper';
const LEGACY_MESSAGES_LS_KEY = 'counterfeit.phone.messages';
const PREVIEW_DATA_LS_KEY = 'counterfeit.phone.preview-v2';
const PHONE_DATA_VERSION = 2;

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

  const contacts = computed(() => activeContacts(phone));
  const allContacts = computed(() =>
    Object.values(phone.contacts).sort((a, b) => a.display_name.localeCompare(b.display_name, 'zh-CN')),
  );
  const threads = computed(() => visibleThreads(phone));
  const unreadTotal = computed(() => Object.values(phone.threads).reduce((sum, thread) => sum + thread.unread, 0));
  const forumPosts = computed(() => phone.forum.posts);

  function persistPhone() {
    const payload = clone(phone);
    try {
      if (typeof getVariables === 'function' && typeof updateVariablesWith === 'function') {
        updateVariablesWith(
          (variables: Record<string, any>) => {
            const current = variables.stat_data?.phone ?? {};
            setVar(variables, 'stat_data.phone', { ...current, ...payload, version: PHONE_DATA_VERSION });
            return variables;
          },
          { type: 'chat' },
        );
        return;
      }
    } catch (error) {
      console.warn('[手机·存档] 聊天变量写入失败', error);
    }
    try {
      localStorage.setItem(PREVIEW_DATA_LS_KEY, JSON.stringify(payload));
    } catch {
      /* 预览数据不重要 */
    }
  }

  function replacePhone(next: PhoneData) {
    for (const key of Object.keys(phone)) {
      delete (phone as unknown as Record<string, unknown>)[key];
    }
    Object.assign(phone, next);
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
    persistPhone();
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
    persistPhone();
  }

  function openDirectThread(character: string): PhoneThread {
    const thread = ensureDirectThread(
      phone,
      character,
      playerNameOf(snapshot.value),
      storyTimeOf(snapshot.value),
      'phone',
    );
    persistPhone();
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
    persistPhone();
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
    persistPhone();
  }

  function clearThread(threadId: string) {
    clearThreadMessages(phone, threadId);
    refreshPendingSnapshot(null);
    persistPhone();
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
    persistPhone();

    if (thread.type === 'direct') {
      await requestDirectReply(thread);
    } else {
      await requestGroupReply(thread);
    }
    await maybeDigestThread(thread);
    refreshPendingSnapshot(null);
    persistPhone();
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
    return [
      thread.summary ? `滚动摘要：${thread.summary}` : '',
      facts ? `重要事实：\n${facts}` : '',
      appointments ? `未完成约定：\n${appointments}` : '',
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
    if (messages.length < 12 || messages.length - thread.summarized_message_count < 8) return;
    try {
      const result = await callPhoneTask<DigestResult>(
        'context_digest',
        [
          `会话：${thread.title}；类型：${thread.type}；参与者：${thread.participants.join('、')}。`,
          thread.summary ? `旧摘要：${thread.summary}` : '',
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
      thread.summarized_message_count = messages.length;
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
          historyBlock(thread),
          `当前公开时间：${cnDate(snapshot.value.date)}；阶段：${actNameOf(snapshot.value.scene)}。`,
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
      persistPhone();
    } catch (error) {
      console.info('[手机·来信] 生成失败', error);
    }
  }

  async function generateForumBatch() {
    const result = await callPhoneTask<ForumBatchResult>(
      'forum_batch',
      [
        '生成总武高及周边学生使用的正常匿名论坛新帖。论坛与主线完全独立，不得把论坛猜测当成事实，也不得改变关系、结局或主线。',
        `公开时间：${cnDate(snapshot.value.date) || '未确认'}；学期阶段：${actNameOf(snapshot.value.scene) || '普通校园日常'}。只使用日期、季节、学期与公开校园常识，不引用私聊、群聊或主线隐私。`,
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
      if (!title || !body) continue;
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
    phone.forum.posts = phone.forum.posts.slice(-120);
    persistPhone();
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
      if (!body) continue;
      post.replies.push({
        id: makeId('reply'),
        author: String(item.author ?? '匿名希望'),
        body,
        story_time: storyTimeOf(snapshot.value),
        created_at: new Date().toISOString(),
      });
    }
    post.heat += (result.replies ?? []).length;
    persistPhone();
  }

  function queueManualIngest(messageId: number) {
    if (!phone.context.manual_queue.includes(messageId)) phone.context.manual_queue.push(messageId);
    persistPhone();
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
    persistPhone();
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
      persistPhone();
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
          '从刚刚完成的主线互动中，只提取明确发生的手机相关事实。不得根据聊天次数或友善语气修改关系变量。',
          previous?.role === 'user' ? `玩家输入：\n${previous.message}` : '',
          `主线回复：\n${text}`,
          '可提取：明确交换/获得联系方式；被拉入或创建群聊；明确说出的重要手机事实；尚未完成的约定。不要把“认识某人”当成“拥有联系方式”。',
          '输出 JSON：{"contacts":[{"character":"世界书规范全名","basis":"明确依据"}],"groups":[{"title":"群名","members":["规范全名"],"basis":"依据"}],"important_facts":[{"text":"事实","participants":["知情者"],"visibility":"private/group/player"}],"pending_appointments":[{"text":"约定","due_story_time":null,"participants":["参与者"],"visibility":"private/group/player"}]}。无内容时输出空数组。',
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
      persistPhone();
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

  function armMainlineBridge() {
    if (bridgeArmed.value || typeof eventOn !== 'function') return;
    // 先把所有 eventOn 收进 try，任一注册失败不至于让其余事件没注册却 flag 已亮——
    // 否则主线桥会永久卡在半臂态。最后再置 flag。
    try {
      eventOn(tavern_events.MESSAGE_SENT, messageId => {
        snapshot.value = readMvuSnapshot();
        // 玩家发新消息前的旧 active_snapshot 已被上一轮 AI 用完，此刻才标记消费：
        // 这样 swipe 重生成时 active_snapshot 仍保留全部手机互动，主线 AI 不会"失忆"。
        const active = phone.context.active_snapshot;
        if (active) markSnapshotConsumed(phone, active);
        refreshPendingSnapshot(messageId);
        persistPhone();
      });
      eventOn(tavern_events.MESSAGE_RECEIVED, (messageId, type) => {
        snapshot.value = readMvuSnapshot();
        persistPhone();
        if (npc.value.mainlineSyncMode === 'auto' && type !== 'extension') {
          void ingestMainlineMessage(messageId, type === 'regenerate' || type === 'swipe');
        } else if (npc.value.mainlineSyncMode === 'manual') {
          queueManualIngest(messageId);
        }
        void maybeProactiveMessage();
        void maybeAutoRefreshForum();
      });
      eventOn(tavern_events.MESSAGE_EDITED, messageId => {
        if (npc.value.mainlineSyncMode === 'auto') void ingestMainlineMessage(messageId, true);
        else if (npc.value.mainlineSyncMode === 'manual') queueManualIngest(messageId);
      });
      eventOn(tavern_events.MESSAGE_SWIPED, messageId => {
        if (npc.value.mainlineSyncMode === 'auto') void ingestMainlineMessage(messageId, true);
        else if (npc.value.mainlineSyncMode === 'manual') queueManualIngest(messageId);
      });
      eventOn(tavern_events.MESSAGE_DELETED, messageId => undoMainlineIngest(messageId));
      eventOn('mag_variable_update_ended', () => {
        // MESSAGE_RECEIVED 与 MVU 更新的先后顺序并不固定；以更新完成事件再次刷新最终楼层快照。
        snapshot.value = readMvuSnapshot();
      });
      eventOn(tavern_events.CHAT_CHANGED, () => {
        reloadPhone();
        void refreshPersonas();
      });
      bridgeArmed.value = true;
      console.info('[手机·主线桥] 已挂载');
    } catch (error) {
      console.warn('[手机·主线桥] 挂载失败，下次 open() 会重试', error);
    }
  }

  async function maybeAutoRefreshForum() {
    const settings = npc.value;
    if (!settings.forumAutoRefreshEnabled || Date.now() < forumAutoRefreshCooldownUntil) return;
    if (Math.random() * 100 >= settings.forumAutoRefreshChance) return;
    forumAutoRefreshCooldownUntil = Date.now() + settings.forumAutoRefreshCooldownMinutes * 60 * 1000;
    try {
      await generateForumBatch();
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
    messagesOf,
    clearUnread,
    openDirectThread,
    createGroup,
    updateContactStatus,
    clearThread,
    sendThreadMessage,
    maybeProactiveMessage,
    generateForumBatch,
    generateForumReplies,
    queueManualIngest,
    undoMainlineIngest,
    ingestMainlineMessage,
    parseLatestMainline,
    armMainlineBridge,
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
