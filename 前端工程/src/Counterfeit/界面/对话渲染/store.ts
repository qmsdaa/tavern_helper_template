import { z } from 'zod';
import { klona } from 'klona';

const LS_CONFIG_KEY = 'cf_bubble_config_v1';

const ConfigSchema = z.object({
  enabled: z.boolean().default(true),
  theme: z.enum(['parchment', 'dark', 'green']).default('parchment'),
  bubbleFontSize: z.number().min(12).max(22).default(17),
  narrativeFontSize: z.number().min(12).max(22).default(15.5),
  lineHeight: z.number().min(1.4).max(2.0).default(1.75),
  avatarSize: z.number().min(36).max(72).default(48),
});

export type BubbleConfig = z.infer<typeof ConfigSchema>;

export function loadConfig(): BubbleConfig {
  try {
    const raw = localStorage.getItem(LS_CONFIG_KEY);
    return ConfigSchema.parse(raw ? JSON.parse(raw) : {});
  } catch (_) {
    return ConfigSchema.parse({});
  }
}

function saveConfig(config: BubbleConfig) {
  try {
    localStorage.setItem(LS_CONFIG_KEY, JSON.stringify(config));
  } catch (_) {}
}

function notifyParent(config: BubbleConfig) {
  window.parent.postMessage({ source: 'cf-bubble-panel', type: 'config-update', config: klona(config) }, '*');
}

export const useBubbleStore = defineStore('bubble', () => {
  const config = ref<BubbleConfig>(loadConfig());

  function updateConfig(patch: Partial<BubbleConfig>) {
    const next = ConfigSchema.parse({ ...config.value, ...patch });
    config.value = next;
    saveConfig(next);
    notifyParent(next);
  }

  function closePanel() {
    window.parent.postMessage({ source: 'cf-bubble-panel', type: 'close-panel' }, '*');
  }

  onMounted(() => {
    window.parent.postMessage({ source: 'cf-bubble-panel', type: 'request-config' }, '*');
    const handler = (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.source !== 'cf-bubble-script' || data.type !== 'init-config') return;
      config.value = ConfigSchema.parse(data.config);
    };
    window.addEventListener('message', handler);
    onUnmounted(() => window.removeEventListener('message', handler));
  });

  return { config, updateConfig, closePanel };
});
