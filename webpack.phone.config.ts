// 仅构建 Counterfeit 手机助手入口的专用配置。
// 避免全量构建触碰开场白、状态栏和角色卡同步产物。
import configFactories from './webpack.config.ts';

const SIDE_EFFECT_PLUGIN_NAMES = new Set(['tavern_sync', 'schema_dump']);

const phoneFactories = configFactories.filter(factory => {
  const probe = factory(undefined, { mode: 'production' });
  return typeof probe.entry === 'string' && /src[\\/]Counterfeit[\\/]界面[\\/]手机[\\/]index\.ts$/.test(probe.entry);
});

if (phoneFactories.length !== 1) {
  throw new Error(`期望恰好匹配 1 个手机助手入口，实际匹配到 ${phoneFactories.length} 个`);
}

export default phoneFactories.map(factory => (env: unknown, argv: { mode?: string }) => {
  const config = factory(env, argv);
  config.plugins = (config.plugins ?? []).filter(plugin => {
    const applyName = (plugin as { apply?: { name?: string } } | null)?.apply?.name ?? '';
    return !SIDE_EFFECT_PLUGIN_NAMES.has(applyName);
  });
  return config;
});
