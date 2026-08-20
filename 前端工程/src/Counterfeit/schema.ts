// Counterfeit · MVU 变量结构（动态角色记录＋世界/玩家状态＋手机助手独占phone容器）
// z 与 _ 由运行环境全局提供，禁止 import
const RelationshipSchema = z.object({
  bond: z.coerce.number().transform((v) => _.clamp(v, 0, 100)).prefault(0),
  romance: z.coerce.number().transform((v) => _.clamp(v, 0, 100)).prefault(0),
  commitment: z.enum(['未确认', '仅朋友', '恋人']).prefault('未确认'),
  intimate_memory: z.string().prefault(''),
  intimate_sexual_memory: z.string().prefault(''),
});

const OutfitSchema = z.object({
  outerwear: z.string().prefault('未确认'),
  inner_layer: z.string().prefault('未确认'),
  bottoms: z.string().prefault('未确认'),
  socks: z.string().prefault('未确认'),
  underwear: z.string().prefault('未确认'),
  shoes: z.string().prefault('未确认'),
});

const LatestUserMemorySchema = z.object({
  memory: z.string().prefault(''),
  inner_thought: z.string().prefault(''),
});

const CharacterStateSchema = z.object({
  display_name: z.string().prefault(''),
  present: z.boolean().prefault(false),
  known: z.boolean().prefault(false),
  relationship: RelationshipSchema.prefault({
    bond: 0,
    romance: 0,
    commitment: '未确认',
    intimate_memory: '',
    intimate_sexual_memory: '',
  }),
  latest_user_memory: LatestUserMemorySchema.prefault({
    memory: '',
    inner_thought: '',
  }),
  outfit: OutfitSchema.prefault({
    outerwear: '未确认',
    inner_layer: '未确认',
    bottoms: '未确认',
    socks: '未确认',
    underwear: '未确认',
    shoes: '未确认',
  }),
});

const IdentityStateSchema = z.union([
  z.object({
    kind: z.literal('transformation'),
    current_body: z.literal('hachiman_f').prefault('hachiman_f'),
    presentation: z.literal('female').prefault('female'),
    legal_identity: z.literal('比企谷八幡（性转）').prefault('比企谷八幡（性转）'),
    self_naming: z.literal('八幡').prefault('八幡'),
    cause_status: z.enum(['unknown', 'investigating', 'explained', 'resolved']).prefault('unknown'),
    disclosure: z.record(z.string(), z.any()).prefault({}),
  }),
  z.object({
    kind: z.literal('body_swap'),
    occupants: z.object({
      body_hachiman: z.enum(['hachiman', 'mrs_yukinoshita']),
      body_mrs_yukinoshita: z.enum(['hachiman', 'mrs_yukinoshita']),
    }),
    body_locations: z.object({
      body_hachiman: z.string().prefault('比企谷家·八幡房间'),
      body_mrs_yukinoshita: z.string().prefault('雪之下家本邸·夫人卧室'),
    }).prefault({ body_hachiman: '比企谷家·八幡房间', body_mrs_yukinoshita: '雪之下家本邸·夫人卧室' }),
    swap_phase: z.enum(['self', 'swapped']).prefault('swapped'),
    last_swap_date: z.string().prefault('2014-07-12'),
    disclosure: z.record(z.string(), z.any()).prefault({}),
    verification_evidence: z.array(z.string()).prefault([]),
    shared_notes: z.array(z.string()).prefault([]),
  }),
]).nullable().prefault(null);

const CollectionSchema = z.object({
  version: z.literal(1).prefault(1),
  cg_unlocks: z.record(z.string(), z.boolean()).prefault({}),
  ending_unlocks: z.record(z.string(), z.boolean()).prefault({}),
}).prefault({ version: 1, cg_unlocks: {}, ending_unlocks: {} });

/**
 * 剧情模式自建角色的参与方式（仅 mode='custom' 且剧本模式开局写入；
 * 开放世界自建与旧自建档恒 null——场景门控按 participation.track 非空放行，旧档自然不受影响）
 */
const ParticipationSchema = z.object({
  /** 预设参与轨道：member=奉仕部第五名部员 / classmate=同班旁观者 / outsider=场外自由人 */
  track: z.enum(['member', 'classmate', 'outsider']),
  /** 玩家自由补充说明（可空字符串） */
  note: z.string().prefault(''),
}).nullable().prefault(null);

export const Schema = z.object({
  // ── 战役、模式与玩家视点 ──
  campaign_id: z.enum(['main', 'dlc_genderbend_hachiman', 'dlc_body_swap_mrs_yukinoshita']).prefault('main'),
  campaign_revision: z.coerce.number().int().min(1).prefault(1),
  mode: z.enum(['pov', 'custom', 'free']).nullable().prefault(null),
  current_pov: z.enum(['hachiman', 'hachiman_f', 'yukino', 'yui', 'laff', 'mrs_yukinoshita']).nullable().prefault(null),
  custom_protagonist: z.object({
    name: z.string().prefault(''),
    gender: z.string().prefault(''),
    className: z.string().prefault(''),
    identity: z.string().prefault(''),
    past: z.string().prefault(''),
    personality: z.string().prefault(''),
    appearance: z.string().prefault(''),
    participation: ParticipationSchema,
  }).nullable().prefault(null),

  // ── 恋爱难度（开场白 commit 写入·仅开局可定）──
  difficulty: z.enum(['简单', '普通', '困难']).nullable().prefault(null),

  // ── 自定义序幕标记（开场白 commit 写入：玩家编辑过自定义序幕文本时 true）──
  // 自由世界（main free / DLC free）开局路由以此为准：以玩家序幕为开局唯一依据，
  // 不再固定 2013-05-20 拉芙转学 / DLC 官方锚点；日期由 commit 从序幕文本解析或保持模式默认
  opening_custom: z.boolean().prefault(false),

  // ── 剧本进度 ──
  current_scene: z.coerce.number().int().transform((v) => _.clamp(v, 1, 150)).prefault(1),
  campaign_completed: z.boolean().prefault(false),
  mainline_completed: z.boolean().prefault(false),
  identity_state: IdentityStateSchema,
  collection: CollectionSchema,

  // ── 世界与玩家状态 ──
  world: z.object({
    current_date: z.string().prefault('2013-05-20'),
    current_location: z.string().prefault('未确认'),
    time_slot: z.enum(['早晨', '上午', '午休', '放课后', '傍晚', '晚间']).nullable().prefault(null),
  }).prefault({
    current_date: '2013-05-20',
    current_location: '未确认',
    time_slot: null,
  }),
  player: z.object({
    cash: z.coerce.number().transform((v) => Math.max(0, v)).nullable().prefault(null),
    carried_items: z.array(z.string()).prefault([]),
  }).prefault({
    cash: null,
    carried_items: [],
  }),
  characters: z.record(z.string(), CharacterStateSchema).prefault({}),

  // ── Ω 与锤子组（仅拉芙 POV 存档激活）──
  'Ω_resonance': z.coerce.number().transform((v) => _.clamp(v, 0, 100)).prefault(0),
  hammer_thunder_1: z.enum(['pending', 'triggered', 'missed']).prefault('pending'),
  hammer_tea_1: z.enum(['pending', 'triggered', 'missed']).prefault('pending'),
  hammer_tea_2: z.enum(['pending', 'triggered', 'missed']).prefault('pending'),
  hammer_teddy_1: z.enum(['pending', 'triggered', 'missed']).prefault('pending'),
  hammer_thunder_2: z.enum(['pending', 'triggered', 'missed']).prefault('pending'),
  hammer_outcast_1: z.enum(['pending', 'triggered', 'missed']).prefault('pending'),
  hammer_teddy_2: z.enum(['pending', 'triggered', 'missed']).prefault('pending'),
  hammer_outcast_2: z.enum(['pending', 'triggered', 'missed']).prefault('pending'),
  hammer_tea_3: z.enum(['pending', 'triggered', 'missed']).prefault('pending'),

  // ── 信息锁组 ──
  laff_knows_fire_truth: z.boolean().prefault(false),
  laff_reed_authorized_yukino: z.boolean().prefault(false),
  dalloway_pen_used: z.boolean().prefault(false),

  // ── 成长里程碑组（2026-08-05 新增·事件旗标制·一旦true不可逆）──
  // 人格阶段由旗标数驱动；current_scene 只决定事件可用性，bond 只决定亲密
  arc_milestones: z.object({
    hachiman: z.object({
      asked_before_self_sacrifice: z.boolean().prefault(false),
      accepted_shared_cost: z.boolean().prefault(false),
      stated_personal_desire: z.boolean().prefault(false),
    }).prefault({
      asked_before_self_sacrifice: false,
      accepted_shared_cost: false,
      stated_personal_desire: false,
    }),
    yukino: z.object({
      offered_resources_without_deciding: z.boolean().prefault(false),
      admitted_personal_wish: z.boolean().prefault(false),
      separated_self_from_family_standard: z.boolean().prefault(false),
    }).prefault({
      offered_resources_without_deciding: false,
      admitted_personal_wish: false,
      separated_self_from_family_standard: false,
    }),
    yui: z.object({
      voiced_disagreement_publicly: z.boolean().prefault(false),
      did_not_retract_after_conflict: z.boolean().prefault(false),
      admitted_selfish_wish: z.boolean().prefault(false),
    }).prefault({
      voiced_disagreement_publicly: false,
      did_not_retract_after_conflict: false,
      admitted_selfish_wish: false,
    }),
    laff: z.object({
      expressed_preference: z.boolean().prefault(false),
      refused_without_explanation: z.boolean().prefault(false),
      chose_against_group_expectation: z.boolean().prefault(false),
      accepted_consequence_without_withdrawing_choice: z.boolean().prefault(false),
    }).prefault({
      expressed_preference: false,
      refused_without_explanation: false,
      chose_against_group_expectation: false,
      accepted_consequence_without_withdrawing_choice: false,
    }),
  }).prefault({
    hachiman: {
      asked_before_self_sacrifice: false,
      accepted_shared_cost: false,
      stated_personal_desire: false,
    },
    yukino: {
      offered_resources_without_deciding: false,
      admitted_personal_wish: false,
      separated_self_from_family_standard: false,
    },
    yui: {
      voiced_disagreement_publicly: false,
      did_not_retract_after_conflict: false,
      admitted_selfish_wish: false,
    },
    laff: {
      expressed_preference: false,
      refused_without_explanation: false,
      chose_against_group_expectation: false,
      accepted_consequence_without_withdrawing_choice: false,
    },
  }),

  // ── 一色成长旗标组（2026-08-05 新增·第五可攻略角色·非第五POV·外部证据制）──
  iroha_milestones: z.object({
    rejected_profitable_solution: z.boolean().prefault(false),
    made_uncalculated_request: z.boolean().prefault(false),
    stated_desire_without_performance: z.boolean().prefault(false),
  }).prefault({
    rejected_profitable_solution: false,
    made_uncalculated_request: false,
    stated_desire_without_performance: false,
  }),

  // ── 结局选择（仅 mainline_completed 后写入）──
  branch_choice: z.enum(['共同线', '八幡×雪乃', '八幡×拉芙希妮', '八幡×结衣', '雪乃×拉芙希妮', '雪乃×结衣', '拉芙希妮×结衣', '姐妹和解']).nullable().prefault(null),

  // ── 手机助手容器（聊天存档级·仅手机前端写入，主AI禁止更新）──
  phone: z.object({
    version: z.union([z.literal(1), z.literal(2)]).prefault(1),
    contacts: z.record(z.string(), z.any()).prefault({}),
    threads: z.record(z.string(), z.any()).prefault({}),
    messages: z.record(z.string(), z.any()).prefault({}),
    forum: z.object({
      posts: z.array(z.any()).prefault([]),
    }).passthrough().prefault({ posts: [] }),
    context: z.object({
      active_snapshot: z.any().nullable().prefault(null),
      manual_queue: z.array(z.coerce.number().int()).prefault([]),
      ingest_records: z.record(z.string(), z.any()).prefault({}),
      facts: z.array(z.any()).prefault([]),
      appointments: z.array(z.any()).prefault([]),
    }).passthrough().prefault({
      active_snapshot: null,
      manual_queue: [],
      ingest_records: {},
      facts: [],
      appointments: [],
    }),
    wallpaper: z.any().optional(),
  }).passthrough().prefault({
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
  }),
}).superRefine((stat, ctx) => {
  const issue = (path, message) => ctx.addIssue({ code: 'custom', path, message });
  if (stat.campaign_id === 'main') {
    const mainPovOk = stat.current_pov === null || ['hachiman', 'yukino', 'yui', 'laff'].includes(stat.current_pov);
    if (!mainPovOk) issue(['current_pov'], '主线玩家视点只能是八幡/雪乃/结衣/拉芙或空值');
    if (stat.identity_state !== null) issue(['identity_state'], 'main 战役不得携带 DLC 身份状态');
    if (stat.mainline_completed !== stat.campaign_completed) issue(['mainline_completed'], 'mainline_completed 必须镜像 main 的 campaign_completed');
  } else {
    if (stat.mode !== 'free') issue(['mode'], '开放世界 DLC 必须使用 mode=free');
    if (stat.current_scene !== 1) issue(['current_scene'], '开放世界 DLC 的 current_scene 只能是兼容占位 1');
    if (stat.mainline_completed) issue(['mainline_completed'], 'DLC 不得写入主线完成态');
  }
  if (stat.campaign_id === 'dlc_genderbend_hachiman') {
    const dlcPovOk =
      (stat.current_pov === 'hachiman_f' && stat.identity_state?.kind === 'transformation') ||
      (['yukino', 'yui', 'laff'].includes(stat.current_pov ?? '') && stat.identity_state === null) ||
      (stat.current_pov === null && stat.identity_state === null && stat.custom_protagonist !== null);
    if (!dlcPovOk) issue(['identity_state'], '《错位的日常》身份组合非法：仅 比企谷八幡（性转）/雪乃/结衣/拉芙/自建 五种开局');
  }
  if (stat.campaign_id === 'dlc_body_swap_mrs_yukinoshita') {
    if (!['hachiman', 'mrs_yukinoshita'].includes(stat.current_pov ?? '') || stat.identity_state?.kind !== 'body_swap') issue(['identity_state'], '《君的名字？》身份组合非法');
    else if (stat.identity_state.occupants.body_hachiman === stat.identity_state.occupants.body_mrs_yukinoshita) issue(['identity_state', 'occupants'], '两具身体必须由两个不同意识占据');
  }
});
export type Schema = z.output<typeof Schema>;
