import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sceneDir = path.join(root, '世界书', '事件');
const checkOnly = process.argv.includes('--check');

function unquote(value) {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function quote(value) {
  return JSON.stringify(value);
}

const PLAYER_NAMES = {
  hachiman: '比企谷八幡',
  yukino: '雪之下雪乃',
  yui: '由比滨结衣',
  laff: '拉芙希妮·都柏林',
};

function blockEnd(lines, start) {
  let end = start + 1;
  while (end < lines.length && (lines[end].trim() === '' || /^\s/.test(lines[end]))) end += 1;
  return end;
}

function ensureCompletePlayerRoutes(text, file) {
  const lines = text.split(/\r?\n/);
  const routeStart = lines.findIndex((line) => line === '玩家入口:');
  if (routeStart < 0) throw new Error(`${file}: missing 玩家入口`);
  const routeEnd = blockEnd(lines, routeStart);
  const castLine = lines.find((line) => /^人物:\s*/.test(line)) ?? '';
  const parallelStart = lines.findIndex((line) => line === 'POV平行动向:');
  const parallelEnd = parallelStart < 0 ? -1 : blockEnd(lines, parallelStart);
  const parallel = {};
  if (parallelStart >= 0) {
    for (const line of lines.slice(parallelStart + 1, parallelEnd)) {
      const match = /^  ([a-z_]+):\s*(.+?)\s*$/.exec(line);
      if (match) parallel[match[1]] = unquote(match[2]);
    }
  }

  const routeLines = lines.slice(routeStart + 1, routeEnd);
  const starts = [];
  for (let index = 0; index < routeLines.length; index += 1) {
    const match = /^  ([a-z_]+):\s*$/.exec(routeLines[index]);
    if (match) starts.push({ key: match[1], index });
  }
  const existing = new Set(starts.map((item) => item.key));
  const insertions = [];
  for (let index = 0; index < starts.length; index += 1) {
    const current = starts[index];
    const end = starts[index + 1]?.index ?? routeLines.length;
    const body = routeLines.slice(current.index + 1, end);
    if (!body.some((line) => /^    演绎入口:\s*$/.test(line))) {
      const fallback = parallel[current.key] ?? '依据共同场景事实与玩家控制边界进入。';
      insertions.push({ index: routeStart + 1 + end, lines: ['    演绎入口:', `      - ${quote(fallback)}`] });
    }
  }
  for (const [key, fullName] of Object.entries(PLAYER_NAMES)) {
    if (existing.has(key)) continue;
    const fallback = parallel[key] ?? '依据共同场景事实与玩家控制边界进入。';
    insertions.push({
      index: routeEnd,
      lines: [
        `  ${key}:`,
        `    在场: ${castLine.includes(fullName)}`,
        '    演绎入口:',
        `      - ${quote(fallback)}`,
      ],
    });
  }
  insertions.sort((a, b) => b.index - a.index);
  for (const insertion of insertions) lines.splice(insertion.index, 0, ...insertion.lines);
  return lines.join('\n');
}

function ensurePlayerRouteGuards(text, file) {
  const lines = text.split(/\r?\n/);
  const routeStart = lines.findIndex((line) => line === '玩家入口:');
  if (routeStart < 0) throw new Error(`${file}: missing 玩家入口`);
  const routeEnd = blockEnd(lines, routeStart);
  const routeLines = lines.slice(routeStart + 1, routeEnd);
  const expectedPlayers = Object.keys(PLAYER_NAMES);
  const existingGuardCount = routeLines.filter((line) => /^  # <%_ if \(getvar\('stat_data\.current_pov'/.test(line)).length;
  const unavailableGuard = [
    `  # <%_ if (!${JSON.stringify(expectedPlayers)}.includes(getvar('stat_data.current_pov', { defaults: null }))) { _%>`,
    '  unavailable:',
    '    在场: false',
    '    演绎入口:',
    `      - ${quote('当前玩家视点尚未初始化。禁止借用事件焦点或其他角色入口继续剧情；只提醒玩家返回开场重新选择视点，或读取包含合法玩家视点的存档。')}`,
    '  # <%_ } _%>',
  ];
  if (existingGuardCount > 0) {
    if (existingGuardCount !== expectedPlayers.length) throw new Error(`${file}: incomplete player-route EJS guards`);
    const legacyFailureIndex = routeLines.findIndex((line) => /^  # <%_ if \(!\[[^\]]+\]\.includes\(getvar\('stat_data\.current_pov', \{ defaults: null \}\)\)\) \{ throw new Error\(.+\); \} _%>$/.test(line));
    const unavailableIndex = routeLines.findIndex((line) => /^  # <%_ if \(!\[[^\]]+\]\.includes\(getvar\('stat_data\.current_pov', \{ defaults: null \}\)\)\) \{ _%>$/.test(line));
    if (legacyFailureIndex >= 0) {
      lines.splice(routeStart + 1 + legacyFailureIndex, 1, ...unavailableGuard);
      return lines.join('\n');
    }
    if (unavailableIndex >= 0) return text;
    throw new Error(`${file}: missing graceful unavailable player-route guard`);
  }

  const starts = [];
  for (let index = 0; index < routeLines.length; index += 1) {
    const match = /^  ([a-z_]+):\s*$/.exec(routeLines[index]);
    if (match) starts.push({ key: match[1], index });
  }
  const actualPlayers = starts.map((item) => item.key);
  if (actualPlayers.length !== expectedPlayers.length || expectedPlayers.some((key) => !actualPlayers.includes(key))) {
    throw new Error(`${file}: player routes must contain exactly ${expectedPlayers.join(', ')}`);
  }

  const guarded = [...unavailableGuard];
  for (let index = 0; index < starts.length; index += 1) {
    const current = starts[index];
    const end = starts[index + 1]?.index ?? routeLines.length;
    guarded.push(`  # <%_ if (getvar('stat_data.current_pov', { defaults: null }) === ${quote(current.key)}) { _%>`);
    guarded.push(...routeLines.slice(current.index, end));
    guarded.push('  # <%_ } _%>');
  }
  lines.splice(routeStart + 1, routeEnd - routeStart - 1, ...guarded);
  return lines.join('\n');
}

function migrate(text, file) {
  const lines = text.split(/\r?\n/);
  const output = [];
  let mainFocusCount = 0;
  let routeCount = 0;
  let legacyCameraCount = 0;

  for (const line of lines) {
    const focusMatch = /^主场POV:\s*(.+?)\s*$/.exec(line);
    if (focusMatch) {
      mainFocusCount += 1;
      const raw = unquote(focusMatch[1]);
      const shared = raw.startsWith('共享场景／零POV');
      output.push('事件焦点:');
      output.push(`  类型: ${shared ? '群像' : '角色'}`);
      output.push('  角色:');
      if (shared) {
        output.push('    []');
        const detail = raw.replace(/^共享场景／零POV(?:[（(](.*)[）)])?$/, '$1').trim();
        if (detail && detail !== raw) output.push(`  说明: ${quote(detail)}`);
      } else {
        for (const character of raw.split('×').map((item) => item.trim()).filter(Boolean)) {
          output.push(`    - ${quote(character)}`);
        }
      }
      continue;
    }

    if (/^POV适配(?:（.*）)?:\s*$/.test(line)) {
      routeCount += 1;
      output.push('玩家入口:');
      continue;
    }

    const compactRouteMatch = /^POV适配:\s*(.+?)\s*$/.exec(line);
    if (compactRouteMatch) {
      routeCount += 1;
      const note = unquote(compactRouteMatch[1]);
      output.push('玩家入口:');
      for (const player of ['hachiman', 'yukino', 'yui', 'laff']) {
        output.push(`  ${player}:`);
        output.push('    在场: true');
        output.push('    演绎入口:');
        output.push(`      - ${quote(`${note}；从该玩家的POV平行动向与玩家控制边界进入。`)}`);
      }
      continue;
    }

    const cameraMatch = /^POV:\s*(.+?)\s*$/.exec(line);
    if (cameraMatch) {
      legacyCameraCount += 1;
      output.push(`场景呈现参考: ${cameraMatch[1]}`);
      continue;
    }

    const annotatedPresenceMatch = /^(    在场:)\s*(true|false)(.+?)\s*$/.exec(line);
    if (annotatedPresenceMatch) {
      output.push(`${annotatedPresenceMatch[1]} ${annotatedPresenceMatch[2]}`);
      const note = annotatedPresenceMatch[3]
        .replace(/^★/, '本场重点；')
        .replace(/^[（(]|[）)]$/g, '')
        .trim();
      if (note) output.push(`    在场说明: ${quote(note)}`);
      continue;
    }

    output.push(line);
  }

  if (mainFocusCount > 1 || routeCount > 1 || legacyCameraCount > 1) {
    throw new Error(`${file}: duplicate legacy viewpoint fields`);
  }
  const complete = ensureCompletePlayerRoutes(output.join('\n'), file);
  return { text: ensurePlayerRouteGuards(complete, file), mainFocusCount, routeCount, legacyCameraCount };
}

const files = (await readdir(sceneDir)).filter((name) => /^场景.+\.yaml$/u.test(name)).sort((a, b) => a.localeCompare(b, 'zh-CN'));
if (files.length !== 150) throw new Error(`expected 150 scene files, got ${files.length}`);

let changed = 0;
let migratedFocus = 0;
let migratedRoutes = 0;
let migratedCamera = 0;
for (const name of files) {
  const file = path.join(sceneDir, name);
  const source = await readFile(file, 'utf8');
  const result = migrate(source, name);
  migratedFocus += result.mainFocusCount;
  migratedRoutes += result.routeCount;
  migratedCamera += result.legacyCameraCount;
  if (result.text !== source) {
    changed += 1;
    if (!checkOnly) await writeFile(file, result.text, 'utf8');
  }
}

if (checkOnly && changed) {
  throw new Error(`${changed} scene files still use legacy viewpoint fields`);
}

console.log(
  checkOnly
    ? `Scene viewpoint migration check passed: ${files.length} files are canonical`
    : `Scene viewpoint migration complete: ${changed} files changed, ${migratedFocus} event focuses, ${migratedRoutes} player routes, ${migratedCamera} legacy camera hints preserved`,
);
