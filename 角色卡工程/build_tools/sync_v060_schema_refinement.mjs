import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const cardRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const projectRoot = path.resolve(cardRoot, '..', '..');
const files = [
  path.join(cardRoot, 'schema.ts'),
  path.join(cardRoot, '脚本', 'Zod.txt'),
  path.join(projectRoot, 'tavern_helper_template', 'src', 'Counterfeit', 'schema.ts'),
];
const check = process.argv.includes('--check');
const stale = [];
const refinement = `.superRefine((stat, ctx) => {
  const issue = (path, message) => ctx.addIssue({ code: 'custom', path, message });
  if (stat.campaign_id === 'main') {
    const mainPovOk = stat.current_pov === null || ['hachiman', 'yukino', 'yui', 'laff'].includes(stat.current_pov);
    if (!mainPovOk) issue(['current_pov'], '主线玩家视点只能是八幡/雪乃/结衣/拉芙或空值');
    if (stat.identity_state !== null) issue(['identity_state'], 'main 战役不得携带 DLC 身份状态');
    if (stat.mainline_completed !== stat.campaign_completed) issue(['mainline_completed'], 'mainline_completed 必须镜像 main 的 campaign_completed');
  } else {
    if (stat.mode !== 'free') issue(['mode'], '开放世界 DLC 必须使用 mode=free');
    if (stat.current_scene !== 1) issue(['current_scene'], '开放世界 DLC 的 current_scene 只能是兼容占位 1');
    if (stat.mainline_completed) issue(['mainline_completed'], 'DLC 不得写入主线完成态');
  }
  if (stat.campaign_id === 'dlc_genderbend_hachiman') {
    const dlcPovOk =
      (stat.current_pov === 'hachiman_f' && stat.identity_state?.kind === 'transformation') ||
      (['yukino', 'yui', 'laff'].includes(stat.current_pov ?? '') && stat.identity_state === null) ||
      (stat.current_pov === null && stat.identity_state === null && stat.custom_protagonist !== null);
    if (!dlcPovOk) issue(['identity_state'], '《错位的日常》身份组合非法：仅 比企谷八幡（性转）/雪乃/结衣/拉芙/自建 五种开局');
  }
  if (stat.campaign_id === 'dlc_body_swap_mrs_yukinoshita') {
    if (!['hachiman', 'mrs_yukinoshita'].includes(stat.current_pov ?? '') || stat.identity_state?.kind !== 'body_swap') issue(['identity_state'], '《君的名字？》身份组合非法');
    else if (stat.identity_state.occupants.body_hachiman === stat.identity_state.occupants.body_mrs_yukinoshita) issue(['identity_state', 'occupants'], '两具身体必须由两个不同意识占据');
  }
})`;

for (const file of files) {
  const original = fs.readFileSync(file, 'utf8');
  let text = original;
  text = text.replace(/; \/\* campaign refinement moved to root Schema below \*\/\r?\n\/\*[\s\S]*?\*\/\r?\n/, ';\n');
  const identityIndex = text.indexOf('const IdentityStateSchema');
  const misplacedStart = text.lastIndexOf('}).superRefine((stat, ctx) => {', identityIndex);
  if (misplacedStart !== -1) {
    const misplacedEnd = text.indexOf('\n});', misplacedStart);
    if (misplacedEnd === -1) throw new Error(`cannot find misplaced refinement end: ${file}`);
    text = text.slice(0, misplacedStart) + '});' + text.slice(misplacedEnd + 4);
  }
  const rootStart = text.indexOf('export const Schema = z.object({');
  const boundary = text.indexOf('export type Schema', rootStart) !== -1
    ? text.indexOf('export type Schema', rootStart)
    : text.indexOf('$(() =>', rootStart);
  if (rootStart === -1 || boundary === -1) throw new Error(`cannot find root Schema boundary: ${file}`);
  // 早期同步器在 Zod.txt 中把 refinement 误接到 `$(() => registerMvuSchema())`
  // 后面。先拆掉这个注册回调后缀，再统一挂到根 Schema。
  const misplacedRegisterRefinement = text.indexOf('}).superRefine((stat, ctx) => {', boundary);
  if (misplacedRegisterRefinement !== -1) {
    const refinementEnd = text.indexOf('\n});', misplacedRegisterRefinement);
    if (refinementEnd === -1) throw new Error(`cannot find register refinement end: ${file}`);
    text = text.slice(0, misplacedRegisterRefinement) + '});' + text.slice(refinementEnd + 4);
  }
  const refreshedBoundary = text.indexOf('export type Schema', rootStart) !== -1
    ? text.indexOf('export type Schema', rootStart)
    : text.indexOf('$(() =>', rootStart);
  const existingRootRefinement = text.indexOf('.superRefine((stat, ctx) => {', rootStart);
  if (existingRootRefinement !== -1 && existingRootRefinement < refreshedBoundary) {
    const refinementEnd = text.indexOf('\n});', existingRootRefinement);
    text = text.slice(0, existingRootRefinement) + text.slice(refinementEnd + 3);
  }
  // 移除旧 refinement 会改变文本长度，边界必须重算；否则 Zod.txt
  // 会误把 registerMvuSchema 的结尾当成 Schema 结尾，并在每次 --check 时漂移空行。
  const finalBoundary = text.indexOf('export type Schema', rootStart) !== -1
    ? text.indexOf('export type Schema', rootStart)
    : text.indexOf('$(() =>', rootStart);
  const rootEnd = text.lastIndexOf('\n});', finalBoundary);
  if (rootEnd === -1) throw new Error(`cannot find root Schema tail: ${file}`);
  text = text.slice(0, rootEnd) + `\n})${refinement};` + text.slice(rootEnd + 4);
  if ((text.match(/\.superRefine\(/g) || []).length !== 1) throw new Error(`unexpected refinement count: ${file}`);
  if (check) {
    if (text !== original) stale.push(path.relative(projectRoot, file));
  } else {
    fs.writeFileSync(file, text, 'utf8');
    console.log(`synced ${path.relative(projectRoot, file)}`);
  }
}
if (check) {
  if (stale.length) throw new Error(`v0.6 schema refinement stale: ${stale.join(', ')}`);
  console.log('v0.6 schema refinement sync check passed');
}
