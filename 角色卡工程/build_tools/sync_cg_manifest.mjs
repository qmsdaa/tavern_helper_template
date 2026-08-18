import { copyFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const frontendProject = path.resolve(root, '..', '..', 'tavern_helper_template');
const frontendRoot = path.join(frontendProject, 'src', 'Counterfeit', 'generated');
const check = process.argv.includes('--check');
const pairs = [
  [path.join(root, 'generated', 'cg-manifest.generated.ts'), path.join(frontendRoot, 'cg-manifest.generated.ts')],
  [path.join(root, 'generated', 'cg-unlock.generated.ts'), path.join(frontendRoot, 'cg-unlock.generated.ts')],
  [path.join(root, 'generated', 'cg-manifest.json'), path.join(frontendProject, 'assets', 'Counterfeit', 'CG', 'cg-manifest.json')],
];

if (check) {
  const stale = [];
  for (const [source, target] of pairs) {
    let left = null;
    let right = null;
    try { left = await readFile(source, 'utf8'); } catch {}
    try { right = await readFile(target, 'utf8'); } catch {}
    if (left !== right) stale.push(path.relative(root, target));
  }
  if (stale.length) throw new Error(`official frontend CG data is stale or missing: ${stale.join(', ')}`);
  console.log('Official frontend CG manifest sync check passed');
} else {
  for (const [source, target] of pairs) {
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(source, target);
  }
  console.log(`Official frontend CG data synchronized to ${frontendRoot}`);
}
