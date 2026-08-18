import { createApp } from 'vue';
import App from './App.vue';
import './global.css';

// 酒馆环境有 jQuery（$），纯浏览器预览没有——按约定做降级（@types/jquery 未声明 window.$，故用 any 取值）
 
const jq = (window as any).$ as JQueryStatic | undefined;

const ready = (fn: () => void) =>
  typeof jq === 'function' ? jq(fn) : document.addEventListener('DOMContentLoaded', fn);

ready(() => {
  const app = createApp(App).use(createPinia());
  app.mount('#app');
  if (typeof jq === 'function') {
    jq(window).on('pagehide', () => app.unmount());
  } else {
    window.addEventListener('pagehide', () => app.unmount());
  }
});
