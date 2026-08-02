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
}
`;
    hostDocument.head.appendChild(style);

    const iframe = hostDocument.createElement('iframe');
    iframe.id = IFRAME_ID;
    iframe.setAttribute('allowtransparency', 'true');
    iframe.srcdoc = PHONE_HTML;

    // 直接把沙箱里的酒馆 API 注入手机 iframe（HTML 内桥接的兜底）
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
    const sendOpen = () => iframe.contentWindow?.postMessage({ source: 'counterfeit-phone-loader', action: 'open' }, '*');
    const openPhone = () => {
      pendingOpen = true;
      iframe.style.pointerEvents = 'auto';
      if (appReady) {
        sendOpen();
      }
    };

    const btn = hostDocument.createElement('button');
    btn.id = BTN_ID;
    btn.title = '手机助手（可拖动）';
    btn.innerHTML =
      '<span class="cpl-pulse"></span>' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">' +
      '<rect x="7" y="2.5" width="10" height="19" rx="2.5"></rect>' +
      '<line x1="10.5" y1="18.5" x2="13.5" y2="18.5"></line></svg>';

    // —— 可拖动悬浮球：位置记忆 + 边缘吸附 + 拖拽/点击区分 ——
    // 注意：酒馆的 html 带 perspective（fixed 包含块不是视口），位置一律用像素 left/top
    const applyPos = (x, y) => {
      btn.style.left = `${Math.round(x)}px`;
      btn.style.top = `${Math.round(y)}px`;
    };
    const defaultPos = () => ({ x: hostWindow.innerWidth - 80, y: hostWindow.innerHeight - 80 });
    let hasSavedPos = false;
    try {
      const saved = JSON.parse(hostWindow.localStorage.getItem(POS_KEY) || 'null');
      if (saved && isFinite(saved.x) && isFinite(saved.y)) {
        applyPos(saved.x, saved.y);
        hasSavedPos = true;
      }
    } catch {
      /* 忽略 */
    }
    if (!hasSavedPos) {
      const p = defaultPos();
      applyPos(p.x, p.y);
    }
    hostWindow.__cpl_resize__ = () => {
      if (!hasSavedPos) {
        const p = defaultPos();
        applyPos(p.x, p.y);
      }
    };
    hostWindow.addEventListener('resize', hostWindow.__cpl_resize__);

    let drag = null;
    btn.addEventListener('pointerdown', e => {
      drag = { startX: e.clientX, startY: e.clientY, baseX: btn.offsetLeft, baseY: btn.offsetTop, moved: false };
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
        applyPos(
          Math.min(Math.max(0, drag.baseX + dx), hostWindow.innerWidth - btn.offsetWidth),
          Math.min(Math.max(0, drag.baseY + dy), hostWindow.innerHeight - btn.offsetHeight),
        );
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
        // 吸附最近的左/右边
        const rect = btn.getBoundingClientRect();
        const snapX = rect.left + rect.width / 2 < hostWindow.innerWidth / 2 ? 12 : hostWindow.innerWidth - rect.width - 12;
        applyPos(snapX, rect.top);
        hasSavedPos = true;
        try {
          hostWindow.localStorage.setItem(POS_KEY, JSON.stringify({ x: snapX, y: rect.top }));
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

    hostWindow[LISTENER_KEY] = event => {
      const data = event.data;
      if (!data || data.source !== 'counterfeit-phone') {
        return;
      }
      if (data.ready) {
        appReady = true;
        btn.style.display = 'flex';
        if (pendingOpen) {
          sendOpen();
        } else {
          iframe.style.pointerEvents = 'none';
        }
        return;
      }
      if (typeof data.open === 'boolean') {
        iframe.style.pointerEvents = data.open ? 'auto' : 'none';
        btn.style.display = data.open ? 'none' : 'flex';
        if (!data.open) {
          pendingOpen = false;
        }
      }
    };
    hostWindow.addEventListener('message', hostWindow[LISTENER_KEY]);

    hostDocument.body.appendChild(iframe);
    hostDocument.body.appendChild(btn);
    injectApis();
    iframe.addEventListener('load', injectApis);
    console.info('[Counterfeit·手机助手] 已挂载（加载器 v3 · 宿主文档）');
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
