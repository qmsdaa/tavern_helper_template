/* Counterfeit · 状态栏挂载器
   机制：酒馆助手脚本在独立沙箱执行，UI 必须挂载到宿主文档（window.top.document）；
   监听宿主 #chat 的 AI 消息楼层（不依赖 LLM 输出任何占位符）；
   每个 AI 楼层在 .mes_text 之后注入一个状态栏 iframe（CDN 取 dist 单文件 + API 桥前置注入）；
   楼层 iframe 只渲染紧凑摘要（章节/场景/日期 + 位置/扮演 + 在场角色头像）；
   点击头像 → 楼层 iframe postMessage 到宿主页 → 本脚本在宿主 document.body 创建顶层遮罩
   + 大窗口 iframe（同一 dist，桥内置 __counterfeitModalChar，状态栏渲染该角色详情）；
   桥内按楼层号提供 getCurrentMessageId，状态栏据此读取本楼层的 MVU 快照；
   楼层远离视口时不创建 iframe（懒挂载），楼层消失（删消息/换聊天）→ iframe 随 DOM 自动移除；
   弹窗随删消息/换聊天/脚本重载自动清理。加载失败只影响状态栏自身，不影响正文。 */
console.info('[Counterfeit·状态栏] eval');
(() => {
  const IFRAME_CLASS = 'counterfeit-statusbar-iframe';
  const CONTAINER_PREFIX = 'counterfeit-statusbar--';
  const TRANSITION_PREFIX = 'counterfeit-transition--';
  const SANDBOX_NAME = '__counterfeit_sandbox__';
  const CDN_URL = 'https://testingcf.jsdelivr.net/gh/qmsdaa/tavern_helper_template@5c35fa12/dist/Counterfeit/界面/状态栏/index.html';

  /* TRANSITION_RUNTIME_PREDICATE_GENERATED_START */
  function transitionCampaignId(stat) {
    return typeof stat?.campaign_id === 'string' && stat.campaign_id ? stat.campaign_id : 'main';
  }
  
  function transitionSceneNumber(stat) {
    const scene = Number(stat?.current_scene);
    return Number.isInteger(scene) && scene > 0 ? scene : null;
  }
  
  /**
   * Select exactly one transition for two adjacent AI-floor snapshots.
   * A jump uses the destination scene's transition and reports how many numbered
   * scenes were skipped; same-scene turns, rewinds, and campaign changes are inert.
   */
  function selectTransitionRuntime(transitionCards, previousStat, currentStat) {
    if (!transitionCards || !previousStat || !currentStat) return null;
    const previousCampaign = transitionCampaignId(previousStat);
    const currentCampaign = transitionCampaignId(currentStat);
    if (previousCampaign !== 'main' || currentCampaign !== 'main' || previousCampaign !== currentCampaign) return null;
  
    const previousScene = transitionSceneNumber(previousStat);
    const currentScene = transitionSceneNumber(currentStat);
    if (previousScene === null || currentScene === null || previousScene >= currentScene) return null;
  
    const transition = transitionCards[String(currentScene)];
    if (!transition) return null;
    return {
      ...transition,
      previous_scene: previousScene,
      current_scene: currentScene,
      skipped_scene_count: Math.max(0, currentScene - previousScene - 1),
    };
  }
  /* TRANSITION_RUNTIME_PREDICATE_GENERATED_END */
  /* TRANSITION_CARDS_GENERATED_START */
  const TRANSITION_CARDS = {
    "7": {
      "id": "main:6>7",
      "campaign_id": "main",
      "from_scene": 6,
      "to_scene": 7,
      "gap_days": 21,
      "visible_title": "六月，固定下来的座位",
      "visible_lines": [
        "入部后的三个星期被课程表、午休和放学铃分开，拉芙在后半段逐渐有了固定座位。",
        "六月的潮气进入特别栋时，四个人已经知道安静时各自会待在哪里。"
      ]
    },
    "8": {
      "id": "main:7>8",
      "campaign_id": "main",
      "from_scene": 7,
      "to_scene": 8,
      "gap_days": 15,
      "visible_title": "六月下旬，答案交回之前",
      "visible_lines": [
        "两周复习被课堂、放学铃和活动室里交换的题纸分成相似的几段。",
        "梅雨尚未结束，期末考试已经到了可以核对结果的时候。"
      ]
    },
    "9": {
      "id": "main:8>9",
      "campaign_id": "main",
      "from_scene": 8,
      "to_scene": 9,
      "gap_days": 7,
      "visible_title": "七月初，梅雨仍在",
      "visible_lines": [
        "复习结果交回去一周，放学后的活动室重新安静下来。",
        "潮湿没有散去，雷声比雨先抵达特别栋。"
      ]
    },
    "13": {
      "id": "main:12>13",
      "campaign_id": "main",
      "from_scene": 12,
      "to_scene": 13,
      "gap_days": 10,
      "visible_title": "七月中旬，暑假将近",
      "visible_lines": [
        "十天里，课程表走到学期末，教室里的话题逐渐换成暑假安排。",
        "奉仕部的门仍在放学后照常打开，直到一份校外活动说明被带进来。"
      ]
    },
    "23": {
      "id": "main:22>23",
      "campaign_id": "main",
      "from_scene": 22,
      "to_scene": 23,
      "gap_days": 10,
      "visible_title": "八月上旬，营火之后",
      "visible_lines": [
        "林间学校结束十天，照片被收进手机，鞋底的泥也已经刷掉。",
        "暑假的日常重新分散，拉芙公寓里的例行评估却按原定日期到来。"
      ]
    },
    "25": {
      "id": "main:24>25",
      "campaign_id": "main",
      "from_scene": 24,
      "to_scene": 25,
      "gap_days": 8,
      "visible_title": "八月下旬，暑假尚未结束",
      "visible_lines": [
        "海边烟火散去八天，千叶的白天仍长，学校里的走廊却先恢复了值班声。",
        "平冢静留下的旧档案没有节日气氛，只在纸箱里等人整理。"
      ]
    },
    "26": {
      "id": "main:25>26",
      "campaign_id": "main",
      "from_scene": 25,
      "to_scene": 26,
      "gap_days": 12,
      "visible_title": "九月，返校",
      "visible_lines": [
        "十二天里，暑假余下的日期从日历上翻完，校服重新出现在早班电车里。",
        "特别栋的活动室没有改变位置，只等四个人在新学期重新推门。"
      ]
    },
    "27": {
      "id": "main:26>27",
      "campaign_id": "main",
      "from_scene": 26,
      "to_scene": 27,
      "gap_days": 13,
      "visible_title": "九月中旬，文化祭通知抵达",
      "visible_lines": [
        "开学后的两周被课程、值日和短暂的部室日常填满。",
        "校舍里的文化祭告示逐日增多，正式委托在周日落到奉仕部桌上。"
      ]
    },
    "30": {
      "id": "main:29>30",
      "campaign_id": "main",
      "from_scene": 29,
      "to_scene": 30,
      "gap_days": 23,
      "visible_title": "十月，文书成为日常",
      "visible_lines": [
        "从九月十六日到十月九日，第三会议室里的纸张从临时堆放变成按编号和颜色归档。",
        "前段是普通筹备，最近六个工作日里，雪乃和拉芙已经不必开口确认下一份文件该放在哪里。"
      ]
    },
    "32": {
      "id": "main:31>32",
      "campaign_id": "main",
      "from_scene": 31,
      "to_scene": 32,
      "gap_days": 17,
      "visible_title": "十月下旬，文化祭当日",
      "visible_lines": [
        "十七天里，校舍被纸板、胶带和反复修改的流程表逐层填满。",
        "开幕前半小时，准备完成的表面之下仍留着一个无人愿意接手的位置。"
      ]
    },
    "40": {
      "id": "main:39>40",
      "campaign_id": "main",
      "from_scene": 39,
      "to_scene": 40,
      "gap_days": 15,
      "visible_title": "十一月，修学旅行出发",
      "visible_lines": [
        "文化祭结束后的半个月里，校内装饰被拆下，课桌上换成京都行程表。",
        "清晨集合把平日分散的同学重新放进同一列车时刻里。"
      ]
    },
    "51": {
      "id": "main:50>51",
      "campaign_id": "main",
      "from_scene": 50,
      "to_scene": 51,
      "gap_days": 14,
      "visible_title": "十二月，选举期继续",
      "visible_lines": [
        "两周里，冬季制服外多了围巾，学生会选举的纸张仍在不同桌面间往返。",
        "操场边的风把草稿页角吹起时，尚未完成的方案终于到了必须交出去的一步。"
      ]
    },
    "53": {
      "id": "main:52>53",
      "campaign_id": "main",
      "from_scene": 52,
      "to_scene": 53,
      "gap_days": 7,
      "visible_title": "十二月中旬，普通的放学后",
      "visible_lines": [
        "选举结果过去一周，走廊里的海报已经撤下，活动室重新只剩茶水和作业。",
        "结衣带来的芝士蛋糕占据了今天长桌上最显眼的位置。"
      ]
    },
    "74": {
      "id": "main:73>74",
      "campaign_id": "main",
      "from_scene": 73,
      "to_scene": 74,
      "gap_days": 7,
      "visible_title": "一月中旬，进路表仍在桌上",
      "visible_lines": [
        "一周过去，冬日放学后的天色更早暗下去，进路调查表却没有因此变得容易填写。",
        "同一行字被写下又擦掉，纸面先留下了时间的痕迹。"
      ]
    },
    "75": {
      "id": "main:74>75",
      "campaign_id": "main",
      "from_scene": 74,
      "to_scene": 75,
      "gap_days": 14,
      "visible_title": "二月，礼物之前",
      "visible_lines": [
        "两周里，商场的季节货架换成巧克力与包装纸，部室里的话题仍绕着真正想送给谁打转。",
        "关系没有因日期自动得到答案，礼物却已经需要被选出来。"
      ]
    },
    "77": {
      "id": "main:76>77",
      "campaign_id": "main",
      "from_scene": 76,
      "to_scene": 77,
      "gap_days": 13,
      "visible_title": "二月十四日，早晨",
      "visible_lines": [
        "十三天里，准备好的巧克力一直没有替送礼者决定该怎样开口。",
        "千叶站的检票声照常响起，下午部室里的目光尚未来到。"
      ]
    },
    "78": {
      "id": "main:77>78",
      "campaign_id": "main",
      "from_scene": 77,
      "to_scene": 78,
      "gap_days": 7,
      "visible_title": "二月下旬，新的委托",
      "visible_lines": [
        "情人节过去一周，包装纸和尴尬都退回普通上课日的背景。",
        "平冢静带来的文件让活动室重新有了必须共同阅读的内容。"
      ]
    },
    "86": {
      "id": "main:85>86",
      "campaign_id": "main",
      "from_scene": 85,
      "to_scene": 86,
      "gap_days": 12,
      "visible_title": "三月下旬，舞会前夜",
      "visible_lines": [
        "十二天里，名单、座次和场地确认把舞会从纸面推到明晚。",
        "正式场合需要的衣物已经备好，仍有人要在镜前学会怎样面对它。"
      ]
    },
    "110": {
      "id": "main:109>110",
      "campaign_id": "main",
      "from_scene": 109,
      "to_scene": 110,
      "gap_days": 8,
      "visible_title": "五月，联合体检当天",
      "visible_lines": [
        "八天里，受理后的方案被印成标牌、名单和现场分工表。",
        "真正的人流抵达校舍后，纸上的顺序开始接受检验。"
      ]
    },
    "112": {
      "id": "main:111>112",
      "campaign_id": "main",
      "from_scene": 111,
      "to_scene": 112,
      "gap_days": 8,
      "visible_title": "五月下旬，活动室的普通一周",
      "visible_lines": [
        "联合体检的报告收好后，八天没有新的危机占据长桌。",
        "六名部员仍要决定谁烧水、谁锁门，以及沉默时各自坐在哪里。"
      ]
    },
    "113": {
      "id": "main:112>113",
      "campaign_id": "main",
      "from_scene": 112,
      "to_scene": 113,
      "gap_days": 7,
      "visible_title": "五月末，新的原稿",
      "visible_lines": [
        "值日表运行一周，茶具、钥匙和座位开始有了不必提醒的顺序。",
        "材木座带着另一份无法决定结局的原稿再次推开活动室门。"
      ]
    },
    "114": {
      "id": "main:113>114",
      "campaign_id": "main",
      "from_scene": 113,
      "to_scene": 114,
      "gap_days": 7,
      "visible_title": "六月初，两份委托",
      "visible_lines": [
        "原稿收好一周，初夏的活动室继续按值日表运转。",
        "同一天到来的两份请求，把学生会调度和网球场地摆上同一张桌。"
      ]
    },
    "115": {
      "id": "main:114>115",
      "campaign_id": "main",
      "from_scene": 114,
      "to_scene": 115,
      "gap_days": 7,
      "visible_title": "六月中旬，三十六个格子",
      "visible_lines": [
        "一周里，场地、时段和责任人被逐项填进表格，纸面越来越完整。",
        "直到需要真正签字时，正确的排列才显出它尚未回答的问题。"
      ]
    },
    "116": {
      "id": "main:115>116",
      "campaign_id": "main",
      "from_scene": 115,
      "to_scene": 116,
      "gap_days": 10,
      "visible_title": "六月二十一日，体育祭",
      "visible_lines": [
        "十天里，正案与施行案被回形针别在一起，雨则连续落到周五夜里。",
        "周六放晴后，操场白线、泥地和真实人流开始检验纸上的安排。"
      ]
    },
    "117": {
      "id": "main:116>117",
      "campaign_id": "main",
      "from_scene": 116,
      "to_scene": 117,
      "gap_days": 14,
      "visible_title": "七月，夏季游园会",
      "visible_lines": [
        "体育祭结束两周，操场上的帐篷已经收走，暑气留在放学后的街道上。",
        "六名部员第一次把共同时间安排到校外，浴衣、集合地点和烟火都只是今天的日常。"
      ]
    },
    "119": {
      "id": "main:118>119",
      "campaign_id": "main",
      "from_scene": 118,
      "to_scene": 119,
      "gap_days": 11,
      "visible_title": "七月下旬，旧档案的纸箱",
      "visible_lines": [
        "期末后的十一天里，学校逐渐进入暑假，特别栋比平日更安静。",
        "平冢静留下的三箱材料仍在原处，直到整理工作真正开始。"
      ]
    },
    "121": {
      "id": "main:120>121",
      "campaign_id": "main",
      "from_scene": 120,
      "to_scene": 121,
      "gap_days": 8,
      "visible_title": "八月，返程票在手",
      "visible_lines": [
        "编号缺页被说出口八天后，暑假的日常没有替拉芙决定是否出发。",
        "她带着返程票来到机场，去查明一件事，也保留回到千叶的日期。"
      ]
    },
    "125": {
      "id": "main:124>125",
      "campaign_id": "main",
      "from_scene": 124,
      "to_scene": 125,
      "gap_days": 17,
      "visible_title": "八月末，归国",
      "visible_lines": [
        "书房对峙后的十七天没有被整理成答案，拉芙只完成了返日所需的行程。",
        "成田机场到达口外，硬纸板欢迎牌把“回来”写成了可以看见的事实。"
      ]
    },
    "126": {
      "id": "main:125>126",
      "campaign_id": "main",
      "from_scene": 125,
      "to_scene": 126,
      "gap_days": 48,
      "visible_title": "十月，十八岁生日之前",
      "visible_lines": [
        "八月末归国后，九月开学，拉芙照常上课、到活动室、回到自己的公寓。",
        "从八月十二日的书房对峙算起，家族专机六十五天没有亮起，沉默没有附带新的说明。"
      ]
    },
    "127": {
      "id": "main:126>127",
      "campaign_id": "main",
      "from_scene": 126,
      "to_scene": 127,
      "gap_days": 8,
      "visible_title": "十月下旬，生日之后",
      "visible_lines": [
        "八天里，生日装饰被收走，信托文件仍在拉芙自己手中。",
        "她没有立刻使用那份“可以”，直到以委托人的位置重新坐到长桌前。"
      ]
    },
    "128": {
      "id": "main:127>128",
      "campaign_id": "main",
      "from_scene": 127,
      "to_scene": 128,
      "gap_days": 14,
      "visible_title": "十一月，方案摊开",
      "visible_lines": [
        "委托提出后的两周里，升学、住所、生计和风险被分别整理成可以讨论的纸页。",
        "长桌没有替任何人作出选择，只让缺口一栏一栏显出来。"
      ]
    },
    "129": {
      "id": "main:128>129",
      "campaign_id": "main",
      "from_scene": 128,
      "to_scene": 129,
      "gap_days": 14,
      "visible_title": "十一月下旬，第一笔自己的支出",
      "visible_lines": [
        "分工会议过去两周，方案从活动室里的栏目变成报名费、保险和纸面回执。",
        "公寓暖气开始工作时，第一次不抄送家族的支付记录抵达邮箱。"
      ]
    },
    "130": {
      "id": "main:129>130",
      "campaign_id": "main",
      "from_scene": 129,
      "to_scene": 130,
      "gap_days": 28,
      "visible_title": "十二月，出发日期确定",
      "visible_lines": [
        "退出申请寄出后的四周里，回执、旁听条款与审议日期依次落到纸面，没有一项替拉芙作出回答。",
        "冬季出行高峰来到时，十二月十九日的去程与十二月二十七日的返程已经放进同一只肩包。"
      ]
    },
    "131": {
      "id": "main:130>131",
      "campaign_id": "main",
      "from_scene": 130,
      "to_scene": 131,
      "gap_days": 32,
      "visible_title": "一月，审议日",
      "visible_lines": [
        "十二月十九日的送行不是单程离开；拉芙按返程票在十二月二十八日回到日本，继续上课与备考。",
        "一月十七日至十八日完成共通测试后，她再次抵达伦敦，二十日早晨以申请人身份走进议事厅。"
      ]
    },
    "142": {
      "id": "main:141>142",
      "campaign_id": "main",
      "from_scene": 141,
      "to_scene": 142,
      "gap_days": 11,
      "visible_title": "二月下旬，考试前夜",
      "visible_lines": [
        "情人节过去十一天，巧克力包装从书包里消失，复习表仍贴在看得见的位置。",
        "明天的考试不会替任何人决定未来，今晚仍只是比企谷家的晚饭和准备。"
      ]
    },
    "143": {
      "id": "main:142>143",
      "campaign_id": "main",
      "from_scene": 142,
      "to_scene": 143,
      "gap_days": 9,
      "visible_title": "三月，合格通知",
      "visible_lines": [
        "考试结束后的九天里，日程上没有新的题目，只有各校发布结果的日期逐渐靠近。",
        "四个人收到的通知来自不同学校，打开之前仍没有谁能替谁确认答案。"
      ]
    },
    "150": {
      "id": "main:149>150",
      "campaign_id": "main",
      "from_scene": 149,
      "to_scene": 150,
      "gap_days": 7,
      "visible_title": "三月下旬，毕业以后",
      "visible_lines": [
        "钥匙交接过去一周，毕业后的日程已经不再由总武高的铃声切分。",
        "拉芙在自己的公寓桌前处理一份普通续聘文件，新的生活从具体条款开始。"
      ]
    }
  };
  /* TRANSITION_CARDS_GENERATED_END */

  // API 桥：状态栏 iframe 由本脚本直接创建，parent 是宿主页面（没有酒馆 API），
  // 真正的 API 在酒馆助手脚本沙箱里——本脚本把它命名为 __counterfeit_sandbox__（与开场白挂载器共用）。
  window.name = SANDBOX_NAME;
  const buildBridge = (floorId, isModal, modalChar) => `<script>
(function () {
  var FLOOR_ID = ${floorId};
  var IS_MODAL = ${isModal ? 'true' : 'false'};
  var MODAL_CHAR = ${modalChar == null ? 'null' : JSON.stringify(String(modalChar))};
  var SANDBOX_NAME = "${SANDBOX_NAME}";
  var names = [
    "getVariables", "updateVariablesWith", "insertOrAssignVariables", "deleteVariable",
    "getChatMessages", "getLastMessageId",
    "eventOn", "eventOnce", "eventMakeFirst", "eventEmit", "tavern_events",
    "_", "$", "jQuery", "z", "errorCatched"
  ];

  function findSandbox(host) {
    try {
      for (var i = 0; i < host.frames.length; i++) {
        var frame = host.frames[i];
        try {
          if (frame && frame.name === SANDBOX_NAME) return frame;
        } catch (error) {}
      }
    } catch (error) {}
    return null;
  }

  var host = null;
  var sandbox = null;
  try {
    host = window.parent && window.parent !== window ? window.parent : null;
    sandbox = host ? findSandbox(host) : null;
  } catch (error) {}

  function readApi(key) {
    try {
      if (sandbox && typeof sandbox[key] !== "undefined") return sandbox[key];
    } catch (error) {}
    try {
      if (host && typeof host[key] !== "undefined") return host[key];
    } catch (error) {}
    return undefined;
  }

  for (var i = 0; i < names.length; i++) {
    var key = names[i];
    try {
      if (typeof window[key] === "undefined") {
        var value = readApi(key);
        if (typeof value !== "undefined") window[key] = value;
      }
    } catch (error) {}
  }

  // 楼层身份：本 iframe 固定对应挂载时的消息楼层号
  window.getCurrentMessageId = function () { return FLOOR_ID; };
  window.getIframeName = function () { return "counterfeit-statusbar--" + FLOOR_ID; };
  // 弹窗标记：true 时状态栏渲染完整信息卡片（本 iframe 由宿主遮罩承载、满屏尺寸）；
  // MODAL_CHAR 非 null 时渲染该角色（规范全名）的专属详情弹窗
  window.__counterfeitModal = IS_MODAL;
  window.__counterfeitModalChar = MODAL_CHAR;

  // waitGlobalInitialized 桥：轮询宿主/沙箱中的命名全局（如 MVU 脚本注册的 Mvu），镜像进本 iframe
  window.waitGlobalInitialized = function (name) {
    return new Promise(function (resolve) {
      var check = function () {
        var value = readApi(name);
        if (typeof value !== "undefined") {
          window[name] = value;
          resolve(value);
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  };

  // 自动高度：内容高度变化时同步到 iframe 元素，禁止内部滚动条；
  // 弹窗 iframe 由宿主遮罩固定满屏尺寸，跳过高度同步，只解除初始隐藏
  function syncHeight() {
    try {
      var frame = window.frameElement;
      if (!frame) return;
      if (!IS_MODAL) {
        var height = Math.max(
          document.body ? document.body.scrollHeight : 0,
          document.documentElement ? document.documentElement.scrollHeight : 0
        );
        if (height > 0 && frame.style.height !== height + "px") {
          frame.style.height = height + "px";
        }
      }
      frame.style.visibility = "visible";
    } catch (error) {}
  }
  window.addEventListener("load", function () {
    syncHeight();
    if (!IS_MODAL && typeof ResizeObserver !== "undefined" && document.body) {
      new ResizeObserver(function () { syncHeight(); }).observe(document.body);
    }
    setTimeout(syncHeight, 500);
    setTimeout(syncHeight, 2000);
  });
})();
<\/script>
<style>
html, body { margin: 0 !important; padding: 0 !important; overflow: hidden !important; max-width: 100% !important; background: transparent !important; }
</style>`;

  const topDoc = window.top.document;

  // dist 单文件只拉取一次；失败时 30 秒后允许重试
  let distHtmlPromise = null;
  function fetchDistHtml() {
    if (!distHtmlPromise) {
      distHtmlPromise = fetch(CDN_URL)
        .then(res => {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.text();
        })
        .catch(error => {
          console.error('[Counterfeit·状态栏] dist 拉取失败：', error);
          distHtmlPromise = null;
          setTimeout(() => {}, 30000);
          throw error;
        });
    }
    return distHtmlPromise;
  }

  function injectBridge(html, floorId, isModal, modalChar) {
    const bridge = buildBridge(floorId, isModal, modalChar ?? null);
    const headIndex = html.indexOf('<head>');
    if (headIndex === -1) return bridge + html;
    return html.slice(0, headIndex + 6) + bridge + html.slice(headIndex + 6);
  }

  // 懒挂载：只有接近视口的楼层才真正拉取 dist 并创建 iframe
  const lazyObserver =
    typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver(
          entries => {
            for (const entry of entries) {
              if (entry.isIntersecting) {
                lazyObserver.unobserve(entry.target);
                void mountIframe(entry.target);
              }
            }
          },
          { root: null, rootMargin: '600px 0px', threshold: 0 },
        )
      : null;

  async function mountIframe(container) {
    if (container.querySelector('iframe')) return;
    const floorId = Number(container.dataset.floor);
    let html;
    try {
      html = await fetchDistHtml();
    } catch (error) {
      container.remove();
      return;
    }
    if (!container.isConnected) return;
    const iframe = topDoc.createElement('iframe');
    iframe.className = IFRAME_CLASS;
    iframe.name = CONTAINER_PREFIX + floorId;
    iframe.style.cssText = 'width:100%;border:none;display:block;height:0;overflow:hidden;visibility:hidden;background:transparent;';
    iframe.setAttribute('frameborder', '0');
    container.appendChild(iframe);
    iframe.srcdoc = injectBridge(html, floorId, false);
  }

  // —— 顶层弹窗：楼层 iframe postMessage → 本脚本（脚本库沙箱）→ 宿主 document.body 遮罩 + 大窗口 ——
  // 规格：遮罩覆盖酒馆视口；窗口 min(90% 实测宽,1150px) × 86% 实测高，手机端近全屏（10px 外边距）；
  // 人物详情 iframe 填满弹窗；✕ / 点遮罩 / Esc 关闭；弹窗内部独立滚动、背景锁滚动；
  // 同一时刻只存在一个弹窗，换角色复用窗口；删消息 / 换聊天 / 脚本重载自动清理。
  //
  // 【移动端高度：不用 vh，用 JS 实测像素】2026-08-05
  // 手机浏览器的 100vh = 地址栏收起后的"大视口"，比可见区域高（华为/UC/微信等尤甚）。
  // 遮罩 position:fixed + align-items:center 时，超高的 iframe 会上下各溢出一半——
  // 顶部标题栏与立绘上半身被切到视口外，正是"移动端显示不全"的根因。
  // dvh 能解决，但老内核不支持；而 CSS 回退链无法表达"vh 偏大时改用可见高度"，
  // 因为不支持 dvh 的内核恰恰会保留 vh 那条声明。故改由 JS 写实测像素高度：
  // visualViewport.height（最准，排除地址栏/键盘）→ documentElement.clientHeight → innerHeight。
  // 同时用 place-items + max-height 双保险，任何情况下都不超出遮罩可见区域。
  const OVERLAY_MARGIN = 20;

  /** 当前真实可见视口高度（px）：优先 visualViewport，排除地址栏与软键盘占位 */
  function visibleViewportHeight() {
    try {
      const vv = window.top.visualViewport;
      if (vv && vv.height > 0) return Math.round(vv.height);
    } catch (error) {}
    try {
      const client = topDoc.documentElement && topDoc.documentElement.clientHeight;
      if (client > 0) return client;
    } catch (error) {}
    try {
      if (window.top.innerHeight > 0) return window.top.innerHeight;
    } catch (error) {}
    return 0;
  }

  /** 当前真实可见视口宽度（px）：与高度同理逐级回退，供弹窗定宽与居中 */
  function visibleViewportWidth() {
    try {
      const vv = window.top.visualViewport;
      if (vv && vv.width > 0) return Math.round(vv.width);
    } catch (error) {}
    try {
      const client = topDoc.documentElement && topDoc.documentElement.clientWidth;
      if (client > 0) return client;
    } catch (error) {}
    try {
      if (window.top.innerWidth > 0) return window.top.innerWidth;
    } catch (error) {}
    return 0;
  }

  /** 按实测视口校准遮罩与弹窗 iframe 的位置与尺寸（窄屏近全屏，宽屏 86% 高） */
  function syncOverlaySize() {
    if (!statusOverlay || !statusOverlay.isConnected || !overlayIframe) return;
    const height = visibleViewportHeight();
    const width = visibleViewportWidth();
    if (height <= 0 || width <= 0) return;
    const narrow = width <= 640;
    // 遮罩自身钉在实测视口上：老内核不支持 inset 简写（且 cssText 遇无效声明会截断解析），
    // 布局视口又可能偏大，left/top/width/height 全部用像素写死
    statusOverlay.style.left = '0px';
    statusOverlay.style.top = '0px';
    statusOverlay.style.width = width + 'px';
    statusOverlay.style.height = height + 'px';
    // 弹窗宽度同样不写 vw（老内核不认识）：窄屏 = 实测宽 - 20px 外边距，
    // 宽屏 = min(90% 实测宽, 1150px)；left/top 按实测视口算居中偏移。
    // position:absolute 由 JS 带上（CSS 里不写）：JS 未执行时 iframe 仍是静态flex子项，
    // 由遮罩的 flex 居中 + CSS 宽度兜底，不会出现 JS 没跑就贴左上角的情况
    const targetWidth = narrow ? Math.max(0, width - OVERLAY_MARGIN) : Math.min(Math.round(width * 0.9), 1150);
    const targetHeight = narrow ? Math.max(0, height - OVERLAY_MARGIN) : Math.round(height * 0.86);
    overlayIframe.style.position = 'absolute';
    overlayIframe.style.left = Math.max(0, Math.round((width - targetWidth) / 2)) + 'px';
    overlayIframe.style.top = Math.max(0, Math.round((height - targetHeight) / 2)) + 'px';
    overlayIframe.style.width = targetWidth + 'px';
    overlayIframe.style.height = targetHeight + 'px';
    overlayIframe.style.maxHeight = Math.max(0, height - (narrow ? OVERLAY_MARGIN : 0)) + 'px';
  }

  let viewportListenersBound = false;
  function bindViewportListeners() {
    if (viewportListenersBound) return;
    viewportListenersBound = true;
    try {
      window.top.addEventListener('resize', syncOverlaySize);
      window.top.addEventListener('orientationchange', syncOverlaySize);
      const vv = window.top.visualViewport;
      if (vv) {
        vv.addEventListener('resize', syncOverlaySize);
        vv.addEventListener('scroll', syncOverlaySize);
      }
    } catch (error) {}
  }

  function unbindViewportListeners() {
    if (!viewportListenersBound) return;
    viewportListenersBound = false;
    try {
      window.top.removeEventListener('resize', syncOverlaySize);
      window.top.removeEventListener('orientationchange', syncOverlaySize);
      const vv = window.top.visualViewport;
      if (vv) {
        vv.removeEventListener('resize', syncOverlaySize);
        vv.removeEventListener('scroll', syncOverlaySize);
      }
    } catch (error) {}
  }
  let statusOverlay = null;
  let overlayIframe = null;
  let overlayFloor = null;
  let savedBodyOverflow = '';

  function ensureOverlayStyle() {
    if (topDoc.getElementById('counterfeit-status-overlay-style')) return;
    const style = topDoc.createElement('style');
    style.id = 'counterfeit-status-overlay-style';
    // z-index 必须高于手机助手悬浮球(1000001)与开场白(2147483647 以下各层)，
    // 否则移动端会看到手机图标/画廊按钮压在角色详情弹窗上面（截图问题之二）。
    // 位置与尺寸不写 inset/vw/vh/dvh：老内核不支持 inset 简写与 vw 单位，
    // 一律由 syncOverlaySize() 写实测像素（见上方说明）。
    // 这里只留 JS 未及执行时的兜底：遮罩四边分开写铺满（left/right/bottom 老内核认识），
    // iframe 由 flex 居中 + width:90%/max-width:1150px + max-height:100% 限制不溢出遮罩。
    style.textContent = [
      '.counterfeit-status-overlay{position:fixed;left:0;top:0;right:0;bottom:0;width:100%;height:100%;z-index:2147483000;display:flex;align-items:center;justify-content:center;overflow:hidden;background:rgba(60,40,52,0.45);backdrop-filter:blur(2px);}',
      '.counterfeit-status-overlay>iframe{width:90%;max-width:1150px;height:86%;max-height:100%;border:none;border-radius:14px;display:block;background:#fdf7f4;box-shadow:0 12px 40px rgba(40,25,35,0.35);visibility:hidden;}',
      '@media (max-width:640px){.counterfeit-status-overlay>iframe{width:calc(100% - 20px);height:calc(100% - 20px);border-radius:10px;}}',
    ].join('\n');
    (topDoc.head || topDoc.body).appendChild(style);
  }

  // —— 主题底色（多主题）——
  // 弹窗 iframe 的兜底底色写在 CSS 里是浅色 #fdf7f4；暗色主题下若不改，
  // 打开瞬间会闪一下白底再变暗。故：① 界面初始化时会 postMessage('theme-bg') 告知当前
  // 主题底色；② 本脚本把它记下来并直接写在 iframe 元素上，下次打开即刻生效（无闪白）。
  // 主题名与底色映射同时落一份在 localStorage（与界面同源共享），首次打开也能取到。
  const THEME_KEY = 'counterfeit-statusbar-theme';
  const THEME_BG_KEY = 'counterfeit-statusbar-theme-bg';
  const THEME_BG_FALLBACK = { sakura: '#fdf7f4', dark: '#241d24', eyecare: '#f2ece0' };
  let panelBg = null;

  function readStoredPanelBg() {
    try {
      const cached = localStorage.getItem(THEME_BG_KEY);
      if (typeof cached === 'string' && /^#[0-9a-f]{3,8}$/i.test(cached)) return cached;
    } catch (error) {}
    try {
      const name = localStorage.getItem(THEME_KEY);
      // auto 需要读宿主明暗才能判定，交给界面自己 postMessage 回来；这里只处理显式三套
      if (name && Object.prototype.hasOwnProperty.call(THEME_BG_FALLBACK, name)) return THEME_BG_FALLBACK[name];
    } catch (error) {}
    return null;
  }

  /** 记住并应用弹窗底色（只改 background，不动任何尺寸属性） */
  function applyPanelBg(color) {
    if (!color || !/^#[0-9a-f]{3,8}$/i.test(color)) return;
    panelBg = color;
    try {
      localStorage.setItem(THEME_BG_KEY, color);
    } catch (error) {}
    try {
      if (overlayIframe) overlayIframe.style.background = color;
    } catch (error) {}
  }

  window.__counterfeitStatusClose = function () {
    unbindViewportListeners();
    try {
      if (statusOverlay && statusOverlay.isConnected) statusOverlay.remove();
    } catch (error) {}
    statusOverlay = null;
    overlayIframe = null;
    overlayFloor = null;
    // 恢复背景页面滚动
    try {
      topDoc.body.style.overflow = savedBodyOverflow;
    } catch (error) {}
  };

  function openOverlay(floorId, modalChar) {
    try {
      ensureOverlayStyle();
      // 复用窗口：遮罩已存在则不重建，仅替换内容（换角色/换楼层）
      if (!statusOverlay || !statusOverlay.isConnected) {
        const overlay = topDoc.createElement('div');
        overlay.id = 'counterfeit-status-overlay';
        overlay.className = 'counterfeit-status-overlay';
        const iframe = topDoc.createElement('iframe');
        iframe.className = IFRAME_CLASS + '-modal';
        iframe.name = CONTAINER_PREFIX + 'modal';
        iframe.setAttribute('frameborder', '0');
        // 暗色/护眼主题下先把底色写上，避免打开瞬间闪一下 CSS 兜底的浅色
        if (!panelBg) panelBg = readStoredPanelBg();
        if (panelBg) iframe.style.background = panelBg;
        overlay.appendChild(iframe);
        // 点击遮罩空白处关闭
        overlay.addEventListener('click', event => {
          if (event.target === overlay) window.__counterfeitStatusClose();
        });
        topDoc.body.appendChild(overlay);
        statusOverlay = overlay;
        overlayIframe = iframe;
        // 打开期间禁止背景页面滚动
        try {
          savedBodyOverflow = topDoc.body.style.overflow;
          topDoc.body.style.overflow = 'hidden';
        } catch (error) {}
        // 实测像素定高（替代 vh/dvh）+ 跟随地址栏收放/旋屏/软键盘持续校准
        syncOverlaySize();
        bindViewportListeners();
      }
      overlayFloor = Number(floorId);
      // 复用已存在窗口时也要重新校准（期间可能旋屏或地址栏状态变化）
      syncOverlaySize();
      const iframe = overlayIframe;
      // 打包产物内嵌 dist（EMBEDDED_HTML）；CDN 开发模板回退为运行时拉取 dist
      void Promise.resolve(typeof EMBEDDED_HTML !== 'undefined' ? EMBEDDED_HTML : fetchDistHtml())
        .then(html => {
          if (!statusOverlay || !statusOverlay.isConnected || iframe !== overlayIframe) return;
          iframe.style.visibility = 'hidden';
          iframe.srcdoc = injectBridge(html, Number(floorId), true, modalChar ?? null);
        })
        .catch(error => {
          console.warn('[Counterfeit·状态栏] 弹窗打开失败：', error);
          window.__counterfeitStatusClose();
        });
    } catch (error) {
      console.warn('[Counterfeit·状态栏] 弹窗打开失败：', error);
    }
  }

  window.__counterfeitStatusOpen = function (floorId) {
    openOverlay(floorId, null);
  };

  window.__counterfeitStatusOpenChar = function (floorId, charKey) {
    openOverlay(floorId, charKey);
  };

  // 私密档案 CG（D15）：createChatMessages 真落楼并对 LLM 隐藏；
  // addOneMessage 只渲染进 DOM、刷新即消失，因此只作为老版本酒馆助手的降级路径
  let cgSending = false;
  function sendCg(url) {
    if (!url || cgSending) return;
    const markdown = '![CG](' + url + ')';
    if (typeof createChatMessages === 'function') {
      cgSending = true;
      void Promise.resolve(
        createChatMessages([{ role: 'user', message: markdown, is_hidden: true }], { refresh: 'affected' }),
      )
        .catch(error => {
          console.warn('[Counterfeit·状态栏] 发送CG失败：', error);
        })
        .finally(() => {
          cgSending = false;
        });
      return;
    }
    try {
      const st =
        (typeof window.SillyTavern !== 'undefined' && window.SillyTavern) ||
        (window.top && typeof window.top.SillyTavern !== 'undefined' && window.top.SillyTavern) ||
        null;
      if (!st || typeof st.addOneMessage !== 'function') {
        console.warn('[Counterfeit·状态栏] 发送CG失败：createChatMessages 与 SillyTavern API 均不可用');
        return;
      }
      console.warn('[Counterfeit·状态栏] createChatMessages 不可用，降级为仅渲染（刷新后消失）');
      st.addOneMessage(
        { name: st.name1 || '玩家', is_user: true, is_system: false, mes: markdown },
        { scroll: true },
      );
    } catch (error) {
      console.warn('[Counterfeit·状态栏] 发送CG失败：', error);
    }
  }

  // 楼层 iframe → 宿主页 postMessage 桥（楼层 iframe 拿不到沙箱引用，只能发消息）
  function onHostMessage(event) {
    const data = event && event.data;
    if (!data || data.source !== 'counterfeit-statusbar') return;
    if (data.type === 'open-char') {
      openOverlay(Number(data.floor), data.key == null ? null : String(data.key));
    } else if (data.type === 'close-modal') {
      window.__counterfeitStatusClose();
    } else if (data.type === 'send-cg') {
      sendCg(typeof data.url === 'string' && data.url ? data.url : null);
    } else if (data.type === 'theme-bg') {
      applyPanelBg(typeof data.color === 'string' ? data.color : null);
    }
  }
  window.top.addEventListener('message', onHostMessage);

  const keydownHandler = event => {
    if (event.key === 'Escape' && statusOverlay) {
      window.__counterfeitStatusClose();
    }
  };
  topDoc.addEventListener('keydown', keydownHandler);

  // 换聊天时关闭弹窗（脚本通常随聊天重载，双保险）
  try {
    if (typeof window.eventOn === 'function' && window.tavern_events && window.tavern_events.CHAT_CHANGED) {
      window.eventOn(window.tavern_events.CHAT_CHANGED, () => window.__counterfeitStatusClose());
    }
  } catch (error) {}

  // 脚本重载清理：先清掉上一次 eval 遗留的遮罩/监听，再注册本次的清理钩子
  function cleanupAll() {
    try {
      window.__counterfeitStatusClose();
    } catch (error) {}
    try {
      window.top.removeEventListener('message', onHostMessage);
    } catch (error) {}
    try {
      topDoc.removeEventListener('keydown', keydownHandler);
    } catch (error) {}
    try {
      const style = topDoc.getElementById('counterfeit-status-overlay-style');
      if (style) style.remove();
    } catch (error) {}
    try {
      const style = topDoc.getElementById('counterfeit-transition-style');
      if (style) style.remove();
    } catch (error) {}
  }
  try {
    if (typeof window.top.__counterfeitStatusbarCleanup === 'function') {
      window.top.__counterfeitStatusbarCleanup();
    }
  } catch (error) {}
  window.top.__counterfeitStatusbarCleanup = cleanupAll;

  function isAiFloor(mesEl) {
    if (mesEl.getAttribute('is_user') === 'true') return false;
    if (mesEl.getAttribute('is_system') === 'true') return false;
    if (mesEl.classList.contains('smallSysMes')) return false;
    return mesEl.querySelector('.mes_text') !== null;
  }

  function snapshotOf(mesid) {
    try {
      const messages = getChatMessages(`${mesid}-${mesid}`, { include_swipes: false });
      return messages?.[0]?.data?.stat_data || null;
    } catch (error) {
      return null;
    }
  }

  function previousAiFloorId(mesEl) {
    let node = mesEl.previousElementSibling;
    while (node) {
      if (node.classList?.contains('mes') && isAiFloor(node) && node.getAttribute('mesid') !== null) {
        return Number(node.getAttribute('mesid'));
      }
      node = node.previousElementSibling;
    }
    return null;
  }

  function ensureTransitionStyle() {
    if (topDoc.getElementById('counterfeit-transition-style')) return;
    const style = topDoc.createElement('style');
    style.id = 'counterfeit-transition-style';
    style.textContent = [
      '.counterfeit-transition-card{box-sizing:border-box;width:calc(100% - 20px);margin:12px 10px 8px;padding:13px 16px;border:1px solid rgba(181,145,155,.35);border-radius:12px;background:linear-gradient(135deg,rgba(253,247,244,.96),rgba(247,241,245,.94));box-shadow:0 3px 14px rgba(72,48,60,.08);color:#4c3f47;}',
      '.counterfeit-transition-title{margin:0 0 7px;font-size:14px;font-weight:650;letter-spacing:.04em;}',
      '.counterfeit-transition-line{margin:3px 0;font-size:13px;line-height:1.65;}',
      '.counterfeit-transition-skipped{margin:8px 0 0;font-size:11px;line-height:1.5;color:#8d7b84;}',
    ].join('\n');
    (topDoc.head || topDoc.body).appendChild(style);
  }

  function transitionRuntimeKey(selection) {
    return `${selection.id}|${selection.previous_scene}>${selection.current_scene}|${selection.skipped_scene_count}`;
  }

  function ensureTransitionCard(mesEl) {
    const mesid = mesEl.getAttribute('mesid');
    if (mesid === null || !isAiFloor(mesEl)) return;
    const cardId = TRANSITION_PREFIX + mesid;
    const existing = mesEl.querySelector('#' + CSS.escape(cardId));
    const current = snapshotOf(Number(mesid));
    const previousId = previousAiFloorId(mesEl);
    const previous = previousId === null ? null : snapshotOf(previousId);
    const selection = selectTransitionRuntime(TRANSITION_CARDS, previous, current);
    if (!selection) {
      if (existing) existing.remove();
      return;
    }

    const runtimeKey = transitionRuntimeKey(selection);
    if (existing?.dataset.transitionKey === runtimeKey) return;
    if (existing) existing.remove();
    ensureTransitionStyle();

    const card = topDoc.createElement('section');
    card.id = cardId;
    card.className = 'counterfeit-transition-card';
    card.dataset.transitionKey = runtimeKey;
    card.dataset.destinationScene = String(selection.current_scene);

    const title = topDoc.createElement('h3');
    title.className = 'counterfeit-transition-title';
    title.textContent = selection.visible_title;
    card.appendChild(title);
    for (const text of selection.visible_lines) {
      const line = topDoc.createElement('p');
      line.className = 'counterfeit-transition-line';
      line.textContent = text;
      card.appendChild(line);
    }
    if (selection.skipped_scene_count > 0) {
      const skipped = topDoc.createElement('p');
      skipped.className = 'counterfeit-transition-skipped';
      skipped.textContent = `已略过 ${selection.skipped_scene_count} 个中间场景，仅展示当前场景的转场。`;
      card.appendChild(skipped);
    }
    mesEl.querySelector('.mes_text').after(card);
  }

  function ensureFloor(mesEl) {
    const mesid = mesEl.getAttribute('mesid');
    if (mesid === null || !isAiFloor(mesEl)) return;
    const containerId = CONTAINER_PREFIX + mesid;
    if (mesEl.querySelector('#' + CSS.escape(containerId))) return;
    const mesText = mesEl.querySelector('.mes_text');
    const container = topDoc.createElement('div');
    container.id = containerId;
    container.dataset.floor = mesid;
    container.style.cssText = 'width:100%;';
    mesText.after(container);
    if (lazyObserver) {
      lazyObserver.observe(container);
    } else {
      void mountIframe(container);
    }
  }

  function check() {
    const chat = topDoc.querySelector('#chat');
    if (!chat) return;
    for (const mesEl of chat.querySelectorAll('.mes')) {
      ensureFloor(mesEl);
      ensureTransitionCard(mesEl);
    }
    // 弹窗所读楼层被删除（删消息/换聊天残留）→ 自动关闭
    if (statusOverlay && overlayFloor != null) {
      const alive = chat.querySelector('.mes[mesid="' + overlayFloor + '"]');
      if (!alive) window.__counterfeitStatusClose();
    }
  }

  check();
  setTimeout(check, 800);
  setTimeout(check, 2000);
  setTimeout(check, 5000);
  new MutationObserver(() => check()).observe(topDoc.body, { childList: true, subtree: true });
})();
