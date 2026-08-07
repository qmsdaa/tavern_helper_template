import { waitUntil } from 'async-wait-until';
import App from './App.vue';
import './global.css';
import { isMockMode } from './mock';
import { initTheme } from './theme';

// 主题上色：在模块求值阶段就执行（早于 DOMContentLoaded 与 MVU 等待），
// 否则暗色主题下会先按浅色渲染一帧再变暗。paint() 内部自带 try/catch，
// 拿不到 documentElement 也只是退回默认配色，不影响后续挂载。
initTheme();

// 酒馆环境有 jQuery（$），纯浏览器 mock 预览没有——按约定做降级（与开场白界面同款处理）
const jq = (window as any).$ as JQueryStatic | undefined;

const ready = (fn: () => void) =>
  typeof jq === 'function' ? jq(fn) : document.addEventListener('DOMContentLoaded', fn);

/** 本消息楼层的 MVU 快照是否已就绪（楼层尚无 stat_data 时回退检查聊天级基线，安全返回 false） */
function hasMessageStatData(): boolean {
  try {
    if (_.has(getVariables({ type: 'message', message_id: getCurrentMessageId() }), 'stat_data')) {
      return true;
    }
    return _.has(getVariables({ type: 'chat' }), 'stat_data');
  } catch {
    return false;
  }
}

ready(async () => {
  if (!isMockMode()) {
    // 等待 MVU 初始化后再挂载；本楼层快照可能晚于全局初始化就绪，给一段有界等待，
    // 超时则照常挂载——Schema 全字段带 prefault，空快照会安全回退为"尚未开局"占位，
    // 之后由 store 的轮询自动跟上真实数据。
    await waitGlobalInitialized('Mvu');
    await waitUntil(hasMessageStatData, { timeout: 8000, intervalBetweenAttempts: 100 }).catch(() => {});
  }
  const app = createApp(App).use(createPinia());
  app.mount('#app');
  if (typeof jq === 'function') {
    jq(window).on('pagehide', () => app.unmount());
  } else {
    window.addEventListener('pagehide', () => app.unmount());
  }
});
