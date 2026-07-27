// Counterfeit · MVU 变量结构（动态角色记录＋世界/玩家状态＋手机助手独占phone容器）
// z 与 _ 由运行环境全局提供，禁止 import
const RelationshipSchema = z.object({
  bond: z.coerce.number().transform((v) => _.clamp(v, 0, 100)).prefault(0),
  romance: z.coerce.number().transform((v) => _.clamp(v, 0, 100)).prefault(0),
  commitment: z.enum(['未确认', '仅朋友', '恋人']).prefault('未确认'),
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

export const Schema = z.object({
  // ── 模式与主角组（双模式）──
  mode: z.enum(['pov', 'custom']).nullable().prefault(null),
  current_pov: z.enum(['hachiman', 'yukino', 'yui', 'laff']).nullable().prefault(null),
  custom_protagonist: z.object({
    name: z.string().prefault(''),
    gender: z.string().prefault(''),
    className: z.string().prefault(''),
    identity: z.string().prefault(''),
    past: z.string().prefault(''),
    personality: z.string().prefault(''),
    appearance: z.string().prefault(''),
  }).nullable().prefault(null),

  // ── 剧本进度 ──
  current_scene: z.coerce.number().int().transform((v) => _.clamp(v, 1, 150)).prefault(1),

  // ── 世界与玩家状态 ──
  world: z.object({
    current_date: z.string().prefault('2013-05-20'),
    current_location: z.string().prefault('未确认'),
  }).prefault({
    current_date: '2013-05-20',
    current_location: '未确认',
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

  // ── 结局组 ──
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
});
export type Schema = z.output<typeof Schema>;
