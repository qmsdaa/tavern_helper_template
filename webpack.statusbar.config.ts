// 仅构建 Counterfeit 状态栏入口的专用配置。
// 复用 webpack.config.ts 的全部条目定义，过滤出"界面/状态栏"入口，
// 并剥离带文件副作用的插件：
//   - tavern_sync：构建时会执行 `pnpm sync bundle all` 打包角色卡/世界书，不允许在状态栏构建中触发
//   - schema_dump：构建时会对所有 src/**/schema.ts 全量导出 schema.json，状态栏构建不需要
// 这样 `webpack --config webpack.statusbar.config.ts` 只会产出 dist/Counterfeit/界面/状态栏/，
// 不会触碰开场白、手机等其他模块的 dist 产物。
import configFactories from './webpack.config.ts';

const SIDE_EFFECT_PLUGIN_NAMES = new Set(['tavern_sync', 'schema_dump']);

const statusbarFactories = configFactories.filter(factory => {
  const probe = factory(undefined, { mode: 'production' });
  return typeof probe.entry === 'string' && /src[\\/]Counterfeit[\\/]界面[\\/]状态栏[\\/]index\.ts$/.test(probe.entry);
});

if (statusbarFactories.length !== 1) {
  throw new Error(`期望恰好匹配 1 个状态栏入口，实际匹配到 ${statusbarFactories.length} 个`);
}

export default statusbarFactories.map(factory => (env: unknown, argv: { mode?: string }) => {
  const config = factory(env, argv);
  config.plugins = (config.plugins ?? []).filter(plugin => {
    const applyName = (plugin as { apply?: { name?: string } } | null)?.apply?.name ?? '';
    return !SIDE_EFFECT_PLUGIN_NAMES.has(applyName);
  });
  return config;
});
