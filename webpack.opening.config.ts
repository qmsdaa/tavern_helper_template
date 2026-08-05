// 仅构建 Counterfeit 开场白入口的专用配置。
// 复用 webpack.config.ts，但移除会触发整卡同步/schema 导出的副作用插件。
import configFactories from './webpack.config.ts';

const SIDE_EFFECT_PLUGIN_NAMES = new Set(['tavern_sync', 'schema_dump']);

const openingFactories = configFactories.filter(factory => {
  const probe = factory(undefined, { mode: 'production' });
  return typeof probe.entry === 'string' && /src[\\/]Counterfeit[\\/]界面[\\/]开场白[\\/]index\.ts$/.test(probe.entry);
});

if (openingFactories.length !== 1) {
  throw new Error(`期望恰好匹配 1 个开场白入口，实际匹配到 ${openingFactories.length} 个`);
}

export default openingFactories.map(factory => (env: unknown, argv: { mode?: string }) => {
  const config = factory(env, argv);
  config.plugins = (config.plugins ?? []).filter(plugin => {
    const applyName = (plugin as { apply?: { name?: string } } | null)?.apply?.name ?? '';
    return !SIDE_EFFECT_PLUGIN_NAMES.has(applyName);
  });
  return config;
});
