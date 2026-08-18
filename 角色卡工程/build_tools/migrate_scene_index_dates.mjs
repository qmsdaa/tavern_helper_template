import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const checkOnly = process.argv.includes('--check');
const state = JSON.parse(await readFile(path.join(root, 'tavern-cards-state.json'), 'utf8'));
const scenes = [];

for (const category of Object.values(state.entryManifest)) {
  for (const [name, entry] of Object.entries(category)) {
    if (!/^场景[零一二三四五六七八九十百]+$/u.test(name)) continue;
    const source = (entry.contents ?? []).find((item) => item.file)?.file;
    if (!source) throw new Error(`${name}: missing scene source path`);
    const dateMatch = /[（(](\d{4})\/(\d{1,2})\/(\d{1,2})[）)]/.exec(entry.abstract ?? '');
    if (!dateMatch) throw new Error(`${name}: manifest abstract lacks canonical date`);
    const iso = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`;
    scenes.push({ name, source, iso });
  }
}

if (scenes.length !== 150) throw new Error(`expected 150 registered scenes, got ${scenes.length}`);
let changed = 0;
for (const scene of scenes) {
  const file = path.join(root, ...scene.source.split('/'));
  const text = await readFile(file, 'utf8');
  const existing = /^索引日期:\s*["']?(\d{4}-\d{2}-\d{2})["']?\s*$/m.exec(text);
  if (existing && existing[1] !== scene.iso) {
    throw new Error(`${scene.source}: 索引日期 ${existing[1]} conflicts with registered canonical date ${scene.iso}`);
  }
  if (existing) continue;
  const next = text.replace(/^(时间:.*)$/m, `$1\n索引日期: "${scene.iso}"`);
  if (next === text) throw new Error(`${scene.source}: missing 时间 field`);
  changed += 1;
  if (!checkOnly) await writeFile(file, next, 'utf8');
}

if (checkOnly && changed) throw new Error(`${changed} scenes are missing 索引日期`);
console.log(checkOnly ? 'Scene index date check passed: 150/150' : `Scene index dates migrated: ${changed} files changed`);
