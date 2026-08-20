/* Counterfeit · 开场白挂载器
   机制：酒馆助手脚本在独立沙箱执行，UI 必须挂载到宿主文档（window.top.document）；
   同时检查宿主 0 楼锚点与原始 <OpeningUI/> 消息，避免局部正则失效时静默黑屏；
   发现未完成的开局 → 创建全屏 srcdoc iframe（内嵌 dist 单文件 + API 桥前置注入）；
   commit 后占位符被替换、原始开局消息消失 → 自动卸载 iframe，无需刷新页面；
   commit 完成时 iframe 发 postMessage(commit-done)，由本脚本（持久沙箱上下文）编排
   首条回复：插入可见 user 消息 → 复制 0 楼变量基线 → /trigger（避免与楼层刷新/卸载竞态）。 */
console.info('[Counterfeit·开场白] eval');
(() => {
  const IFRAME_ID = 'counterfeit-opening-iframe';
  const ANCHOR_SELECTOR = '#counterfeit-opening-anchor';
  const SANDBOX_NAME = '__counterfeit_sandbox__';
  const CDN_URL = 'https://testingcf.jsdelivr.net/gh/qmsdaa/tavern_helper_template@5c35fa12/dist/Counterfeit/界面/开场白/index.html';

  // API 桥：开场白 iframe 的 parent 是宿主页面（没有酒馆 API），
  // 真正的 API 在酒馆助手脚本沙箱里——本脚本把它命名为 __counterfeit_sandbox__。
  window.name = SANDBOX_NAME;
  const BRIDGE = `<script>
(function () {
  var names = [
    "getVariables", "updateVariablesWith", "insertOrAssignVariables", "deleteVariable",
    "getChatMessages", "setChatMessages", "createChatMessages", "getLastMessageId",
    "waitGlobalInitialized",
    "eventOn", "eventMakeFirst", "eventEmit", "tavern_events", "_", "$", "jQuery"
  ];

  function pick(host) {
    for (var i = 0; i < names.length; i++) {
      var key = names[i];
      try {
        if (typeof window[key] === "undefined" && typeof host[key] !== "undefined") {
          window[key] = host[key];
        }
      } catch (error) {}
    }
  }

  function findOpeningBlock(messages) {
    if (!Array.isArray(messages)) return null;
    for (var i = 0; i < messages.length; i++) {
      var item = messages[i];
      if (item && item.message_id === 0 && typeof item.message === "string") {
        var match = item.message.match(/<opening_setup\\b[\\s\\S]*?<\\/opening_setup>/);
        if (match) return match[0];
      }
    }
    return null;
  }

  function installBootWatchdog() {
    document.addEventListener("DOMContentLoaded", function () {
      var app = document.getElementById("app");
      var watchdog = document.createElement("div");
      watchdog.id = "counterfeit-opening-watchdog";
      // 老旧 X5/WebKit 内核不支持 inset 简写，且 cssText 遇到无效声明会截断后续解析；
      // left/top/right/bottom/width/height 分开写，老内核全部认识，不会丢声明
      watchdog.style.cssText = [
        "position:fixed", "left:0", "top:0", "right:0", "bottom:0",
        "width:100%", "height:100%", "z-index:2147483647",
        "display:flex", "align-items:center", "justify-content:center",
        "padding:24px", "background:#171319", "color:#f7eef3",
        "font:14px/1.8 sans-serif", "text-align:center"
      ].join(";");
      watchdog.textContent = "Counterfeit 开场白正在加载……";
      document.body.appendChild(watchdog);

      var startedAt = Date.now();
      var timer = setInterval(function () {
        if (app && app.childElementCount > 0) {
          clearInterval(timer);
          watchdog.remove();
          return;
        }
        if (Date.now() - startedAt > 8000) {
          clearInterval(timer);
          watchdog.textContent = "Counterfeit 开场白加载失败。请检查酒馆助手日志与外部模块访问设置。";
        }
      }, 100);
    }, { once: true });
  }

  function withoutOpeningBlock(messages, block) {
    return messages.map(function (item) {
      if (!item || item.message_id !== 0 || typeof item.message !== "string") return item;
      var copy = Object.assign({}, item);
      copy.message = copy.message
        .replace(block, "")
        .replace(/\\n{3,}/g, "\\n\\n")
        .trim();
      return copy;
    });
  }

  try {
    installBootWatchdog();
    var host = window.parent;
    if (!host || host === window) return;
    var sandbox = null;
    try {
      for (var i = 0; i < host.frames.length; i++) {
        var frame = host.frames[i];
        try {
          if (frame && frame.name === "${SANDBOX_NAME}") {
            sandbox = frame;
            break;
          }
        } catch (error) {}
      }
    } catch (error) {}
    pick(sandbox || host);

    // 新版 commit（dist 内）已完整负责：MVU 变量全量写入（含初始关系预建）、
    // 0 楼落盘。本拦截器只把 <opening_setup> 块从 0 楼剥离，
    // 避免开局元数据明文残留正文；
    // 不再 normalize 变量 / 不再伪造 user 消息 / 不再 /trigger——
    // 旧流程会把 commit 预建的 characters 清空并重复触发生成（剧情模式开局关系归零的根因）。
    var rawSetChatMessages = window.setChatMessages;
    if (typeof rawSetChatMessages === "function") {
      window.setChatMessages = function (messages, options) {
        var block = findOpeningBlock(messages);
        if (!block) return rawSetChatMessages(messages, options);
        return rawSetChatMessages(withoutOpeningBlock(messages, block), options);
      };
    }
  } catch (error) {
    console.error("[Counterfeit Opening] bridge error", error);
  }
})();
<\/script>`;

  function getHostDocument() {
    try {
      return window.top?.document ?? window.parent?.document ?? document;
    } catch (error) {
      console.error('[Counterfeit·开场白] 无法访问宿主文档：', error);
      return document;
    }
  }

  const topDoc = getHostDocument();

  // —— 开局文字降级（防黑屏）——
  // 任何"应该挂载但挂不出来"的分支都必须留下可见文字，而不是只写 console。
  // 三项自检：插件（酒馆助手 API）/ 脚本（内嵌界面 HTML）/ 正则（0 楼占位符替换）。
  const NOTICE_ID = 'counterfeit-opening-fallback';

  function isUsableOpeningHtml(html) {
    return typeof html === 'string' && html.length > 1024 && /<(?:!doctype|html|body|div)\b/i.test(html);
  }

  // 酒馆助手 API 注入到脚本沙箱作用域，不一定挂在 window 上——
  // 用与本文件其余检测一致的裸标识符 typeof，避免误报"缺少 API"。
  function missingOpeningApis() {
    const probes = [
      ['getChatMessages', () => typeof getChatMessages],
      ['getLastMessageId', () => typeof getLastMessageId],
      ['getVariables', () => typeof getVariables],
      ['createChatMessages', () => typeof createChatMessages],
    ];
    return probes
      .filter(([, probe]) => {
        try {
          return probe() !== 'function';
        } catch (error) {
          return true;
        }
      })
      .map(([name]) => name);
  }

  function selfCheck() {
    const missingApis = missingOpeningApis();
    const hasAnchor = Boolean(topDoc.querySelector(ANCHOR_SELECTOR));
    const rawPending = rawGreetingNeedsOpening();
    let embedded = null;
    try {
      embedded = typeof EMBEDDED_HTML === 'string' ? EMBEDDED_HTML : null;
    } catch (error) {
      embedded = null;
    }

    return [
      {
        name: '插件',
        ok: missingApis.length === 0,
        detail:
          missingApis.length === 0
            ? '酒馆助手 API 就绪'
            : '缺少 API：' + missingApis.join('、') + '——请确认已启用酒馆助手（JS-Slash-Runner）并允许本卡运行脚本',
      },
      {
        name: '脚本',
        ok: embedded === null ? true : isUsableOpeningHtml(embedded),
        detail:
          embedded === null
            ? '未内嵌界面（走远端拉取）——若拉取失败请检查网络/CSP'
            : isUsableOpeningHtml(embedded)
              ? '内嵌界面 HTML 完整（' + embedded.length + ' 字符）'
              : '内嵌界面 HTML 缺失或被截断——请重新运行 build_tools/pack_embedded_frontends.py 并重新导入卡',
      },
      {
        name: '正则',
        ok: hasAnchor || !rawPending,
        detail: hasAnchor
          ? '0 楼锚点已就位'
          : rawPending
            ? '未找到锚点，已用 0 楼原文兜底——请确认正则「开场白界面」与「对AI隐藏开场白界面」均已启用且未被局部正则覆盖'
            : '开局已完成，无需锚点',
      },
    ];
  }

  function clearFallbackNotice() {
    const existing = topDoc.getElementById(NOTICE_ID);
    if (existing) existing.remove();
  }

  function renderFallbackNotice(reason) {
    if (!topDoc.body) {
      console.error('[Counterfeit·开场白] 宿主 body 不可用，无法输出降级提示');
      return;
    }
    const checks = selfCheck();
    const lines = checks.map(item => (item.ok ? '✅ ' : '❌ ') + item.name + '：' + item.detail);
    const headline =
      reason === 'script'
        ? '开场白界面无法加载（内嵌界面缺失）'
        : reason === 'host'
          ? '开场白界面无法挂载（宿主页面未就绪）'
          : reason === 'regex'
            ? '开场白界面未能显示（0 楼占位符未被替换）'
            : '开场白界面未能显示';

    console.error('[Counterfeit·开场白] 降级提示：' + headline + '\n' + lines.join('\n'));

    let box = topDoc.getElementById(NOTICE_ID);
    if (!box) {
      box = topDoc.createElement('div');
      box.id = NOTICE_ID;
      // 与 watchdog 同理：不用 inset 简写（老内核不支持且会截断 cssText 解析），
      // 这是最后的可见降级通道，它自己都铺不满屏就什么都看不到了
      box.style.cssText = [
        'position:fixed',
        'left:0',
        'top:0',
        'right:0',
        'bottom:0',
        'width:100%',
        'height:100%',
        'z-index:1000000',
        'overflow:auto',
        'display:flex',
        'align-items:center',
        'justify-content:center',
        'padding:24px',
        'background:#171319',
        'color:#f7eef3',
        'font:14px/1.9 sans-serif',
      ].join(';');
      topDoc.body.appendChild(box);
    }

    const panel = topDoc.createElement('div');
    panel.style.cssText = 'max-width:560px;width:100%;text-align:left;';

    const title = topDoc.createElement('div');
    title.style.cssText = 'font-size:16px;font-weight:700;margin-bottom:12px;';
    title.textContent = 'Counterfeit · ' + headline;
    panel.appendChild(title);

    const list = topDoc.createElement('div');
    list.style.cssText = 'white-space:pre-wrap;margin-bottom:16px;';
    list.textContent = lines.join('\n');
    panel.appendChild(list);

    const hint = topDoc.createElement('div');
    hint.style.cssText = 'opacity:.75;margin-bottom:16px;';
    hint.textContent =
      '修好上面标 ❌ 的项后刷新页面即可重新进入开场白。若三项均为 ✅ 仍看不到界面，请查看控制台 [Counterfeit·开场白] 日志。也可关闭本提示手动发送第一条消息直接开始（此时不会写入开局变量）。';
    panel.appendChild(hint);

    const dismiss = topDoc.createElement('button');
    dismiss.type = 'button';
    dismiss.textContent = '关闭提示';
    dismiss.style.cssText =
      'padding:8px 18px;border:1px solid rgba(247,238,243,.4);border-radius:6px;background:transparent;color:inherit;cursor:pointer;font:inherit;';
    dismiss.addEventListener('click', () => {
      noticeDismissed = true;
      clearFallbackNotice();
    });
    panel.appendChild(dismiss);

    box.textContent = '';
    box.appendChild(panel);
  }

  let noticeDismissed = false;

  function rawGreetingNeedsOpening() {
    if (typeof getChatMessages !== 'function') return false;
    try {
      const messages = getChatMessages(0);
      return (
        Array.isArray(messages) &&
        messages.some(
          item =>
            item &&
            item.message_id === 0 &&
            typeof item.message === 'string' &&
            item.message.includes('<OpeningUI/>'),
        )
      );
    } catch (error) {
      console.warn('[Counterfeit·开场白] 读取 0 楼原始消息失败：', error);
      return false;
    }
  }

  // —— 开场白 iframe 尺寸校准（与状态栏 syncOverlaySize 同源思路）——
  // 【移动端定位：不用 inset/vw/vh，用 JS 实测像素】
  // 老旧 X5/WebKit 内核不支持 inset 简写，且 cssText 遇到无效声明会从该处截断解析，
  // 'position:fixed;inset:0;width:100vw;height:100vh;…' 会让尺寸声明整段丢失，
  // iframe 退化为默认固有尺寸（约 300×150）停在挂载瞬间的位置——移动端开场白缩成
  // 小盒压在左上角的根因。酒馆的 html 带 perspective（fixed 包含块不是视口），
  // 位置一律用像素 left/top：cssText 只写老内核一定认识的声明，
  // left/top/width/height 全部由 syncOpeningSize() 写实测像素。
  function openingViewport() {
    // 实测可见视口：visualViewport 最准（排除地址栏/软键盘，offset 处理双指缩放偏移），
    // 逐级回退 documentElement.clientWidth/Height → innerWidth/innerHeight
    try {
      const vv = window.top.visualViewport;
      if (vv && vv.width > 0 && vv.height > 0) {
        return {
          width: Math.round(vv.width),
          height: Math.round(vv.height),
          offsetLeft: Math.round(vv.offsetLeft || 0),
          offsetTop: Math.round(vv.offsetTop || 0),
        };
      }
    } catch (error) {}
    try {
      const docEl = topDoc.documentElement;
      if (docEl && docEl.clientWidth > 0 && docEl.clientHeight > 0) {
        return { width: docEl.clientWidth, height: docEl.clientHeight, offsetLeft: 0, offsetTop: 0 };
      }
    } catch (error) {}
    try {
      if (window.top.innerWidth > 0 && window.top.innerHeight > 0) {
        return { width: window.top.innerWidth, height: window.top.innerHeight, offsetLeft: 0, offsetTop: 0 };
      }
    } catch (error) {}
    return { width: 0, height: 0, offsetLeft: 0, offsetTop: 0 };
  }

  function syncOpeningSize() {
    const iframe = topDoc.getElementById(IFRAME_ID);
    if (!iframe) return;
    const vp = openingViewport();
    if (vp.width <= 0 || vp.height <= 0) return;
    iframe.style.left = vp.offsetLeft + 'px';
    iframe.style.top = vp.offsetTop + 'px';
    iframe.style.width = vp.width + 'px';
    iframe.style.height = vp.height + 'px';
  }

  // 跟随地址栏收放/旋屏/软键盘/双指缩放持续校准；iframe 卸载时解绑（见 check() 卸载分支）
  let openingViewportBound = false;
  function bindOpeningViewportListeners() {
    if (openingViewportBound) return;
    openingViewportBound = true;
    try {
      window.top.addEventListener('resize', syncOpeningSize);
      window.top.addEventListener('orientationchange', syncOpeningSize);
      const vv = window.top.visualViewport;
      if (vv) {
        vv.addEventListener('resize', syncOpeningSize);
        vv.addEventListener('scroll', syncOpeningSize);
      }
    } catch (error) {}
  }

  function unbindOpeningViewportListeners() {
    if (!openingViewportBound) return;
    openingViewportBound = false;
    try {
      window.top.removeEventListener('resize', syncOpeningSize);
      window.top.removeEventListener('orientationchange', syncOpeningSize);
      const vv = window.top.visualViewport;
      if (vv) {
        vv.removeEventListener('resize', syncOpeningSize);
        vv.removeEventListener('scroll', syncOpeningSize);
      }
    } catch (error) {}
  }

  async function buildAndMount() {
    if (topDoc.getElementById(IFRAME_ID)) return;
    let html;
    try {
      const res = await fetch(CDN_URL);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      html = await res.text();
    } catch (error) {
      console.error('[Counterfeit·开场白] dist 拉取失败：', error);
      if (!noticeDismissed) renderFallbackNotice('script');
      return;
    }
    if (!isUsableOpeningHtml(html)) {
      console.error('[Counterfeit·开场白] 界面 HTML 不可用（缺失或被截断）');
      if (!noticeDismissed) renderFallbackNotice('script');
      return;
    }
    const iframe = topDoc.createElement('iframe');
    iframe.id = IFRAME_ID;
    // cssText 只写老内核一定认识的声明（不用 inset/vw/vh，原因见上方 openingViewport 注释）；
    // left/top 给 0 作初始值，尺寸由 appendChild 后的 syncOpeningSize() 写实测像素
    iframe.style.cssText = 'position:fixed;left:0;top:0;border:none;z-index:999999;background:#fff;';
    iframe.srcdoc = BRIDGE + html;
    if (!topDoc.body) {
      console.error('[Counterfeit·开场白] 宿主 body 尚未就绪');
      if (!noticeDismissed) renderFallbackNotice('host');
      return;
    }
    topDoc.body.appendChild(iframe);
    syncOpeningSize();
    bindOpeningViewportListeners();
    // 挂载后自检：老内核若仍没吃上尺寸，getBoundingClientRect 会暴露——
    // 宽或高不足实测视口 60% 视为定位失败，按像素法重试一次；
    // 仍失败则给可见降级提示，绝不允许静默缩成小盒
    setTimeout(() => {
      const mounted = topDoc.getElementById(IFRAME_ID);
      if (!mounted) return;
      const vp = openingViewport();
      if (vp.width <= 0 || vp.height <= 0) return;
      const rect = mounted.getBoundingClientRect();
      if (rect.width >= vp.width * 0.6 && rect.height >= vp.height * 0.6) return;
      console.warn(
        '[Counterfeit·开场白] iframe 尺寸自检未过（' +
          Math.round(rect.width) + '×' + Math.round(rect.height) +
          ' / 视口 ' + vp.width + '×' + vp.height + '），按实测像素重试',
      );
      syncOpeningSize();
      setTimeout(() => {
        const retried = topDoc.getElementById(IFRAME_ID);
        if (!retried) return;
        const retryRect = retried.getBoundingClientRect();
        if (retryRect.width >= vp.width * 0.6 && retryRect.height >= vp.height * 0.6) return;
        console.error('[Counterfeit·开场白] iframe 定位重试仍失败，转入降级提示');
        if (!noticeDismissed) renderFallbackNotice('host');
      }, 500);
    }, 1500);
    clearFallbackNotice();
    console.info('[Counterfeit·开场白] 已挂载');
  }

  function check() {
    const anchor = topDoc.querySelector(ANCHOR_SELECTOR);
    const iframe = topDoc.getElementById(IFRAME_ID);
    const shouldMount = !resumeCommitted && (Boolean(anchor) || rawGreetingNeedsOpening());
    if (shouldMount && !iframe) {
      void buildAndMount();
    } else if (!shouldMount && iframe) {
      unbindOpeningViewportListeners();
      iframe.remove();
      console.info('[Counterfeit·开场白] 开局占位符消失，已卸载');
    }
    // 兜底通道：commit 完成检测（与 iframe 卸载同周期轮询）
    detectCommitDone();
  }

  // —— 开局首条回复编排（脚本库沙箱 = 持久上下文，不受开场白 iframe 卸载影响）——
  // 双通道触发：commit 时 iframe postMessage(commit-done) 为快速通道；
  // check() 轮询检测为兜底通道（0 楼占位符消失 + 变量已提交 + 仍只有 0 楼 + 未触发过）。
  // 编排：插入 user 开局标记 → 校验楼层确实落地 → 复制 0 楼变量基线 → 触发生成。
  // 硬性约束：user 楼层不存在时绝不 /trigger（否则会打在 0 楼上生成空 swipe）。
  let firstReplyScheduled = false;
  // 迁移旧档 commit 后的会话级闩锁：一旦迁移完成，本聊天绝不再挂载开局界面。
  // 真实酒馆里 0 楼刷新若不及时（锚点残留）会让 check() 把刚卸载的界面挂回去；
  // 迁移意味着玩家选择跳过开局，任何"该挂载"信号此后都视为过期。
  let resumeCommitted = false;

  const POV_LABELS = {
    hachiman: '比企谷八幡',
    hachiman_f: '比企谷八幡（性转）',
    yukino: '雪之下雪乃',
    yui: '由比滨结衣',
    laff: '拉芙希妮·都柏林',
    mrs_yukinoshita: '雪之下夫人',
  };

  // 剧情自建参与轨道显示名（与 前端工程/src/Counterfeit/界面/开场白/store.ts PARTICIPATION_LABELS 同步）
  const PARTICIPATION_LABELS = {
    member: '奉仕部第五名部员',
    classmate: '同班旁观者',
    outsider: '场外自由人',
  };

  function buildOpeningMarker(stat, commitKind) {
    if (commitKind === 'resume') return '我已迁移旧档，请从存档中最后一个可观察时刻继续。';
    const campaignId = (stat && stat.campaign_id) || 'main';
    if (campaignId === 'dlc_genderbend_hachiman') {
      const dlcPovKey = (stat && stat.current_pov) || null;
      if (!dlcPovKey) {
        const customName = stat && stat.custom_protagonist && stat.custom_protagonist.name;
        return '我将以自建角色' + (customName ? '“' + customName + '”' : '') + '，进入《错位的日常》。';
      }
      const dlcPovLabel = POV_LABELS[dlcPovKey] || dlcPovKey;
      return '我选择扮演' + dlcPovLabel + '，进入《错位的日常》。';
    }
    if (campaignId === 'dlc_body_swap_mrs_yukinoshita') {
      return stat && stat.current_pov === 'mrs_yukinoshita'
        ? '我选择扮演雪之下夫人的意识，进入《君的名字？》。'
        : '我选择扮演比企谷八幡的意识，进入《君的名字？》。';
    }
    const mode = stat && stat.mode === 'custom' ? 'custom' : stat && stat.mode === 'free' ? 'free' : 'pov';
    const povKey = (stat && stat.current_pov) || 'custom';
    const povLabel = POV_LABELS[povKey] || povKey;
    const customName = stat && stat.custom_protagonist && stat.custom_protagonist.name;
    const customTrack =
      stat && stat.custom_protagonist && stat.custom_protagonist.participation && stat.custom_protagonist.participation.track;
    // free+自建（open+自建）stat.mode='free' 且 current_pov=null → 同样走"我将以自建角色"句式，
    // 否则会生成"我选择扮演custom…"且 isOpeningPayload 判定为 POV 开局（2026-08-07 修复）
    const isCustomPlayer = mode === 'custom' || (mode === 'free' && povKey === 'custom');
    // 不再附加 <counterfeit_opening> 路由标记：尖括号标记会被酒馆消息清洗剥除，
    // 导致编排校验与"开局场景路由"EJS 判断双双失效（首条回复中止 bug 根因）。
    // 路由信息全部冗余于 stat_data 变量与可见句特征（"我选择扮演/我将以自建角色"），
    // 校验与 EJS 一律改用可见句特征，抗清洗且兼容旧存档。
    if (isCustomPlayer) {
      const base = '我将以自建角色' + (customName ? '“' + customName + '”' : '');
      // 剧情模式自建（participation.track 非空）：明示从场景1开始，触发主线场景路由；
      // 旧自建档/开放世界自建无 participation → 维持原句式（开局场景路由按 stat_data 区分）
      if (mode === 'custom' && customTrack) {
        const trackLabel = PARTICIPATION_LABELS[customTrack] || customTrack;
        return base + '参与主线剧情（参与方式：' + trackLabel + '），请从2013年5月20日的场景1开始故事。';
      }
      return base + '开始故事。';
    }
    // 自定义序幕生效（自由世界）：user 标记不带默认日期，开局场景路由以序幕文本为准
    const openingCustom = !!(stat && stat.opening_custom);
    return mode === 'free'
      ? '我选择扮演' + povLabel + (openingCustom ? '，按自定义序幕开始开放世界故事。' : '，从2013年5月20日开始开放世界故事。')
      : '我选择扮演' + povLabel + '，请从2013年5月20日的场景1开始故事。';
  }

  /** 判断一条 user 消息是否为结构化开局消息（可见句特征，抗清洗） */
  function isOpeningPayload(message) {
    const text = String(message || '');
    return text.includes('我选择扮演') || text.includes('我将以自建角色') || text.includes('我已迁移旧档');
  }

  function toast(text, type) {
    try {
      if (typeof showToast === 'function') showToast(text, type || 'info', 4000);
    } catch (error) {}
  }

  async function orchestrateFirstReply(commitKind) {
    if (firstReplyScheduled) return;
    firstReplyScheduled = true;
    try {
      const stat =
        typeof getVariables === 'function'
          ? (getVariables({ type: 'message', message_id: 0 }) || {}).stat_data
          : null;
      let resolvedKind = commitKind;
      if (!resolvedKind && typeof getChatMessages === 'function') {
        const floor0 = getChatMessages(0)[0];
        if (floor0 && typeof floor0.message === 'string' && floor0.message.includes('<counterfeit_resume_capsule')) {
          resolvedKind = 'resume';
        }
      }
      const marker = buildOpeningMarker(stat, resolvedKind);

      // 1) 插入 user 开局标记（末尾已是 user 消息则跳过）
      let lastId = typeof getLastMessageId === 'function' ? getLastMessageId() : 0;
      const lastMsg = typeof getChatMessages === 'function' ? getChatMessages(lastId)[0] : null;
      const already = lastMsg && lastMsg.role === 'user';
      if (!already && typeof createChatMessages === 'function') {
        const before = lastId;
        await createChatMessages([{ role: 'user', message: marker }], { refresh: 'affected' });
        lastId = getLastMessageId();
        if (lastId <= before) {
          console.error('[Counterfeit·开场白] user 消息插入后楼层号未变化');
          toast('开局消息插入失败，请手动发送第一条消息', 'error');
          return;
        }
        console.info('[Counterfeit·开场白] 已插入开局 user 消息（楼层 ' + lastId + '）');
      }

      // 2) 校验：末楼必须是包含开局可见句的 user，否则绝不 /trigger（避免 0 楼被生成空 swipe）
      const checkMsg = typeof getChatMessages === 'function' ? getChatMessages(getLastMessageId())[0] : null;
      if (!checkMsg || checkMsg.role !== 'user' || !isOpeningPayload(checkMsg.message)) {
        console.error('[Counterfeit·开场白] 末楼不是有效开局 user 消息，已中止自动生成');
        toast('自动首条回复中止：请手动发送第一条消息', 'error');
        return;
      }

      // 3) user 楼层变量基线 = 0 楼 commit 快照（MVU 未自动快照时兜底，已快照则为同值覆盖）
      try {
        if (stat && typeof updateVariablesWith === 'function') {
          const statCopy = JSON.parse(JSON.stringify(stat));
          await updateVariablesWith(
            vars => {
              vars.stat_data = statCopy;
              return vars;
            },
            { type: 'message', message_id: getLastMessageId() },
          );
        }
      } catch (error) {
        console.warn('[Counterfeit·开场白] user 楼层变量基线复制失败（不阻断生成）：', error);
      }

      // 4) 让 SillyTavern 自己触发生成；JS-Slash-Runner 的 generate() 只返回文本，不会创建 assistant 楼层
      if (typeof triggerSlash === 'function') {
        console.info('[Counterfeit·开场白] 通过 /trigger 生成首条回复…');
        await triggerSlash('/trigger');
        console.info('[Counterfeit·开场白] /trigger 已完成');
      } else {
        console.error('[Counterfeit·开场白] 缺少 triggerSlash，无法自动创建 assistant 楼层');
        toast('开局完成，但酒馆助手缺少 /trigger API；请手动发送第一条消息', 'error');
      }
    } catch (error) {
      console.error('[Counterfeit·开场白] 自动首条回复失败：', error);
      toast('自动首条回复失败，请手动发送第一条消息', 'error');
    }
  }

  // 快速通道：commit 完成时 iframe 的通知
  window.top.addEventListener('message', event => {
    const data = event && event.data;
    if (!data || data.source !== 'counterfeit-opening' || data.type !== 'commit-done') return;
    console.info('[Counterfeit·开场白] 收到 commit-done 通知，编排首条回复');
    // 迁移旧档：存档已直接写入，开局界面没有继续停留的意义——立即卸载 iframe，
    // 让玩家直接回到酒馆主界面（否则要等 check() 轮询周期才发现占位符消失）。
    if (data.commitKind === 'resume') {
      // 迁移表格延迟持久化：迁移期插件提交模型要求存在 AI 楼层（commit 写聊天记录），
      // 此时尚无——SaveImportScreen 已做 restore 模式运行时导入，这里暂存插件格式数据，
      // 等首条 AI 回复落地后调 importTableAsJson(persist) 正式持久化（消息/检查点模式重载可恢复）。
      if (data.tableSheets && typeof data.tableSheets === 'object') {
        pendingResumeTables = data.tableSheets;
      }
      resumeCommitted = true;
      // 0 楼重渲染若不及时，锚点残留会让轮询把界面挂回去——先摘锚点再上闩锁
      topDoc.querySelector(ANCHOR_SELECTOR)?.remove();
      const doneIframe = topDoc.getElementById(IFRAME_ID);
      if (doneIframe) {
        unbindOpeningViewportListeners();
        doneIframe.remove();
        console.info('[Counterfeit·开场白] 迁移完成，已立即卸载开局界面');
      }
    }
    const replyPromise = orchestrateFirstReply(data.commitKind === 'resume' ? 'resume' : 'opening');
    if (data.commitKind === 'resume' && pendingResumeTables) {
      replyPromise.then(() => scheduleResumeTablesPersist(), () => scheduleResumeTablesPersist());
    }
  });

  // 迁移表格持久化：等待 AI 楼层就绪后调 shujuku importTableAsJson（persist 默认开）。
  // 持久化完成后清理暂存；切换聊天时由 CHAT_CHANGED 钩子取消（见文件底部）。
  let pendingResumeTables = null;
  let resumeTablesPersistDone = false;
  function persistResumeTables() {
    if (!pendingResumeTables || resumeTablesPersistDone) return;
    const api = window.parent.AutoCardUpdaterAPI;
    if (!api || typeof api.importTableAsJson !== 'function') return;
    try {
      if (typeof getLastMessageId === 'function' && typeof getChatMessages === 'function') {
        const lastMsg = getChatMessages(getLastMessageId())[0];
        if (!lastMsg || lastMsg.is_user !== false) return;
      }
    } catch (error) {
      return;
    }
    resumeTablesPersistDone = true;
    const data = pendingResumeTables;
    pendingResumeTables = null;
    try {
      Promise.resolve(api.importTableAsJson(JSON.stringify(data))).then(
        ok => console.info('[Counterfeit·迁移] 数据库表格持久化导入结果：', ok),
        err => console.warn('[Counterfeit·迁移] 数据库表格持久化导入失败：', err),
      );
    } catch (error) {
      console.warn('[Counterfeit·迁移] 数据库表格持久化导入失败：', error);
    }
  }
  function scheduleResumeTablesPersist() {
    if (!pendingResumeTables || resumeTablesPersistDone) return;
    let attempts = 0;
    const tick = () => {
      attempts += 1;
      if (resumeTablesPersistDone || !pendingResumeTables) return;
      persistResumeTables();
      if (!resumeTablesPersistDone && attempts < 30) setTimeout(tick, 1000);
    };
    setTimeout(tick, 1500);
  }

  // 兜底通道：轮询检测 commit 完成（0 楼占位符消失 + 变量已提交 + 仍只有 0 楼）
  function detectCommitDone() {
    if (firstReplyScheduled) return;
    try {
      if (
        typeof getChatMessages !== 'function' ||
        typeof getLastMessageId !== 'function' ||
        typeof getVariables !== 'function'
      )
        return;
      if (getLastMessageId() !== 0) return;
      const floor0 = getChatMessages(0)[0];
      if (!floor0 || typeof floor0.message !== 'string' || floor0.message.includes('<OpeningUI/>')) return;
      const vars = getVariables({ type: 'message', message_id: 0 });
      if (!vars || !vars.stat_data || !vars.stat_data.mode) return;
      const isResume = floor0.message.includes('<counterfeit_resume_capsule');
      if (isResume) resumeCommitted = true;
      console.info('[Counterfeit·开场白] 轮询检测到 commit 完成，编排首条回复');
      void orchestrateFirstReply(isResume ? 'resume' : 'opening');
    } catch (error) {}
  }

  // 最后一道兜底：正则失效（锚点没生成）+ 酒馆助手 API 不可用（读不到 0 楼原文）时，
  // shouldMount 恒为 false，上面所有分支都不会触发——玩家只会看到 0 楼裸露的占位符文本。
  // 这里直接在宿主 DOM 里找那段没被正则替换掉的占位符，作为"该挂载但完全没挂载"的证据。
  function detectUnreplacedPlaceholder() {
    if (noticeDismissed) return;
    if (topDoc.getElementById(IFRAME_ID) || topDoc.getElementById(NOTICE_ID)) return;
    if (topDoc.querySelector(ANCHOR_SELECTOR)) return;
    try {
      const chat = topDoc.querySelector('#chat') || topDoc.body;
      if (!chat || !(chat.textContent || '').includes('<OpeningUI/>')) return;
    } catch (error) {
      return;
    }
    console.error('[Counterfeit·开场白] 0 楼占位符未被正则替换，且未能挂载界面');
    renderFallbackNotice('regex');
  }

  // v0.5.x → v0.6.0 轻量原位迁移。旧聊天不会重新显示 <OpeningUI/>，因此必须由持久挂载器
  // 在界面渲染/下一轮生成前补齐新增字段。只增补缺失字段，不触碰场景、关系、phone、历史正文。
  async function migrateLegacyCampaignFields() {
    if (typeof getVariables !== 'function' || typeof updateVariablesWith !== 'function') return;
    const migrate = vars => {
      if (!vars || !vars.stat_data || typeof vars.stat_data !== 'object') return vars;
      const stat = vars.stat_data;
      let changed = false;
      if (!Object.prototype.hasOwnProperty.call(stat, 'campaign_id')) {
        stat.campaign_id = 'main';
        changed = true;
      }
      if (!Object.prototype.hasOwnProperty.call(stat, 'campaign_revision')) {
        stat.campaign_revision = 1;
        changed = true;
      }
      if (!Object.prototype.hasOwnProperty.call(stat, 'campaign_completed')) {
        stat.campaign_completed = stat.campaign_id === 'main' && stat.mainline_completed === true;
        changed = true;
      }
      if (!Object.prototype.hasOwnProperty.call(stat, 'identity_state')) {
        stat.identity_state = null;
        changed = true;
      }
      if (!stat.collection || typeof stat.collection !== 'object') {
        stat.collection = { version: 1, cg_unlocks: {}, ending_unlocks: {} };
        changed = true;
      } else {
        if (stat.collection.version !== 1) {
          stat.collection.version = 1;
          changed = true;
        }
        if (!stat.collection.cg_unlocks || typeof stat.collection.cg_unlocks !== 'object') {
          stat.collection.cg_unlocks = {};
          changed = true;
        }
        if (!stat.collection.ending_unlocks || typeof stat.collection.ending_unlocks !== 'object') {
          stat.collection.ending_unlocks = {};
          changed = true;
        }
      }
      if (stat.campaign_id !== 'main' && stat.mainline_completed !== false) {
        stat.mainline_completed = false;
        changed = true;
      }
      return vars;
    };
    try {
      const scopes = [{ type: 'message', message_id: 0 }];
      if (typeof getLastMessageId === 'function') {
        const lastId = getLastMessageId();
        if (lastId !== 0) scopes.push({ type: 'message', message_id: lastId });
      }
      scopes.push({ type: 'chat' });
      for (const scope of scopes) {
        const current = getVariables(scope);
        if (!current || !current.stat_data) continue;
        const stat = current.stat_data;
        const needs =
          !Object.prototype.hasOwnProperty.call(stat, 'campaign_id') ||
          !Object.prototype.hasOwnProperty.call(stat, 'campaign_revision') ||
          !Object.prototype.hasOwnProperty.call(stat, 'campaign_completed') ||
          !Object.prototype.hasOwnProperty.call(stat, 'identity_state') ||
          !stat.collection;
        if (needs) await updateVariablesWith(migrate, scope);
      }
      console.info('[Counterfeit·迁移] v0.6 campaign 字段检查完成');
    } catch (error) {
      console.warn('[Counterfeit·迁移] 旧档字段增补失败，将在下次加载重试', error);
    }
  }

  // —— POV 身份守护（2026-08-09 重写）——
  // 根因：主 AI 在长会话中偶尔在 UpdateVariable 里手滑写入 /current_pov 或 /custom_protagonist
  // （把事件焦点或在场角色"补写"成玩家视点），MVU 每轮从 initvar 重放历史更新 → 错误永久生效，
  // 自建角色会"变成八幡"。守护：开局身份基线（0 楼 commit）为不可变基准，
  // ① 解析历史消息 <UpdateVariable>/<JSONPatch> 内的 JSON Patch 数组，删除违规身份 op、保留合法 op；
  // ② 文本无法完整解析时按"逐对象解析→保留可解析合法 op"降级，绝不依赖定序脆弱正则；
  // ③ 最新楼层与聊天级快照逐字段改回基线。
  // 保护根路径 /campaign_id /campaign_revision /mode /current_pov /custom_protagonist /difficulty 及其全部子路径。
  // 监听：mag_variable_update_ended 为主 · MESSAGE_RECEIVED 兜底 · CHAT_CHANGED/加载后各查一次；
  // 防重入 + 800ms 去抖，修复动作自身不触发循环。
  function installIdentityGuard() {
    const GUARD_ROOTS = ['campaign_id', 'campaign_revision', 'mode', 'current_pov', 'custom_protagonist', 'difficulty'];
    const AI_FORBIDDEN_ROOTS = GUARD_ROOTS.concat(['collection']);
    const DEBOUNCE_MS = 800;
    // 自身回写窗口：我们的 setChatMessages/updateVariablesWith 可能触发 MVU 再次抛出
    // mag_variable_update_ended，窗口内的事件延迟到窗口结束后再扫描（不丢弃，防真实违规被吞）
    const SELF_FIX_WINDOW_MS = 1000;
    let baseline = null;
    let debounceTimer = null;
    let running = false;
    let pendingRerun = false;
    let selfFixUntil = 0;

    function loadBaseline() {
      try {
        const s0 = (getVariables({ type: 'message', message_id: 0 }) || {}).stat_data;
        if (s0 && s0.mode) {
          baseline = {
            campaign_id: s0.campaign_id ?? 'main',
            campaign_revision: s0.campaign_revision ?? 1,
            mode: s0.mode,
            current_pov: s0.current_pov ?? null,
            custom_protagonist: s0.custom_protagonist ?? null,
            difficulty: s0.difficulty ?? null,
          };
          console.info('[Counterfeit·守护] 身份基线已缓存', baseline);
        }
      } catch (error) {}
    }
    function identityOf(stat) {
      if (!stat || typeof stat !== 'object') return null;
      return {
        campaign_id: stat.campaign_id ?? 'main',
        campaign_revision: stat.campaign_revision ?? 1,
        mode: stat.mode ?? null,
        current_pov: stat.current_pov ?? null,
        custom_protagonist: stat.custom_protagonist ?? null,
        difficulty: stat.difficulty ?? null,
      };
    }
    function sameIdentity(a, b) {
      return (
        !!a &&
        !!b &&
        a.campaign_id === b.campaign_id &&
        a.campaign_revision === b.campaign_revision &&
        a.mode === b.mode &&
        a.current_pov === b.current_pov &&
        a.difficulty === b.difficulty &&
        JSON.stringify(a.custom_protagonist ?? null) === JSON.stringify(b.custom_protagonist ?? null)
      );
    }

    // 违规路径判定：根路径及其任意子路径（含 move 的 from），与 op 类型/字段顺序无关
    function isGuardedPath(p) {
      if (typeof p !== 'string') return false;
      const norm = p.replace(/^\/+/, '');
      const root = norm.split('/')[0];
      return AI_FORBIDDEN_ROOTS.indexOf(root) !== -1;
    }
    function isViolatingOp(op) {
      return !!op && typeof op === 'object' && (isGuardedPath(op.path) || isGuardedPath(op.from));
    }

    function tryParsePatchArray(raw) {
      const candidates = [raw, String(raw).replace(/,\s*([}\]])/g, '$1')];
      for (const candidate of candidates) {
        try {
          const parsed = JSON.parse(candidate);
          if (Array.isArray(parsed)) return parsed;
        } catch (error) {}
      }
      return null;
    }

    // 降级用：从数组体里按花括号平衡提取顶层 {...} 段（忽略字符串内的括号）
    function extractTopLevelObjects(raw) {
      const pieces = [];
      let depth = 0;
      let start = -1;
      let inString = false;
      let escaped = false;
      const text = String(raw);
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (inString) {
          if (escaped) escaped = false;
          else if (ch === '\\') escaped = true;
          else if (ch === '"') inString = false;
          continue;
        }
        if (ch === '"') {
          inString = true;
          continue;
        }
        if (ch === '{') {
          if (depth === 0) start = i;
          depth++;
        } else if (ch === '}') {
          depth--;
          if (depth === 0 && start >= 0) {
            pieces.push(text.slice(start, i + 1));
            start = -1;
          }
        }
      }
      return pieces;
    }

    function patchMentionsGuard(raw) {
      const text = String(raw);
      // 兼容带引号 / 裸写 / 带斜杠前缀的路径写法，词界用非单词字符防止 model 之类误命中
      return AI_FORBIDDEN_ROOTS.some(root => new RegExp('["\'/:\\s]' + root + '(?=[/"\'\\s,}\\]])').test(text));
    }

    // 清洗一段 JSONPatch 文本：完整解析优先；失败时逐对象降级（保留可解析合法 op）。
    // 返回 { text, changed, dropped, degraded }；dropped=-1 表示整段无法解析且提到违规路径 → 置空。
    function sanitizePatchText(raw) {
      const parsed = tryParsePatchArray(raw);
      if (parsed) {
        const kept = parsed.filter(op => !isViolatingOp(op));
        if (kept.length === parsed.length) return { text: raw, changed: false, dropped: 0, degraded: false };
        return { text: JSON.stringify(kept), changed: true, dropped: parsed.length - kept.length, degraded: false };
      }
      const mentions = patchMentionsGuard(raw);
      const pieces = extractTopLevelObjects(raw);
      if (pieces.length === 0) {
        // 完全无法解析：只有确实提到违规路径才置空（防误伤其他内容）
        return mentions
          ? { text: '[]', changed: true, dropped: -1, degraded: true }
          : { text: raw, changed: false, dropped: 0, degraded: false };
      }
      const kept = [];
      let dropped = 0;
      let unparseable = 0;
      for (const piece of pieces) {
        let op = null;
        try {
          op = JSON.parse(piece);
        } catch (error) {
          try {
            op = JSON.parse(piece.replace(/,\s*([}\]])/g, '$1'));
          } catch (error2) {}
        }
        if (!op || typeof op !== 'object') {
          unparseable++;
          continue;
        }
        if (isViolatingOp(op)) {
          dropped++;
          continue;
        }
        kept.push(op);
      }
      if (dropped === 0 && unparseable === 0) return { text: raw, changed: false, dropped: 0, degraded: false };
      if (dropped === 0 && !mentions) return { text: raw, changed: false, dropped: 0, degraded: false };
      return { text: JSON.stringify(kept), changed: true, dropped, degraded: true };
    }

    // 清洗一条消息正文里的全部 <UpdateVariable> 块（一条消息可有多个块）
    function sanitizeMessageText(text) {
      if (typeof text !== 'string' || !text.includes('<UpdateVariable>')) {
        return { text, changed: false, dropped: 0, degraded: false };
      }
      let changed = false;
      let dropped = 0;
      let degraded = false;
      const next = text.replace(/<UpdateVariable>([\s\S]*?)<\/UpdateVariable>/g, (whole, inner) => {
        const applyToPatch = patchRaw => {
          const result = sanitizePatchText(patchRaw.trim());
          if (!result.changed) return patchRaw;
          changed = true;
          if (result.dropped > 0) dropped += result.dropped;
          if (result.degraded) degraded = true;
          return '\n' + result.text + '\n';
        };
        if (inner.includes('<JSONPatch>')) {
          const newInner = inner.replace(/<JSONPatch>([\s\S]*?)<\/JSONPatch>/g, (w, patchRaw) => {
            return '<JSONPatch>' + applyToPatch(patchRaw) + '</JSONPatch>';
          });
          return '<UpdateVariable>' + newInner + '</UpdateVariable>';
        }
        // 无 JSONPatch 标签的兜底：找块内第一个 JSON 数组
        const arrayMatch = inner.match(/\[[\s\S]*\]/);
        if (!arrayMatch) return whole;
        const result = sanitizePatchText(arrayMatch[0]);
        if (!result.changed) return whole;
        changed = true;
        if (result.dropped > 0) dropped += result.dropped;
        if (result.degraded) degraded = true;
        return '<UpdateVariable>' + inner.replace(arrayMatch[0], result.text) + '</UpdateVariable>';
      });
      return { text: next, changed, dropped, degraded };
    }

    async function scanAndFix() {
      if (running) {
        pendingRerun = true;
        return;
      }
      running = true;
      try {
        if (!baseline) loadBaseline();
        if (!baseline) return;
        if (typeof getLastMessageId !== 'function' || typeof getVariables !== 'function') return;
        const lastId = getLastMessageId();
        if (lastId == null) return;

        // 1) 清理历史消息原文中的违规 op（无论快照当前是否已错——
        //    MVU 从 initvar 重放历史，违规 op 留着就会在下一轮重放时生效）
        let historyDirty = false;
        let droppedTotal = 0;
        let collectionDirty = false;
        if (typeof getChatMessages === 'function' && typeof setChatMessages === 'function') {
          const msgs = getChatMessages('0-' + lastId);
          const fixed = (Array.isArray(msgs) ? msgs : []).map(m => {
            if (!m || typeof m.message !== 'string' || !m.message.includes('<UpdateVariable>')) return m;
            if (/['"]\/collection(?:\/|['"])/.test(m.message)) collectionDirty = true;
            const result = sanitizeMessageText(m.message);
            if (!result.changed) return m;
            historyDirty = true;
            droppedTotal += result.dropped;
            return Object.assign({}, m, { message: result.text });
          });
          if (historyDirty) {
            selfFixUntil = Date.now() + SELF_FIX_WINDOW_MS;
            await setChatMessages(fixed, { refresh: 'affected' });
            console.warn('[Counterfeit·守护] 已从历史消息删除 ' + droppedTotal + ' 个违规身份 op（合法变量更新全部保留）');
          }
        }

        // 2) 最新楼层与聊天级快照逐字段改回 0 楼基线（两者独立检查：
        //    最新楼层恰好干净但 chat 级被污染的情况也要修）
        const floorCur = identityOf((getVariables({ type: 'message', message_id: lastId }) || {}).stat_data);
        const chatCur = identityOf((getVariables({ type: 'chat' }) || {}).stat_data);
        const floorBad = !!floorCur && !sameIdentity(floorCur, baseline);
        const chatBad = !!chatCur && !sameIdentity(chatCur, baseline);
        let safeCollection = null;
        if (collectionDirty) {
          for (let id = lastId - 1; id >= 0; id--) {
            const candidate = (getVariables({ type: 'message', message_id: id }) || {}).stat_data?.collection;
            if (candidate && typeof candidate === 'object') {
              safeCollection = JSON.parse(JSON.stringify(candidate));
              break;
            }
          }
        }
        const floorStat = (getVariables({ type: 'message', message_id: lastId }) || {}).stat_data;
        const chatStat = (getVariables({ type: 'chat' }) || {}).stat_data;
        const floorCollectionBad = !!safeCollection && JSON.stringify(floorStat?.collection ?? null) !== JSON.stringify(safeCollection);
        const chatCollectionBad = !!safeCollection && JSON.stringify(chatStat?.collection ?? null) !== JSON.stringify(safeCollection);
        if ((floorBad || chatBad || floorCollectionBad || chatCollectionBad) && typeof updateVariablesWith === 'function') {
          console.warn(
            '[Counterfeit·守护] 检测到身份变量被改写（期望 ' +
              JSON.stringify(baseline) +
              ' 楼层 ' +
              JSON.stringify(floorCur) +
              ' 聊天级 ' +
              JSON.stringify(chatCur) +
              '），开始修复',
          );
          const apply = vars => {
            const s = vars.stat_data || {};
            if ((s.campaign_id ?? 'main') !== baseline.campaign_id) s.campaign_id = baseline.campaign_id;
            if ((s.campaign_revision ?? 1) !== baseline.campaign_revision) s.campaign_revision = baseline.campaign_revision;
            if ((s.mode ?? null) !== baseline.mode) s.mode = baseline.mode;
            if ((s.current_pov ?? null) !== baseline.current_pov) s.current_pov = baseline.current_pov;
            if (JSON.stringify(s.custom_protagonist ?? null) !== JSON.stringify(baseline.custom_protagonist)) {
              s.custom_protagonist = baseline.custom_protagonist;
            }
            if ((s.difficulty ?? null) !== baseline.difficulty) s.difficulty = baseline.difficulty;
            if (safeCollection && JSON.stringify(s.collection ?? null) !== JSON.stringify(safeCollection)) {
              s.collection = JSON.parse(JSON.stringify(safeCollection));
            }
            return vars;
          };
          selfFixUntil = Date.now() + SELF_FIX_WINDOW_MS;
          if (floorBad || floorCollectionBad) await updateVariablesWith(apply, { type: 'message', message_id: lastId });
          if (chatBad || chatCollectionBad) await updateVariablesWith(apply, { type: 'chat' });
          console.warn('[Counterfeit·守护] 楼层/聊天级身份与客户端收藏快照已修复');
        }
        if (!historyDirty && !floorBad && !chatBad && !floorCollectionBad && !chatCollectionBad) {
          console.info('[Counterfeit·守护] 检查通过，身份变量与历史更新块均干净');
        }
      } catch (error) {
        console.warn('[Counterfeit·守护] 修复失败', error);
      } finally {
        running = false;
        if (pendingRerun) {
          pendingRerun = false;
          scheduleScan(0);
        }
      }
    }

    // 去抖调度：短时间连发的事件合并为一次扫描；修复动作自身的回写窗口内不再响应事件
    function scheduleScan(delay) {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        void scanAndFix();
      }, typeof delay === 'number' ? delay : DEBOUNCE_MS);
    }
    function onEvent() {
      const wait = selfFixUntil - Date.now();
      scheduleScan(wait > 0 ? Math.max(DEBOUNCE_MS, wait + 50) : DEBOUNCE_MS);
    }

    const on = typeof eventOn !== 'undefined' ? eventOn : typeof window !== 'undefined' ? window.eventOn : undefined;
    const events =
      typeof tavern_events !== 'undefined' ? tavern_events : typeof window !== 'undefined' ? window.tavern_events : undefined;
    if (typeof on === 'function') {
      // 主通道：MVU 变量更新结束（框架事件名为字符串，不依赖 tavern_events 枚举存在）
      try {
        on('mag_variable_update_ended', onEvent);
      } catch (error) {}
      // 兜底通道：收到 AI 消息
      if (events && events.MESSAGE_RECEIVED) {
        try {
          on(events.MESSAGE_RECEIVED, onEvent);
        } catch (error) {}
      }
      // 加载存档/切换聊天后重查一次（基线随聊天重置）
      if (events && events.CHAT_CHANGED) {
        try {
          on(events.CHAT_CHANGED, () => {
            baseline = null;
            scheduleScan(1500);
          });
        } catch (error) {}
      }
      console.info('[Counterfeit·守护] POV 身份守护已启用（mag_variable_update_ended 主 · MESSAGE_RECEIVED 兜底 · CHAT_CHANGED 重查）');
    } else {
      console.warn('[Counterfeit·守护] eventOn 不可用，POV 守护未启用');
    }
    // 脚本加载后也做一次检查（覆盖 reload 场景）
    scheduleScan(2000);
  }

  if (topDoc.body) {
    check();
    new MutationObserver(() => check()).observe(topDoc.body, { childList: true, subtree: true });
  } else {
    topDoc.addEventListener('DOMContentLoaded', check, { once: true });
  }
  void migrateLegacyCampaignFields();
  installIdentityGuard();
  // 给酒馆自己的渲染与正则留出时间，再判定"完全没挂载"
  setTimeout(detectUnreplacedPlaceholder, 6000);
  setTimeout(detectUnreplacedPlaceholder, 12000);
  setTimeout(check, 300);
  setTimeout(check, 1000);
  setTimeout(check, 3000);
  setInterval(check, 1500);
  if (typeof window.eventOn === 'function' && window.tavern_events?.APP_READY) {
    window.eventOn(window.tavern_events.APP_READY, check);
  }
  if (typeof window.eventOn === 'function' && window.tavern_events?.CHAT_CHANGED) {
    window.eventOn(window.tavern_events.CHAT_CHANGED, () => {
      // 迁移表格持久化必须落在迁移发生的聊天里；切换聊天即作废
      pendingResumeTables = null;
      void migrateLegacyCampaignFields();
    });
  }
})();
