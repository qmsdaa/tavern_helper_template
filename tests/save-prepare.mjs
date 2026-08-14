import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const out = path.join(here, '.save-build');
const rewrite = text => text.replace(/(from\s+['"])(\.\.?\/[^'"]+)(['"])/g, (_m, a, spec, b) => `${a}${/\.[cm]?[jt]s$/.test(spec) ? spec : `${spec}.ts`}${b}`);

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, '存档'), { recursive: true });
const schema = fs.readFileSync(path.join(root, 'src', 'Counterfeit', 'schema.ts'), 'utf8');
fs.writeFileSync(path.join(out, 'schema.ts'), `import { z } from 'zod';\nimport _ from 'lodash';\n${schema}`);
for (const name of ['types.ts', 'migrationLedger.ts', 'parseChatExport.ts', 'migrations.ts', 'portableSave.ts', 'resumeCommit.ts']) {
  const source = fs.readFileSync(path.join(root, 'src', 'Counterfeit', '存档', name), 'utf8');
  fs.writeFileSync(path.join(out, '存档', name), rewrite(source));
}
console.log('[save-prepare] portable save modules prepared');
