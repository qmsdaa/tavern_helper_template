// 排查 3 条未命中 UPDATE：是数据漂移还是解析偏差
import fs from 'node:fs';

const path = '独立产物/Counterfeit - 2026-08-15@22h51m25s478ms.jsonl';
const records = fs.readFileSync(path, 'utf8').split(/\r?\n/).filter(l => l.trim()).map(l => JSON.parse(l));

for (const floor of [15, 21, 23]) {
  const rec = records[floor];
  const iso = rec.TavernDB_ACU_IsolatedData;
  const entry = iso[''] ?? Object.values(iso)[0];
  const frame = entry.storageFrame;
  console.log('=== jsonl line', floor, '===');
  for (const le of frame.logEntries ?? []) {
    for (const op of le.operations ?? []) {
      for (const st of op.statements ?? []) {
        const s = String(st);
        if (/^UPDATE (romance_targets|relationship_networks|world_map_points)/.test(s)) {
          console.log(' ', s.slice(0, 200));
        }
      }
    }
  }
}

// 对照：重放完后 romance_targets / relationship_networks / world_map_points 各行 key 值
import { reconstructAcuSheetData } from '../前端工程/tests/.save-build/存档/acuTables.ts';
const result = reconstructAcuSheetData(records);
const rt = result.data.sheet_romance_targets.content;
console.log('\nromance_targets 姓名列:', rt.slice(1).map(r => JSON.stringify(r[1])));
const fn = result.data.sheet_factions.content;
console.log('relationship_networks 网络名称列:', fn.slice(1).map(r => JSON.stringify(r[1])));
const wm = result.data.sheet_world_map.content;
console.log('world_map_points 详细地点列:', wm.slice(1).map(r => JSON.stringify(r[1])));
