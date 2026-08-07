// Counterfeit · 状态栏静态资料表（D14）
// 与 cg.ts 同构：规范全名为键，未列出的角色返回 null，由 UI 显示"未公开"占位——不得编造。
// 数据来源：cards/Counterfeit/角色基础信息.json（† = 同人推定值，非官方公开）；
//          攻略指南逐字取自各角色世界书「角色关系判定」段，文本不得改写。

export interface BaseInfo {
  /** 身高，含 † 推定标记；未公开为 null */
  height: string | null;
  weight: string | null;
  birthday: string | null;
  bloodType: string | null;
  hobbies: string | null;
}

/** 规范全名 → 基础信息 */
const BASE_INFO: Record<string, BaseInfo> = {
  比企谷八幡: {
    height: '172cm†',
    weight: '60kg†',
    birthday: '8月8日',
    bloodType: 'A型',
    hobbies: '阅读、轻小说与动漫游戏、千叶本地知识、独处、MAX咖啡',
  },
  雪之下雪乃: {
    height: '167cm†',
    weight: '52kg†',
    birthday: '1月3日',
    bloodType: 'B型',
    hobbies: '阅读、红茶、猫、潘先生、料理与烘焙',
  },
  由比滨结衣: {
    height: '164cm†',
    weight: '55kg†',
    birthday: '6月18日',
    bloodType: 'O型',
    hobbies: '购物、卡拉OK、甜点与料理练习、照顾萨布雷、朋友聚会',
  },
  '拉芙希妮·都柏林': {
    height: '172cm',
    weight: '47kg',
    birthday: '10月16日',
    bloodType: 'B型',
    hobbies: '诗歌、写作、晒太阳',
  },
  一色彩羽: {
    height: null,
    weight: null,
    birthday: '4月16日',
    bloodType: 'B型',
    hobbies: '时尚美容、社交、足球部经理工作、学生会活动',
  },
  比企谷小町: {
    height: null,
    weight: null,
    birthday: '3月3日',
    bloodType: 'O型',
    hobbies: '料理与家务、购物、策划活动、干涉哥哥的人际关系',
  },
  平冢静: {
    height: '178cm†',
    weight: '58kg†',
    birthday: '12月7日',
    bloodType: 'B型',
    hobbies: '少年漫画、言情小说、动画、摩托车、拉面、饮酒',
  },
  户冢彩加: {
    height: '158cm†',
    weight: '50kg†',
    birthday: '5月9日',
    bloodType: 'A型',
    hobbies: '网球与体能训练',
  },
  叶山隼人: {
    height: null,
    weight: null,
    birthday: '9月28日',
    bloodType: 'B型',
    hobbies: '足球、各类运动、集体活动',
  },
  三浦优美子: {
    height: null,
    weight: null,
    birthday: '12月12日',
    bloodType: 'B型',
    hobbies: '时尚、购物、美容装扮、朋友聚会',
  },
  海老名姬菜: {
    height: null,
    weight: null,
    birthday: '7月14日',
    bloodType: 'AB型',
    hobbies: 'BL创作与阅读、历史小说、绘画、同人活动、池袋购物',
  },
  川崎沙希: {
    height: null,
    weight: null,
    birthday: '10月26日',
    bloodType: 'A型',
    hobbies: '缝纫、家务、料理、照顾弟妹',
  },
  户部翔: {
    height: null,
    weight: null,
    birthday: '8月29日',
    bloodType: 'B型',
    hobbies: '足球、卡拉OK、朋友聚会',
  },
  相模南: {
    height: null,
    weight: null,
    birthday: '6月26日',
    bloodType: null,
    hobbies: '卡拉OK、社交活动',
  },
  材木座义辉: {
    height: null,
    weight: null,
    birthday: '11月23日',
    bloodType: 'AB型',
    hobbies: '轻小说创作、电子游戏、历史武将、中二角色扮演',
  },
  大和: { height: null, weight: null, birthday: null, bloodType: null, hobbies: '橄榄球' },
  大冈: { height: null, weight: null, birthday: null, bloodType: null, hobbies: '棒球' },
  雪之下阳乃: {
    height: null,
    weight: null,
    birthday: '7月7日',
    bloodType: 'B型',
    hobbies: '擅长运动、武术与社交',
  },
  城廻巡: {
    height: null,
    weight: null,
    birthday: '1月21日',
    bloodType: null,
    hobbies: '学生会工作、校园活动组织',
  },
  折本香织: {
    height: null,
    weight: null,
    birthday: '2月21日',
    bloodType: 'O型',
    hobbies: '社交与集体活动',
  },
  川崎京华: { height: null, weight: null, birthday: null, bloodType: null, hobbies: '玩耍、甜食' },
  玉绳: {
    height: null,
    weight: null,
    birthday: null,
    bloodType: null,
    hobbies: '学生会工作、活动策划',
  },
  由比滨母亲: { height: null, weight: null, birthday: null, bloodType: null, hobbies: '料理、烘焙与家庭活动' },
};

export interface RelationshipGuide {
  /** 仅少数角色有，如结衣的「接近说明」 */
  note?: string;
  positive: string;
  negative: string;
  commitment: string;
}

/**
 * 规范全名 → 攻略指南。
 * 文本逐字取自世界书「角色关系判定」段；雪乃的"增加/减少好感行为（参考）"与
 * 拉芙的"正面/负面（参考）"在此统一为 positive/negative 字段名，内容一字未改。
 */
const GUIDE: Record<string, RelationshipGuide> = {
  比企谷八幡: {
    positive:
      '共事时主动分担，不把麻烦都留给他;记住MAX咖啡等细节，但不刻意邀功;不把他的自贬当真，也不空泛夸他“是好人”;看穿自爆后提出替代方案，并共同承担后果,明确告诉他：“别替我决定。”;尊重他的拒绝、沉默和个人选择',
    negative:
      '因同情或怜悯接近他;强迫他参加集体活动;默认让他用自爆解决问题;消费他的牺牲，事后再假装心疼;当众揭穿他的真实动机;替他决定什么对他最好;把他当成需要拯救或改造的人',
    commitment: '他停止用任务或自毁包装关系，主动作出只有我或只有我们才能成立的明确承认',
  },
  雪之下雪乃: {
    positive:
      '坦诚表达真实意图·在委托中提出可执行的方案并承担责任·尊重她的独立选择·记得潘先生、红茶与猫等喜好·看见并认真回应她少有的让步',
    negative:
      '空洞恭维外貌家世或成绩·说谎隐瞒真实目的·套路式讨好送礼·擅自替她承担或决定·把她的求助和让步视为软弱',
    commitment: '她明确确认这段关系出自自己的选择，并以个人意志而不是效率或比较结果作出回答',
  },
  由比滨结衣: {
    note: '接近结衣容易——她对谁都先给温度；但让她相信对方能够接住"不负责暖场的她"，并不容易',
    positive:
      '真诚回应她主动释放的善意·记得萨布雷、甜点与聊天中的小细节·在轻松气氛之外认真询问她的真实想法·接受她的靠近却不视为理所当然·在她勉强微笑时允许她坦率说不',
    negative:
      '把她的温柔当作没有主见·利用她不愿破坏气氛逼她让步·敷衍回应昵称、邀约与礼物·只在需要调和关系时依赖她·明知她在逞强仍要求她继续保持开心',
    commitment: '她不再读空气或退让，完整说出自己的真实要求，并确认对方接住的是她本人',
  },
  '拉芙希妮·都柏林': {
    positive:
      '尊重她对距离与接触的选择·把善意说清而不要求回报·让她参与集体活动甚至做决定·记得她对甜食、诗歌与日常小事的偏好·察觉异常时安静陪伴而不追问',
    negative:
      '因同情或创伤接近她·擅自触碰丝带或追问过去·把克制当作不会受伤·以家族和姐姐替她定义身份·替她决定什么才安全或正确',
    commitment: '长期一致性已经形成可核对的事实，并由她在没有外部逼迫时主动走向对方、明确签发自己的选择',
  },
  一色彩羽: {
    positive:
      '为她做不求回报的事且不利用漏洞·听出撒娇里低半度的本音但不当众拆穿·在她算不清收益时仍保持稳定回应',
    negative: '被营业式撒娇牵着走·用交换条件回应靠近·利用她的请求拿捏她·当众拆穿演出',
    commitment: '她的本音突破演出，而对方不接受事后找补，双方确认刚才那句真实表达仍然算数',
  },
  平冢静: {
    positive: '让她不必借教育或偶然路过的名义也能表达关心·认真回答她对选择与责任的追问·在沉默时陪伴而不逼问',
    negative: '把关心当理所当然·利用她的身份谋便利·主动追问达洛维·用恭维替代真实交流',
    commitment: '她主动把关心从职责语法改为个人选择，并与对方明确确认这段双向关系',
  },
  雪之下阳乃: {
    positive: '准确指出她回避的核心但不攻击·不接探测节奏也不拆穿·在她的社交主场给出未经排练的真实答案',
    negative: '奉承家世能力或美貌·拿雪乃当接近她的工具·算计被识破·把她短暂卸下面具的时刻转述给第三人',
    commitment: '她不再把反复出现的真实面归为偶尔失常，并主动让一次没有完成的真话在两人之间继续成立',
  },
  '爱布拉娜·都柏林': {
    positive: '不被掌控也不逃离·听出通知式语言里的问句并回答·记得过甜红茶等私密偏好·面对她交出的不确定保持稳定',
    negative: '用服从或对抗把关系简化成权力角力·恭维完美品牌·借拉芙希妮接近她·承诺落空·公开点破她的脆弱',
    commitment: '她主动说出我不知道或我需要，并允许这份不确定在对方面前保留而不立即收回控制权',
  },
  三浦优美子: {
    positive: '讲理而不跪服地正面赢她一次·对结衣真诚·在圈子压力下站理不站队·尊重她主动让步',
    negative: '奉承女王位置·油腻搭讪·让结衣为难·背后议论·在她让步后得寸进尺',
    commitment: '她主动把玩家划入自己人，却明确说明这个位置来自个人选择而不是圈子归属',
  },
  户冢彩加: {
    positive: '认真陪练·观看比赛并指出具体进步·在他承担部长责任时并肩搭手·分辨他对所有人的温柔和只对玩家的偏向',
    negative: '只夸外貌可爱·拿性别表达开玩笑·轻视网球部·用贵重礼物代替共同经历',
    commitment: '他主动承认对玩家的等待、留位与记挂和对其他人不同，并明确接受这份特别',
  },
  川崎沙希: {
    positive: '用顺路搭手等实际行动分担·真诚对待她的弟妹·尊重疲惫而不表演心疼·保持稳定低能耗的陪伴',
    negative: '同情施舍·劝她别再拼·打听家境·在打工地点大惊小怪·约好后放鸽子',
    commitment: '她主动把自己的时间、家庭日常和需要帮助的时刻向玩家开放，并明确接受彼此可以依靠',
  },
  海老名姬菜: {
    positive: '接住试探性逗弄而不慌·展现真实的人际判断·对她坦诚·认真回应她关闭棱镜后说出的观察',
    negative: '装现充或装深沉·过度迎合她的爱好·虚伪被识破·拿她的兴趣当笑柄',
    commitment: '她主动承认玩家已经成为不想隔着棱镜观察的人，并以直接表达替代旁观式试探',
  },
  比企谷小町: {
    positive: '对比企谷家的日常作出真实贡献·用同规格坦率接住吐槽·记得她认真说过的小事·在她不谈分数时同样认真回应',
    negative: '刻意讨好刷分·通过她打探八幡·把她当小孩敷衍·忽视她认真表达的担心',
    commitment: '她停止只用打分包裹在意，主动表达一份只对玩家成立的偏向，并与对方明确确认',
  },
  鹤见留美: {
    positive: '不要求说明的安静在场·以平等语气交流·守住每一个小承诺·认真听她说出过早看懂的人际事实',
    negative: '同情表演·空泛鼓励·替她安排帮助·承诺落空·把她的处境当作谈资',
    commitment: '她主动把玩家从可以并肩沉默的人推进到只对彼此成立的偏向，并明确确认这份关系',
  },
};

/** characters 记录键可能出现的简称 → 上表使用的规范全名 */
const NAME_ALIASES: Record<string, string> = {
  一色伊吕波: '一色彩羽',
  爱布拉娜: '爱布拉娜·都柏林',
  拉芙希妮: '拉芙希妮·都柏林',
};

function canonical(name: string): string {
  return NAME_ALIASES[name] || name;
}

export function baseInfoOf(canonicalName: string): BaseInfo | null {
  return BASE_INFO[canonical(canonicalName)] || null;
}

export function guideOf(canonicalName: string): RelationshipGuide | null {
  return GUIDE[canonical(canonicalName)] || null;
}

/** † 标注的字段为同人推定值；有任意一项带 † 时 UI 显示脚注 */
export function hasEstimatedValue(info: BaseInfo | null): boolean {
  if (!info) return false;
  return [info.height, info.weight, info.birthday, info.bloodType].some(v => !!v && v.includes('†'));
}
