import App from './App.vue';
import './global.css';

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
