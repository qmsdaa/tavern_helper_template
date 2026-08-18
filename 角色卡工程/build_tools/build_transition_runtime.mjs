import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const indexPath = path.join(root, 'generated', 'scene-index.json');
const templatePath = path.join(root, '脚本', '状态栏挂载.template.js');
const predicatePath = path.join(root, 'build_tools', 'transition_runtime_predicate.mjs');
const GUARD_START = '# TRANSITION_RUNTIME_GUARD_START ';
const GUARD_END = '# TRANSITION_RUNTIME_GUARD_END ';
const PREDICATE_START = '  /* TRANSITION_RUNTIME_PREDICATE_GENERATED_START */';
const PREDICATE_END = '  /* TRANSITION_RUNTIME_PREDICATE_GENERATED_END */';
const CARDS_START = '  /* TRANSITION_CARDS_GENERATED_START */';
const CARDS_END = '  /* TRANSITION_CARDS_GENERATED_END */';

function replaceGeneratedBlock(text, startMarker, endMarker, body, source) {
  const start = text.indexOf(startMarker);
  const end = text.indexOf(endMarker);
  if (start < 0 || end < 0 || end < start) throw new Error(`${source}: missing generated block markers`);
  const bodyStart = start + startMarker.length;
  return `${text.slice(0, bodyStart)}\n${body}\n${text.slice(end)}`;
}

export async function buildTransitionCards() {
  const index = JSON.parse(await readFile(indexPath, 'utf8'));
  const scenes = (index.scenes ?? []).filter((scene) => scene.campaign_id === 'main' && scene.transition);
  if (scenes.length !== 37) throw new Error(`expected 37 transition scenes, found ${scenes.length}`);
  const cards = {};
  for (const scene of scenes) {
    const transition = scene.transition;
    if (!scene.transition_id || !transition.visible_title || !Array.isArray(transition.visible_lines) || transition.visible_lines.length === 0) {
      throw new Error(`${scene.id}: incomplete transition runtime data`);
    }
    cards[String(scene.number)] = {
      id: scene.transition_id,
      campaign_id: scene.campaign_id,
      from_scene: Number(scene.previous_id.split(':')[1]),
      to_scene: scene.number,
      gap_days: scene.gap_days,
      visible_title: transition.visible_title,
      visible_lines: transition.visible_lines,
    };
  }
  return cards;
}

function renderGuard(sceneNumber, sceneId, transitionLines) {
  const suffix = String(sceneNumber);
  const skippedLine = `  skipped_scene_count: "<%= __cfTransitionSkipped${suffix} %>"`;
  return [
    `${GUARD_START}${sceneId}`,
    `# <%_ const __cfTransitionTarget${suffix} = ${sceneNumber}; _%>`,
    `# <%_ const __cfTransitionCurrentScene${suffix} = Number(getvar('stat_data.current_scene', { defaults: 1 })); _%>`,
    `# <%_ const __cfTransitionCurrentCampaign${suffix} = getvar('stat_data.campaign_id', { defaults: 'main' }); _%>`,
    `# <%_ let __cfTransitionMessages${suffix} = []; _%>`,
    `# <%_ try { const __cfTransitionLastId${suffix} = typeof getLastMessageId === 'function' ? getLastMessageId() : 0; __cfTransitionMessages${suffix} = getChatMessages('0-' + __cfTransitionLastId${suffix}, { role: 'assistant', include_swipes: false }) || []; } catch (error) { __cfTransitionMessages${suffix} = []; } _%>`,
    `# <%_ const __cfTransitionSnapshots${suffix} = (Array.isArray(__cfTransitionMessages${suffix}) ? __cfTransitionMessages${suffix} : []).map(item => item && item.data && item.data.stat_data).filter(Boolean); _%>`,
    `# <%_ const __cfTransitionPrevious${suffix} = __cfTransitionSnapshots${suffix}.length ? __cfTransitionSnapshots${suffix}[__cfTransitionSnapshots${suffix}.length - 1] : null; _%>`,
    `# <%_ const __cfTransitionPreviousScene${suffix} = Number(__cfTransitionPrevious${suffix} && __cfTransitionPrevious${suffix}.current_scene); _%>`,
    `# <%_ const __cfTransitionPreviousCampaign${suffix} = (__cfTransitionPrevious${suffix} && __cfTransitionPrevious${suffix}.campaign_id) || 'main'; _%>`,
    `# <%_ const __cfTransitionSkipped${suffix} = Math.max(0, __cfTransitionCurrentScene${suffix} - __cfTransitionPreviousScene${suffix} - 1); _%>`,
    `# <%_ const __cfTransitionExpose${suffix} = __cfTransitionCurrentCampaign${suffix} === 'main' && __cfTransitionPreviousCampaign${suffix} === 'main' && __cfTransitionCurrentScene${suffix} === __cfTransitionTarget${suffix} && Number.isInteger(__cfTransitionPreviousScene${suffix}) && __cfTransitionPreviousScene${suffix} < __cfTransitionCurrentScene${suffix}; _%>`,
    `# <%_ if (__cfTransitionExpose${suffix}) { _%>`,
    transitionLines[0],
    skippedLine,
    ...transitionLines.slice(1),
    '# <%_ } _%>',
    `${GUARD_END}${sceneId}`,
  ];
}

export function buildGuardedScene(text, sceneNumber, sceneId, source = sceneId) {
  const newline = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(/\r?\n/);
  const transitionIndex = lines.findIndex((line) => line === '转场:');
  if (transitionIndex < 0) throw new Error(`${source}: missing transition block`);

  let transitionEnd = transitionIndex + 1;
  while (transitionEnd < lines.length && (lines[transitionEnd].trim() === '' || /^\s/.test(lines[transitionEnd]))) transitionEnd += 1;
  const transitionLines = lines
    .slice(transitionIndex, transitionEnd)
    .filter((line) => !/^  skipped_scene_count:/.test(line));

  const expectedStart = `${GUARD_START}${sceneId}`;
  const expectedEnd = `${GUARD_END}${sceneId}`;
  const markerStart = lines.lastIndexOf(expectedStart, transitionIndex);
  const replaceStart = markerStart >= 0 ? markerStart : transitionIndex;
  const markerEnd = lines.indexOf(expectedEnd, transitionEnd);
  let replaceEnd = transitionEnd;
  if (markerEnd >= 0) replaceEnd = markerEnd + 1;
  else if (lines[transitionEnd] === '# <%_ } _%>') replaceEnd = transitionEnd + 1;

  lines.splice(replaceStart, replaceEnd - replaceStart, ...renderGuard(sceneNumber, sceneId, transitionLines));
  return lines.join(newline);
}

export async function renderTemplate(template, cards) {
  const predicate = (await readFile(predicatePath, 'utf8'))
    .replace(/^export\s+/gm, '')
    .trim()
    .split(/\r?\n/)
    .map((line) => `  ${line}`)
    .join('\n');
  const cardsSource = `  const TRANSITION_CARDS = ${JSON.stringify(cards, null, 2).replace(/\n/g, '\n  ')};`;
  const withPredicate = replaceGeneratedBlock(template, PREDICATE_START, PREDICATE_END, predicate, '状态栏挂载.template.js');
  return replaceGeneratedBlock(withPredicate, CARDS_START, CARDS_END, cardsSource, '状态栏挂载.template.js');
}

export async function buildRuntimeArtifacts() {
  const cards = await buildTransitionCards();
  const artifacts = new Map();
  const index = JSON.parse(await readFile(indexPath, 'utf8'));
  for (const scene of index.scenes.filter((item) => item.campaign_id === 'main' && item.transition)) {
    const file = path.join(root, ...scene.source.split('/'));
    const actual = await readFile(file, 'utf8');
    artifacts.set(file, buildGuardedScene(actual, scene.number, scene.id, scene.source));
  }
  const template = await readFile(templatePath, 'utf8');
  artifacts.set(templatePath, await renderTemplate(template, cards));
  return artifacts;
}

export async function run({ check = false } = {}) {
  const artifacts = await buildRuntimeArtifacts();
  if (check) {
    const stale = [];
    for (const [file, expected] of artifacts) {
      const actual = await readFile(file, 'utf8');
      if (actual !== expected) stale.push(path.relative(root, file));
    }
    if (stale.length) throw new Error(`transition runtime artifacts are stale: ${stale.join(', ')}`);
    console.log(`Transition runtime check passed: 37 scene guards + statusbar template are current`);
    return;
  }
  for (const [file, content] of artifacts) await writeFile(file, content, 'utf8');
  console.log(`Transition runtime generated: 37 scene guards + statusbar template`);
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) await run({ check: process.argv.includes('--check') });
