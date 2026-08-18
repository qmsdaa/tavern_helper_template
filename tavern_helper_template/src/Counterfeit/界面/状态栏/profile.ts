// Counterfeit · 状态栏静态资料表（D14）
// 与 cg.ts 同构：规范全名为键，未列出的角色返回 null，由 UI 显示"未公开"占位——不得编造。
// 数据来源：cards/Counterfeit/角色基础信息.json（† = 同人推定值，非官方公开）；
//          攻略指南逐字取自各角色世界书「攻略提示」段，文本不得改写。

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
  routeTone: string;
  heartMoments: string;
  distanceTriggers: string;
  confirmationSignal: string;
}

/**
 * 规范全名 → 攻略指南。
 * 文本逐字取自世界书「攻略提示」段；字段统一为路线基调、心动瞬间、退避雷区与确认信号。
 */
const GUIDE: Record<string, RelationshipGuide> = {
  比企谷八幡: {
    routeTone: '对八幡，热闹地追着他跑没有用。和他一起收拾麻烦，阻止他擅自牺牲，再把自己的选择说清楚，他才会慢慢留下',
    heartMoments:
      '共事时自然分走一半麻烦·记得MAX咖啡之类的小事却不邀功·不接他的自贬，也不轻飘飘地夸他是好人·在他准备自爆时给出另一条路，并说清楚“别替我决定”·尊重他的拒绝、沉默和个人选择',
    distanceTriggers:
      '因怜悯接近他·强迫他融入集体·默认把烂摊子交给他自爆解决·消费他的牺牲后再补一句心疼·当众揭穿他的真实动机·把他当成需要拯救或改造的人',
    confirmationSignal: '遇到麻烦时，他先来和你商量，不再独自把结论做完；谈到你们的关系，也不会用委托或自嘲把话岔开',
  },
  雪之下雪乃: {
    routeTone: '雪乃在意的是说过的话有没有兑现。夸奖可以省下，把意图讲明、把分内的事做好，也别替她作决定',
    heartMoments:
      '直接说出真实意图·在委托中提出能落实的办法并承担自己的部分·尊重她的独立与拒绝·记得潘先生、红茶和猫等喜好·看见她少有的让步，认真回应却不顺势占便宜',
    distanceTriggers: '空洞恭维她的外貌、家世或成绩·隐瞒目的和套路式讨好·用送礼代替交流·擅自替她承担或决定·把她的求助与让步看成软弱',
    confirmationSignal: '她会主动约定下一次见面；被问到你们的关系时，她给出自己的答案，不再拿效率、正确或比较挡在前面',
  },
  由比滨结衣: {
    routeTone: '结衣会主动缩短距离，很容易让人误以为路线已经走得很远。等她不再负责活跃气氛，你是否仍愿意听她把话说完，才决定之后的距离',
    heartMoments:
      '真诚回应她主动递来的善意·记得萨布雷、甜点和聊天里的小细节·离开热闹气氛后仍认真问她真正想要什么·接受她的靠近却不视为理所当然·看出勉强的笑时，给她坦率说不的余地',
    distanceTriggers:
      '把她的温柔误解成没有主见·利用她不愿破坏气氛逼她退让·敷衍昵称、邀约和礼物·只在需要调和关系时依赖她·明知她在逞强仍要求她继续开心',
    confirmationSignal: '她停止观察周围人的脸色，把自己的愿望先说出来；即使答案可能破坏气氛，她也不再改口',
  },
  '拉芙希妮·都柏林': {
    routeTone: '别把她当成等待修复的人。让她自己选座位、去处和相处距离；日常松下来后，偶尔的玩笑、挑食和临时起意比追问过去更能拉近关系',
    heartMoments:
      '尊重她对距离与接触的选择·把善意说明白却不索取回报·邀请她参与集体活动，也把决定权交给她·记得甜食、诗歌和日常小偏好·察觉她状态不对时安静陪着，不逼她交代原因',
    distanceTriggers: '因同情她的经历而靠近·擅自触碰丝带或追问过去·把她的克制误当成不会受伤·用家族或姐姐替她定义身份·替她决定什么才安全、什么才正确',
    confirmationSignal: '她会主动来找你，提议下一次见面，也开始把“我想去”“我想留下”放在家族安排之前',
  },
  一色彩羽: {
    routeTone: '她的撒娇大半是熟练动作，好感往往露在台词断掉以后。别拆穿，也别装没听懂，照常回答那句还没包装好的话',
    heartMoments:
      '为她做一件不求回报、也不钻规则漏洞的事·听出撒娇里压低半度的本音却不当众拆穿·在她没有准备好台词时耐心等一句真话·即使事情没有收益也保持稳定回应',
    distanceTriggers: '对营业式撒娇照单全收·每次靠近都先谈交换条件·拿她的请求和失误反过来控制她·当众拆穿她的演出·逼她在众人面前承认真心',
    confirmationSignal: '她说完本音后没有立刻补上“开玩笑的”，隔天还会沿着那句话继续谈',
  },
  平冢静: {
    routeTone: '她很会把关心说成教师职责。单独相处时少谈“老师应该怎样”，多问一句“平冢静今天想怎样”',
    heartMoments: '认真回答她关于选择和责任的追问·看见她照顾人的方式，也允许她抱怨、迟疑或安静一会儿·沉默时陪在身边却不逼问·以平等的态度回应她作为个人的关心',
    distanceTriggers: '把她的照顾视为理所当然·利用教师身份谋取便利·追问她不愿谈的达洛维往事·只会恭维成熟、漂亮或可靠，却不进行真实交流',
    confirmationSignal: '她会约你做与学校无关的事，理由不再是顺路、指导或工作；被追问时也不拿玩笑带过',
  },
  雪之下阳乃: {
    routeTone: '别和阳乃争谁更会看人。她抛来试探时按自己的节奏回答；看见她失去从容，也不要追问、炫耀或转述',
    heartMoments: '察觉她在试探，仍按自己的原意回答·点到她正在回避的事却不继续追打·在她的社交场合说出当下真实的判断·她一时沉默或失去从容时不追问，也不外传',
    distanceTriggers: '奉承她的家世、能力或美貌·把雪乃当成接近她的工具·带着算计靠近却自以为没被发现·把她一时失去从容的样子转述给第三人·要求她立刻证明真心',
    confirmationSignal: '一次中断的真话，她会主动找时间说完；这次没有观众，也不借雪乃起头',
  },
  '爱布拉娜·都柏林': {
    routeTone: '她习惯把邀请说成安排，把犹豫藏在命令里。保留自己的意见，也别为了对抗而唱反调；她会观察你是否在她失去把握时仍保持原来的态度',
    heartMoments: '面对掌控时保留自己的立场却不逃走·听出通知式语言里的问句并认真回答·记得过甜红茶之类不对外公开的偏好·她拿不准时仍照常说话，不抢着替她做决定',
    distanceTriggers: '把每次相处都变成服从或对抗的权力游戏·恭维她经营出来的完美形象·借拉芙希妮接近她·轻易许诺又让承诺落空·当众点破她不愿公开的脆弱',
    confirmationSignal: '她开始在决定前询问你的意见，也会承认自己拿不准，不急着把刚出口的话改回命令',
  },
  三浦优美子: {
    routeTone: '优美子对软弱的奉承没兴趣。敢当面讲道理，又不拿结衣和圈内地位做筹码，她才会认真看你',
    heartMoments: '有理有据地正面赢她一次，却不给她难堪·真诚对待结衣·在圈子施压时按是非而不是阵营站位·她主动退一步时就此收手，不趁机追压',
    distanceTriggers: '奉承她在圈子里的地位·油腻搭讪·故意让结衣为难·背后议论她和她的朋友·在她退一步后立刻得寸进尺',
    confirmationSignal: '她会在自己的圈子里公开给你留位置，私下又说明这不是因为结衣或叶山，是她本人想让你留下',
  },
  户冢彩加: {
    routeTone: '和户冢相处，陪练、比赛和部长工作都比重复说“可爱”重要。留意他什么时候只等你、只问你的意见',
    heartMoments: '认真陪练并守住约定·看完比赛后说出具体的进步·在他承担部长责任时自然搭一把手·分辨他对所有人的温柔和只对你的等待、留位与记挂',
    distanceTriggers: '只夸外貌可爱·拿他的性别表达开玩笑·轻视网球部和他的投入·用贵重礼物代替一起度过的时间·把他的温柔当成默认好感',
    confirmationSignal: '他会主动等你、为你留位，也会承认这种在意和对其他朋友不一样',
  },
  川崎沙希: {
    routeTone: '沙希看行动。准时、少添麻烦、愿意搭手，比夸她坚强或者劝她休息有用得多',
    heartMoments: '用顺路搭手之类的实际行动分担·真诚对待她的弟妹·看见疲惫却不表演心疼·给她安静、稳定、低负担的陪伴·每次约定都准时兑现',
    distanceTriggers: '把帮助做成同情和施舍·劝她“别再拼了”却不给现实方案·追问家境·在她的打工地点大惊小怪·约好后放鸽子',
    confirmationSignal: '她会让你见弟妹，在疲惫或忙不过来时找你帮忙，也不再坚持所有事情都由自己扛',
  },
  海老名姬菜: {
    routeTone: '她常用兴趣和玩笑观察别人。无需迎合她；有自己的判断，也敢在她收起笑声后继续认真谈下去',
    heartMoments: '面对她试探性的逗弄不慌乱，也不急着表演反应·展现真实而细致的人际判断·对她坦诚，不装现充也不装深沉·认真回应她收起玩笑后说出的观察',
    distanceTriggers: '为了吸引她刻意扮演人设·过度迎合她的兴趣·虚伪被识破后继续圆谎·把她的爱好当成笑柄·只跟着她的笑话起哄，一到认真话题就躲开',
    confirmationSignal: '她收起起哄式的笑，直接问你怎样看她；听完回答后，她也会用自己的话回应',
  },
  比企谷小町: {
    routeTone: '小町看得穿刷分。自然地参与比企谷家的日常，玩笑照开，她认真说话时也别敷衍',
    heartMoments: '对比企谷家的日常作出真实贡献·用同样坦率的吐槽回应她·记得她认真提过的小事·即使她没有说“加分”，也把她的担心和愿望放在心上',
    distanceTriggers: '为了刷分刻意讨好·借她打探或接近八幡·把她当小孩子敷衍·只接玩笑却忽略认真表达·把家人的信任当成攻略捷径',
    confirmationSignal: '她不再报“加分”，而是直接说想见你、想让你留下；说完也不会转头拿八幡当挡箭牌',
  },
  鹤见留美: {
    routeTone: '留美不需要被开导。按约出现，平等说话，允许沉默存在；她会记得这些小事',
    heartMoments: '不要求说明也能安静待在身边·始终用平等语气和她交流·守住每一个看似不起眼的承诺·认真听她说那些过早看懂的人际事实，却不急着给答案',
    distanceTriggers: '表演式同情·空泛地说“会好起来”·擅自替她安排帮助·答应后失约·把她的处境当成谈资·用大人的口吻否定她的判断',
    confirmationSignal: '她开始主动约你，也会提前告诉你自己哪天有空、愿意在哪里等你',
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
