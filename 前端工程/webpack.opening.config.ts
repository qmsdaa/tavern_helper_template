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
  // 卡内开场必须在“禁止外部模块访问”的酒馆环境中也能启动。
  // 通用配置会把 Vue 设为宿主全局、把 Pinia/Zod 等改写成 jsDelivr ESM；
  // 开场是内嵌 srcdoc，必须覆盖该策略并把执行依赖全部打入单文件。
  config.externals = undefined;
  // webpack 5.109 的 outputModule + 作用域提升会把 commonJsWrap 帮助器（__webpack_require__.cjs）
  // 内联进拼接模块，却不输出定义 __webpack_require__ 的运行时本体——产物首行即 ReferenceError。
  // 关闭模块拼接即可回退到标准运行时包装（2026-08-15 实测：拼接开启时生产构建必挂）。
  config.optimization = { ...(config.optimization ?? {}), concatenateModules: false };
  config.plugins = (config.plugins ?? []).filter(plugin => {
    const applyName = (plugin as { apply?: { name?: string } } | null)?.apply?.name ?? '';
    return !SIDE_EFFECT_PLUGIN_NAMES.has(applyName);
  });
  return config;
});
