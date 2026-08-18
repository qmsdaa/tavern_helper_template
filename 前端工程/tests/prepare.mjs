// 测试准备脚本：把手机源码复制到 tests/.build/，并把相对导入补全 .ts 扩展名，
// 让 node --test（Node 原生 TS type-stripping）可以直接加载。
// 用法：node tests/prepare.mjs && node --test tests/.build/*.test.ts
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(here, '../src/Counterfeit/界面/手机');
const outDir = path.join(here, '.build');

const REWRITE_KEYS = [
  // import x from './y'  /  import './y'
  [/(import\s+(?:[^'"]*\s+from\s+)?)(['"])(\.\.?\/[^'"]+)(['"])/g, (_m, pre, q1, spec, q2) => {
    const normalized = spec.endsWith('.ts') || spec.endsWith('.js') ? spec : `${spec}.ts`;
    return `${pre}${q1}${normalized}${q2}`;
  }],
  // export { ... } from './y'
  [/(export\s+[^'"]*?\s+from\s+)(['"])(\.\.?\/[^'"]+)(['"])/g, (_m, pre, q1, spec, q2) => {
    const normalized = spec.endsWith('.ts') || spec.endsWith('.js') ? spec : `${spec}.ts`;
    return `${pre}${q1}${normalized}${q2}`;
  }],
];

function rewrite(text) {
  for (const [re, fn] of REWRITE_KEYS) {
    text = text.replace(re, fn);
  }
  return text;
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const PHONE_MODULES = [
  'phoneData.ts',
  'backup.ts',
  'mainlineBridge.ts',
  'persistence.ts',
  'shujuku.ts',
  'settings.ts',
  'vars.ts',
  'phoneLlm.ts',
];
let copied = 0;
for (const file of PHONE_MODULES) {
  const src = path.join(srcDir, file);
  if (!fs.existsSync(src)) continue;
  fs.writeFileSync(path.join(outDir, file), rewrite(fs.readFileSync(src, 'utf8')));
  copied += 1;
}

// 测试文件留在 tests/ 目录（其导入形如 './.build/xxx.ts'），.build 只放改写后的模块副本
const testFiles = fs.readdirSync(here).filter(f => f.endsWith('.test.ts'));
console.log(`[tests/prepare] ${copied} 个模块副本已生成（${testFiles.length} 个测试留在 tests/）`);
