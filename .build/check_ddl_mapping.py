# 校验：checkpoint 里每个 sheet 的 content[0] 表头 与 sourceData.ddl 注释 的映射是否可解析
import json, re, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

path = '独立产物/Counterfeit - 2026-08-15@22h51m25s478ms.jsonl'
records = [json.loads(l) for l in open(path, encoding='utf-8') if l.strip()]

ckpt = None
for i in range(len(records) - 1, 0, -1):
    rec = records[i]
    iso = rec.get('TavernDB_ACU_IsolatedData')
    if not isinstance(iso, dict):
        continue
    entry = iso.get('')
    if not isinstance(entry, dict):
        entry = next(iter(iso.values()), None)
    frame = (entry or {}).get('storageFrame') or {}
    ck = frame.get('checkpoint')
    if isinstance(ck, dict) and isinstance(ck.get('data'), dict) and any(k.startswith('sheet_') for k in ck['data']):
        ckpt = (i, ck['data'])
        break

floor, data = ckpt
print('checkpoint floor:', floor)
out = []
for key in sorted(k for k in data if k.startswith('sheet_')):
    sd = data[key]
    if not isinstance(sd, dict):
        continue
    src = sd.get('sourceData') or {}
    ddl = src.get('ddl') or ''
    content = sd.get('content') or []
    header = content[0] if content else []
    eng_map = {}
    tbl = None
    tm = re.search(r"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[\"'`]?(\w+)", ddl, re.I)
    if tm:
        tbl = tm.group(1)
    for line in ddl.split('\n'):
        cm = re.match(r'^\s*"?([A-Za-z_]\w*)"?\s+[A-Z]+', line)
        cmt = re.search(r'--\s*(.+?)\s*$', line)
        if cm and cmt and cm.group(1).upper() not in ('PRIMARY', 'FOREIGN', 'UNIQUE', 'CHECK', 'CONSTRAINT', 'CREATE'):
            eng_map[cm.group(1)] = cmt.group(1)
    # 解析校验
    unresolved = []
    for eng, zh in eng_map.items():
        if eng in header or zh in header:
            continue
        fuzzy = [h for h in header if isinstance(h, str) and (h.startswith(zh) or zh.startswith(h))]
        if not fuzzy:
            unresolved.append((eng, zh))
    out.append((key, sd.get('name'), tbl, len(content) - 1, header, eng_map, unresolved))

for key, name, tbl, nrows, header, eng_map, unresolved in out:
    status = 'OK' if not unresolved else 'UNRESOLVED: ' + str(unresolved)
    print(f'{key} | {name} | table={tbl} | rows={nrows} | {status}')
    print('   header:', header)
    if unresolved:
        print('   eng_map:', eng_map)
