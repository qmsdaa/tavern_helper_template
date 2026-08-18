// 一次性验证：用真实备份 jsonl 跑 reconstructAcuSheetData，对照重放前后的行数与关键单元格
import fs from 'node:fs';
import { reconstructAcuSheetData, extractCheckpointSheetData } from '../前端工程/tests/.save-build/存档/acuTables.ts';

const path = '独立产物/Counterfeit - 2026-08-15@22h51m25s478ms.jsonl';
const records = fs.readFileSync(path, 'utf8').split(/\r?\n/).filter(l => l.trim()).map(l => JSON.parse(l));

const before = extractCheckpointSheetData(records);
const result = reconstructAcuSheetData(records);

if (!result) {
  console.log('FAIL: reconstruct returned null');
  process.exit(1);
}

console.log('checkpointFloor(jsonl line):', result.checkpointFloor);
console.log('replayedLogs:', result.replayedLogs, ' replayedStatements:', result.replayedStatements);
console.log('warnings(' + result.warnings.length + '):');
for (const w of result.warnings) console.log('  -', w);

console.log('\nsheet rows (before -> after):');
const after = result.data;
for (const key of Object.keys(after).filter(k => k.startsWith('sheet_')).sort()) {
  const a = after[key]?.content?.length - 1;
  const b = before?.[key]?.content?.length - 1;
  const mark = a !== b ? '  <== changed' : '';
  console.log(`  ${key} (${after[key]?.name}): ${b} -> ${a}${mark}`);
}

// 抽查：chronicle 应有 19 行（1 + 18 层日志各插 1 条 AM 码）
const chronicle = after.sheet_summary?.content ?? [];
console.log('\nchronicle 末行 row_id/code:', chronicle[chronicle.length - 1]?.slice(0, 2));
console.log('chronicle 全部编码:', chronicle.slice(1).map(r => r[1]).join(','));

// 抽查：check_suggestions 应保持 5 行（INSERT OR REPLACE 覆盖），展示文本=最后一层的内容
const suggestions = after.sheet_bwxtt33d5?.content ?? [];
console.log('\ncheck_suggestions rows:', suggestions.length - 1);
console.log('check_suggestions 首行:', suggestions[1]?.slice(0, 2));

// 抽查：romance_diary 行数 = 1 + 8 = 9
const diary = after.sheet_romance_diary?.content ?? [];
console.log('\nromance_diary rows:', diary.length - 1, '(expect 9)');

// 抽查：global_state 当前时间应是最末层 UPDATE 的值
const global_ = after.sheet_global_data?.content ?? [];
console.log('global_state:', JSON.stringify(global_[1]));
