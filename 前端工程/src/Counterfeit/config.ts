// 素材根路径（立绘 / 序奏视频 / BGM）。
// 本地预览：以仓库根目录为 webroot 启动静态服务器（端口 5500），即可访问 assets/ 下的素材。
// 部署时改成 jsdelivr 等 CDN 地址即可，一行切换，例如：
// 2026-08-28 起 ASSET_BASE 也迁至 tavern_helper_template_cdn（原仓库超 jsDelivr 后端体积上限，
// 新 commit 不再被解析）。开场白序奏视频（intro_01..06 / title_sakura_loop）只存在于新仓库。
export const ASSET_BASE = 'https://cdn.jsdelivr.net/gh/qmsdaa/tavern_helper_template_cdn@895ab1f4d382284f2c8150e7910c766ba0eabc56/assets/Counterfeit/开场白';

// 状态栏详情立绘 / 状态栏轻量头像 / 手机好友头像（均固定 GitHub commit，不使用漂移分支）。
// 详情立绘为 4K/2K，只有角色弹窗打开后才加载；列表 chip 只加载 512×512 头像。
// 2026-08-28 统一钉到 tavern_helper_template_cdn@895ab1f（含 2026-08-23 新拉芙希妮立绘
// 与手机头像迁移；至此 ASSET_BASE/PORTRAIT_BASE/STATUS_AVATAR_BASE/AVATAR_BASE 全部迁出旧仓库）。
export const PORTRAIT_BASE = 'https://cdn.jsdelivr.net/gh/qmsdaa/tavern_helper_template_cdn@895ab1f4d382284f2c8150e7910c766ba0eabc56/assets/Counterfeit/状态栏/portraits';
export const STATUS_AVATAR_BASE = 'https://cdn.jsdelivr.net/gh/qmsdaa/tavern_helper_template_cdn@895ab1f4d382284f2c8150e7910c766ba0eabc56/assets/Counterfeit/状态栏/avatars';
export const AVATAR_BASE = 'https://cdn.jsdelivr.net/gh/qmsdaa/tavern_helper_template_cdn@895ab1f4d382284f2c8150e7910c766ba0eabc56/assets/Counterfeit/手机/avatars';

// 素材版本号：同名文件内容更新后递增（?v= 查询串破浏览器/CDN 缓存）。
// ⚠️ 每次替换 assets 下的图片/音频都要 bump 这个值，否则用户端会继续用缓存旧图。
export const ASSET_VERSION = '20260828a';
