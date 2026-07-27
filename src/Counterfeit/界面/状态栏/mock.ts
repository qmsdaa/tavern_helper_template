// Counterfeit · 状态栏 mock 预览数据
// 仅当 URL 显式带 ?mock=<场景> 时启用，用于脱离酒馆做视觉测试；
// 生产环境（无 mock 参数）读取失败时绝不伪造数据，只走 MVU 快照与安全回退。
import type { Schema } from '../../schema';

export function isMockMode(): boolean {
  return new URLSearchParams(window.location.search).has('mock');
}

function mockScenario(): string {
  return new URLSearchParams(window.location.search).get('mock') || 'pov';
}

type CharacterRecord = Schema['characters'][string];

interface CharacterSeed {
  display_name: string;
  present?: boolean;
  known?: boolean;
  bond?: number;
  romance?: number;
  commitment?: '未确认' | '仅朋友' | '恋人';
  memory?: string;
  inner_thought?: string;
}

function makeCharacter(seed: CharacterSeed): CharacterRecord {
  return {
    display_name: seed.display_name,
    present: seed.present ?? true,
    known: seed.known ?? true,
    relationship: {
      bond: seed.bond ?? 0,
      romance: seed.romance ?? 0,
      commitment: seed.commitment ?? '未确认',
    },
    latest_user_memory: {
      memory: seed.memory ?? '',
      inner_thought: seed.inner_thought ?? '',
    },
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

function baseData(): Schema {
  return {
    mode: null,
    current_pov: null,
    custom_protagonist: null,
    current_scene: 1,
    world: { current_date: '2013-05-20', current_location: '未确认' },
    player: { cash: null, carried_items: [] },
    characters: {},
    'Ω_resonance': 0,
    hammer_thunder_1: 'pending',
    hammer_tea_1: 'pending',
    hammer_tea_2: 'pending',
    hammer_teddy_1: 'pending',
    hammer_thunder_2: 'pending',
    hammer_outcast_1: 'pending',
    hammer_teddy_2: 'pending',
    hammer_outcast_2: 'pending',
    hammer_tea_3: 'pending',
    laff_knows_fire_truth: false,
    laff_reed_authorized_yukino: false,
    dalloway_pen_used: false,
    branch_choice: null,
    phone: {
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
    },
  };
}

/** 尚未完成开局（mode=null） */
function noneData(): Schema {
  return baseData();
}

/** 普通 POV：八幡 · 第三幕 · 两名在场角色（一名有记忆、一名空记忆）＋被过滤角色示例 */
function povData(): Schema {
  const data = baseData();
  data.mode = 'pov';
  data.current_pov = 'hachiman';
  data.current_scene = 32;
  data.world = { current_date: '2013-10-21', current_location: '总武高中 · 特别大楼四楼 · 奉仕部活动室' };
  data.player = { cash: 2480, carried_items: ['MAX咖啡', '文库本'] };
  data.characters = {
    雪之下雪乃: makeCharacter({
      display_name: '雪乃',
      bond: 65,
      memory: '部活结束后，他没有多说，只是把她忘在活动室的文库本整齐地放在了桌角。',
      inner_thought: '……谢谢。这种话，还是说不出口。',
    }),
    由比滨结衣: makeCharacter({ display_name: '结衣', bond: 34 }),
    // 不在场：必须被过滤
    户冢彩加: makeCharacter({ display_name: '户冢', present: false, bond: 40 }),
    // 在场但尚未认识：必须连名字都不显示
    戴毛线帽的女生: makeCharacter({ display_name: '戴毛线帽的女生', known: false, bond: 5 }),
  };
  return data;
}

/** 拉芙 POV：Ω 与九锤状态（场景 97 · 累计 Ω=43 的剧本时点） */
function laffData(): Schema {
  const data = baseData();
  data.mode = 'pov';
  data.current_pov = 'laff';
  data.current_scene = 97;
  data.world = { current_date: '2014-03-08', current_location: '拉芙希妮的公寓 · 客厅' };
  data.player = { cash: null, carried_items: ['达洛维钢笔'] };
  data['Ω_resonance'] = 43;
  data.hammer_thunder_1 = 'missed';
  data.hammer_tea_1 = 'triggered';
  data.hammer_tea_2 = 'triggered';
  data.hammer_teddy_1 = 'triggered';
  data.hammer_thunder_2 = 'triggered';
  data.hammer_outcast_1 = 'triggered';
  data.characters = {
    雪之下雪乃: makeCharacter({
      display_name: '雪乃',
      bond: 82,
      memory: '打雷的那晚，她把一杯没有加糖的红茶推到自己手边，什么也没问。',
      inner_thought: '苇草不需要道谢。……我只是，想坐在她旁边而已。',
    }),
    由比滨结衣: makeCharacter({ display_name: '结衣', bond: 61, commitment: '仅朋友' }),
    比企谷八幡: makeCharacter({ display_name: '比企谷', bond: 45 }),
  };
  return data;
}

/** 自建开放世界模式 */
function customData(): Schema {
  const data = baseData();
  data.mode = 'custom';
  data.custom_protagonist = {
    name: '青空黎',
    gender: '女',
    className: '二年F班',
    identity: '普通学生',
    past: '',
    personality: '',
    appearance: '',
  };
  data.world = { current_date: '2013-05-22', current_location: '总武高中 · 二年F班教室' };
  data.player = { cash: 3000, carried_items: [] };
  data.characters = {
    由比滨结衣: makeCharacter({
      display_name: '结衣',
      bond: 32,
      memory: '午休时，她分了一半的炒面面包给转来的新同桌。',
    }),
  };
  return data;
}

/** 布局压力：长地点 / 长物品名 / 多角色 / 空记忆 / 尾声分支 */
function longData(): Schema {
  const data = baseData();
  data.mode = 'pov';
  data.current_pov = 'yukino';
  data.current_scene = 150;
  data.branch_choice = '共同线';
  data.world = {
    current_date: '2015-03-14',
    current_location: '总武高中 · 特别大楼四楼西侧尽头的奉仕部活动室（毕业典礼前最后一天的黄昏）',
  };
  data.player = {
    cash: 123456,
    carried_items: [
      '毕业典礼用的深红色缎带书签',
      '奉仕部活动室的备用钥匙（平冢老师托付）',
      '写了三年的委托记录册·最终卷',
      '潘先生玩偶挂件',
    ],
  };
  data.characters = {
    比企谷八幡: makeCharacter({
      display_name: '八幡',
      bond: 88,
      commitment: '恋人',
      memory: '他在毕业纪念册的最后一页，只写了一句话：「这两年的委托，没有一件是亏本的。」',
      inner_thought: '真物这种东西，原来真的会一直留在手里。',
    }),
    由比滨结衣: makeCharacter({ display_name: '结衣', bond: 78 }),
    拉芙希妮·都柏林: makeCharacter({
      display_name: '拉芙希妮',
      bond: 66,
      memory: '她把钢笔轻轻放回抽屉最深处，说：「这次，故事由我们自己写完。」',
    }),
    一色彩羽: makeCharacter({ display_name: '一色', bond: 41 }),
    平冢静: makeCharacter({ display_name: '平冢老师', bond: 55, commitment: '仅朋友' }),
    户冢彩加: makeCharacter({ display_name: '户冢', bond: 28 }),
  };
  return data;
}

/** 无在场角色：POV 雪乃 · 独处 */
function emptyData(): Schema {
  const data = baseData();
  data.mode = 'pov';
  data.current_pov = 'yukino';
  data.current_scene = 63;
  data.world = { current_date: '2014-01-06', current_location: '雪之下家公寓 · 自己的房间' };
  data.player = { cash: null, carried_items: [] };
  data.characters = {
    比企谷八幡: makeCharacter({ display_name: '八幡', present: false, bond: 60 }),
    由比滨结衣: makeCharacter({ display_name: '结衣', present: false, bond: 62 }),
  };
  return data;
}

const SCENARIOS: Record<string, () => Schema> = {
  '1': povData,
  pov: povData,
  laff: laffData,
  custom: customData,
  long: longData,
  empty: emptyData,
  none: noneData,
};

export function getMockData(): Schema {
  const build = SCENARIOS[mockScenario()] ?? povData;
  return build();
}
