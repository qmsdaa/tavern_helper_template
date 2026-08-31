// 素材根路径（立绘 / 序奏视频 / BGM）。
// 本地预览：以仓库根目录为 webroot 启动静态服务器（端口 5500），即可访问 assets/ 下的素材。
// 部署时改成 jsdelivr 等 CDN 地址即可，一行切换，例如：
// 2026-08-28 起 ASSET_BASE 也迁至 tavern_helper_template_cdn（原仓库超 jsDelivr 后端体积上限，
// 新 commit 不再被解析）。开场白 OP 成片（op_desktop / op_mobile）只存在于新仓库；
// 2026-08-31 OP 换新为 84s 剪辑成片（双画幅码率降至 1250k/900k 以符合 jsDelivr 20MB 单文件上限）；
// 同日 hotfix：op_mobile 补回音轨（首版移动转码漏音频流导致手机端 OP 无声，@1b23b9a）。
export const ASSET_BASE = 'https://cdn.jsdelivr.net/gh/qmsdaa/tavern_helper_template_cdn@1b23b9a19763f63966a387d59ea80446b287ddd6/assets/Counterfeit/开场白';

// 状态栏详情立绘 / 状态栏轻量头像 / 手机好友头像（均固定 GitHub commit，不使用漂移分支）。
// 详情立绘为 4K/2K，只有角色弹窗打开后才加载；列表 chip 只加载 512×512 头像。
// 2026-08-28 统一钉到 tavern_helper_template_cdn@35b5f36（含当日 OP 成片 op_desktop/op_mobile、
// 2026-08-23 新拉芙希妮立绘与手机头像迁移；至此四处 base 全部迁出旧仓库）。
export const PORTRAIT_BASE = 'https://cdn.jsdelivr.net/gh/qmsdaa/tavern_helper_template_cdn@35b5f36650e9de0a22de5737fede7700fa8d5c35/assets/Counterfeit/状态栏/portraits';
export const STATUS_AVATAR_BASE = 'https://cdn.jsdelivr.net/gh/qmsdaa/tavern_helper_template_cdn@35b5f36650e9de0a22de5737fede7700fa8d5c35/assets/Counterfeit/状态栏/avatars';
export const AVATAR_BASE = 'https://cdn.jsdelivr.net/gh/qmsdaa/tavern_helper_template_cdn@35b5f36650e9de0a22de5737fede7700fa8d5c35/assets/Counterfeit/手机/avatars';

// 素材版本号：同名文件内容更新后递增（?v= 查询串破浏览器/CDN 缓存）。
// ⚠️ 每次替换 assets 下的图片/音频都要 bump 这个值，否则用户端会继续用缓存旧图。
export const ASSET_VERSION = '20260831b';
