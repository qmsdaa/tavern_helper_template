/* Counterfeit · 手机助手加载器（由 assets/tools/pack_phone_script.py 生成，请勿手改本文件产物）
   机制：酒馆助手脚本在独立沙箱执行，UI 必须挂载到宿主文档（window.top.document）；
   srcdoc iframe（与宿主页面同源）挂载手机 UI；可拖动悬浮球启动器在宿主页面。 */
console.info('[Counterfeit·手机助手] eval');
(() => {
  const BTN_ID = 'counterfeit-phone-launcher-root';
  const IFRAME_ID = 'counterfeit-phone-iframe';
  const STYLE_ID = 'counterfeit-phone-loader-style';
  const LISTENER_KEY = '__counterfeit_phone_msg_listener__';
  const POS_KEY = 'counterfeit.phone.launcher.pos';
  const SANDBOX_NAME = '__counterfeit_sandbox__';

  const PHONE_HTML = __PHONE_HTML__;

  // 酒馆助手脚本在沙箱 iframe 中执行：UI 要挂到宿主（顶层）文档
  function getHostDocument() {
    try {
      return window.top?.document ?? window.parent?.document ?? document;
    } catch {
      return document;
    }
  }
  const hostDocument = getHostDocument();
  const hostWindow = hostDocument.defaultView ?? window;
  // 给沙箱命名：手机 iframe 里的 API 桥靠这个名字找回沙箱（那里有 getVariables 等 API）
  try {
    window.name = SANDBOX_NAME;
  } catch {
    /* 忽略 */
  }

  function mount() {
    // 幂等：重复挂载时清理旧实例
    hostDocument.getElementById(BTN_ID)?.remove();
    hostDocument.getElementById(IFRAME_ID)?.remove();
    hostDocument.getElementById(STYLE_ID)?.remove();
    if (hostWindow[LISTENER_KEY]) {
      hostWindow.removeEventListener('message', hostWindow[LISTENER_KEY]);
    }
    if (hostWindow.__cpl_resize__) {
      hostWindow.removeEventListener('resize', hostWindow.__cpl_resize__);
    }
    if (hostWindow.__cpl_viewport_sync__) {
      hostWindow.removeEventListener('resize', hostWindow.__cpl_viewport_sync__);
      hostWindow.removeEventListener('orientationchange', hostWindow.__cpl_viewport_sync__);
      hostWindow.removeEventListener('scroll', hostWindow.__cpl_viewport_sync__);
      try {
        if (hostWindow.visualViewport) {
          hostWindow.visualViewport.removeEventListener('resize', hostWindow.__cpl_viewport_sync__);
          hostWindow.visualViewport.removeEventListener('scroll', hostWindow.__cpl_viewport_sync__);
        }
      } catch {
        /* 忽略 */
      }
    }
    if (!hostDocument.body) {
      return;
    }

    const style = hostDocument.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
#${BTN_ID} {
  position: fixed; left: 0; top: 0; z-index: 1000001;
  width: 58px; height: 58px; border-radius: 50%; border: none; cursor: grab;
  background: linear-gradient(145deg, #4a4a52, #3a3a40); color: #fff;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 8px 24px rgba(0,0,0,0.35);
  transition: transform .2s ease, box-shadow .2s ease;
  user-select: none; -webkit-user-select: none; touch-action: none;
}
#${BTN_ID}:hover { transform: scale(1.06); box-shadow: 0 12px 30px rgba(0,0,0,0.45); }
#${BTN_ID}.dragging { cursor: grabbing; transition: none; transform: scale(1.1); }
#${BTN_ID} svg { width: 26px; height: 26px; pointer-events: none; }
#${BTN_ID} .cpl-pulse {
  position: absolute; inset: -4px; border-radius: 50%;
  border: 2px solid rgba(255,255,255,.35);
  animation: cpl-pulse 2.4s ease-out infinite; pointer-events: none;
}
@keyframes cpl-pulse { 0% { transform: scale(.9); opacity: .8; } 100% { transform: scale(1.5); opacity: 0; } }
#${IFRAME_ID} {
  position: fixed; left: 0; top: 0; width: 100vw; height: 100vh;
  border: none; z-index: 1000000; pointer-events: none; background: transparent;
  /* 合成层提示：规避部分移动内核对 visibility 切换的 iframe 不重绘的 bug */
  transform: translateZ(0);
  /* 防御：手机 App 只有在回报 open:true 后才可见。
     启动失败（如 API 缺失抛错）时 iframe 文档保持深色背景，
     若没有这一层，全屏 iframe 会把酒馆整个盖成黑屏。 */
  visibility: hidden;
}
`;
    hostDocument.head.appendChild(style);

    // 【移动端尺寸：不用 vh，用 JS 实测像素】2026-08-23
    // 与 2026-08-05 状态栏修复同源：部分移动内核（国产套壳/旧 WebView/移动 Safari）
    // 对宿主页面里 iframe 的 100vw/100vh 解析不可靠——可能解析成超大值，
    // 此时 App 内部 flex 居中会把手机本体定位到视口外几千像素处，
    // 用户看到的就是"点球 → 球消失（open:true 已回传）→ 屏幕上什么都没有"。
    // iframe 元素本身一旦被 JS 写成实测像素尺寸，iframe 内部的 vh 也就随之正确
    //（iframe 是自己的视口），App 内的 100vh 布局无需改动。
    function measuredViewport() {
      const fallback = { width: hostWindow.innerWidth || 0, height: hostWindow.innerHeight || 0 };
      try {
        const vv = hostWindow.visualViewport;
        if (vv && vv.width > 0 && vv.height > 0) {
          return { width: Math.round(vv.width), height: Math.round(vv.height) };
        }
      } catch {
        /* 忽略 */
      }
      try {
        const de = hostDocument.documentElement;
        if (de && de.clientWidth > 0 && de.clientHeight > 0) {
          return { width: de.clientWidth, height: de.clientHeight };
        }
      } catch {
        /* 忽略 */
      }
      return fallback;
    }

    // 自校正放置：left/top 先按"可视视口坐标"写入，再以 getBoundingClientRect 纠偏。
    // 酒馆 html 带 perspective（fixed 包含块=文档而非视口）、文档滚动、移动端 pinch 平移
    // 对 fixed 元素都是纯平移，一次纠偏即收敛；1px 容差防止重复同步时抖动。
    function placeInViewport(el, vx, vy) {
      if (el.style.display === 'none') {
        return; // 无布局盒（球在手机打开时隐藏），跳过；再次显示时由 keepBallInView 重放
      }
      el.style.left = `${Math.round(vx)}px`;
      el.style.top = `${Math.round(vy)}px`;
      const r = el.getBoundingClientRect();
      const dx = vx - r.left;
      const dy = vy - r.top;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        el.style.left = `${Math.round((parseFloat(el.style.left) || 0) + dx)}px`;
        el.style.top = `${Math.round((parseFloat(el.style.top) || 0) + dy)}px`;
      }
    }

    function syncIframeSize() {
      const el = hostDocument.getElementById(IFRAME_ID);
      if (!el) {
        return;
      }
      const { width, height } = measuredViewport();
      if (width > 0 && height > 0) {
        el.style.width = `${width}px`;
        el.style.height = `${height}px`;
      }
      placeInViewport(el, 0, 0);
    }

    const viewportSync = () => {
      syncIframeSize();
      keepBallInView();
    };
    hostWindow.__cpl_viewport_sync__ = viewportSync;
    hostWindow.addEventListener('resize', viewportSync);
    hostWindow.addEventListener('orientationchange', viewportSync);
    // 文档滚动也要同步：fixed 包含块是 html（perspective）时，滚动会让元素相对视口漂移
    hostWindow.addEventListener('scroll', viewportSync, { passive: true });
    try {
      if (hostWindow.visualViewport) {
        hostWindow.visualViewport.addEventListener('resize', viewportSync);
        hostWindow.visualViewport.addEventListener('scroll', viewportSync);
      }
    } catch {
      /* 忽略 */
    }

    // 显示/隐藏统一走这里：显示时先按实测视口重设尺寸（强制一次 layout+repaint），
    // 再用双 rAF 二次确认——部分移动内核在 visibility 切换当帧不合成 iframe 内容
    function setIframeVisible(visible) {
      const el = hostDocument.getElementById(IFRAME_ID);
      if (!el) {
        return;
      }
      el.style.pointerEvents = visible ? 'auto' : 'none';
      if (visible) {
        syncIframeSize();
        el.style.visibility = 'visible';
        hostWindow.requestAnimationFrame(() => {
          hostWindow.requestAnimationFrame(() => {
            syncIframeSize();
          });
        });
      } else {
        el.style.visibility = 'hidden';
      }
    }

    const iframe = hostDocument.createElement('iframe');
    iframe.id = IFRAME_ID;
    // TauriTavern: ordinary fullscreen-window forces width/height:auto !important,
    // which shrinks a replaced iframe to 300x150. Declare before host admission.
    iframe.setAttribute('data-tt-mobile-surface', 'viewport-host');
    iframe.setAttribute('allowtransparency', 'true');
    iframe.srcdoc = PHONE_HTML;

    // 直接把沙箱里的酒馆 API 注入手机 iframe（HTML 内桥接的兜底）。
    // Vue/Pinia/Zod 等执行依赖均已内联，不从宿主注入。
    const API_NAMES = [
      'getVariables', 'updateVariablesWith', 'insertOrAssignVariables', 'deleteVariable',
      'getChatMessages', 'setChatMessages', 'getLastMessageId',
      'generateRaw', 'generate', 'eventOn', 'eventMakeFirst', 'eventEmit', 'tavern_events',
      'getCharWorldbookNames', 'getWorldbook', 'updateWorldbookWith', 'createWorldbook',
      'getOrCreateChatWorldbook',
      'getModelList', 'getProxyPresetNames', 'getPresetNames',
      'stopGenerationById', 'stopAllGeneration',
      '_', '$', 'jQuery',
    ];
    const injectApis = () => {
      const win = iframe.contentWindow;
      if (!win) {
        return;
      }
      for (const k of API_NAMES) {
        try {
          if (win[k] === undefined && window[k] !== undefined) {
            win[k] = window[k];
          }
        } catch {
          /* 忽略 */
        }
      }
    };

    let appReady = false;
    let pendingOpen = false;
    // 每次操作前重取 iframe 节点：宿主（如 TauriTavern 浮层准入）可能挪走/替换元素，
    // 持有的旧引用 contentWindow 可能已成死上下文，postMessage 无声丢失
    const freshIframe = () => hostDocument.getElementById(IFRAME_ID) || iframe;
    const sendOpen = () => freshIframe().contentWindow?.postMessage({ source: 'counterfeit-phone-loader', action: 'open' }, '*');
    const openPhone = () => {
      pendingOpen = true;
      // App 未就绪前不放开事件与可见性，否则死掉的 App 会留下透明但吃点击的全屏层
      if (appReady) {
        setIframeVisible(true);
        sendOpen();
      }
    };

    const btn = hostDocument.createElement('button');
    btn.id = BTN_ID;
    btn.setAttribute('data-tt-mobile-surface', 'free-window');
    btn.setAttribute('aria-label', '打开手机助手');
    btn.title = '手机助手（可拖动）';
    btn.innerHTML =
      '<span class="cpl-pulse"></span>' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">' +
      '<rect x="7" y="2.5" width="10" height="19" rx="2.5"></rect>' +
      '<line x1="10.5" y1="18.5" x2="13.5" y2="18.5"></line></svg>';

    // —— 可拖动悬浮球：位置记忆 + 边缘吸附 + 拖拽/点击区分 ——
    // 位置一律用"可视视口坐标"（pos）管理，写样式经 placeInViewport 自校正。
    // 修复"悬浮球跑到视窗外"：酒馆 html 带 perspective（fixed 包含块=文档），
    // 窗口缩小/地址栏伸缩/横竖屏切换/文档滚动后，旧 left/top 会落到视口外——
    // keepBallInView 在挂载与每次视口变化时把球拉回可视区域。
    const applyPos = (x, y) => {
      btn.style.left = `${Math.round(x)}px`;
      btn.style.top = `${Math.round(y)}px`;
    };
    const defaultPos = () => {
      const { width, height } = measuredViewport();
      return { x: Math.max(0, width - 80), y: Math.max(0, height - 80) };
    };
    let pos = defaultPos();
    let hasSavedPos = false;
    try {
      const saved = JSON.parse(hostWindow.localStorage.getItem(POS_KEY) || 'null');
      if (saved && isFinite(saved.x) && isFinite(saved.y)) {
        pos = { x: saved.x, y: saved.y };
        hasSavedPos = true;
      }
    } catch {
      /* 忽略 */
    }
    // 元素尚未挂载，只能直写；appendChild 后由 keepBallInView 做钳位+纠偏
    applyPos(pos.x, pos.y);

    function keepBallInView() {
      const el = hostDocument.getElementById(BTN_ID);
      if (!el || el.style.display === 'none') {
        return;
      }
      const { width, height } = measuredViewport();
      if (width <= 0 || height <= 0) {
        return;
      }
      if (!hasSavedPos) {
        pos = defaultPos();
      } else {
        pos = {
          x: Math.min(Math.max(0, pos.x), Math.max(0, width - el.offsetWidth)),
          y: Math.min(Math.max(0, pos.y), Math.max(0, height - el.offsetHeight)),
        };
      }
      placeInViewport(el, pos.x, pos.y);
    }

    let drag = null;
    btn.addEventListener('pointerdown', e => {
      // offX/offY = 样式坐标与可视视口坐标的当前差值（perspective 包含块/文档滚动导致），
      // 拖拽期间视为常量，避免每帧 getBoundingClientRect；pointerup 时再终校正
      const r = btn.getBoundingClientRect();
      drag = {
        startX: e.clientX,
        startY: e.clientY,
        baseX: pos.x,
        baseY: pos.y,
        offX: (parseFloat(btn.style.left) || 0) - r.left,
        offY: (parseFloat(btn.style.top) || 0) - r.top,
        moved: false,
      };
      btn.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    btn.addEventListener('pointermove', e => {
      if (!drag) {
        return;
      }
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      if (!drag.moved && Math.hypot(dx, dy) > 6) {
        drag.moved = true;
        btn.classList.add('dragging');
      }
      if (drag.moved) {
        const { width, height } = measuredViewport();
        pos = {
          x: Math.min(Math.max(0, drag.baseX + dx), Math.max(0, width - btn.offsetWidth)),
          y: Math.min(Math.max(0, drag.baseY + dy), Math.max(0, height - btn.offsetHeight)),
        };
        applyPos(pos.x + drag.offX, pos.y + drag.offY);
      }
    });
    btn.addEventListener('pointerup', () => {
      if (!drag) {
        return;
      }
      const wasDrag = drag.moved;
      drag = null;
      btn.classList.remove('dragging');
      if (wasDrag) {
        // 吸附最近的左/右边（视口坐标），随后 placeInViewport 终校正
        const { width } = measuredViewport();
        const w = btn.offsetWidth;
        pos = { x: pos.x + w / 2 < width / 2 ? 12 : Math.max(12, width - w - 12), y: pos.y };
        placeInViewport(btn, pos.x, pos.y);
        hasSavedPos = true;
        try {
          hostWindow.localStorage.setItem(POS_KEY, JSON.stringify(pos));
        } catch {
          /* 忽略 */
        }
      } else {
        openPhone();
      }
    });
    btn.addEventListener('pointercancel', () => {
      drag = null;
      btn.classList.remove('dragging');
    });
    // Keyboard/assistive activation has no pointerdown/up. Pointer taps are already
    // handled above; do not reopen on the synthetic click after a drag.
    btn.addEventListener('click', event => {
      if (event.detail === 0) openPhone();
    });
    btn.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openPhone();
      }
    });

    hostWindow[LISTENER_KEY] = event => {
      const data = event.data;
      // 不校验 event.source === iframe.contentWindow：宿主挪动 iframe 后 source 恒不等，
      // 旧校验会把 App 的 ready/open 回执静默丢掉；data.source 私有命名空间令牌足够区分
      if (!data || data.source !== 'counterfeit-phone') {
        return;
      }
      if (data.ready) {
        appReady = true;
        btn.style.display = 'flex';
        if (pendingOpen) {
          setIframeVisible(true);
          sendOpen();
        } else {
          setIframeVisible(false);
        }
        return;
      }
      if (typeof data.open === 'boolean') {
        setIframeVisible(data.open);
        btn.style.display = data.open ? 'none' : 'flex';
        if (!data.open) {
          pendingOpen = false;
          // 重新显示时重放位置（隐藏期间视口可能变过）
          keepBallInView();
        }
      }
    };
    hostWindow.addEventListener('message', hostWindow[LISTENER_KEY]);

    hostDocument.body.appendChild(iframe);
    hostDocument.body.appendChild(btn);
    syncIframeSize();
    keepBallInView();
    injectApis();
    iframe.addEventListener('load', () => {
      injectApis();
      syncIframeSize();
    });
    console.info('[Counterfeit·手机助手] 已挂载（加载器 v7 · viewport-host · 视口锁定+独立开关 · 握手去 source 硬校验）');
  }

  if (hostDocument.body) {
    mount();
  } else {
    hostDocument.addEventListener('DOMContentLoaded', mount, { once: true });
  }
  // 酒馆环境兜底：APP_READY 时再确保一次（幂等）
  if (typeof window.eventOn === 'function' && window.tavern_events?.APP_READY) {
    window.eventOn(window.tavern_events.APP_READY, () => {
      if (!hostDocument.getElementById(BTN_ID)) {
        mount();
      }
    });
  }
})();
