import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const readbackRoot = process.argv[2]
  ? path.resolve(root, process.argv[2])
  : path.join(root, '.build', 'readback-20260805');
const pairs = [
  {
    name: 'opening',
    source: path.join(root, '脚本', '开场白挂载.js'),
    readback: path.join(readbackRoot, '脚本', '开场白挂载.txt'),
    markers: ['<div id="app"></div>', ".mount('#app')", '新的游戏', 'counterfeit-opening'],
  },
  {
    name: 'statusbar',
    source: path.join(root, '脚本', '状态栏挂载.js'),
    readback: path.join(readbackRoot, '脚本', '状态栏挂载.txt'),
    markers: ['<div id="app"></div>', 'latest_user_memory', 'current_location'],
  },
];

function inspectEmbedded(file, markers) {
  const script = fs.readFileSync(file, 'utf8');
  new Function(script);
  const match = script.match(/const EMBEDDED_HTML_B64 = '([A-Za-z0-9+/=]+)'/);
  if (!match) throw new Error(`${file}: embedded payload missing`);
  const html = Buffer.from(match[1], 'base64').toString('utf8');
  for (const marker of markers) {
    if (!html.includes(marker)) throw new Error(`${file}: HTML marker missing: ${marker}`);
  }
  if (script.includes('fetch(CDN_URL)')) throw new Error(`${file}: runtime CDN fetch remains`);
  if (script.includes('</script>')) throw new Error(`${file}: raw closing script tag remains`);
  return { script, html };
}

function normalizeNewlines(value) {
  return value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

const report = {};
for (const pair of pairs) {
  const source = inspectEmbedded(pair.source, pair.markers);
  const readback = inspectEmbedded(pair.readback, pair.markers);
  if (normalizeNewlines(source.script).trimEnd() !== normalizeNewlines(readback.script).trimEnd()) {
    throw new Error(`${pair.name}: packed readback script differs from source`);
  }
  if (source.html !== readback.html) {
    throw new Error(`${pair.name}: packed readback HTML differs from source`);
  }
  if (pair.name === 'opening') {
    const remoteScript = /<script\b[^>]*\bsrc\s*=\s*["']https?:\/\//i;
    const remoteModule = /\b(?:from\s*|import\s*\()\s*["']https?:\/\//i;
    if (remoteScript.test(source.html)) throw new Error('opening: remote script runtime dependency remains');
    if (remoteModule.test(source.html)) throw new Error('opening: remote module-import runtime dependency remains');
  }
  report[pair.name] = {
    script_bytes: Buffer.byteLength(source.script),
    html_bytes: Buffer.byteLength(source.html),
    packed_readback_exact: true,
    syntax_ok: true,
    runtime_cdn_fetch: false,
    ...(pair.name === 'opening' ? { external_execution_modules: false } : {}),
  };
}

console.log(JSON.stringify(report, null, 2));
