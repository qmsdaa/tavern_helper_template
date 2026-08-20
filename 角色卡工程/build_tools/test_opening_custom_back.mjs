import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const openingDir = path.join(here, '..', '..', '前端工程', 'src', 'Counterfeit', '界面', '开场白');
const storeSource = readFileSync(path.join(openingDir, 'store.ts'), 'utf8');
const customFormSource = readFileSync(path.join(openingDir, 'CustomForm.vue'), 'utf8');

test('自建角色返回交给 store 按入口决定目的屏', () => {
  assert.match(customFormSource, /@click="store\.backFromCustom\(\)"/);
  assert.doesNotMatch(customFormSource, /@click="store\.backToMode\(\)"/);

  const action = storeSource.match(/function backFromCustom\(\)\s*\{([\s\S]*?)\n\s*\}/)?.[1] || '';
  assert.match(action, /campaignId\.value === 'dlc_genderbend_hachiman'/);
  assert.match(action, /dlcPov\.value === 'custom'/);
  assert.match(action, /step\.value = 'dlc_setup'/);
  assert.match(action, /step\.value = 'mode'/);
  assert.match(storeSource, /return\s*\{[\s\S]*\bbackFromCustom\b/);
});
