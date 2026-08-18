// shujuku(SP·数据库/ACU) 表格在 SillyTavern chat_metadata 里的存储键。
// 数据本体：TavernDB_ACU_InternalSheetGuide.tags[tag].data.sheet_*（name/content 二维数组）
// 结构配置：TavernDB_ACU_ScopedConfig（模板/归档）
// 另有 <键名>__chatId 两个绑定标记，值为所属聊天 ID——迁移时必须改写为新聊天 ID，故提取时不携带。
// sqlite/消息持久化模式（插件 commit 模型）下，chat_metadata 的 guide 只含模板表头，
// 真实数据行写在聊天楼层消息的 TavernDB_ACU_IsolatedData[''].storageFrame.checkpoint.data
// （插件格式：mate + sheet_*）。迁移时两者都要提取。
export const ACU_METADATA_KEYS = ['TavernDB_ACU_InternalSheetGuide', 'TavernDB_ACU_ScopedConfig'] as const;
export const ACU_CHAT_ID_SUFFIX = '__chatId';
/** 便携存档/迁移容器内携带"插件运行时快照（checkpoint.data）"的键（非酒馆 metadata 键） */
export const ACU_SHEET_DATA_KEY = 'TavernDB_ACU_SheetData';

/** 从 chat_metadata 提取 ACU 表格相关键（深拷贝隔离引用）；一个都没有返回 null */
export function extractAcuTables(meta: Record<string, any> | null | undefined): Record<string, unknown> | null {
  if (!meta || typeof meta !== 'object') return null;
  const out: Record<string, unknown> = {};
  for (const key of ACU_METADATA_KEYS) {
    const value = meta[key];
    if (value && typeof value === 'object') out[key] = JSON.parse(JSON.stringify(value));
  }
  return Object.keys(out).length ? out : null;
}

/**
 * 提取 ACU 表格元数据：chat_metadata 优先，缺失的键回退读 chat[0] 顶层字段
 * （旧酒馆版本把 Guide 存在首条消息而非 chat_metadata，与插件 getChatSheetGuideContainer_ACU 兼容口径一致）。
 */
export function extractAcuTablesFromHeader(records: unknown[]): Record<string, unknown> | null {
  if (!Array.isArray(records)) return null;
  const meta = (records[0] as Record<string, any> | null | undefined)?.chat_metadata;
  const primary = extractAcuTables(meta);
  const legacy = extractAcuTables(records[0] as Record<string, any> | null | undefined);
  if (!legacy) return primary;
  if (!primary) return legacy;
  return { ...legacy, ...primary };
}

/**
 * 从聊天楼层消息提取最新的 storageFrame.checkpoint.data（插件格式，含 mate + sheet_* 数据行）。
 * 倒序扫描取最后一个带表格数据的快照；chat[0] 是头不计入。
 */
export function extractCheckpointSheetData(records: unknown[]): Record<string, unknown> | null {
  if (!Array.isArray(records)) return null;
  for (let i = records.length - 1; i >= 1; i -= 1) {
    const record = records[i] as Record<string, any> | null | undefined;
    if (!record || typeof record !== 'object') continue;
    const isolated = record.TavernDB_ACU_IsolatedData;
    if (!isolated || typeof isolated !== 'object') continue;
    const entry =
      typeof isolated[''] === 'object' && isolated[''] !== null
        ? isolated['']
        : (Object.values(isolated as Record<string, unknown>)[0] as Record<string, any> | undefined);
    const frame = entry?.storageFrame;
    const data = frame?.checkpoint?.data;
    if (!data || typeof data !== 'object') continue;
    if (Object.keys(data).some(key => key.startsWith('sheet_'))) {
      return JSON.parse(JSON.stringify(data));
    }
  }
  return null;
}

/** 统计表格数量（guide tags 与 checkpoint 快照两者取其一，checkpoint 优先） */
export function countAcuSheets(tables: Record<string, unknown> | null | undefined): number {
  const snapshot = tables?.[ACU_SHEET_DATA_KEY] as Record<string, unknown> | undefined;
  if (snapshot && typeof snapshot === 'object') {
    return Object.keys(snapshot).filter(key => key.startsWith('sheet_')).length;
  }
  const guide = tables?.TavernDB_ACU_InternalSheetGuide as { tags?: Record<string, { data?: Record<string, unknown> }> } | undefined;
  if (!guide?.tags) return 0;
  let count = 0;
  for (const tag of Object.values(guide.tags)) {
    if (tag?.data) count += Object.keys(tag.data).filter(key => key.startsWith('sheet_')).length;
  }
  return count;
}

/* ===== V2 消息持久化模型：checkpoint + sql_batch 日志重放 =====
 * 用户的 shujuku 运行在消息持久化（commit）模式：楼层消息的
 * TavernDB_ACU_IsolatedData[''].storageFrame 里，最近的 full checkpoint 才是全量，
 * 其后楼层只携带 logEntries(sql_batch 增量)。直接取 checkpoint 得到的是旧状态，
 * 必须自 checkpoint 楼层（含，与插件 loadTableStateFromFramesV2_ACU 的 >= 边界一致）
 * 按 seq 升序重放全部日志，才能得到当前表数据。
 * 语法边界（对真实存档逐条枚举，2026-08-17，共 143 条）：
 *   UPDATE t SET col = v [, ...] WHERE row_id = N | col = 'v' | col IN ('v', ...)
 *   INSERT INTO t (cols) VALUES (...)[, (...)]        —— 必带列清单
 *   INSERT OR REPLACE INTO t (cols) VALUES (...), (...)  —— 可含真实换行
 *   值仅三种：'字符串'(支持 '' 转义) / 数字 / row_id 子查询
 *     (SELECT MAX(row_id)+1 FROM t) 或 (SELECT COALESCE(MAX(row_id), 0) + 1 FROM t)
 *   观测中无 NULL 字面量，仍按可解析处理。
 * 任何超出边界的语句：记 warning 并跳过，绝不抛错中断迁移（部分导入优于不导入）。
 */

type AcuSqlValue = { kind: 'str' | 'num'; value: string | number } | { kind: 'null' } | { kind: 'nextRowId' };
interface AcuWhere { col: string; op: 'eq' | 'in'; values: AcuSqlValue[] }
interface AcuSheetRuntime {
  sheetKey: string;
  table: string;
  header: unknown[];
  rows: unknown[][];
  colIndex: Record<string, number>;
  sheet: Record<string, any>;
}

const ACU_ROWID_SUBQUERY =
  /^\(\s*SELECT\s+(?:COALESCE\s*\(\s*MAX\s*\(\s*row_id\s*\)\s*,\s*0\s*\)|MAX\s*\(\s*row_id\s*\))\s*\+\s*1\s+FROM\s+["'`]?\w+["'`]?\s*\)$/i;
const ACU_DDL_SKIP_WORDS = /^(PRIMARY|FOREIGN|UNIQUE|CHECK|CONSTRAINT|CREATE|REFERENCES)$/i;

function acuSkipWs(s: string, i: number): number {
  while (i < s.length && /\s/.test(s[i])) i += 1;
  return i;
}

/** 引号/括号感知地前进：在字符串内跳过（处理 '' 转义），返回结束位置 */
function acuSkipQuoted(s: string, i: number): number {
  // 调用时 s[i] === "'"
  i += 1;
  while (i < s.length) {
    if (s[i] === "'") {
      if (s[i + 1] === "'") { i += 2; continue; }
      return i + 1;
    }
    i += 1;
  }
  return i; // 未闭合：容忍，走到末尾
}

/** 读取一个 SQL 值；失败返回 null */
function acuReadValue(s: string, i: number): { value: AcuSqlValue; next: number } | null {
  i = acuSkipWs(s, i);
  const ch = s[i];
  if (ch === "'") {
    let j = i + 1;
    let out = '';
    while (j < s.length) {
      if (s[j] === "'") {
        if (s[j + 1] === "'") { out += "'"; j += 2; continue; }
        return { value: { kind: 'str', value: out }, next: j + 1 };
      }
      out += s[j];
      j += 1;
    }
    return null;
  }
  if (ch === '(') {
    let depth = 0;
    let j = i;
    while (j < s.length) {
      const c = s[j];
      if (c === "'") { j = acuSkipQuoted(s, j); continue; }
      if (c === '(') depth += 1;
      else if (c === ')') {
        depth -= 1;
        if (depth === 0) { j += 1; break; }
      }
      j += 1;
    }
    if (depth !== 0) return null;
    const text = s.slice(i, j);
    if (ACU_ROWID_SUBQUERY.test(text)) return { value: { kind: 'nextRowId' }, next: j };
    return null; // 其他表达式超出语法边界
  }
  const rest = s.slice(i);
  const nullMatch = rest.match(/^NULL(?![A-Za-z0-9_])/i);
  if (nullMatch) return { value: { kind: 'null' }, next: i + 4 };
  const numMatch = rest.match(/^-?\d+(?:\.\d+)?/);
  if (numMatch) return { value: { kind: 'num', value: Number(numMatch[0]) }, next: i + numMatch[0].length };
  return null;
}

/** 按顶层逗号切分（字符串/括号感知） */
function acuSplitTopLevel(s: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === "'") { i = acuSkipQuoted(s, i); continue; }
    if (c === '(') depth += 1;
    else if (c === ')') depth -= 1;
    else if (c === ',' && depth === 0) {
      parts.push(s.slice(start, i));
      start = i + 1;
    }
    i += 1;
  }
  parts.push(s.slice(start));
  return parts.map(part => part.trim()).filter(part => part.length > 0);
}

/** 找顶层关键字位置（不在字符串/括号内，词边界完整）；找不到返回 -1 */
function acuFindTopLevelKeyword(s: string, keyword: string): number {
  const kw = keyword.toUpperCase();
  const isWordChar = (c: string | undefined) => !!c && /[A-Za-z0-9_]/.test(c);
  let depth = 0;
  for (let i = 0; i <= s.length - kw.length; i += 1) {
    const c = s[i];
    if (c === "'") { i = acuSkipQuoted(s, i) - 1; continue; }
    if (c === '(') { depth += 1; continue; }
    if (c === ')') { depth -= 1; continue; }
    if (depth !== 0) continue;
    if (s.slice(i, i + kw.length).toUpperCase() !== kw) continue;
    if (!isWordChar(s[i - 1]) && !isWordChar(s[i + kw.length])) return i;
  }
  return -1;
}

function acuParseWhere(s: string): AcuWhere | null {
  const text = s.trim().replace(/;+\s*$/, '');
  const inMatch = text.match(/^["'`]?(\w+)["'`]?\s+IN\s*\(/i);
  if (inMatch) {
    const closeIdx = text.lastIndexOf(')');
    if (closeIdx < 0) return null;
    const inner = text.slice(inMatch[0].length, closeIdx);
    const values: AcuSqlValue[] = [];
    for (const part of acuSplitTopLevel(inner)) {
      const v = acuReadValue(part, 0);
      if (!v || part.slice(v.next).trim()) return null;
      values.push(v.value);
    }
    return values.length ? { col: inMatch[1], op: 'in', values } : null;
  }
  const eqMatch = text.match(/^["'`]?(\w+)["'`]?\s*=\s*/);
  if (!eqMatch) return null;
  const v = acuReadValue(text, eqMatch[0].length);
  if (!v || text.slice(v.next).trim()) return null;
  return { col: eqMatch[1], op: 'eq', values: [v.value] };
}

/** 解析 DDL：表名 + 英文列名 → 中文列名（-- 注释）映射。兼容 CREATE TABLE IF NOT EXISTS。 */
function acuParseDdl(ddl: string): { table: string | null; engToZh: Record<string, string> } {
  const engToZh: Record<string, string> = {};
  const tableMatch = ddl.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["'`]?(\w+)["'`]?/i);
  for (const line of ddl.split('\n')) {
    const colMatch = line.match(/^\s*["'`]?([A-Za-z_]\w*)["'`]?\s+[A-Z]/);
    const commentMatch = line.match(/--\s*(.+?)\s*$/);
    if (!colMatch || !commentMatch) continue;
    if (ACU_DDL_SKIP_WORDS.test(colMatch[1])) continue;
    engToZh[colMatch[1]] = commentMatch[1];
  }
  return { table: tableMatch ? tableMatch[1] : null, engToZh };
}

/** 从 checkpoint.data 建 sheet 运行时（表名 → sheet，列名 → content 列下标） */
function acuBuildSheetRuntimes(data: Record<string, any>, warnings: string[]): Map<string, AcuSheetRuntime> {
  const byTable = new Map<string, AcuSheetRuntime>();
  for (const key of Object.keys(data)) {
    if (!key.startsWith('sheet_')) continue;
    const sheet = data[key];
    if (!sheet || typeof sheet !== 'object') continue;
    const content = Array.isArray(sheet.content) ? sheet.content : null;
    if (!content || !content.length || !Array.isArray(content[0])) continue;
    const ddl = typeof sheet.sourceData?.ddl === 'string' ? sheet.sourceData.ddl : '';
    const parsed = ddl ? acuParseDdl(ddl) : { table: null, engToZh: {} };
    // 无 DDL 的 sheet 也建运行时（patch/sheet 级操作不依赖列映射），表名兜底用 sheetKey；
    // SQL 增量日志在这些表上会因列无法映射而逐条告警跳过。
    const table = parsed.table ?? key;
    const header: unknown[] = content[0];
    const colIndex: Record<string, number> = {};
    for (const [eng, zh] of Object.entries(parsed.engToZh)) {
      let idx = header.indexOf(zh);
      if (idx < 0) idx = header.indexOf(eng);
      if (idx < 0) {
        warnings.push(`表格 ${key}（${table}）列 ${eng}→「${zh}」在表头中找不到，相关写入被跳过`);
        continue;
      }
      colIndex[eng] = idx;
    }
    if (!ddl) {
      for (const [i, name] of header.entries()) colIndex[String(name)] = i;
    }
    if (colIndex.row_id === undefined) {
      const idx = header.indexOf('row_id');
      if (idx >= 0) colIndex.row_id = idx;
    }
    if (byTable.has(table)) {
      warnings.push(`DDL 表名 ${table} 被多个 sheet 声明，增量日志重放跳过该表`);
      continue;
    }
    byTable.set(table, { sheetKey: key, table, header, rows: content.slice(1), colIndex, sheet });
  }
  return byTable;
}

function acuCellEquals(cell: unknown, v: AcuSqlValue): boolean {
  if (v.kind === 'null') return cell === null || cell === undefined || cell === '';
  if (v.kind === 'nextRowId') return false;
  if (cell === null || cell === undefined) return false;
  return String(cell) === String(v.value);
}

function acuCellValue(v: AcuSqlValue, rt: AcuSheetRuntime): unknown {
  if (v.kind === 'null') return null;
  if (v.kind === 'nextRowId') return acuNextRowId(rt);
  return v.value;
}

function acuNextRowId(rt: AcuSheetRuntime): number {
  const idx = rt.colIndex.row_id;
  let max = 0;
  if (idx !== undefined) {
    for (const row of rt.rows) {
      const n = Number(row[idx]);
      if (Number.isFinite(n) && n > max) max = n;
    }
  }
  return max + 1;
}

/** 应用一条 UPDATE / INSERT / INSERT OR REPLACE；全部失败路径只记 warning 不抛错 */
function acuApplyStatement(stmt: string, byTable: Map<string, AcuSheetRuntime>, warnings: string[], floor: number): void {
  const fail = (reason: string): void => { warnings.push(`楼层 ${floor} 的 SQL 未应用（${reason}）：${stmt.slice(0, 120)}`); };
  const updateMatch = stmt.match(/^\s*UPDATE\s+["'`]?(\w+)["'`]?\s+SET\s/i);
  if (updateMatch) {
    const rt = byTable.get(updateMatch[1]);
    if (!rt) return fail(`未知表 ${updateMatch[1]}`);
    const rest = stmt.slice(updateMatch[0].length);
    const wherePos = acuFindTopLevelKeyword(rest, 'WHERE');
    if (wherePos < 0) return fail('缺少 WHERE');
    const where = acuParseWhere(rest.slice(wherePos + 5));
    if (!where) return fail('WHERE 超出语法边界');
    const whereIdx = rt.colIndex[where.col];
    if (whereIdx === undefined) return fail(`WHERE 列 ${where.col} 无法映射`);
    const sets: { idx: number; value: AcuSqlValue }[] = [];
    for (const assign of acuSplitTopLevel(rest.slice(0, wherePos))) {
      const assignMatch = assign.match(/^["'`]?(\w+)["'`]?\s*=\s*/);
      if (!assignMatch) return fail('SET 赋值无法解析');
      const idx = rt.colIndex[assignMatch[1]];
      const v = acuReadValue(assign, assignMatch[0].length);
      if (!v || assign.slice(v.next).trim()) return fail(`列 ${assignMatch[1]} 的值无法解析`);
      if (idx === undefined) {
        warnings.push(`楼层 ${floor}：表格 ${rt.table} 的列 ${assignMatch[1]} 无法映射，该列写入被跳过`);
        continue;
      }
      sets.push({ idx, value: v.value });
    }
    let matched = 0;
    for (const row of rt.rows) {
      const hit = where.op === 'eq'
        ? acuCellEquals(row[whereIdx], where.values[0])
        : where.values.some(v => acuCellEquals(row[whereIdx], v));
      if (!hit) continue;
      matched += 1;
      for (const set of sets) row[set.idx] = acuCellValue(set.value, rt);
    }
    if (!matched) warnings.push(`楼层 ${floor}：UPDATE ${rt.table} 未命中任何行（${where.col}），可能存在数据漂移`);
    return;
  }
  const insertMatch = stmt.match(/^\s*INSERT\s+(OR\s+REPLACE\s+)?INTO\s+["'`]?(\w+)["'`]?\s*\(/i);
  if (insertMatch) {
    const orReplace = !!insertMatch[1];
    const rt = byTable.get(insertMatch[2]);
    if (!rt) return fail(`未知表 ${insertMatch[2]}`);
    const colsOpen = insertMatch[0].length - 1;
    let depth = 0;
    let j = colsOpen;
    while (j < stmt.length) {
      const c = stmt[j];
      if (c === "'") { j = acuSkipQuoted(stmt, j); continue; }
      if (c === '(') depth += 1;
      else if (c === ')') {
        depth -= 1;
        if (depth === 0) break;
      }
      j += 1;
    }
    if (depth !== 0) return fail('列清单括号未闭合');
    const cols = acuSplitTopLevel(stmt.slice(colsOpen + 1, j)).map(c => c.replace(/^["'`]|["'`]$/g, ''));
    const valuesMatch = stmt.slice(j + 1).match(/^\s*VALUES\s*/i);
    if (!valuesMatch) return fail('缺少 VALUES');
    const valuesPart = stmt.slice(j + 1 + valuesMatch[0].length).trim().replace(/;+\s*$/, '');
    const colIdx = cols.map(col => rt.colIndex[col]);
    cols.forEach((col, i) => {
      if (colIdx[i] === undefined) warnings.push(`楼层 ${floor}：表格 ${rt.table} 的列 ${col} 无法映射，该列写入被跳过`);
    });
    let cursor = acuSkipWs(valuesPart, 0);
    while (cursor < valuesPart.length) {
      if (valuesPart[cursor] !== '(') return fail('VALUES 行组无法解析');
      let groupDepth = 0;
      let g = cursor;
      while (g < valuesPart.length) {
        const c = valuesPart[g];
        if (c === "'") { g = acuSkipQuoted(valuesPart, g); continue; }
        if (c === '(') groupDepth += 1;
        else if (c === ')') {
          groupDepth -= 1;
          if (groupDepth === 0) break;
        }
        g += 1;
      }
      if (groupDepth !== 0) return fail('VALUES 行组括号未闭合');
      const cells = acuSplitTopLevel(valuesPart.slice(cursor + 1, g));
      if (cells.length !== cols.length) return fail(`VALUES 列数（${cells.length}）与列清单（${cols.length}）不一致`);
      const newRow: unknown[] = new Array(rt.header.length).fill(null);
      let explicitRowId: number | null = null;
      for (let c = 0; c < cells.length; c += 1) {
        const idx = colIdx[c];
        const v = acuReadValue(cells[c], 0);
        if (!v || cells[c].slice(v.next).trim()) return fail(`列 ${cols[c]} 的值无法解析`);
        if (idx === undefined) continue;
        const cell = acuCellValue(v.value, rt);
        newRow[idx] = cell;
        if (cols[c] === 'row_id' && typeof cell === 'number') explicitRowId = cell;
      }
      let replaced = false;
      if (explicitRowId !== null && rt.colIndex.row_id !== undefined) {
        const rowIdIdx = rt.colIndex.row_id;
        const at = rt.rows.findIndex(row => Number(row[rowIdIdx]) === explicitRowId);
        if (at >= 0) {
          if (!orReplace) warnings.push(`楼层 ${floor}：INSERT ${rt.table} 的 row_id=${explicitRowId} 已存在，按覆盖处理`);
          rt.rows[at] = newRow;
          replaced = true;
        }
      }
      if (!replaced) rt.rows.push(newRow);
      cursor = acuSkipWs(valuesPart, g + 1);
      if (cursor < valuesPart.length) {
        if (valuesPart[cursor] !== ',') return fail('VALUES 行组之间缺少逗号');
        cursor = acuSkipWs(valuesPart, cursor + 1);
      }
    }
    return;
  }
  fail('语句类型不支持');
}

export interface AcuReconstructResult {
  data: Record<string, unknown>;
  warnings: string[];
  checkpointFloor: number;
  replayedLogs: number;
  replayedStatements: number;
}

/** data_replace 的新状态：必须是含 sheet_* 键的对象，否则返回 null */
function acuSanitizeReplacementData(value: unknown): Record<string, any> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (!Object.keys(value).some(key => key.startsWith('sheet_'))) return null;
  return JSON.parse(JSON.stringify(value)) as Record<string, any>;
}

function replaceState(state: Record<string, any>, next: Record<string, any>): void {
  Object.keys(state).forEach(key => delete state[key]);
  Object.assign(state, next);
}

/**
 * 应用一条 sheet 级操作（patch 日志与新版非 SQL 操作共用）：
 * sheet_replace / row_upsert / row_delete / meta_update。
 * row_id 匹配与插件 applyTablePatchV2_ACU 同口径：content[0] 是表头，
 * row[0] === patch.rowId 定位数据行；不命中 upsert 则追加。
 */
function acuApplyPatchToRuntime(
  patch: { kind?: string; sheetKey?: unknown; sheet?: unknown; rowId?: unknown; cells?: unknown; meta?: unknown } | null | undefined,
  byTable: Map<string, AcuSheetRuntime>,
  warnings: string[],
  floor: number,
  data: Record<string, any>,
): void {
  if (!patch || typeof patch !== 'object') return;
  const sheetKey = String(patch.sheetKey ?? '');
  let rt = byTable.get(sheetKey);
  if (!rt) {
    for (const candidate of byTable.values()) {
      if (candidate.sheetKey === sheetKey) { rt = candidate; break; }
    }
  }
  if (patch.kind === 'sheet_replace') {
    const sheet = patch.sheet as Record<string, any> | null | undefined;
    if (!sheet || !Array.isArray(sheet.content) || !Array.isArray(sheet.content[0])) {
      warnings.push(`楼层 ${floor}：sheet_replace 缺少表 ${sheetKey} 的合法 content，已跳过`);
      return;
    }
    const content = JSON.parse(JSON.stringify(sheet.content));
    const header = content[0] as unknown[];
    const rows = content.slice(1) as unknown[][];
    const colIndex: Record<string, number> = {};
    for (const [i, name] of header.entries()) colIndex[String(name)] = i;
    if (String(header[0]) === 'row_id') colIndex.row_id = 0;
    data[sheetKey] = JSON.parse(JSON.stringify(sheet));
    if (rt) byTable.delete(rt.table);
    byTable.set(sheetKey, { sheetKey, table: sheetKey, header, rows, colIndex, sheet: data[sheetKey] });
    return;
  }
  if (!rt) {
    warnings.push(`楼层 ${floor}：${patch.kind ?? 'patch'} 引用了未知表 ${sheetKey}，已跳过`);
    return;
  }
  if (patch.kind === 'meta_update') {
    if (patch.meta && typeof patch.meta === 'object') Object.assign(rt.sheet, JSON.parse(JSON.stringify(patch.meta)));
    return;
  }
  if (patch.kind === 'row_upsert') {
    if (!Array.isArray(patch.cells)) return;
    const cells = JSON.parse(JSON.stringify(patch.cells)) as unknown[];
    const at = rt.rows.findIndex(row => Array.isArray(row) && row[0] === patch.rowId);
    if (at >= 0) rt.rows[at] = cells;
    else rt.rows.push(cells);
    return;
  }
  if (patch.kind === 'row_delete') {
    rt.rows = rt.rows.filter(row => !(Array.isArray(row) && row[0] === patch.rowId));
    return;
  }
}

/**
 * 消息持久化模式的当前表格数据 = 最近 full checkpoint + 其后（含该楼层）logEntries 重放。
 * 与插件 loadTableStateFromFramesV2_ACU 同口径：跳过用户楼层、checkpoint 需 kind='full'、
 * 日志按楼层升序 + 楼内 seq 升序应用。找不到任何 full checkpoint 时，
 * 退而接受最新的"带 sheet_* 数据"的 checkpoint（记 warning）；都没有返回 null。
 */
export function reconstructAcuSheetData(records: unknown[]): AcuReconstructResult | null {
  if (!Array.isArray(records)) return null;
  const frames: { floor: number; frame: any }[] = [];
  for (let i = 1; i < records.length; i += 1) {
    const record = records[i] as Record<string, any> | null | undefined;
    if (!record || typeof record !== 'object' || record.is_user === true) continue;
    const isolated = record.TavernDB_ACU_IsolatedData;
    if (!isolated || typeof isolated !== 'object') continue;
    const entry =
      typeof isolated[''] === 'object' && isolated[''] !== null
        ? isolated['']
        : (Object.values(isolated as Record<string, unknown>)[0] as Record<string, any> | undefined);
    const frame = entry?.storageFrame;
    if (frame && typeof frame === 'object') frames.push({ floor: i, frame });
  }
  const hasSheetData = (frame: any) => {
    const data = frame?.checkpoint?.data;
    return data && typeof data === 'object' && Object.keys(data).some(key => key.startsWith('sheet_'));
  };
  let ckptIdx = -1;
  for (let i = frames.length - 1; i >= 0; i -= 1) {
    if (frames[i].frame?.checkpoint?.kind === 'full' && hasSheetData(frames[i].frame)) { ckptIdx = i; break; }
  }
  const warnings: string[] = [];
  if (ckptIdx < 0) {
    for (let i = frames.length - 1; i >= 0; i -= 1) {
      if (hasSheetData(frames[i].frame)) { ckptIdx = i; break; }
    }
    if (ckptIdx >= 0) warnings.push('未找到 kind=full 的 checkpoint，退用最近的数据快照');
  }
  if (ckptIdx < 0) return null;
  const checkpointFloor = frames[ckptIdx].floor;
  const data = JSON.parse(JSON.stringify(frames[ckptIdx].frame.checkpoint.data)) as Record<string, any>;
  if (!data.mate || typeof data.mate !== 'object') data.mate = { type: 'chatSheets', version: 1 };
  const byTable = acuBuildSheetRuntimes(data, warnings);
  let replayedLogs = 0;
  let replayedStatements = 0;
  for (let i = ckptIdx; i < frames.length; i += 1) {
    const { floor, frame } = frames[i];
    const entries = Array.isArray(frame.logEntries) ? [...frame.logEntries] : [];
    entries.sort((a, b) => (Number(a?.seq) || 0) - (Number(b?.seq) || 0));
    for (const entry of entries) {
      const ops = Array.isArray(entry?.operations) ? entry.operations : [];
      if (!ops.length && Array.isArray(entry?.patches) && entry.patches.length) {
        for (const patch of entry.patches) acuApplyPatchToRuntime(patch, byTable, warnings, floor, data);
        replayedLogs += 1;
        continue;
      }
      let touched = false;
      for (const op of ops) {
        if (op?.kind === 'data_replace') {
          const next = acuSanitizeReplacementData(op.data);
          if (!next) {
            warnings.push(`楼层 ${floor} 的 data_replace 缺少 sheet_* 数据，已跳过`);
            continue;
          }
          replaceState(data, next);
          const rebuilt = acuBuildSheetRuntimes(data, warnings);
          byTable.clear();
          for (const [table, rt] of rebuilt) byTable.set(table, rt);
          replayedStatements += 1;
          touched = true;
          continue;
        }
        if (op?.kind === 'sql_batch' && Array.isArray(op.statements)) {
          for (const stmt of op.statements) {
            replayedStatements += 1;
            acuApplyStatement(String(stmt), byTable, warnings, floor);
            touched = true;
          }
          continue;
        }
        if (op?.kind === 'sheet_replace' || op?.kind === 'row_upsert' || op?.kind === 'row_delete' || op?.kind === 'meta_update') {
          acuApplyPatchToRuntime(op, byTable, warnings, floor, data);
          touched = true;
          continue;
        }
        warnings.push(`楼层 ${floor} 存在未支持的操作类型 ${op?.kind ?? '?'}，已跳过`);
      }
      if (touched) replayedLogs += 1;
    }
  }
  for (const rt of byTable.values()) rt.sheet.content = [rt.header, ...rt.rows];
  return { data, warnings, checkpointFloor, replayedLogs, replayedStatements };
}

/* ===== legacy-v1 存储形态重建 =====
 * 与插件 mergeAllIndependentTablesLegacyV1_ACU 同口径（无隔离标记的简化版）：
 *  - 顶层旧字段：AI 楼层的 TavernDB_ACU_IndependentData / _Data / _SummaryData
 *  - 隔离槽旧形态：TavernDB_ACU_IsolatedData['']（无 storageFrame.version=2 时）里的
 *    independentData（checkpoint/legacy，首写胜出）/ incrementalData（delta，收集后按时序补合并）
 *  - delta 应用与 applyTableDelta_ACU 同语义：metaChanged + rowDeltas（upsert 按 row_id 定位、不命中追加）
 * 与插件差异（均有 warning）：不做当前模板 sheet 过滤（导入时由插件 data_replace 统一接管）、
 * 不做 guide 结构物化与 updateConfig uiSentinel 归一。
 */
interface AcuLegacyRowDelta { op?: string; row_id?: unknown; cells?: unknown }

function acuLegacySheetWithContent(key: string, value: unknown): { name: unknown; content: unknown[][] } | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const s = value as { name?: unknown; content?: unknown };
  const content = Array.isArray(s.content) ? (s.content as unknown[]) : [];
  if (!content.length || !Array.isArray(content[0])) return null;
  return { name: s.name ?? key, content: content as unknown[][] };
}

function acuLegacyCollectInto(
  merged: Record<string, any>, found: Record<string, boolean>, source: unknown,
): void {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return;
  for (const [key, value] of Object.entries(source)) {
    if (!key.startsWith('sheet_') || found[key]) continue;
    const sheet = acuLegacySheetWithContent(key, value);
    if (!sheet) continue;
    merged[key] = JSON.parse(JSON.stringify(value));
    found[key] = true;
  }
}

function acuApplyLegacyDelta(base: Record<string, any>, delta: unknown): Record<string, any> | null {
  if (!delta || typeof delta !== 'object' || Array.isArray(delta)) return null;
  const result = JSON.parse(JSON.stringify(base));
  const d = delta as { metaChanged?: Record<string, unknown>; rowDeltas?: AcuLegacyRowDelta[] };
  if (d.metaChanged && typeof d.metaChanged === 'object') {
    for (const field of ['name', 'orderNo', 'updateConfig', 'exportConfig', 'sourceData']) {
      if (d.metaChanged[field] !== undefined) result[field] = JSON.parse(JSON.stringify(d.metaChanged[field]));
    }
  }
  if (!Array.isArray(d.rowDeltas) || !Array.isArray(result.content)) return result;
  const indexByRowId = new Map<unknown, number>();
  for (let i = 0; i < result.content.length; i += 1) {
    const row = result.content[i];
    if (Array.isArray(row) && row[0] != null && !indexByRowId.has(row[0])) indexByRowId.set(row[0], i);
  }
  const toDelete = new Set<number>();
  for (const rd of d.rowDeltas) {
    if (!rd || typeof rd !== 'object') continue;
    if (rd.op === 'delete') {
      const idx = indexByRowId.get(rd.row_id);
      if (idx !== undefined) toDelete.add(idx);
      continue;
    }
    if (rd.op === 'upsert' && Array.isArray(rd.cells)) {
      const idx = indexByRowId.get(rd.row_id);
      if (idx !== undefined) result.content[idx] = JSON.parse(JSON.stringify(rd.cells));
      else {
        result.content.push(JSON.parse(JSON.stringify(rd.cells)));
        indexByRowId.set(rd.row_id, result.content.length - 1);
      }
    }
  }
  if (toDelete.size > 0) {
    for (const idx of [...toDelete].sort((a, b) => b - a)) result.content.splice(idx, 1);
  }
  return result;
}

export interface AcuLegacyReconstructResult {
  data: Record<string, unknown> | null;
  warnings: string[];
  mergedSheets: number;
  appliedDeltas: number;
}

/**
 * 尝试从 legacy-v1 形态重建当前表格数据；任何表格数据都找不到返回 data=null。
 * 兼容插件隔离键语义：顶层旧字段要求消息不带 TavernDB_ACU_Identity（无标记）；
 * 隔离槽旧形态只读 '' 槽（isolationKey 取空）。
 */
export function reconstructLegacyV1SheetData(records: unknown[]): AcuLegacyReconstructResult {
  const warnings: string[] = [];
  const merged: Record<string, any> = {};
  const found: Record<string, boolean> = {};
  const pendingDeltas: { delta: unknown }[] = [];
  if (Array.isArray(records)) {
    for (let i = records.length - 1; i >= 1; i -= 1) {
      const record = records[i] as Record<string, any> | null | undefined;
      if (!record || typeof record !== 'object' || record.is_user === true) continue;
      const isolated = record.TavernDB_ACU_IsolatedData;
      if (isolated && typeof isolated === 'object' && !Array.isArray(isolated)) {
        const tag = typeof isolated[''] === 'object' && isolated[''] !== null
          ? isolated['']
          : (Object.values(isolated)[0] as Record<string, any> | undefined);
        if (tag && typeof tag === 'object') {
          const frame = tag.storageFrame;
          if (!(frame && typeof frame === 'object' && frame.version === 2)) {
            if (tag._acu_storage_mode === 'delta') {
              if (tag.incrementalData && typeof tag.incrementalData === 'object') {
                pendingDeltas.push({ delta: tag.incrementalData });
              }
            } else {
              acuLegacyCollectInto(merged, found, tag.independentData);
            }
          }
        }
      }
      if (record.TavernDB_ACU_Identity) continue;
      for (const field of ['TavernDB_ACU_IndependentData', 'TavernDB_ACU_Data', 'TavernDB_ACU_SummaryData']) {
        acuLegacyCollectInto(merged, found, record[field]);
      }
    }
  }
  let appliedDeltas = 0;
  if (Object.keys(merged).length > 0) {
    // 收集顺序是从新到旧，与插件同口径反转为时序后补合并（delta 作用于其前的 base）
    for (const { delta } of [...pendingDeltas].reverse()) {
      if (!delta || typeof delta !== 'object') continue;
      for (const [sheetKey, value] of Object.entries(delta as Record<string, unknown>)) {
        if (!merged[sheetKey]) continue;
        const next = acuApplyLegacyDelta(merged[sheetKey], value);
        if (next) {
          merged[sheetKey] = next;
          appliedDeltas += 1;
        } else {
          warnings.push(`表格 ${sheetKey} 的旧版 delta 无法应用，已跳过`);
        }
      }
    }
  }
  if (Object.keys(merged).length === 0) return { data: null, warnings, mergedSheets: 0, appliedDeltas: 0 };
  const out: Record<string, unknown> = { mate: { type: 'chatSheets', version: 1 } };
  for (const [key, value] of Object.entries(merged)) out[key] = value;
  warnings.push('数据库表格：从旧版 legacy-v1 存储形态合并重建（不按当前模板过滤，导入后以新表结构为准）');
  return { data: out, warnings, mergedSheets: Object.keys(merged).length, appliedDeltas };
}

/**
 * 转换为 shujuku importTableAsJson 的 sheet 格式（{ mate, sheet_* }）。
 * 优先 checkpoint 快照（插件格式、含真实数据行）；否则把 guide 的 tags.data 转成插件格式。
 */
export function toShujukuSheetData(tables: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!tables || typeof tables !== 'object') return null;
  const snapshot = tables[ACU_SHEET_DATA_KEY];
  if (snapshot && typeof snapshot === 'object') {
    const sheets = Object.keys(snapshot).filter(key => key.startsWith('sheet_'));
    if (sheets.length) return JSON.parse(JSON.stringify(snapshot));
  }
  const guide = tables.TavernDB_ACU_InternalSheetGuide as { tags?: Record<string, { data?: Record<string, unknown> }> } | undefined;
  if (!guide?.tags) return null;
  const out: Record<string, unknown> = { mate: { type: 'chatSheets', version: 1 } };
  for (const tag of Object.values(guide.tags)) {
    const data = tag?.data;
    if (!data || typeof data !== 'object') continue;
    for (const [key, sheet] of Object.entries(data)) {
      if (!key.startsWith('sheet_') || out[key]) continue;
      if (sheet && typeof sheet === 'object') {
        const s = sheet as { name?: unknown; content?: unknown };
        out[key] = { name: s.name ?? key, content: Array.isArray(s.content) ? s.content : [] };
      }
    }
  }
  return Object.keys(out).length > 1 ? out : null;
}
