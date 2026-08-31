import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sourcePath = new URL('../世界书/MVU/更新规则.yaml', import.meta.url);
const source = await readFile(sourcePath, 'utf8');

function getvarFor(statData) {
  return (rawPath, options = {}) => {
    let value = { stat_data: statData };
    for (const key of String(rawPath).split('.')) {
      if (value && typeof value === 'object' && key in value) value = value[key];
      else return options.defaults;
    }
    return value === undefined ? options.defaults : value;
  };
}

function render(statData) {
  const tag = /<%_([\s\S]*?)_%>/g;
  let body = "let output = '';\n";
  let cursor = 0;
  for (const match of source.matchAll(tag)) {
    body += `output += ${JSON.stringify(source.slice(cursor, match.index))};\n`;
    body += `${match[1]}\n`;
    cursor = match.index + match[0].length;
  }
  body += `output += ${JSON.stringify(source.slice(cursor))};\nreturn output;`;
  const result = Function('getvar', body)(getvarFor(statData));
  assert.ok(!result.includes('<%_'), 'render left an opening EJS tag');
  assert.ok(!result.includes('_%>'), 'render left a closing EJS tag');
  assert.equal((result.match(/^  world\.current_date:/gm) ?? []).length <= 1, true, 'date rule rendered twice');
  assert.ok(!result.includes('开场白commit'), 'opening commit documentation must not be sent');
  assert.ok(!result.includes('初始关系表'), 'initial relationship table must not be sent');
  return result;
}

function includesAll(text, markers, label) {
  for (const marker of markers) assert.ok(text.includes(marker), `${label} missing ${marker}`);
}

function excludesAll(text, markers, label) {
  for (const marker of markers) assert.ok(!text.includes(marker), `${label} unexpectedly contains ${marker}`);
}

const base = {
  campaign_id: 'main',
  mode: 'pov',
  current_pov: 'hachiman',
  mainline_completed: false,
  branch_choice: null,
  custom_protagonist: null,
};

const main = render(base);
includesAll(main, ['  current_scene:', 'arc_milestones.hachiman.asked_before_self_sacrifice:', 'characters.${规范全名}.present:'], 'main/pov');
excludesAll(main, ['  world.time_slot:', '  identity_state:', '  Ω_resonance:', '  branch_choice:'], 'main/pov');

const scriptedCustom = render({
  ...base,
  mode: 'custom',
  current_pov: null,
  custom_protagonist: { participation: { track: 'member', note: '' } },
});
includesAll(scriptedCustom, ['  current_scene:', '  campaign_completed:'], 'main/custom scripted');
excludesAll(scriptedCustom, ['  world.time_slot:'], 'main/custom scripted');

const legacyCustom = render({ ...base, mode: 'custom', current_pov: null, custom_protagonist: { participation: null } });
includesAll(legacyCustom, ['  world.time_slot:', '  world.current_date:'], 'main/custom free');
excludesAll(legacyCustom, ['  current_scene:', '  campaign_completed:'], 'main/custom free');

const genderbend = render({ ...base, campaign_id: 'dlc_genderbend_hachiman', mode: 'free', current_pov: 'hachiman_f' });
includesAll(genderbend, ['kind 恒为 transformation', '  world.time_slot:', '  campaign_completed:'], 'genderbend/hachiman_f');
excludesAll(genderbend, ['  current_scene:', 'kind 恒为 body_swap'], 'genderbend/hachiman_f');

const genderbendYukino = render({ ...base, campaign_id: 'dlc_genderbend_hachiman', mode: 'free', current_pov: 'yukino' });
excludesAll(genderbendYukino, ['  identity_state:', '  current_scene:'], 'genderbend/yukino');

const bodySwap = render({ ...base, campaign_id: 'dlc_body_swap_mrs_yukinoshita', mode: 'free', current_pov: 'hachiman' });
includesAll(bodySwap, ['kind 恒为 body_swap', 'body_locations 按身体外壳', '  campaign_completed:'], 'body-swap');
excludesAll(bodySwap, ['kind 恒为 transformation', '  current_scene:'], 'body-swap');

const laff = render({ ...base, current_pov: 'laff' });
includesAll(laff, ['  Ω_resonance:', '${hammer_thunder_1|hammer_tea_1'], 'main/laff');

const finale = render({ ...base, mainline_completed: true });
includesAll(finale, ['  branch_choice:', '姐妹和解要求'], 'main/finale pending');

const selectedFinale = render({ ...base, mainline_completed: true, branch_choice: '共同线' });
excludesAll(selectedFinale, ['  branch_choice:'], 'main/finale selected');

assert.ok(source.length < 15_323, `source did not shrink: ${source.length} chars`);
assert.ok(main.length < source.length, 'main rendered prompt should be smaller than source');
assert.ok(genderbendYukino.length < main.length, 'free DLC rendered prompt should be smaller than scripted main');

console.log(JSON.stringify({
  source_chars: source.length,
  main_pov_chars: main.length,
  main_free_chars: legacyCustom.length,
  genderbend_yukino_chars: genderbendYukino.length,
  body_swap_chars: bodySwap.length,
  laff_main_chars: laff.length,
  finale_chars: finale.length,
}, null, 2));
