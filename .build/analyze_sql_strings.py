# 深入检查：字符串字面量内是否含单引号转义('')、括号、逗号；INSERT 是否都带列清单
import json, re, collections, sys

path = '独立产物/Counterfeit - 2026-08-15@22h51m25s478ms.jsonl'
records = [json.loads(l) for l in open(path, encoding='utf-8') if l.strip()]

stmts = []
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
    for le in frame.get('logEntries') or []:
        for op in le.get('operations') or []:
            if op.get('kind') == 'sql_batch':
                for st in op.get('statements') or []:
                    stmts.append((i, le.get('seq'), str(st)))

print('total statements:', len(stmts))

esc = 0
no_cols = 0
null_vals = 0
num_vals = 0
samples_multiline = 0
for floor, seq, st in stmts:
    if "''" in st:
        esc += 1
    m = re.match(r"INSERT(?:\s+OR\s+REPLACE)?\s+INTO\s+(\w+)\s*\(", st, re.I)
    if st.upper().startswith('INSERT') and not m:
        no_cols += 1
        print('INSERT without col list?', st[:120])
    if re.search(r'\bNULL\b', st, re.I):
        null_vals += 1
    if '\n' in st:
        samples_multiline += 1

print('statements containing doubled-quote escape:', esc)
print('INSERT without column list:', no_cols)
print('statements mentioning NULL:', null_vals)
print('statements containing real newlines:', samples_multiline)

# 打印每种语句的代表样本（截断）
seen = set()
for floor, seq, st in stmts:
    key = re.match(r"(UPDATE|INSERT(?:\s+OR\s+REPLACE)?)\s+(?:INTO\s+)?(\w+)", st, re.I)
    k = (key.group(1).upper(), key.group(2)) if key else ('?', '?')
    if k in seen:
        continue
    seen.add(k)
    one = ' '.join(st.split())
    print('SAMPLE', floor, seq, k, '=>', one[:160])
