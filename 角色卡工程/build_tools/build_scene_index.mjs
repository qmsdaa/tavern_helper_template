import assert from 'node:assert/strict';
import { access, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const generatedDir = path.join(root, 'generated');
const yamlModuleUrl = new URL('../../../tavern_helper_template/node_modules/yaml/dist/index.js', import.meta.url);

async function loadYaml(text, source) {
  let parse;
  try {
    ({ parse } = await import(yamlModuleUrl.href));
  } catch (error) {
    throw new Error(`无法加载项目 YAML 解析器（${yamlModuleUrl.pathname}）：${error.message}`);
  }
  try {
    return parse(text);
  } catch (error) {
    throw new Error(`${source}: YAML 解析失败：${error.message}`);
  }
}

function unquote(value) {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function getTopScalar(text, key) {
  const match = new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:\\s*(.+?)\\s*$`, 'm').exec(text);
  return match ? unquote(match[1]) : null;
}

function getTopBlock(text, keyPattern) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => new RegExp(`^${keyPattern}:\\s*$`).test(line));
  if (start < 0) return null;
  let end = start + 1;
  while (end < lines.length && (lines[end].trim() === '' || /^\s/.test(lines[end]))) end += 1;
  return lines.slice(start + 1, end);
}

function parseChineseNumber(value) {
  const digits = new Map([
    ['零', 0], ['一', 1], ['二', 2], ['三', 3], ['四', 4], ['五', 5],
    ['六', 6], ['七', 7], ['八', 8], ['九', 9],
  ]);
  if (value === '十') return 10;
  if (value.includes('百')) {
    const [hundreds, rest = ''] = value.split('百');
    return (digits.get(hundreds) ?? 1) * 100 + (rest ? parseChineseNumber(rest) : 0);
  }
  if (value.includes('十')) {
    const [tens, units = ''] = value.split('十');
    return (tens ? digits.get(tens) : 1) * 10 + (units ? digits.get(units) : 0);
  }
  if (!digits.has(value)) throw new Error(`无法解析中文数字：${value}`);
  return digits.get(value);
}

function parseAct(raw, source) {
  const match = /^第([零一二三四五六七八九十百]+)幕/.exec(raw ?? '');
  if (!match) throw new Error(`${source}: 幕字段格式不合法：${raw}`);
  return parseChineseNumber(match[1]);
}

function parseTitle(text, source) {
  const explicit = getTopScalar(text, '标题') ?? getTopScalar(text, 'CG标题');
  if (explicit) return explicit;
  const block = getTopBlock(text, '场景功能');
  const first = block?.find((line) => /^\s+-\s+/.test(line));
  if (!first) throw new Error(`${source}: 缺少标题或场景功能首项`);
  return unquote(first.replace(/^\s+-\s+/, '').trim());
}

function parseEventFocus(text, source) {
  const block = getTopBlock(text, '事件焦点');
  if (!block) throw new Error(`${source}: 缺少事件焦点`);
  const typeRaw = block.map((line) => /^\s+类型:\s*(.+?)\s*$/.exec(line)).find(Boolean)?.[1];
  const type = typeRaw === '角色' ? 'character' : typeRaw === '群像' ? 'ensemble' : null;
  if (!type) throw new Error(`${source}: 事件焦点类型必须是角色或群像`);
  const characters = block
    .map((line) => /^\s+-\s+(.+?)\s*$/.exec(line))
    .filter(Boolean)
    .map((match) => unquote(match[1]));
  if (type === 'character' && characters.length === 0) throw new Error(`${source}: 角色事件焦点不能为空`);
  if (type === 'ensemble' && characters.length > 0) throw new Error(`${source}: 群像事件焦点不应伪装成玩家视点角色列表`);
  const note = block.map((line) => /^\s+说明:\s*(.+?)\s*$/.exec(line)).find(Boolean)?.[1];
  return { type, characters, ...(note ? { note: unquote(note) } : {}) };
}

function parsePlayerRoutes(text, source, allowedPovs) {
  const block = getTopBlock(text, '玩家入口');
  if (!block) throw new Error(`${source}: 缺少玩家入口`);
  const closeGuard = '  # <%_ } _%>';
  // 剧情自建放行条件（state json 门控/场景路由共用同一判定式，改动需三处同步）
  const customCond = 'getvar\\(\'stat_data\\.mode\', \\{ defaults: null \\}\\) === "custom" && getvar\\(\'stat_data\\.custom_protagonist\\.participation\\.track\', \\{ defaults: null \\}\\) !== null';
  const unavailableOpenGuard = new RegExp(`^  # <%_ if \\(!(?<players>\\[[^\\]]+\\])\\.includes\\(getvar\\('stat_data\\.current_pov', \\{ defaults: null \\}\\)\\) && !\\(${customCond}\\)\\) \\{ _%>$`);
  const firstContentIndex = block.findIndex((line) => line.trim());
  const unavailableMatch = unavailableOpenGuard.exec(block[firstContentIndex] ?? '');
  if (!unavailableMatch) throw new Error(`${source}: 玩家入口缺少无异常的 unavailable EJS guard`);
  let guardedPlayers;
  try { guardedPlayers = JSON.parse(unavailableMatch.groups.players); } catch {}
  if (!Array.isArray(guardedPlayers) || guardedPlayers.length !== allowedPovs.length || allowedPovs.some((key) => !guardedPlayers.includes(key))) {
    throw new Error(`${source}: unavailable guard 与 manifest allowed_povs 不一致`);
  }
  const unavailableStart = block.findIndex((line, index) => index > firstContentIndex && line === '  unavailable:');
  const unavailableClose = block.findIndex((line, index) => index > unavailableStart && line === closeGuard);
  const unavailableLines = unavailableStart >= 0 && unavailableClose > unavailableStart
    ? block.slice(unavailableStart + 1, unavailableClose)
    : [];
  if (
    unavailableStart !== firstContentIndex + 1
    || unavailableClose < 0
    || !unavailableLines.some((line) => /^    在场:\s*false\s*$/.test(line))
    || !unavailableLines.some((line) => /^    演绎入口:\s*$/.test(line))
    || !unavailableLines.some((line) => /禁止借用事件焦点/.test(line))
  ) {
    throw new Error(`${source}: unavailable 玩家入口必须阻止剧情且禁止回退事件焦点`);
  }
  if (block.some((line) => /throw new Error/.test(line))) throw new Error(`${source}: 玩家入口运行时不得抛出 EJS 异常`);

  const openGuard = /^  # <%_ if \(getvar\('stat_data\.current_pov', \{ defaults: null \}\) === "(?<key>[a-z_]+)"\) \{ _%>$/;
  const customOpenGuard = new RegExp(`^  # <%_ if \\(${customCond}\\) \\{ _%>$`);
  const routeKeys = [...allowedPovs, 'custom'];
  const matchRouteGuard = (line, key) =>
    key === 'custom' ? customOpenGuard.test(line ?? '') : openGuard.exec(line ?? '')?.groups.key === key;
  const starts = [];
  for (let index = 0; index < block.length; index += 1) {
    const match = /^  ([a-z_]+):\s*$/.exec(block[index]);
    if (match && routeKeys.includes(match[1])) starts.push({ key: match[1], index });
  }
  const routes = {};
  for (let index = 0; index < starts.length; index += 1) {
    const current = starts[index];
    const end = starts[index + 1]?.index ?? block.length;
    if (!matchRouteGuard(block[current.index - 1], current.key)) {
      throw new Error(`${source}: 玩家入口 ${current.key} 缺少匹配的 EJS guard`);
    }
    const closeIndex = block.findIndex((line, lineIndex) => lineIndex > current.index && lineIndex < end && line === closeGuard);
    if (closeIndex < 0) throw new Error(`${source}: 玩家入口 ${current.key} 缺少 EJS guard 闭合`);
    const betweenRoutes = block.slice(closeIndex + 1, end).filter((line) => line.trim());
    if (index + 1 < starts.length) {
      if (betweenRoutes.length !== 1 || !matchRouteGuard(betweenRoutes.at(-1), starts[index + 1].key)) {
        throw new Error(`${source}: 玩家入口 ${current.key} 与下一 guard 边界不闭合`);
      }
    } else if (betweenRoutes.length !== 0) {
      throw new Error(`${source}: 最后一个玩家入口 guard 后存在未受控内容`);
    }
    const lines = block.slice(current.index + 1, closeIndex).map((line) => line.replace(/^ {4}/, '')).filter((line) => line.trim());
    if (Object.hasOwn(routes, current.key)) throw new Error(`${source}: 重复玩家入口 ${current.key}`);
    // custom 路由的"在场"允许 EJS 条件渲染（按参与轨道分派 true/false）；POV 路由必须是布尔字面量
    const presencePattern = current.key === 'custom' ? /^在场:\s*(true|false|<%=)/ : /^在场:\s*(true|false)\s*$/;
    if (!lines.some((line) => presencePattern.test(line))) {
      throw new Error(`${source}: 玩家入口 ${current.key} 缺少在场布尔值`);
    }
    routes[current.key] = lines.join('\n');
  }
  if (Object.keys(routes).length === 0) throw new Error(`${source}: 玩家入口为空`);
  if (starts.at(-1)?.key !== 'custom') throw new Error(`${source}: custom 玩家入口必须位于全部 POV 路由之后`);
  const actualKeys = Object.keys(routes);
  if (actualKeys.length !== routeKeys.length || routeKeys.some((key) => !actualKeys.includes(key))) {
    throw new Error(`${source}: 玩家入口必须完整覆盖 manifest allowed_povs 与 custom 剧情自建路由，禁止回退到事件焦点`);
  }
  return routes;
}

function parseTransition(text, gapDays, source) {
  const block = getTopBlock(text, '转场');
  if (!block) {
    if (gapDays >= 7) throw new Error(`${source}: ${gapDays} 天跨度缺少转场块`);
    return null;
  }
  const scalar = (key) => {
    const match = block.map((line) => new RegExp(`^  ${key}:\\s*(.+?)\\s*$`).exec(line)).find(Boolean);
    return match ? unquote(match[1]) : null;
  };
  const list = (key) => {
    const start = block.findIndex((line) => line === `  ${key}:`);
    if (start < 0) return [];
    const values = [];
    for (let index = start + 1; index < block.length; index += 1) {
      if (/^  [^\s].*:\s*/.test(block[index])) break;
      const match = /^    -\s+(.+?)\s*$/.exec(block[index]);
      if (match) values.push(unquote(match[1]));
    }
    return values;
  };
  const mapping = (key) => {
    const start = block.findIndex((line) => line === `  ${key}:`);
    if (start < 0) return {};
    const values = {};
    for (let index = start + 1; index < block.length; index += 1) {
      if (/^  [^\s].*:\s*/.test(block[index])) break;
      const match = /^    ([^:]+):\s*(.+?)\s*$/.exec(block[index]);
      if (match) values[match[1].trim()] = unquote(match[2]);
    }
    return values;
  };
  const structured = (key) => {
    const listValues = list(key);
    return listValues.length > 0 ? listValues : mapping(key);
  };
  const mode = scalar('mode');
  if (!['none', 'date_only', 'authored'].includes(mode)) throw new Error(`${source}: 转场 mode 不合法：${mode}`);
  const max = scalar('max_model_sentences');
  const transition = {
    mode,
    visible_title: scalar('visible_title'),
    visible_lines: list('visible_lines'),
    established_changes: list('established_changes'),
    stable_facts: list('stable_facts'),
    player_observation: structured('player_observation'),
    unresolved: list('unresolved'),
    max_model_sentences: max == null ? null : Number(max),
  };
  if (gapDays >= 21 && mode !== 'authored') throw new Error(`${source}: ${gapDays} 天跨度必须使用 authored 转场`);
  if (!transition.visible_title || transition.visible_lines.length === 0) throw new Error(`${source}: 转场缺少玩家可见标题或正文`);
  if (!Number.isInteger(transition.max_model_sentences) || transition.max_model_sentences < 1 || transition.max_model_sentences > 4) {
    throw new Error(`${source}: max_model_sentences 必须是 1 至 4 的整数`);
  }
  if (mode === 'authored') {
    for (const field of ['established_changes', 'stable_facts', 'unresolved']) {
      if (transition[field].length === 0) throw new Error(`${source}: authored 转场缺少 ${field}`);
    }
    if (Object.keys(transition.player_observation).length === 0) throw new Error(`${source}: authored 转场缺少 player_observation`);
  }
  return transition;
}

function daysBetween(previous, current) {
  return Math.round((Date.parse(`${current}T00:00:00Z`) - Date.parse(`${previous}T00:00:00Z`)) / 86_400_000);
}

export function selectPlayerRoute(scene, currentPov) {
  const route = scene.player_routes?.[currentPov];
  if (!route) throw new Error(`${scene.id}: 玩家视点 ${currentPov} 没有对应玩家入口`);
  return {
    event_focus: scene.event_focus,
    current_player_route: route,
  };
}

export function renderGuardedSceneForTest(text, currentPov, source = 'scene') {
  const allowedPovs = ['hachiman', 'yukino', 'yui', 'laff'];
  const routes = parsePlayerRoutes(text, source, allowedPovs);
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => line === '玩家入口:');
  let end = start + 1;
  while (end < lines.length && (lines[end].trim() === '' || /^\s/.test(lines[end]))) end += 1;
  let selectedKey = currentPov;
  let selected = routes[currentPov];
  if (!selected) {
    selectedKey = 'unavailable';
    const block = lines.slice(start + 1, end);
    const unavailableStart = block.findIndex((line) => line === '  unavailable:');
    const unavailableClose = block.findIndex((line, index) => index > unavailableStart && line === '  # <%_ } _%>');
    if (unavailableStart < 0 || unavailableClose < 0) throw new Error(`${source}: 缺少 unavailable 玩家入口`);
    selected = block.slice(unavailableStart + 1, unavailableClose).map((line) => line.replace(/^ {4}/, '')).filter((line) => line.trim()).join('\n');
  }
  const rendered = ['玩家入口:', `  ${selectedKey}:`, ...selected.split('\n').map((line) => `    ${line}`)];
  lines.splice(start, end - start, ...rendered);
  return lines.join('\n');
}

export async function buildArtifacts() {
  const registryPath = path.join(root, '世界书', '剧情', 'campaigns.yaml');
  const registry = await loadYaml(await readFile(registryPath, 'utf8'), path.relative(root, registryPath));
  assert.equal(registry?.schema_version, 1, 'campaign registry schema_version must be 1');
  assert.ok(registry?.campaigns && typeof registry.campaigns === 'object', 'campaign registry is missing campaigns');

  // 章节一句话概要：仅供玩家侧界面（手机章节列表）对未到达场景显示，防剧透；
  // 属于构建期输入，不进世界书，不进模型侧 render lookup。
  const teaserPath = path.join(root, '世界书', '剧情', 'scene-teasers.yaml');
  const teaserSource = await loadYaml(await readFile(teaserPath, 'utf8'), path.relative(root, teaserPath));
  assert.equal(teaserSource?.schema_version, 1, 'scene teasers schema_version must be 1');
  assert.ok(teaserSource?.campaigns && typeof teaserSource.campaigns === 'object', 'scene teasers is missing campaigns');

  const campaignIds = Object.keys(registry.campaigns);
  assert.equal(new Set(campaignIds).size, campaignIds.length, 'duplicate campaign ids');
  const sceneRecords = [];

  for (const [campaignId, campaign] of Object.entries(registry.campaigns)) {
    assert.ok(campaign.title, `${campaignId}: title is required`);
    assert.ok(Number.isInteger(campaign.revision) && campaign.revision > 0, `${campaignId}: revision must be positive`);
    assert.ok(Array.isArray(campaign.allowed_povs) && campaign.allowed_povs.length > 0, `${campaignId}: allowed_povs are required`);

    if (campaign.campaign_type === 'open_world') {
      for (const field of ['timeline_anchor', 'start_date', 'opening_route', 'premise_entry']) {
        assert.ok(campaign[field], `${campaignId}: ${field} is required for open_world`);
      }
      assert.equal(campaign.forced_mode, 'free', `${campaignId}: open_world forced_mode must be free`);
      assert.match(campaign.start_date, /^\d{4}-\d{2}-\d{2}$/, `${campaignId}: start_date must be ISO`);
      assert.ok(!('total_scenes' in campaign), `${campaignId}: open_world must not define total_scenes`);
      continue;
    }

    assert.equal(campaign.campaign_type, 'scripted', `${campaignId}: unknown campaign_type`);
    assert.ok(Number.isInteger(campaign.total_scenes) && campaign.total_scenes > 0, `${campaignId}: total_scenes is required`);
    assert.ok(campaign.scene_dir, `${campaignId}: scene_dir is required`);
    const sceneDir = path.join(root, ...campaign.scene_dir.split('/'));
    const files = (await readdir(sceneDir)).filter((name) => /^场景.+\.yaml$/u.test(name));
    const parsed = [];
    for (const file of files) {
      const source = path.posix.join(campaign.scene_dir, file);
      const text = await readFile(path.join(sceneDir, file), 'utf8');
      const number = Number(getTopScalar(text, '场景'));
      if (!Number.isInteger(number) || number < 1) throw new Error(`${source}: 场景编号不合法`);
      const date = getTopScalar(text, '索引日期');
      if (!date) throw new Error(`${source}: 缺少索引日期`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
        throw new Error(`${source}: 索引日期不是合法 ISO 日期：${date}`);
      }
      const routes = parsePlayerRoutes(text, source, campaign.allowed_povs);
      const routeKeys = Object.keys(routes);
      assert.deepEqual([...routeKeys].sort(), [...campaign.allowed_povs, 'custom'].sort(), `${source}: 玩家入口必须覆盖 manifest allowed_povs 与 custom 剧情自建路由`);
      parsed.push({
        id: `${campaignId}:${number}`,
        campaign_id: campaignId,
        number,
        date,
        act: parseAct(getTopScalar(text, '幕'), source),
        title: parseTitle(text, source),
        event_focus: parseEventFocus(text, source),
        player_route_keys: [...campaign.allowed_povs],
        player_routes: routes,
        source,
        cg_ids: [],
      });
    }
    parsed.sort((a, b) => a.number - b.number);
    assert.equal(parsed.length, campaign.total_scenes, `${campaignId}: scene total mismatch`);
    assert.deepEqual(parsed.map((scene) => scene.number), Array.from({ length: campaign.total_scenes }, (_, i) => i + 1), `${campaignId}: scenes must be contiguous`);

    const teasers = teaserSource.campaigns[campaignId];
    assert.ok(teasers && typeof teasers === 'object', `${campaignId}: scene-teasers.yaml 缺少该战役的一句话概要`);
    assert.deepEqual(
      Object.keys(teasers).map(Number).sort((a, b) => a - b),
      Array.from({ length: campaign.total_scenes }, (_, i) => i + 1),
      `${campaignId}: teaser 必须逐场覆盖 1..${campaign.total_scenes}，不多不少`,
    );
    for (const scene of parsed) {
      const teaser = typeof teasers[scene.number] === 'string' ? teasers[scene.number].trim() : '';
      assert.ok(teaser.length >= 8 && teaser.length <= 60, `${scene.source}: teaser 长度 ${teaser.length} 超出 8..60`);
      assert.ok(!teaser.includes('\n'), `${scene.source}: teaser 必须是单行一句话`);
      assert.notEqual(teaser, scene.title, `${scene.source}: teaser 不得与防剧透对象（完整标题）相同`);
      assert.ok(!/[★🔨⛈🍵🔥🧸Ω]/.test(teaser) && !/HAMMER/i.test(teaser), `${scene.source}: teaser 泄漏设计标记`);
      scene.teaser = teaser;
    }

    const previousIndexPath = path.join(generatedDir, 'scene-index.json');
    let previousIds = [];
    try {
      previousIds = JSON.parse(await readFile(previousIndexPath, 'utf8')).scenes
        .filter((scene) => scene.campaign_id === campaignId)
        .map((scene) => scene.id);
    } catch {}
    const currentIds = new Set(parsed.map((scene) => scene.id));
    const aliases = campaign.save_migration_aliases ?? {};
    for (const oldId of previousIds.filter((id) => !currentIds.has(id))) {
      assert.ok(aliases[oldId] && currentIds.has(aliases[oldId]), `${campaignId}: removed scene ${oldId} lacks a valid save migration alias`);
    }

    for (let index = 0; index < parsed.length; index += 1) {
      const current = parsed[index];
      const previous = parsed[index - 1];
      const next = parsed[index + 1];
      const gapDays = previous ? daysBetween(previous.date, current.date) : null;
      if (gapDays != null && gapDays < 0 && !/^\s*回溯:\s*true\s*$/m.test(await readFile(path.join(root, ...current.source.split('/')), 'utf8'))) {
        throw new Error(`${current.source}: 日期倒退 ${previous.date} -> ${current.date}，且未声明回溯: true`);
      }
      const sourceText = await readFile(path.join(root, ...current.source.split('/')), 'utf8');
      const transition = gapDays == null ? null : parseTransition(sourceText, gapDays, current.source);
      Object.assign(current, {
        previous_id: previous?.id ?? null,
        next_id: next?.id ?? null,
        gap_days: gapDays,
        transition_id: gapDays != null && gapDays >= 7 ? `${previous.id}>${current.number}` : null,
        transition,
      });
    }
    sceneRecords.push(...parsed);
  }

  const ids = sceneRecords.map((scene) => scene.id);
  assert.equal(new Set(ids).size, ids.length, 'scene ids must be unique');
  const sceneIdSet = new Set(ids);
  const cgSourcePath = path.join(root, '世界书', '剧情', 'cg-manifest.yaml');
  const cgSource = await loadYaml(await readFile(cgSourcePath, 'utf8'), path.relative(root, cgSourcePath));
  assert.equal(cgSource.schema_version, 2, 'CG source manifest schema_version must be 2');
  const cgSceneIds = new Set();
  for (const item of cgSource.items ?? []) {
    const sceneId = `main:${Number(item.scene)}`;
    assert.ok(sceneIdSet.has(sceneId), `CG source references unknown scene: ${sceneId}`);
    assert.ok(!cgSceneIds.has(sceneId), `CG source duplicates scene: ${sceneId}`);
    cgSceneIds.add(sceneId);
    sceneRecords.find((scene) => scene.id === sceneId).cg_ids.push(`${sceneId}:default`);
  }
  for (const [campaignId, campaign] of Object.entries(registry.campaigns)) {
    if (campaign.campaign_type !== 'open_world') continue;
    assert.ok(sceneIdSet.has(campaign.timeline_anchor), `${campaignId}: timeline_anchor does not resolve`);
    const premisePath = path.join(root, ...campaign.premise_entry.split('/'));
    try {
      await access(premisePath);
    } catch {
      throw new Error(`${campaignId}: premise_entry does not resolve: ${campaign.premise_entry}`);
    }
  }

  const snapshotSourcePath = path.join(root, '世界书', '剧情', 'main-118-snapshot.yaml');
  const snapshot = await loadYaml(await readFile(snapshotSourcePath, 'utf8'), path.relative(root, snapshotSourcePath));
  assert.equal(snapshot.snapshot_id, 'main:118', 'snapshot id must be main:118');
  assert.equal(snapshot.through_scene, 118, 'snapshot through_scene must be 118');
  assert.ok(snapshot.shared_world_facts, 'snapshot shared_world_facts are required');
  assert.ok(snapshot.player_snapshots?.hachiman, 'snapshot hachiman baseline is required');
  assert.ok(snapshot.player_snapshots?.mrs_yukinoshita, 'snapshot Mrs. Yukinoshita baseline is required');
  assert.ok(snapshot.source_scenes.every((number) => Number.isInteger(number) && number <= 118), 'snapshot source scenes must not pass scene 118');

  const publicScenes = sceneRecords.map(({ player_routes: _privateRoutes, ...scene }) => scene);
  const renderLookup = Object.fromEntries(sceneRecords.map((scene) => [scene.id, {
    event_focus: scene.event_focus,
    player_routes: scene.player_routes,
  }]));
  const index = { schema_version: 1, generated_from: '世界书/剧情/campaigns.yaml', scenes: publicScenes };
  const campaigns = { schema_version: registry.schema_version, campaigns: registry.campaigns };
  const ts = `// Generated by build_tools/build_scene_index.mjs. Do not edit.\nexport const campaignRegistry = ${JSON.stringify(registry.campaigns)} as const;\nexport const sceneIndex = ${JSON.stringify(publicScenes)} as const;\n`;

  return new Map([
    [path.join(generatedDir, 'campaigns.json'), `${JSON.stringify(campaigns, null, 2)}\n`],
    [path.join(generatedDir, 'scene-index.json'), `${JSON.stringify(index, null, 2)}\n`],
    [path.join(generatedDir, 'scene-index.ts'), ts],
    [path.join(generatedDir, 'scene-render-lookup.json'), `${JSON.stringify({ schema_version: 1, scenes: renderLookup }, null, 2)}\n`],
    [path.join(generatedDir, 'campaign-snapshots', 'main-118.json'), `${JSON.stringify(snapshot, null, 2)}\n`],
  ]);
}

export async function run({ check = false } = {}) {
  const artifacts = await buildArtifacts();
  if (check) {
    const stale = [];
    for (const [file, expected] of artifacts) {
      let actual = null;
      try { actual = await readFile(file, 'utf8'); } catch {}
      if (actual !== expected) stale.push(path.relative(root, file));
    }
    if (stale.length) throw new Error(`generated scene artifacts are stale or missing: ${stale.join(', ')}`);
    console.log(`Scene index check passed: ${artifacts.size} generated artifacts are current`);
    return;
  }

  for (const [file, content] of artifacts) {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, content, 'utf8');
  }
  console.log(`Scene index generated: ${artifacts.size} artifacts`);
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  await run({ check: process.argv.includes('--check') });
}
