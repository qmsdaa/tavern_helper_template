// 前端工程/tests/prepare-opening.mjs
// 开场白测试准备：把开场白源码复制到 tests/.build-opening/，补全 .ts 扩展名，
// 并把 '../../config' 重写为 './config.ts'（平铺目录）。
// 用法：node tests/prepare-opening.mjs && node --test tests/introVideos.test.ts
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, '.build-opening');

const COPIES = [
  [path.resolve(here, '../src/Counterfeit/界面/开场白/introVideos.ts'), 'introVideos.ts'],
  [path.resolve(here, '../src/Counterfeit/config.ts'), 'config.ts'],
];

function rewrite(text) {
  text = text.replace(/(['"])\.\.\/\.\.\/config\1/g, "'./config.ts'");
  text = text.replace(
    /(import\s+(?:[^'"]*\s+from\s+)?)(['"])(\.\.?\/[^'"]+)(['"])/g,
    (_m, pre, q1, spec, q2) => `${pre}${q1}${spec.endsWith('.ts') || spec.endsWith('.js') ? spec : `${spec}.ts`}${q2}`,
  );
  return text;
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
for (const [src, name] of COPIES) {
  fs.writeFileSync(path.join(outDir, name), rewrite(fs.readFileSync(src, 'utf8')));
}
console.log(`[tests/prepare-opening] ${COPIES.length} 个模块副本已生成`);
