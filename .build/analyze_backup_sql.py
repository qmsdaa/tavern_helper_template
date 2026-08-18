# 一次性分析脚本：枚举真实备份 jsonl 里所有 sql_batch 语句的语法形状，为重放器定界
import json, re, collections, sys

path = sys.argv[1] if len(sys.argv) > 1 else '独立产物/Counterfeit - 2026-08-15@22h51m25s478ms.jsonl'
records = [json.loads(l) for l in open(path, encoding='utf-8') if l.strip()]
print('records:', len(records))

shapes = collections.Counter()
tables = collections.Counter()
kinds = collections.Counter()
where_shapes = collections.Counter()
insert_rowid_shapes = collections.Counter()
log_floors = []
ckpt_floors = []
ddl_samples = {}

for i, rec in enumerate(records):
    if i == 0:
        continue
    iso = rec.get('TavernDB_ACU_IsolatedData')
    if not isinstance(iso, dict):
        continue
    entry = iso.get('')
    if not isinstance(entry, dict):
        entry = next(iter(iso.values()), None)
    if not isinstance(entry, dict):
        continue
    frame = entry.get('storageFrame')
    if not isinstance(frame, dict):
        continue
    ck = frame.get('checkpoint')
    if isinstance(ck, dict) and isinstance(ck.get('data'), dict):
        keys = [k for k in ck['data'] if k.startswith('sheet_')]
        ckpt_floors.append((i, ck.get('kind'), len(keys)))
        # 收集每个 sheet 的 ddl 样本（只看最后一个 checkpoint）
        for k in keys:
            sd = ck['data'][k]
            if isinstance(sd, dict):
                src = sd.get('sourceData')
                ddl = src.get('ddl') if isinstance(src, dict) else None
                if ddl:
                    ddl_samples[k] = (sd.get('name'), ddl[:300])
    for le in frame.get('logEntries') or []:
        log_floors.append(i)
        for op in le.get('operations') or []:
            kinds[op.get('kind')] += 1
            if op.get('kind') != 'sql_batch':
                continue
            for st in op.get('statements') or []:
                st = str(st)
                m = re.match(r"(UPDATE|INSERT(?:\s+OR\s+REPLACE)?)\s+(?:INTO\s+)?[\"'`]?(\w+)", st, re.I)
                if m:
                    shapes[re.sub(r'\s+', ' ', m.group(1).upper())] += 1
                    tables[m.group(2)] += 1
                    wm = re.search(r'\bWHERE\b(.+)$', st, re.I | re.S)
                    if wm:
                        w = ' '.join(wm.group(1).split())
                        wn = re.sub(r"'[^']*'", "'v'", w)
                        wn = re.sub(r'\d+', 'N', wn)
                        where_shapes[wn] += 1
                    rm = re.search(r'\(\s*SELECT\b[^)]*\)', st, re.I)
                    if rm:
                        insert_rowid_shapes[' '.join(rm.group(0).split())] += 1
                else:
                    shapes['UNPARSED: ' + ' '.join(st.split())[:80]] += 1

print('checkpoint floors:', ckpt_floors)
print('log floors:', sorted(set(log_floors)))
print('op kinds:', dict(kinds))
print('statement heads:', dict(shapes))
print('tables touched:', dict(tables))
print('WHERE shapes:')
for k, v in where_shapes.items():
    print('  ', v, '|', k)
print('row_id subquery shapes:')
for k, v in insert_rowid_shapes.items():
    print('  ', v, '|', k)
print()
print('=== ddl samples (sheet -> name, first 300 chars) ===')
for k, (name, ddl) in ddl_samples.items():
    print('---', k, '=', name)
    print(ddl)
