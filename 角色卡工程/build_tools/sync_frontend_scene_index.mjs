import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const cardRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const frontendRoot = process.argv[2]
  ? resolve(process.argv[2])
  : resolve(cardRoot, '..', '..', 'tavern_helper_template');
const source = resolve(cardRoot, 'generated', 'scene-index.ts');
const target = resolve(frontendRoot, 'src', 'Counterfeit', 'generated', 'scene-index.ts');

await mkdir(dirname(target), { recursive: true });
await copyFile(source, target);
console.log(`scene index synced: ${source} -> ${target}`);
