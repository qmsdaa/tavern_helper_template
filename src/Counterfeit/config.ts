// 素材根路径（立绘 / film 帧 / BGM）。
// 本地预览：以仓库根目录为 webroot 启动静态服务器（端口 5500），即可访问 assets/ 下的素材。
// 部署时改成 jsdelivr 等 CDN 地址即可，一行切换，例如：
export const ASSET_BASE = 'https://testingcf.jsdelivr.net/gh/qmsdaa/tavern_helper_template@20615ae2329f126eac6694ee8d96fd230e91d732/assets/Counterfeit/开场白';
// export const ASSET_BASE = 'https://testingcf.jsdelivr.net/gh/qmsdaa/tavern_helper_template@20615ae2329f126eac6694ee8d96fd230e91d732/assets/Counterfeit/开场白';

// 状态栏立绘 / 手机好友头像素材根路径（28be4d1 提交引入，jsdelivr @commit pin）
export const PORTRAIT_BASE = 'https://testingcf.jsdelivr.net/gh/qmsdaa/tavern_helper_template@28be4d1936d5492a5f490a52b83433a77ad3e16a/assets/Counterfeit/状态栏/portraits';
export const AVATAR_BASE = 'https://testingcf.jsdelivr.net/gh/qmsdaa/tavern_helper_template@28be4d1936d5492a5f490a52b83433a77ad3e16a/assets/Counterfeit/手机/avatars';

// 素材版本号：同名文件内容更新后递增（?v= 查询串破浏览器/CDN 缓存）。
// ⚠️ 每次替换 assets 下的图片/音频都要 bump 这个值，否则用户端会继续用缓存旧图。
export const ASSET_VERSION = '20260802b';
