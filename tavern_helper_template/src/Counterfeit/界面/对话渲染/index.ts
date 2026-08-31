import App from './App.vue';
import './global.css';

const jq = (window as any).$ as JQueryStatic | undefined;

if (typeof jq === 'function') {
  jq(() => {
    const app = createApp(App).use(createPinia());
    app.mount('#app');
    jq(window).on('pagehide', () => app.unmount());
  });
}
