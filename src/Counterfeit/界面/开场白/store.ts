import { OPENING_TEXTS, povByKey, renderCustomOpening, type PovKey } from './copy';
import { OPENING_DRAFT_MAX, resolveOpeningText } from './openingDraft';
import { showToast } from './toast';

export type Step = 'gate' | 'intro' | 'title' | 'mode' | 'pov' | 'custom' | 'opening' | 'gallery' | 'done';
export type Mode = 'pov' | 'custom';
/** 玩法模式：story=剧本模式（150场）·open=开放世界攻略模式（写入 stat.mode='free'） */
export type GameMode = 'story' | 'open';
/** 恋爱难度：开局定档·commit 写入 stat_data.difficulty·全模式生效 */
export type DifficultyKey = '简单' | '普通' | '困难';

/** POV 角色开局所在班级教室（MVU-DESIGN §2.1：world.current_location 在 POV 模式填对应 F/J 班教室） */
const POV_CLASSROOM: Record<PovKey, string> = {
  hachiman: '总武高中·2年F班教室',
  yukino: '总武高中·2年J班教室',
  yui: '总武高中·2年F班教室',
  laff: '总武高中·2年J班教室',
};

/**
 * POV 角色开局手头可支配现金（日元）
 *
 * 之所以要给初值而不是沿用 null：更新规则明令“不得自行估算”“余额未知时一笔收支仍保持 null”，
 * 而春物这类日常校园叙事几乎不会出现“钱包里有 X 日元”的准确报数，
 * 于是 cash 会永久停在 null，所有收支 delta 都无处落地、金钱变量形同虚设。
 * 开局锚定一个确定余额后，后续 delta 才能真正生效。
 *
 * 数额本身也是人物设定的一部分（家境差异），不是随手填的占位数。
 */
const POV_INITIAL_CASH: Record<PovKey, number> = {
  hachiman: 3000, // 普通家庭·零花钱与零工所得
  yui: 5000, // 一般中产·由比滨家日常零用
  yukino: 20000, // 雪之下家·独居生活费
  laff: 50000, // 都柏林家族·月度汇款
};

/**
 * 初始关系表（与 世界书/MVU/更新规则.yaml §初始关系表 逐行同步，改表必须两边一起改）
 *
 * 之前依赖主 AI 首轮建档时按表覆写——AI 不稳定执行导致开局 bond/romance 全为 0，
 * 改为开场白 commit 直接预建完整记录（present=false，状态栏/手机不显示，登场时由 AI 置 present）。
 * 数值是 2013-05-20 拉芙转学日的起点，此后增减仍按更新规则各铁律。
 */
interface InitialRelation {
  display: string;
  bond: number;
  romance: number;
  known: boolean;
}

const INITIAL_RELATIONS: Record<PovKey, Record<string, InitialRelation>> = {
  hachiman: {
    雪之下雪乃: { display: '雪乃', bond: 50, romance: 10, known: true },
    由比滨结衣: { display: '结衣', bond: 50, romance: 15, known: true },
    比企谷小町: { display: '小町', bond: 75, romance: 0, known: true },
    户冢彩加: { display: '户冢', bond: 30, romance: 0, known: true },
    平冢静: { display: '平冢老师', bond: 25, romance: 0, known: true },
    三浦优美子: { display: '优美子', bond: 15, romance: 0, known: true },
    海老名姬菜: { display: '姬菜', bond: 15, romance: 0, known: true },
    川崎沙希: { display: '沙希', bond: 15, romance: 0, known: true },
    拉芙希妮·都柏林: { display: '拉芙希妮', bond: 0, romance: 0, known: false },
  },
  yukino: {
    比企谷八幡: { display: '八幡', bond: 50, romance: 10, known: true },
    由比滨结衣: { display: '结衣', bond: 50, romance: 5, known: true },
    雪之下阳乃: { display: '阳乃', bond: 40, romance: 0, known: true },
    平冢静: { display: '平冢老师', bond: 25, romance: 0, known: true },
    拉芙希妮·都柏林: { display: '拉芙希妮', bond: 0, romance: 0, known: false },
  },
  yui: {
    比企谷八幡: { display: '八幡', bond: 50, romance: 15, known: true },
    雪之下雪乃: { display: '雪乃', bond: 50, romance: 5, known: true },
    三浦优美子: { display: '优美子', bond: 40, romance: 0, known: true },
    海老名姬菜: { display: '姬菜', bond: 40, romance: 0, known: true },
    户冢彩加: { display: '户冢', bond: 25, romance: 0, known: true },
    川崎沙希: { display: '沙希', bond: 15, romance: 0, known: true },
    比企谷小町: { display: '小町', bond: 20, romance: 0, known: true },
    平冢静: { display: '平冢老师', bond: 25, romance: 0, known: true },
    拉芙希妮·都柏林: { display: '拉芙希妮', bond: 0, romance: 0, known: false },
  },
  laff: {
    爱布拉娜: { display: '爱布拉娜', bond: 70, romance: 25, known: true },
    雪之下雪乃: { display: '雪乃', bond: 0, romance: 0, known: false },
    比企谷八幡: { display: '八幡', bond: 0, romance: 0, known: false },
    由比滨结衣: { display: '结衣', bond: 0, romance: 0, known: false },
  },
};

/** 场景1在场预置（与更新规则"初始关系表"同步）：POV 剧本模式开局即与玩家同教室的角色 */
const SCENE1_PRESENT: Partial<Record<PovKey, string[]>> = {
  yukino: ['拉芙希妮·都柏林'],
  laff: ['雪之下雪乃'],
};

/** 按初始关系表生成 characters 记录集（present=false·空记忆·穿搭未确认，与 record_creation 默认形状一致） */
function initialCharacters(pov: PovKey): Record<string, unknown> {
  const records: Record<string, unknown> = {};
  for (const [name, rel] of Object.entries(INITIAL_RELATIONS[pov])) {
    records[name] = {
      display_name: rel.display,
      present: false,
      known: rel.known,
      relationship: { bond: rel.bond, romance: rel.romance, commitment: '未确认', intimate_memory: '', intimate_sexual_memory: '' },
      latest_user_memory: { memory: '', inner_thought: '' },
      outfit: {
        outerwear: '未确认',
        inner_layer: '未确认',
        bottoms: '未确认',
        socks: '未确认',
        underwear: '未确认',
        shoes: '未确认',
      },
    };
  }
  return records;
}

/**
 * 世界书条目命名规则（MVU-DESIGN §3 · galgame 系统设计 §3.1）：
 * - 场景条目：/^场景\d+$/ · 1-150，pov 模式开、custom 模式关
 * - 尾声条目：/^尾声/ ，pov 模式开、custom 模式关（150a-g 用绿灯特殊触发词，未注册前默认关；commit 仅切可见性不强行开未注册条目）
 * - S1 家族暗线组（在 POV 模式下启用；自建模式禁用）：见下方常量
 * - S2 真相附录（任何模式运行时都不直接启用）：见下方常量
 *   注：条目内容层仍带 @@if EJS 过滤，enabled 仅是第一道门控
 */
const SCENE_NAME_RE = /^场景\d+$/;
const SPOILER_S1 = [
  '还火事件',
  '伦敦与都柏林家族据点',
  '都柏林家族势力',
  '爱布拉娜_基础信息',
  '爱布拉娜_性格调色盘',
  '爱布拉娜_三面性',
  '达洛维小姐',
  '温斯顿先生',
  '科尔马克·都柏林',
  '多琳·都柏林',
] as const;
/** S2 真相附录：任何运行时模式都不直接启用（由其内容层 @@if current_pov===laff && current_scene>=123 自行门控） */
const SPOILER_S2 = ['还火事件_封存真相'] as const;

export interface CustomForm {
  /** 姓名 */
  name: string;
  /** 性别 */
  gender: '' | '男' | '女' | '其他';
  /** 所在班级 */
  className: string;
  /** 身份（如「二年J班转学生」） */
  identity: string;
  /** 过往经历 */
  past: string;
  /** 性格 */
  personality: string;
  /** 相貌 */
  appearance: string;
}

const emptyForm = (): CustomForm => ({
  name: '',
  gender: '',
  className: '',
  identity: '',
  past: '',
  personality: '',
  appearance: '',
});

/** 转义 XML 属性值中的特殊字符 */
function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// 注意：本模板环境中 pinia 经 jsdelivr +esm 引入、携带自己的 vue 副本，而组件渲染用的是酒馆注入的全局 Vue。
// 因此 store 必须使用 setup 写法 + 自动导入的（全局 Vue 的）ref/reactive/computed，
// 让响应式依赖挂到全局 Vue 的 effect 系统上；options 写法的 state() 会挂在 pinia 那份 vue 上，界面不更新。
/** 预览调试：?screen=title|gallery|intro… 直达指定屏（缺省 gate 启动门） */
function initialStep(): Step {
  const target = new URLSearchParams(window.location.search).get('screen');
  const valid: Step[] = ['gate', 'intro', 'title', 'mode', 'pov', 'custom', 'opening', 'gallery', 'done'];
  return valid.includes(target as Step) ? (target as Step) : 'gate';
}

export const useOpeningStore = defineStore('counterfeit-opening', () => {
  const step = ref<Step>(initialStep());
  const mode = ref<Mode | null>(null);
  /** 玩法模式：story=剧本 / open=开放世界（stat.mode 写 'free'）；自建角色在两种玩法下均可用 */
  const gameMode = ref<GameMode>('story');
  const selectedPov = ref<PovKey | null>(null);
  const difficulty = ref<DifficultyKey>('普通');
  const form = reactive<CustomForm>(emptyForm());
  const submitting = ref(false);
  /** 已提交的设定摘要块（done 屏展示） */
  const committedSummary = ref('');
  /** 已提交的开场文本（done 屏展示） */
  const committedText = ref('');
  /** 是否纯浏览器预览模式（无酒馆 API 时的降级提交） */
  const previewMode = ref(false);

  const povInfo = computed(() => (selectedPov.value ? povByKey(selectedPov.value) : null));

  /** 当前选择对应的官方开场文本（默认序幕，不可被自定义覆盖本体） */
  const openingText = computed<string>(() => {
    if (mode.value === 'pov' && selectedPov.value) {
      return OPENING_TEXTS[selectedPov.value];
    }
    if (mode.value === 'custom') {
      return renderCustomOpening(form.name);
    }
    return '';
  });

  /** 玩家自定义序幕草稿：null=未编辑（用官方默认）。只存内存，不写 localStorage，只对当前新存档生效 */
  const openingDraft = ref<string | null>(null);

  /** 最终提交正文：草稿清洗后优先，空草稿回退官方默认。
   *  自定义正文只改变 0 楼可见叙事文字——summaryBlock（<opening_setup>）与 MVU 变量写入路径不变 */
  const finalOpeningText = computed<string>(() => resolveOpeningText(openingDraft.value, openingText.value));

  /** 应用自定义序幕草稿：超过 3000 字拒绝保存；全空白视为清空草稿（回退官方） */
  function applyOpeningDraft(raw: string): { ok: boolean; message: string } {
    if (raw.trim().length === 0) {
      openingDraft.value = null;
      return { ok: true, message: '已清空自定义文案，序幕使用官方默认' };
    }
    if (raw.length > OPENING_DRAFT_MAX) {
      return { ok: false, message: `序幕最长 ${OPENING_DRAFT_MAX} 字（当前 ${raw.length} 字），请精简后再保存` };
    }
    openingDraft.value = raw;
    return { ok: true, message: '已应用自定义序幕（仅修改叙事文字，开局角色/日期/场景/难度不变）' };
  }

  /** 恢复官方默认序幕 */
  function resetOpeningDraft() {
    openingDraft.value = null;
  }

  // 切换模式/主角/玩法/难度时丢弃草稿——草稿绑定的是"当前选择对应的官方序幕"，不能跨选择串用
  watch([mode, selectedPov, gameMode, difficulty], () => {
    openingDraft.value = null;
  });

  /** 结构化设定摘要块 */
  const summaryBlock = computed<string>(() => {
    const statMode = gameMode.value === 'open' ? 'free' : mode.value;
    if (mode.value === 'pov' && selectedPov.value) {
      const info = povByKey(selectedPov.value);
      const lines = [
        `<opening_setup mode="${statMode}" pov="${info.key}" diff="${difficulty.value}" name="${escapeAttr(info.name)}">`,
        `定位: ${info.role}`,
        `简介: ${info.tagline}`,
      ];
      if (info.exclusive) {
        lines.push(`独占内容: ${info.exclusive}`);
      }
      lines.push('</opening_setup>');
      return lines.join('\n');
    }
    if (mode.value === 'custom') {
      return [
        `<opening_setup mode="${statMode}" diff="${difficulty.value}" name="${escapeAttr(form.name.trim())}">`,
        `性别: ${form.gender || '未填写'}`,
        `所在班级: ${form.className || '未填写'}`,
        `身份: ${form.identity.trim() || '未填写'}`,
        `过往经历: ${form.past.trim() || '未填写'}`,
        `性格: ${form.personality.trim() || '未填写'}`,
        `相貌: ${form.appearance.trim() || '未填写'}`,
        '</opening_setup>',
      ].join('\n');
    }
    return '';
  });

  function toIntro() {
    step.value = 'intro';
  }

  /** 序奏结束（或跳过）→ 标题屏 */
  function toTitle() {
    step.value = 'title';
  }

  function toMode() {
    step.value = 'mode';
  }

  function toGallery() {
    step.value = 'gallery';
  }

  function backToTitle() {
    step.value = 'title';
  }

  function backToMode() {
    step.value = 'mode';
  }

  /** 点击 POV 卡：未选中则选中高亮；再次点击已选中的卡则直接进入确认屏 */
  function selectPov(key: PovKey) {
    if (selectedPov.value === key) {
      confirmPov();
      return;
    }
    selectedPov.value = key;
  }

  function confirmPov() {
    if (!selectedPov.value) {
      showToast('请先选择一个视角', 'info');
      return;
    }
    mode.value = 'pov';
    step.value = 'pov';
  }

  function toCustom() {
    mode.value = 'custom';
    // 自建入口必须清空 POV 残留，否则 open+自建 commit 会按残留 POV 预建初始关系表
    // （曾实测：先点拉芙卡再来自建 → characters 混入拉芙 POV 预建记录，爱布拉娜 bond=70 等）
    selectedPov.value = null;
    step.value = 'custom';
  }

  /** 自建角色确认创建（姓名必填，其余可空） */
  function confirmCustom() {
    if (!form.name.trim()) {
      showToast('请至少填写主角姓名', 'error');
      return;
    }
    mode.value = 'custom';
    step.value = 'opening';
  }

  function toOpening() {
    step.value = 'opening';
  }

  /** 提交：组装设定摘要 → 原子写入并验证 MVU 变量 → 替换 0 楼 <OpeningUI/> 占位符 */
  async function commit() {
    if (submitting.value) {
      return;
    }
    submitting.value = true;
    try {
      const summary = summaryBlock.value;
      // 自定义序幕只替换 0 楼可见叙事文字；summaryBlock（<opening_setup>）与下方 MVU 写入不受影响
      const text = finalOpeningText.value;
      const payload = `${summary}\n\n${text}`;

      // MVU 写入：按 MVU-DESIGN §2.1 全量写入初始状态（双模式各自的 commit 集）
      // 字段路径必须与 schema.ts 对齐，否则 zod 默认 strip 会静默剥离
      try {
        if (typeof getVariables === 'function' && typeof updateVariablesWith === 'function') {
          const buildStat = (vars: Record<string, any>) => {
            const stat = _.get(vars, 'stat_data') ?? {};
            const isPov = mode.value === 'pov';
            const isOpen = gameMode.value === 'open';
            // 三模式公共项（§2.1 通行口径，路径对齐 schema.ts）
            // open（开放世界攻略）→ stat.mode='free'：current_scene 冻结占位不参与150场路由·time_slot 锚定放课后
            stat.mode = isOpen ? 'free' : isPov ? 'pov' : 'custom';
            stat.difficulty = difficulty.value;
            stat.current_scene = 1;
            stat.world = {
              current_date: '2013-05-20',
              current_location: isPov && selectedPov.value
                ? POV_CLASSROOM[selectedPov.value]
                : '未确认',
              time_slot: isOpen ? '放课后' : null,
            };
            // custom 模式主角家境未知，保持 null（“未确认”）由叙事后续锚定
            stat.player = {
              cash: isPov && selectedPov.value ? POV_INITIAL_CASH[selectedPov.value] : null,
              carried_items: [],
            };
            // 预建只属于"四选一"开局（剧本或开放世界均以 mode==='pov' 进入）；自建模式（custom）永不预建。
            // 旧条件 (isPov || isOpen) 会让 open+自建 + selectedPov 残留时错误预建（2026-08-07 修复）。
            stat.characters = isPov && selectedPov.value ? initialCharacters(selectedPov.value) : {};
            if (isPov && selectedPov.value) {
              for (const n of SCENE1_PRESENT[selectedPov.value] ?? []) {
                if (stat.characters[n]) stat.characters[n].present = true;
              }
            }
            stat['Ω_resonance'] = 0;
            for (const hammer of [
              'hammer_thunder_1', 'hammer_tea_1', 'hammer_tea_2',
              'hammer_teddy_1', 'hammer_thunder_2', 'hammer_outcast_1',
              'hammer_teddy_2', 'hammer_outcast_2', 'hammer_tea_3',
            ]) {
              stat[hammer] = 'pending';
            }
            stat.laff_knows_fire_truth = false;
            stat.laff_reed_authorized_yukino = false;
            stat.dalloway_pen_used = false;
            stat.branch_choice = null;
            if (isPov) {
              stat.current_pov = selectedPov.value;
              stat.custom_protagonist = null;
            } else {
              stat.current_pov = null;
              stat.custom_protagonist = { ...form };
            }
            _.set(vars, 'stat_data', stat);
            return vars;
          };
          // 楼层 0：首条 user 消息所在楼层，保留楼层快照基线。
          // MVU 可能尚未完成楼层变量初始化（桶不存在时 getVariables 返回空）——
          // 若此时跳过楼层写入，AI 变量更新链会从 initvar 空壳起步（开局数值全 0），
          // 因此先等框架就绪，再对 0 楼桶做有界重试；聊天级基线无论如何都写。
          if (typeof waitGlobalInitialized !== 'function') {
            throw new Error('waitGlobalInitialized API 缺失，无法确认 MVU 已就绪');
          }
          await waitGlobalInitialized('Mvu');
          let floor0Variables: Record<string, any> | null = null;
          for (let attempt = 0; attempt < 20 && !floor0Variables; attempt++) {
            floor0Variables = getVariables({ type: 'message', message_id: 0 }) ?? null;
            if (!floor0Variables) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }
          if (!floor0Variables) {
            throw new Error('等待 10 秒后 0 楼变量桶仍为空');
          }
          await updateVariablesWith(buildStat, { type: 'message', message_id: 0 });
          // 聊天级基线：状态栏/手机在 AI 首轮楼层快照缺失时回退读取 chat 级，
          // 保证开局初始状态（现金/角色记录等）不依赖主 AI 首轮是否输出变量更新块
          await updateVariablesWith(buildStat, { type: 'chat' });
          const expected = buildStat({}).stat_data;
          const committedFloor0 = (getVariables({ type: 'message', message_id: 0 }) ?? {}).stat_data;
          const committedChat = (getVariables({ type: 'chat' }) ?? {}).stat_data;
          const assertCommitted = (label: string, stat: Record<string, any> | undefined) => {
            if (!stat) throw new Error(`${label}缺少 stat_data`);
            if (stat.mode !== expected.mode || stat.current_pov !== expected.current_pov) {
              throw new Error(`${label}模式/视角校验失败`);
            }
            if (JSON.stringify(stat.characters ?? {}) !== JSON.stringify(expected.characters ?? {})) {
              throw new Error(`${label}初始关系校验失败`);
            }
          };
          assertCommitted('楼层0', committedFloor0);
          assertCommitted('聊天级', committedChat);
          console.info(
            `[开场白] 已写入并验证 MVU 变量（楼层0 + 聊天级全量 commit，预建角色 ${Object.keys(expected.characters ?? {}).length} 人）`,
          );
        } else {
          throw new Error('无 MVU API（getVariables/updateVariablesWith 缺失）');
        }
      } catch (error) {
        console.error('[开场白] MVU 变量写入失败', error);
        showToast('变量写入失败，请检查 MVU 脚本是否启用', 'error', 4000);
        throw error;
      }

      // 世界书 enabled 批量切换（MVU-DESIGN §3 · 角色卡绑定世界书）
      // 三阶门控：commit 翻条目 enabled → 场景条目内容层 @@if mode=="pov" && current_scene==N 进一步过滤 → MVU 变量驱动主AI按场景走
      // 这里只切 enabled：场景/尾声 = pov 开 · S1 暗线组 = pov 开 · S2 = 恒关。custom 模式全部关，仅留世界观/扮演准则/角色等 S0 公开条目
      try {
        if (typeof getCharWorldbookNames === 'function' && typeof getWorldbook === 'function' && typeof updateWorldbookWith === 'function') {
          const names = getCharWorldbookNames('current');
          const bookName = names?.primary;
          if (bookName) {
            const entries = await getWorldbook(bookName);
            if (Array.isArray(entries)) {
              const isOpen = gameMode.value === 'open';
              const isStoryPov = mode.value === 'pov' && gameMode.value === 'story';
              const next = entries.map(e => {
                const n = e.name;
                if (!n) return e;
                const isScene = SCENE_NAME_RE.test(n);
                const isEpilogue = /^尾声/.test(n);
                const isS1 = (SPOILER_S1 as readonly string[]).includes(n);
                const isS2 = (SPOILER_S2 as readonly string[]).includes(n);
                let nextEnabled: boolean;
                if (isS2) {
                  // S2 真相：任何模式都不直接启用（条目自带更严的 @@if 门控）
                  nextEnabled = false;
                } else if (isScene || isEpilogue) {
                  // 场景/尾声：仅剧本模式开；开放世界与自建关
                  nextEnabled = isStoryPov;
                } else if (isS1) {
                  // S1 家族暗线组：剧本POV开；开放世界全开（爱布拉娜可攻略·家族线自由展开）；剧本自建关
                  nextEnabled = isStoryPov || isOpen;
                } else {
                  // S0 公开/世界观/扮演准则/角色条目等保留原 enabled 状态
                  nextEnabled = e.enabled;
                }
                return { ...e, enabled: nextEnabled };
              });
              await updateWorldbookWith(bookName, () => next);
              console.info(`[开场白] 世界书 enabled 批量切换完成（mode=${isOpen ? 'free' : isStoryPov ? 'pov' : 'custom'}，共 ${entries.length} 条）`);
            } else {
              console.error('[开场白] getWorldbook 未返回条目数组，世界书切换跳过');
            }
          } else {
            console.warn('[开场白] 当前角色卡未绑定主世界书，世界书切换跳过');
          }
        } else {
          console.warn('[开场白] 无世界书 API（getCharWorldbookNames/getWorldbook/updateWorldbookWith 缺失），世界书 enabled 未切换');
        }
      } catch (error) {
        console.error('[开场白] 世界书 enabled 切换失败', error);
        showToast('世界书切换失败，可能需手动启用/禁用场景条目', 'error', 4000);
      }

      // 落盘开场：替换 0 楼的 <OpeningUI/> 占位符，占位符消失后界面随刷新卸载
      if (typeof getChatMessages === 'function' && typeof setChatMessages === 'function') {
        const original = getChatMessages(0)[0]?.message ?? '';
        const next = original.includes('<OpeningUI/>')
          ? original.replace('<OpeningUI/>', payload)
          : `${original}\n\n${payload}`;
        if (!original.includes('<OpeningUI/>')) {
          console.warn('[开场白] 0 楼未找到 <OpeningUI/> 占位符，已改为追加到文末');
        }
        await setChatMessages([{ message_id: 0, message: next }], { refresh: 'affected' });
        console.info('[开场白] 已写入 0 楼消息');
        committedSummary.value = summary;
        committedText.value = text;
        // 正常随楼层刷新卸载；若未卸载则兜底展示完成态
        step.value = 'done';
        // 首条回复改由挂载脚本（脚本库沙箱，持久上下文）编排：
        // commit 后本 iframe 会随占位符消失被卸载，iframe 内直接生成会与楼层刷新/卸载竞态
        // （回复被挂成 0 楼 swipe 或直接丢失），改为 postMessage 通知沙箱：
        // 插入可见 user 消息 → 复制 0 楼变量基线 → /trigger 创建 assistant 楼层
        try {
          if (window.parent && window.parent !== window) {
            window.parent.postMessage({ source: 'counterfeit-opening', type: 'commit-done', summary }, '*');
            showToast('开局完成，正在生成第一段剧情…', 'info', 4000);
          } else {
            console.warn('[开场白] 无宿主页面，跳过自动触发首条回复');
          }
        } catch (error) {
          console.error('[开场白] 自动触发首条回复失败', error);
        }
      } else {
        // 纯浏览器预览：无酒馆 API，完整打印 payload 并进入完成态
        console.info('[开场白·预览模式] 提交 payload：\n' + payload);
        previewMode.value = true;
        committedSummary.value = summary;
        committedText.value = text;
        step.value = 'done';
      }
    } catch (error) {
      console.error('[开场白] 提交失败', error);
      showToast(`提交失败：${error instanceof Error ? error.message : String(error)}`, 'error', 4000);
    } finally {
      submitting.value = false;
    }
  }

  return {
    step,
    mode,
    gameMode,
    selectedPov,
    difficulty,
    form,
    submitting,
    committedSummary,
    committedText,
    previewMode,
    povInfo,
    openingText,
    openingDraft,
    finalOpeningText,
    applyOpeningDraft,
    resetOpeningDraft,
    summaryBlock,
    toMode,
    toIntro,
    toTitle,
    toGallery,
    backToTitle,
    backToMode,
    selectPov,
    confirmPov,
    toCustom,
    confirmCustom,
    toOpening,
    commit,
  };
});
