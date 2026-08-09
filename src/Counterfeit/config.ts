// 素材根路径（立绘 / film 帧 / BGM）。
// 本地预览：以仓库根目录为 webroot 启动静态服务器（端口 5500），即可访问 assets/ 下的素材。
// 部署时改成 jsdelivr 等 CDN 地址即可，一行切换，例如：
export const ASSET_BASE = 'https://cdn.jsdelivr.net/gh/qmsdaa/tavern_helper_template@0e601ca2dbb529a160e5b18bae8709c674895134/assets/Counterfeit/开场白';

// 状态栏详情立绘 / 状态栏轻量头像 / 手机好友头像（均固定 GitHub commit，不使用漂移分支）。
// 详情立绘为 4K/2K，只有角色弹窗打开后才加载；列表 chip 只加载 512×512 头像。
export const PORTRAIT_BASE = 'https://cdn.jsdelivr.net/gh/qmsdaa/tavern_helper_template@9ac59a466f6795072f712c47e41f043c263be98d/assets/Counterfeit/状态栏/portraits';
export const STATUS_AVATAR_BASE = 'https://cdn.jsdelivr.net/gh/qmsdaa/tavern_helper_template@9ac59a466f6795072f712c47e41f043c263be98d/assets/Counterfeit/状态栏/avatars';
export const AVATAR_BASE = 'https://cdn.jsdelivr.net/gh/qmsdaa/tavern_helper_template@8a916d6/assets/Counterfeit/手机/avatars';

// 素材版本号：同名文件内容更新后递增（?v= 查询串破浏览器/CDN 缓存）。
// ⚠️ 每次替换 assets 下的图片/音频都要 bump 这个值，否则用户端会继续用缓存旧图。
export const ASSET_VERSION = '20260806b';
