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
  // webpack 5.109 outputModule + 作用域提升会丢运行时本体（__webpack_require__.cjs ReferenceError），
  // 关闭模块拼接回退标准运行时包装（同 webpack.opening.config.ts 的修复）。
  config.optimization = { ...(config.optimization ?? {}), concatenateModules: false };
  // 手机助手运行在加载器自创的 srcdoc iframe 里，酒馆助手不会给它注入全局 z（zod）。
  // 共享配置的 externals 会把 zod 外置成全局 z，模块求值时直接 ReferenceError、Vue 不挂载、
  // 全屏 iframe 黑屏盖住院馆。这里对 zod 取消外置、直接打进单文件产物，彻底去掉这个依赖。
  const baseExternals = config.externals;
  config.externals = [
    ((externalsArg: { context?: string; request?: string }, callback: (err?: unknown, result?: string) => void) => {
      if (externalsArg?.request === 'zod') {
        return callback();
      }
      if (typeof baseExternals === 'function') {
        return (baseExternals as (arg: unknown, cb: typeof callback) => unknown)(externalsArg, callback);
      }
      return callback();
    }) as never,
  ];
  return config;
});
