import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const cardRoot = path.resolve(here, '..');
const projectRoot = path.resolve(cardRoot, '..', '..');
const helperRoot = path.join(projectRoot, 'tavern_helper_template');
const helperRequire = createRequire(path.join(helperRoot, 'package.json'));
const { parseDocument } = helperRequire('yaml');

const read = file => fs.readFileSync(file, 'utf8');
const card = relative => read(path.join(cardRoot, relative));
const project = relative => read(path.join(projectRoot, relative));
const helper = relative => read(path.join(helperRoot, relative));

const planningText = card('创作规划.yaml');
const planningDoc = parseDocument(planningText, { prettyErrors: true });
assert.deepEqual(planningDoc.errors, [], `创作规划.yaml 解析失败：\n${planningDoc.errors.join('\n')}`);
assert.match(planningText, /mode: pov \| custom \| free/, '创作规划的模式结构必须包含 free');
assert.doesNotMatch(planningText, /五人_日程/, '已删除的五人日程条目不得继续留在创作规划');

const completionFiles = [
  ['创作规划.yaml', card('创作规划.yaml')],
  ['schema.ts', card('schema.ts')],
  ['世界书/变量/initvar.yaml', card(path.join('世界书', '变量', 'initvar.yaml'))],
  ['世界书/MVU/更新规则.yaml', card(path.join('世界书', 'MVU', '更新规则.yaml'))],
  ['世界书/MVU/输出格式.yaml', card(path.join('世界书', 'MVU', '输出格式.yaml'))],
  ['世界书/EJS预处理/EJS预处理.txt', card(path.join('世界书', 'EJS预处理', 'EJS预处理.txt'))],
  ['脚本/Zod.txt', card(path.join('脚本', 'Zod.txt'))],
  ['前端 schema.ts', helper(path.join('src', 'Counterfeit', 'schema.ts'))],
  ['开场白 store.ts', helper(path.join('src', 'Counterfeit', '界面', '开场白', 'store.ts'))],
];
for (const [name, text] of completionFiles) {
  assert.match(text, /mainline_completed/, `${name} 缺少 mainline_completed`);
}

const openingStore = helper(path.join('src', 'Counterfeit', '界面', '开场白', 'store.ts'));
assert.doesNotMatch(openingStore, /updateWorldbookWith\s*\(/, '开场白不得按聊天修改共享世界书 enabled 状态');
assert.doesNotMatch(openingStore, /getWorldbook\s*\(/, '开场白不应读取世界书后执行每聊天切换');

const state = JSON.parse(card('tavern-cards-state.json'));
assert.equal(state.version, '0.5.1', '角色卡内部版本必须为 0.5.1');
assert.match(state.creator_notes, /^v0\.5\.1\b/, 'creator_notes 必须标明 v0.5.1');

for (const relative of ['AGENTS.md', 'CLAUDE.md', path.join('docs', '权威', '项目规则.md')]) {
  const text = project(relative);
  assert.match(text, /卡工程规划.*`创作规划\.yaml`/, `${relative} 仍未指向创作规划.yaml`);
  assert.doesNotMatch(text, /`故事规划\.yaml`/, `${relative} 仍引用不存在的故事规划.yaml`);
}
const authority = project(path.join('docs', '权威', 'README.md'));
assert.match(authority, /世界书 226 条/, '权威 README 的世界书条目数必须为 226');
assert.doesNotMatch(authority, /故事规划\.yaml/, '权威 README 仍引用不存在的故事规划.yaml');

console.log('v0.5.1 contracts: PASS');

