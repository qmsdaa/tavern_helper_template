import { OPENING_TEXTS, dlcPovByKey, povByKey, renderCustomOpening, renderDlcCustomOpening, type DlcPovCopy, type PovKey } from './copy';
import { OPENING_DRAFT_MAX, parseOpeningDate, resolveOpeningText } from './openingDraft';
import { showToast } from './toast';

export type Step = 'gate' | 'intro' | 'title' | 'campaign' | 'mode' | 'pov' | 'custom' | 'dlc_setup' | 'save_import' | 'opening' | 'gallery' | 'done';
export type Mode = 'pov' | 'custom';
export type CampaignId = 'main' | 'dlc_genderbend_hachiman' | 'dlc_body_swap_mrs_yukinoshita';
export type DlcMind = 'hachiman' | 'mrs_yukinoshita';
/** 《错位的日常》可扮演集合：性转八幡（DLC 专属）+ 三主角 + 自建 */
export type DlcPov = 'hachiman_f' | 'yukino' | 'yui' | 'laff' | 'custom';
/** 玩法模式：story=剧本模式（150场）·open=开放世界攻略模式（写入 stat.mode='free'） */
export type GameMode = 'story' | 'open';
/** 恋爱难度：开局定档·commit 写入 stat_data.difficulty·全模式生效 */
export type DifficultyKey = '简单' | '普通' | '困难';
/** 剧情模式下自建角色的参与方式预设轨道（开放世界自建不选、不写入） */
export type ParticipationTrack = 'member' | 'classmate' | 'outsider';
/** 参与轨道显示名：开局摘要块与挂载脚本首条 user 消息共用口径，改动需两边同步 */
export const PARTICIPATION_LABELS: Record<ParticipationTrack, string> = {
  member: '奉仕部第五名部员',
  classmate: '同班旁观者',
  outsider: '场外自由人',
};

/** POV 角色开局所在班级教室（MVU-DESIGN §2.1：world.current_location 在 POV 模式填对应 F/J 班教室） */
const POV_CLASSROOM: Record<PovKey, string> = {
  hachiman: '总武高中·2年F班教室',
  yukino: '总武高中·2年J班教室',
  yui: '总武高中·2年F班教室',
  laff: '总武高中·2年J班教室',
};

/** 《错位的日常》DLC 各可扮演角色的默认开局位置（官方序幕不自定义时） */
const DLC_LOCATIONS: Record<DlcPov, string> = {
  hachiman_f: '比企谷家·八幡房间',
  yukino: '雪之下雪乃的公寓',
  yui: '由比滨家',
  laff: '成田机场到达口（从英国返回）',
  custom: '未确认',
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

// 开场专用生产构建会把 Pinia 与 Vue 内联到同一 bundle；继续使用 setup store，
// 让开场状态与组件响应式依赖保持直接、可测试，也避免依赖酒馆宿主提供前端运行库。
/** 预览调试：?screen=title|gallery|intro… 直达指定屏（缺省 gate 启动门） */
function initialStep(): Step {
  const target = new URLSearchParams(window.location.search).get('screen');
  const valid: Step[] = ['gate', 'intro', 'title', 'campaign', 'mode', 'pov', 'custom', 'dlc_setup', 'save_import', 'opening', 'gallery', 'done'];
  return valid.includes(target as Step) ? (target as Step) : 'gate';
}

export const useOpeningStore = defineStore('counterfeit-opening', () => {
  const step = ref<Step>(initialStep());
  const campaignId = ref<CampaignId>('main');
  const dlcMind = ref<DlcMind>('hachiman');
  /** 《错位的日常》DLC 角色选择（性转八幡 / 雪乃 / 结衣 / 拉芙 / 自建） */
  const dlcPov = ref<DlcPov>('hachiman_f');
  const mode = ref<Mode | null>(null);
  /** 玩法模式：story=剧本 / open=开放世界（stat.mode 写 'free'）；自建角色在两种玩法下均可用 */
  const gameMode = ref<GameMode>('story');
  const selectedPov = ref<PovKey | null>(null);
  const difficulty = ref<DifficultyKey>('普通');
  const form = reactive<CustomForm>(emptyForm());
  /** 剧情模式自建的参与方式（gameMode='open' 时不展示、commit 恒写 null） */
  const participationTrack = ref<ParticipationTrack | null>(null);
  const participationNote = ref('');
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
    if (campaignId.value === 'dlc_genderbend_hachiman') {
      if (dlcPov.value === 'custom') return renderDlcCustomOpening(form.name);
      const map: Record<Exclude<DlcPov, 'custom'>, string> = {
        hachiman_f: OPENING_TEXTS.dlc_genderbend_hachiman,
        yukino: OPENING_TEXTS.dlc_genderbend_yukino,
        yui: OPENING_TEXTS.dlc_genderbend_yui,
        laff: OPENING_TEXTS.dlc_genderbend_laff,
      };
      return map[dlcPov.value as Exclude<DlcPov, 'custom'>] ?? OPENING_TEXTS.dlc_genderbend_hachiman;
    }
    if (campaignId.value === 'dlc_body_swap_mrs_yukinoshita') {
      return dlcMind.value === 'mrs_yukinoshita'
        ? OPENING_TEXTS.dlc_body_swap_mrs_yukinoshita
        : OPENING_TEXTS.dlc_body_swap_hachiman;
    }
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
    return { ok: true, message: '已应用自定义序幕（自由世界模式下，开局日期/地点/情境以你的序幕为准）' };
  }

  /** 恢复官方默认序幕 */
  function resetOpeningDraft() {
    openingDraft.value = null;
  }

  // 切换模式/主角/玩法/难度时丢弃草稿——草稿绑定的是"当前选择对应的官方序幕"，不能跨选择串用
  watch([campaignId, dlcMind, dlcPov, mode, selectedPov, gameMode, difficulty], () => {
    openingDraft.value = null;
  });

  /** 结构化设定摘要块 */
  const summaryBlock = computed<string>(() => {
    if (campaignId.value === 'dlc_genderbend_hachiman') {
      if (dlcPov.value === 'custom') {
        return [
          `<opening_setup campaign="${campaignId.value}" revision="1" mode="free" diff="${difficulty.value}" name="${escapeAttr(form.name.trim())}">`,
          '故事: 《错位的日常》',
          `玩家视点: 自建角色「${form.name.trim() || '未命名角色'}」`,
          `性别: ${form.gender || '未填写'}`,
          `所在班级: ${form.className || '未填写'}`,
          `身份: ${form.identity.trim() || '未填写'}`,
          `过往经历: ${form.past.trim() || '未填写'}`,
          `性格: ${form.personality.trim() || '未填写'}`,
          `相貌: ${form.appearance.trim() || '未填写'}`,
          '连续性: main:118 · 2014-07-12',
          '</opening_setup>',
        ].join('\n');
      }
      const povLabel = dlcPovByKey(dlcPov.value as DlcPovCopy['key']).name;
      return [
        `<opening_setup campaign="${campaignId.value}" revision="1" mode="free" pov="${dlcPov.value}" diff="${difficulty.value}">`,
        '故事: 《错位的日常》',
        `玩家视点: ${povLabel}`,
        '连续性: main:118 · 2014-07-12',
        '</opening_setup>',
      ].join('\n');
    }
    if (campaignId.value === 'dlc_body_swap_mrs_yukinoshita') {
      return [
        `<opening_setup campaign="${campaignId.value}" revision="1" mode="free" pov="${dlcMind.value}" diff="${difficulty.value}">`,
        '故事: 《君的名字？》',
        `玩家意识: ${dlcMind.value === 'hachiman' ? '比企谷八幡' : '雪之下夫人'}（整局稳定）`,
        `初始身体: ${dlcMind.value === 'hachiman' ? '雪之下夫人的身体' : '比企谷八幡的身体'}`,
        '连续性: main:118 · 2014-07-12',
        '</opening_setup>',
      ].join('\n');
    }
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
      const lines = [
        `<opening_setup mode="${statMode}" diff="${difficulty.value}" name="${escapeAttr(form.name.trim())}">`,
        `性别: ${form.gender || '未填写'}`,
        `所在班级: ${form.className || '未填写'}`,
        `身份: ${form.identity.trim() || '未填写'}`,
        `过往经历: ${form.past.trim() || '未填写'}`,
        `性格: ${form.personality.trim() || '未填写'}`,
        `相貌: ${form.appearance.trim() || '未填写'}`,
      ];
      // 剧情模式自建：参与方式是场景门控放行依据，必须进摘要块让模型逐楼可见
      if (gameMode.value === 'story' && participationTrack.value) {
        lines.push(`参与方式: ${PARTICIPATION_LABELS[participationTrack.value]}`);
        const note = participationNote.value.trim();
        if (note) {
          lines.push(`参与补充: ${note}`);
        }
      }
      lines.push('</opening_setup>');
      return lines.join('\n');
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

  function toCampaign() {
    step.value = 'campaign';
  }

  function chooseCampaign(id: CampaignId) {
    campaignId.value = id;
    selectedPov.value = null;
    mode.value = null;
    if (id === 'main') {
      step.value = 'mode';
      return;
    }
    gameMode.value = 'open';
    dlcMind.value = 'hachiman';
    dlcPov.value = 'hachiman_f';
    step.value = 'dlc_setup';
  }

  /** 《错位的日常》DLC 角色选择：选性转八幡/雪乃/结衣/拉芙 或进入自建表单 */
  function selectDlcPov(pov: DlcPov) {
    dlcPov.value = pov;
    if (pov === 'custom') {
      mode.value = 'custom';
      selectedPov.value = null;
      step.value = 'custom';
    }
  }

  function confirmDlc() {
    if (campaignId.value === 'main') return;
    if (campaignId.value === 'dlc_genderbend_hachiman') {
      if (dlcPov.value === 'custom') {
        selectDlcPov('custom');
        return;
      }
      dlcMind.value = 'hachiman';
      step.value = 'opening';
      return;
    }
    if (campaignId.value === 'dlc_body_swap_mrs_yukinoshita') dlcMind.value = 'hachiman';
    step.value = 'opening';
  }

  function toSaveImport() {
    step.value = 'save_import';
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

  /** 自建表单返回：DLC 自建回角色网格，主线自建回玩法模式选择。 */
  function backFromCustom() {
    if (campaignId.value === 'dlc_genderbend_hachiman' && dlcPov.value === 'custom') step.value = 'dlc_setup';
    else step.value = 'mode';
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

  /** 自建角色确认创建（姓名必填；剧情模式另需选定参与方式，其余可空） */
  function confirmCustom() {
    if (!form.name.trim()) {
      showToast('请至少填写主角姓名', 'error');
      return;
    }
    if (gameMode.value === 'story' && !participationTrack.value) {
      showToast('剧情模式需要选择一种参与剧情的方式', 'error');
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
            const isDlc = campaignId.value !== 'main';
            const isPov = mode.value === 'pov';
            const isOpen = gameMode.value === 'open';
            stat.campaign_id = campaignId.value;
            stat.campaign_revision = 1;
            // 三模式公共项（§2.1 通行口径，路径对齐 schema.ts）
            // open（开放世界攻略）→ stat.mode='free'：current_scene 冻结占位不参与150场路由·time_slot 锚定放课后
            stat.mode = isDlc || isOpen ? 'free' : isPov ? 'pov' : 'custom';
            stat.difficulty = difficulty.value;
            stat.opening_custom = openingDraft.value != null && openingDraft.value.trim().length > 0;
            stat.current_scene = 1;
            stat.campaign_completed = false;
            stat.mainline_completed = false;
            stat.collection = { version: 1, cg_unlocks: {}, ending_unlocks: {} };
            if (campaignId.value === 'dlc_genderbend_hachiman') {
              stat.collection.cg_unlocks['dlc_genderbend_hachiman:opening_seen'] = true;
            } else if (campaignId.value === 'dlc_body_swap_mrs_yukinoshita') {
              stat.collection.cg_unlocks[`dlc_body_swap_mrs_yukinoshita:opening_seen:${dlcMind.value}`] = true;
            }
            // 自定义序幕生效：free 模式优先使用从序幕文本解析出的日期（自由世界/ DLC 均可）
            const baseDate = isDlc ? '2014-07-12' : '2013-05-20';
            const parsedDate = openingDraft.value != null ? parseOpeningDate(openingDraft.value, isDlc ? 2014 : 2013) : null;
            stat.world = {
              current_date: parsedDate ?? baseDate,
              current_location: campaignId.value === 'dlc_genderbend_hachiman'
                ? (DLC_LOCATIONS[dlcPov.value] ?? '未确认')
                : campaignId.value === 'dlc_body_swap_mrs_yukinoshita'
                  ? dlcMind.value === 'hachiman' ? '雪之下家本邸·夫人卧室' : '比企谷家·八幡房间'
                  : isPov && selectedPov.value ? POV_CLASSROOM[selectedPov.value] : '未确认',
              time_slot: isDlc ? '早晨' : isOpen ? '放课后' : null,
            };
            // custom 模式主角家境未知，保持 null（“未确认”）由叙事后续锚定
            stat.player = {
              cash: !isDlc && isPov && selectedPov.value ? POV_INITIAL_CASH[selectedPov.value] : null,
              carried_items: [],
            };
            // 预建只属于"四选一"开局（剧本或开放世界均以 mode==='pov' 进入）；自建模式（custom）永不预建。
            // 旧条件 (isPov || isOpen) 会让 open+自建 + selectedPov 残留时错误预建（2026-08-07 修复）。
            stat.characters = !isDlc && isPov && selectedPov.value ? initialCharacters(selectedPov.value) : {};
            if (!isDlc && isPov && selectedPov.value) {
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
            if (campaignId.value === 'dlc_genderbend_hachiman') {
              if (dlcPov.value === 'hachiman_f') {
                stat.current_pov = 'hachiman_f';
                stat.custom_protagonist = null;
                stat.identity_state = {
                  kind: 'transformation', current_body: 'hachiman_f', presentation: 'female',
                  legal_identity: '比企谷八幡（性转）', self_naming: '八幡', cause_status: 'unknown', disclosure: {},
                };
              } else if (dlcPov.value === 'custom') {
                stat.current_pov = null;
                stat.custom_protagonist = { ...form, participation: null };
                stat.identity_state = null;
              } else {
                stat.current_pov = dlcPov.value; // yukino | yui | laff
                stat.custom_protagonist = null;
                stat.identity_state = null;
              }
            } else if (campaignId.value === 'dlc_body_swap_mrs_yukinoshita') {
              stat.current_pov = dlcMind.value;
              stat.custom_protagonist = null;
              stat.identity_state = {
                kind: 'body_swap',
                occupants: { body_hachiman: 'mrs_yukinoshita', body_mrs_yukinoshita: 'hachiman' },
                body_locations: { body_hachiman: '比企谷家·八幡房间', body_mrs_yukinoshita: '雪之下家本邸·夫人卧室' },
                swap_phase: 'swapped', last_swap_date: '2014-07-12', disclosure: {}, verification_evidence: [], shared_notes: [],
              };
            } else if (isPov) {
              stat.current_pov = selectedPov.value;
              stat.custom_protagonist = null;
              stat.identity_state = null;
            } else {
              stat.current_pov = null;
              stat.custom_protagonist = {
                ...form,
                // 仅剧情模式自建写入参与方式（场景门控放行依据）；开放世界自建恒 null
                participation:
                  !isOpen && participationTrack.value
                    ? { track: participationTrack.value, note: participationNote.value.trim() }
                    : null,
              };
              stat.identity_state = null;
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
            if (stat.campaign_id !== expected.campaign_id || stat.campaign_revision !== 1 || stat.mode !== expected.mode || stat.current_pov !== expected.current_pov) {
              throw new Error(`${label}战役/模式/玩家视点校验失败`);
            }
            if (JSON.stringify(stat.identity_state ?? null) !== JSON.stringify(expected.identity_state ?? null)) throw new Error(`${label}身份状态校验失败`);
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

      // 世界书 enabled 是角色卡共享配置，不能按聊天模式修改，否则一个新聊天会污染其他存档。
      // 场景、暗线与真相隔离统一由各楼层 stat_data + 已验证的 EJS getvar 守卫完成。

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
            window.parent.postMessage({ source: 'counterfeit-opening', type: 'commit-done', commitKind: 'opening', campaignId: campaignId.value, summary }, '*');
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
    campaignId,
    dlcMind,
    dlcPov,
    mode,
    gameMode,
    selectedPov,
    difficulty,
    form,
    participationTrack,
    participationNote,
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
    toCampaign,
    chooseCampaign,
    selectDlcPov,
    confirmDlc,
    toSaveImport,
    toIntro,
    toTitle,
    toGallery,
    backToTitle,
    backToMode,
    backFromCustom,
    selectPov,
    confirmPov,
    toCustom,
    confirmCustom,
    toOpening,
    commit,
  };
});
