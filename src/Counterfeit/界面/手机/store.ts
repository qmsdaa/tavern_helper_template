import {
  buildGenerateExtra,
  DEFAULT_LLM_CONFIG,
  DEFAULT_NPC_SETTINGS,
  loadLlmConfig,
  loadNpcSettings,
  readStoryContext,
  saveLlmConfig,
  saveNpcSettings,
  type LlmConfig,
  type NpcSettings,
} from './settings';
import {
  AFFECTION_FIELD_BY_NAME,
  computeFriends,
  emptySnapshot,
  loadPersonaMap,
  readMvuSnapshot,
  type MvuSnapshot,
} from './vars';

export interface WallpaperChoice {
  type: 'default' | 'preset' | 'custom';
  /** preset＝素材相对路径 · custom＝dataURL · default＝'' */
  value: string;
}

export interface ChatMessage {
  from: 'me' | 'them';
  text: string;
  /** ISO 时间戳（可选） */
  t?: string;
}

const WALLPAPER_LS_KEY = 'counterfeit.phone.wallpaper';

/** 轻量路径写入（不依赖 lodash `_`，手机 iframe 里未必有） */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function setVar(obj: any, path: string, value: any) {
  const keys = path.split('.');
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (typeof cur[keys[i]] !== 'object' || cur[keys[i]] === null) {
      cur[keys[i]] = {};
    }
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = value;
}
const MESSAGES_LS_KEY = 'counterfeit.phone.messages';
const MESSAGE_KEEP = 50;

export const usePhoneStore = defineStore('counterfeit-phone', () => {
  /** 手机是否展开 */
  const isOpen = ref(false);
  /** 当前 app（'home' = 主屏幕） */
  const currentApp = ref<string>('home');
  /** MVU 快照（打开时刷新） */
  const snapshot = ref<MvuSnapshot>(emptySnapshot());
  /** 当前壁纸（stat_data.phone.wallpaper 持久化，localStorage 兜底） */
  const wallpaper = ref<WallpaperChoice>(loadWallpaper());
  /** 好友 persona（世界书 [手机]xxx 条目） */
  const personas = ref<Record<string, string>>({});
  /** 消息会话（stat_data.phone.messages 持久化，localStorage 兜底） */
  const sessions = reactive<Record<string, ChatMessage[]>>(loadMessages());
  /** 各好友未读数（NPC 主动来信） */
  const unread = reactive<Record<string, number>>({});
  /** 未读总数（主屏幕消息图标徽章） */
  const unreadTotal = computed(() => Object.values(unread).reduce((a, b) => a + b, 0));
  /** 消息 app 跳转目标会话（好友 app「发消息」用） */
  const pendingThread = ref('');
  /** LLM 模型配置（localStorage 持久化，见 settings.ts） */
  const llm = ref<LlmConfig>(loadLlmConfig());
  /** NPC 互动设置（localStorage 持久化） */
  const npc = ref<NpcSettings>(loadNpcSettings());

  function updateLlmConfig(cfg: LlmConfig) {
    llm.value = { ...cfg };
    saveLlmConfig(llm.value);
  }

  function updateNpcSettings(s: NpcSettings) {
    npc.value = { ...s };
    saveNpcSettings(npc.value);
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
    snapshot.value = readMvuSnapshot();
    isOpen.value = true;
    void refreshPersonas();
    armProactiveListener();
  }

  function close() {
    isOpen.value = false;
    currentApp.value = 'home';
  }

  function goHome() {
    currentApp.value = 'home';
  }

  function openApp(id: string) {
    if (id === 'home') {
      goHome();
      return;
    }
    snapshot.value = readMvuSnapshot();
    currentApp.value = id;
  }

  function refresh() {
    snapshot.value = readMvuSnapshot();
  }

  async function refreshPersonas() {
    personas.value = await loadPersonaMap();
  }

  function setWallpaper(choice: WallpaperChoice) {
    wallpaper.value = choice;
    persistWallpaper(choice);
  }

  function pushMessage(friend: string, msg: ChatMessage) {
    if (!sessions[friend]) {
      sessions[friend] = [];
    }
    sessions[friend].push(msg);
  }

  function persistMessages() {
    const trimmed: Record<string, ChatMessage[]> = {};
    for (const [k, v] of Object.entries(sessions)) {
      trimmed[k] = v.slice(-MESSAGE_KEEP);
    }
    try {
      localStorage.setItem(MESSAGES_LS_KEY, JSON.stringify(trimmed));
    } catch {
      /* 忽略 */
    }
    try {
      if (typeof getVariables === 'function' && typeof updateVariablesWith === 'function') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const variables = getVariables({ type: 'chat' } as any);
        if (variables && variables.stat_data) {
          updateVariablesWith(
            vars => {
              setVar(vars, 'stat_data.phone.messages', trimmed);
              return vars;
            },
            { type: 'chat' },
          );
        }
      }
    } catch (error) {
      console.info('[手机·消息] MVU 写入失败（已用本地存储兜底）', error);
    }
  }

  /** 好感联动：完成一次对话 +delta（钳制 0-100），返回新值（无变量时返回 null） */
  function bumpAffection(friend: string, delta = 1): number | null {
    const field = AFFECTION_FIELD_BY_NAME[friend];
    if (!field) {
      return null;
    }
    const current = snapshot.value.affection[field];
    if (current == null) {
      return null;
    }
    const next = Math.max(0, Math.min(100, current + delta));
    snapshot.value.affection[field] = next;
    try {
      if (typeof getVariables === 'function' && typeof updateVariablesWith === 'function') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const variables = getVariables({ type: 'chat' } as any);
        if (variables && variables.stat_data) {
          updateVariablesWith(
            vars => {
              setVar(vars, `stat_data.${field}`, next);
              return vars;
            },
            { type: 'chat' },
          );
        }
      }
    } catch (error) {
      console.info('[手机·好感] MVU 写入失败', error);
    }
    return next;
  }

  function clearUnread(friend: string) {
    unread[friend] = 0;
  }

  /* —— NPC 主动来信（v3）—— */

  let proactiveArmed = false;
  let proactiveCooldownUntil = 0;

  /** 主聊天有新 AI 消息时挂上监听（打开手机时调用一次） */
  function armProactiveListener() {
    if (proactiveArmed) {
      return;
    }
    proactiveArmed = true;
    try {
      if (typeof eventOn === 'function' && window.tavern_events?.MESSAGE_RECEIVED) {
        eventOn(window.tavern_events.MESSAGE_RECEIVED, () => {
          void maybeProactiveMessage();
        });
        console.info('[手机·来信] 主动来信监听已挂载');
      }
    } catch (error) {
      console.info('[手机·来信] 事件桥不可用', error);
    }
  }

  /** 概率触发一条 NPC 主动消息：开关/概率/冷却/好感门槛由 NPC 互动设置决定；话题联动剧情阶段 */
  async function maybeProactiveMessage() {
    try {
      const settings = npc.value;
      if (!settings.proactiveEnabled) {
        return;
      }
      if (Date.now() < proactiveCooldownUntil || Math.random() * 100 >= settings.proactiveChance) {
        return;
      }
      const candidates = computeFriends(snapshot.value).filter(
        f => (snapshot.value.affection[AFFECTION_FIELD_BY_NAME[f.name]] ?? 0) >= settings.affectionGate,
      );
      if (!candidates.length || typeof generateRaw !== 'function') {
        return;
      }
      proactiveCooldownUntil = Date.now() + settings.cooldownMinutes * 60 * 1000;
      const friend = candidates[Math.floor(Math.random() * candidates.length)].name;
      const hero = snapshot.value.customName || '玩家';
      const persona = (personas.value[friend] ?? '').slice(0, 800);
      const story = await readStoryContext(snapshot.value);
      const storyLine = story.sceneTitle
        ? `当前剧情：${story.actName || '未知幕'} · ${story.sceneTitle}${story.dateText ? `（${story.dateText}）` : ''}。`
        : story.actName
          ? `当前剧情：${story.actName}${story.dateText ? ` · ${story.dateText}` : ''}。`
          : '';
      const prompt = [
        `扮演「${friend}」给「${hero}」主动发一条手机消息。`,
        persona ? `角色资料：\n${persona}` : '',
        storyLine
          ? `${storyLine}消息内容自然地与最近的剧情事件、时令或校园生活挂钩（像是 TA 当下真的在关心/吐槽这件事），不要剧透未发生的剧情。`
          : '',
        `要求：以「${friend}」的口吻；用简体中文；1-2 行；日常关心或随口提起的小事；不要解释、不要旁白、不要角色名前缀。`,
        settings.extraPrompt.trim() ? `附加要求：${settings.extraPrompt.trim()}` : '',
      ]
        .filter(Boolean)
        .join('\n\n');
      const raw = await generateRaw({
        user_input: prompt,
        should_silence: true,
        ...buildGenerateExtra(llm.value),
      } as Parameters<typeof generateRaw>[0]);
      const text = (typeof raw === 'string' ? raw : String(raw ?? ''))
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean)[0];
      if (!text) {
        return;
      }
      pushMessage(friend, { from: 'them', text, t: new Date().toISOString() });
      unread[friend] = (unread[friend] ?? 0) + 1;
      persistMessages();
      console.info('[手机·来信]', friend, text.slice(0, 30));
    } catch (error) {
      console.info('[手机·来信] 生成失败', error);
    }
  }

  return {
    isOpen,
    currentApp,
    snapshot,
    wallpaper,
    personas,
    sessions,
    unread,
    unreadTotal,
    pendingThread,
    llm,
    npc,
    updateLlmConfig,
    updateNpcSettings,
    resetLlmConfig,
    resetNpcSettings,
    open,
    close,
    goHome,
    openApp,
    refresh,
    refreshPersonas,
    setWallpaper,
    pushMessage,
    persistMessages,
    bumpAffection,
    clearUnread,
    armProactiveListener,
    maybeProactiveMessage,
  };
});

function loadWallpaper(): WallpaperChoice {
  try {
    if (typeof getVariables === 'function') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const v = getVariables({ type: 'chat' } as any) ?? {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = (v as any).stat_data?.phone?.wallpaper;
      if (w && typeof w === 'object' && typeof w.type === 'string') {
        return w as WallpaperChoice;
      }
    }
  } catch {
    /* 落到本地存储 */
  }
  try {
    const raw = localStorage.getItem(WALLPAPER_LS_KEY);
    if (raw) {
      const w = JSON.parse(raw);
      if (w && typeof w.type === 'string') {
        return w as WallpaperChoice;
      }
    }
  } catch {
    /* 落到默认 */
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
    if (typeof getVariables === 'function' && typeof updateVariablesWith === 'function') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const variables = getVariables({ type: 'chat' } as any);
      if (variables && variables.stat_data) {
        updateVariablesWith(
          vars => {
            setVar(vars, 'stat_data.phone.wallpaper', choice);
            return vars;
          },
          { type: 'chat' },
        );
      }
    }
  } catch (error) {
    console.info('[手机·壁纸] MVU 写入失败（已用本地存储兜底）', error);
  }
}

function loadMessages(): Record<string, ChatMessage[]> {
  try {
    if (typeof getVariables === 'function') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const v = getVariables({ type: 'chat' } as any) ?? {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const m = (v as any).stat_data?.phone?.messages;
      if (m && typeof m === 'object') {
        return m as Record<string, ChatMessage[]>;
      }
    }
  } catch {
    /* 落到本地存储 */
  }
  try {
    const raw = localStorage.getItem(MESSAGES_LS_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    /* 落到空 */
  }
  return {};
}
