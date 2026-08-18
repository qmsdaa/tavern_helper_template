import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const statePath = path.join(root, 'tavern-cards-state.json');
const original = fs.readFileSync(statePath, 'utf8');
const state = JSON.parse(original);
const check = process.argv.includes('--check');
const manifest = state.entryManifest;
const campaignGuard = "getvar('stat_data.campaign_id', {defaults: 'main'}) === 'main'";

let scenes = 0;
for (const [key, entry] of Object.entries(manifest['事件'])) {
  const file = entry?.contents?.find?.(item => item?.file)?.file;
  if (typeof file !== 'string' || !file.startsWith('世界书/事件/场景')) continue;
  const condition = entry.contents?.[0]?.content;
  if (typeof condition !== 'string' || !condition.startsWith('@@if ')) throw new Error(`${key} missing condition`);
  if (!condition.includes("stat_data.campaign_id")) {
    entry.contents[0].content = condition.replace('@@if (', `@@if (${campaignGuard} && `);
  }
  if (!entry.contents[0].content.includes(campaignGuard)) throw new Error(`${key} campaign guard migration failed`);
  scenes++;
}
if (scenes !== 150) throw new Error(`expected 150 scenes, got ${scenes}`);

const ejs = manifest['EJS预处理'];
const rebuilt = {};
for (const [key, value] of Object.entries(ejs)) {
  if (key === 'POV分幕滤镜') {
    rebuilt['玩家视点滤镜'] = {
      ...value,
      path: '世界书/EJS预处理/玩家视点滤镜.txt',
      abstract: '按不可变current_pov注入唯一玩家视点观察滤镜；主线才显示场景阶段，DLC不读取事件焦点',
    };
  } else rebuilt[key] = value;
}
rebuilt['存档续接路由'] = {
  path: '世界书/EJS预处理/存档续接路由.txt', keywords: [],
  abstract: '已验证旧档迁移后的首轮续接：从最后可观察时刻继续，不重放旧聊天或任何新战役开局',
  uid: 242, enabled: true, strategy: { type: 'constant' }, position: { type: 'before_character_definition', order: 11 },
};
manifest['EJS预处理'] = rebuilt;

manifest['机制']['DLC_main118_共同快照'] = {
  scope: 'specific', keywords: [], abstract: '两个DLC共享的main:118共同连续性事实，不包含任何玩家意识私有知识',
  contents: [
    { content: "@@if ['dlc_genderbend_hachiman', 'dlc_body_swap_mrs_yukinoshita'].includes(getvar('stat_data.campaign_id', { defaults: 'main' }))" },
    { file: '世界书/剧情/main-118-shared.yaml' },
  ], uid: 243, enabled: true, strategy: { type: 'constant' }, position: { type: 'after_character_definition', order: 198 },
};
manifest['机制']['DLC_main118_八幡意识快照'] = {
  scope: 'specific', keywords: [], abstract: 'main:118八幡玩家意识的私有知识与关系基线，仅八幡稳定意识可见',
  contents: [
    { content: "@@if ['dlc_genderbend_hachiman', 'dlc_body_swap_mrs_yukinoshita'].includes(getvar('stat_data.campaign_id', { defaults: 'main' })) && getvar('stat_data.current_pov', { defaults: null }) === 'hachiman'" },
    { file: '世界书/剧情/main-118-hachiman.yaml' },
  ], uid: 244, enabled: true, strategy: { type: 'constant' }, position: { type: 'after_character_definition', order: 199 },
};
manifest['机制']['DLC_main118_夫人意识快照'] = {
  scope: 'specific', keywords: [], abstract: 'main:118雪之下夫人玩家意识的私有知识与关系基线，仅夫人稳定意识可见',
  contents: [
    { content: "@@if getvar('stat_data.campaign_id', { defaults: 'main' }) === 'dlc_body_swap_mrs_yukinoshita' && getvar('stat_data.current_pov', { defaults: null }) === 'mrs_yukinoshita'" },
    { file: '世界书/剧情/main-118-mrs-yukinoshita.yaml' },
  ], uid: 245, enabled: true, strategy: { type: 'constant' }, position: { type: 'after_character_definition', order: 200 },
};

const uidEntries = [];
for (const group of Object.values(manifest)) for (const entry of Object.values(group)) if (entry && Number.isInteger(entry.uid)) uidEntries.push(entry.uid);
if (new Set(uidEntries).size !== uidEntries.length) throw new Error('duplicate manifest uid');
const next = JSON.stringify(state, null, 2) + '\n';
if (check) {
  if (next !== original) throw new Error('v0.6 manifest migration is stale');
  console.log('v0.6 manifest migration check passed');
} else {
  fs.writeFileSync(statePath, next, 'utf8');
  console.log(`migrated ${scenes} main scene guards; registered player filter, resume route, and 3 isolated snapshots`);
}
