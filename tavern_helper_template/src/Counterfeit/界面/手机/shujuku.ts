// shujuku（SP·数据库 III）联动层 —— 手机助手唯一出口（桥接层单出口模式）。
// 边界：
//   ① 安全分级降级：API 缺失 / 方法缺失 / 表不存在 各自独立降级，返回统一 {ok, code, message}；
//   ② 读快写慢：读取容忍快照过期（TTL 缓存），写入串行排队并等到真正 settle（不抢超时——
//      写 Promise 背后还在改 SQLite/聊天变量，提前放弃会破坏队列不变量，借鉴玉子手机）；
//   ③ 候选名解析：表名/列名都给候选清单，模板改版（恋爱特化表 vs 适配表格）不用改代码。
// API 参考：奶龙工具箱 docs/SHUJUKU_API.md（window.AutoCardUpdaterAPI）。

interface ShujukuApi {
  exportTableAsJson?: () => Record<string, unknown>;
  insertRow?: (tableName: string, data: Record<string, unknown>) => Promise<number>;
  updateRow?: (tableName: string, rowIndex: number, data: Record<string, unknown>) => Promise<boolean>;
}

export interface DbResult {
  ok: boolean;
  code: 'ok' | 'api_unavailable' | 'method_missing' | 'sheet_not_found' | 'error';
  message?: string;
}

export interface SheetData {
  key: string;
  name: string;
  headers: string[];
  rows: Record<string, unknown>[];
}

/** 手机跑在 srcdoc iframe 里，API 挂在宿主窗口；同源 srcdoc 可读 parent */
function resolveApi(): ShujukuApi | null {
  try {
    const own = (window as unknown as { AutoCardUpdaterAPI?: ShujukuApi }).AutoCardUpdaterAPI;
    if (own) return own;
  } catch {
    /* 忽略 */
  }
  try {
    const parent = window.parent as unknown as { AutoCardUpdaterAPI?: ShujukuApi };
    if (parent && parent.AutoCardUpdaterAPI) return parent.AutoCardUpdaterAPI;
  } catch {
    /* 跨域或宿主无 API */
  }
  return null;
}

/** shujuku 是否可用（设置界面显示状态用） */
export function shujukuAvailable(): boolean {
  return resolveApi() !== null;
}

/* —— 表格快照（TTL 缓存） —— */

const SNAPSHOT_TTL_MS = 60_000;
let snapshotCache: { at: number; sheets: SheetData[] } | null = null;

/** content 为二维数组（首行表头）时转对象行；已是对象行则原样保留 */
function processSheet(key: string, raw: unknown): SheetData | null {
  if (!raw || typeof raw !== 'object') return null;
  const sheet = raw as { name?: unknown; content?: unknown };
  const content = Array.isArray(sheet.content) ? sheet.content : [];
  if (!content.length) return null;
  const name = String(sheet.name ?? key).trim() || key;
  const first = content[0];
  if (Array.isArray(first)) {
    const headers = first.map(h => String(h ?? '').trim());
    const rows = content
      .slice(1)
      .filter(row => Array.isArray(row))
      .map(row => {
        const obj: Record<string, unknown> = {};
        headers.forEach((header, index) => {
          if (header) obj[header] = (row as unknown[])[index];
        });
        return obj;
      });
    return { key, name, headers, rows };
  }
  // 对象行形态：表头取首行 keys
  const rows = content.filter(row => row && typeof row === 'object') as Record<string, unknown>[];
  const headers = rows.length ? Object.keys(rows[0]) : [];
  return { key, name, headers, rows };
}

/** 读取全部表（60s TTL；写操作后调 invalidateSheets 立即失效） */
export function getSheets(): SheetData[] {
  if (snapshotCache && Date.now() - snapshotCache.at < SNAPSHOT_TTL_MS) {
    return snapshotCache.sheets;
  }
  const api = resolveApi();
  if (!api || typeof api.exportTableAsJson !== 'function') {
    return [];
  }
  try {
    const raw = api.exportTableAsJson();
    const sheets = Object.entries(raw ?? {})
      .filter(([key]) => key !== 'mate')
      .map(([key, value]) => processSheet(key, value))
      .filter((sheet): sheet is SheetData => sheet !== null);
    snapshotCache = { at: Date.now(), sheets };
    return sheets;
  } catch (error) {
    console.info('[手机·数据库] exportTableAsJson 失败', error);
    return [];
  }
}

export function invalidateSheets() {
  snapshotCache = null;
}

/** 按候选名找表（display name 或 sheet key 均可命中） */
export function findSheet(candidates: string[]): SheetData | null {
  const wanted = new Set(candidates);
  return getSheets().find(sheet => wanted.has(sheet.name) || wanted.has(sheet.key)) ?? null;
}

/** 读某表最后 N 行（可按列值过滤；filterValue 为子串匹配） */
export function readRows(
  candidates: string[],
  options: { limit?: number; column?: string; filterValue?: string } = {},
): Record<string, unknown>[] {
  const sheet = findSheet(candidates);
  if (!sheet) return [];
  let rows = sheet.rows;
  if (options.column && options.filterValue) {
    const column = pickHeader(sheet.headers, [options.column]) ?? options.column;
    rows = rows.filter(row => String(row[column] ?? '').includes(options.filterValue as string));
  }
  const limit = options.limit ?? rows.length;
  return rows.slice(-limit);
}

/** 候选表头解析：逻辑列名 → 实际表头（模板列名漂移时免改代码） */
export function pickHeader(headers: string[], candidates: string[]): string | null {
  for (const candidate of candidates) {
    const hit = headers.find(header => header === candidate);
    if (hit) return hit;
  }
  return null;
}

/* —— 串行写队列（尾链模式：任何时刻只有一个写在飞） —— */

let mutationTail: Promise<unknown> = Promise.resolve();

function enqueueMutation<T>(task: () => Promise<T>): Promise<T> {
  const run = mutationTail.catch(() => undefined).then(task);
  mutationTail = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/** 插入一行。表不存在/方法缺失各自降级；成功返回新行索引 */
export function insertTableRow(candidates: string[], data: Record<string, unknown>): Promise<DbResult & { rowIndex?: number }> {
  const sheet = findSheet(candidates);
  if (!sheet) {
    return Promise.resolve({ ok: false, code: 'sheet_not_found', message: `未找到表：${candidates.join('/')}` });
  }
  const api = resolveApi();
  if (!api) {
    return Promise.resolve({ ok: false, code: 'api_unavailable', message: '数据库 API 不可用' });
  }
  if (typeof api.insertRow !== 'function') {
    return Promise.resolve({ ok: false, code: 'method_missing', message: 'insertRow 不可用' });
  }
  return enqueueMutation(async () => {
    try {
      const rowIndex = await api.insertRow!(sheet.name, data);
      invalidateSheets();
      if (typeof rowIndex === 'number' && rowIndex >= 0) {
        return { ok: true, code: 'ok' as const, rowIndex };
      }
      return { ok: false, code: 'error' as const, message: `insertRow 返回 ${rowIndex}` };
    } catch (error) {
      return { ok: false, code: 'error' as const, message: error instanceof Error ? error.message : String(error) };
    }
  });
}

/** 按某列的值定位行并更新（用于备忘录状态同步）；rowIndex 含表头偏移（0=表头） */
export function updateRowWhere(
  candidates: string[],
  matchColumnCandidates: string[],
  matchValue: string,
  data: Record<string, unknown>,
): Promise<DbResult> {
  const sheet = findSheet(candidates);
  if (!sheet) {
    return Promise.resolve({ ok: false, code: 'sheet_not_found', message: `未找到表：${candidates.join('/')}` });
  }
  const api = resolveApi();
  if (!api) {
    return Promise.resolve({ ok: false, code: 'api_unavailable', message: '数据库 API 不可用' });
  }
  if (typeof api.updateRow !== 'function') {
    return Promise.resolve({ ok: false, code: 'method_missing', message: 'updateRow 不可用' });
  }
  const matchColumn = pickHeader(sheet.headers, matchColumnCandidates);
  if (!matchColumn) {
    return Promise.resolve({ ok: false, code: 'sheet_not_found', message: `表 ${sheet.name} 缺少列：${matchColumnCandidates.join('/')}` });
  }
  const rowPos = sheet.rows.findIndex(row => String(row[matchColumn] ?? '').trim() === matchValue.trim());
  if (rowPos < 0) {
    return Promise.resolve({ ok: false, code: 'sheet_not_found', message: `表 ${sheet.name} 中未找到「${matchValue}」` });
  }
  return enqueueMutation(async () => {
    try {
      // shujuku 行索引含表头：0=表头，数据行从 1 起
      const ok = await api.updateRow!(sheet.name, rowPos + 1, data);
      invalidateSheets();
      return ok ? { ok: true, code: 'ok' as const } : { ok: false, code: 'error' as const, message: 'updateRow 返回 false' };
    } catch (error) {
      return { ok: false, code: 'error' as const, message: error instanceof Error ? error.message : String(error) };
    }
  });
}

/* —— 各表候选名（恋爱特化表_精简版 / Counterfeit适配表格 双模板兼容） —— */

export const SHEET_SUMMARY = ['纪要表', '纪要', 'sheet_summary', 'sheet_chronicle'];
export const SHEET_MEMO = ['备忘录', 'sheet_memo'];
export const SHEET_ROMANCE_DIARY = ['恋爱日记表', '恋爱日记', 'sheet_romance_diary'];
export const SHEET_CHARACTERS = ['重要角色表', 'sheet_important_non_romance', 'sheet_important_characters'];
export const SHEET_ROMANCE_TARGET = ['恋爱对象表', 'sheet_romance_target'];
export const SHEET_INVENTORY = ['物品表', 'sheet_inventory', 'sheet_readable_12'];
export const SHEET_DIRECTOR_PLAN = ['导演规划表', '剧情大纲', '主线大纲', 'sheet_director_plan'];

export const COL_AM_CODE = ['编码索引', 'code_index'];
export const COL_MEMO_TITLE = ['备忘标题', '标题'];
export const COL_CHARACTER_NAME = ['姓名', '角色', '写作角色'];
export const COL_SUMMARY_OVERVIEW = ['概览', '概要', 'summary'];
export const COL_SUMMARY_CHRONICLE = ['纪要', 'chronicle_text'];
export const COL_SUMMARY_TIME_SPAN = ['时间跨度', 'time_span'];
export const COL_SUMMARY_KEY_DIALOGUE = ['重要对话', 'key_dialogue'];
export const COL_DIRECTOR_PLOT = ['剧情走向', 'plot'];
export const COL_DIRECTOR_OUTLINE = ['大纲', 'outline'];
export const COL_DIRECTOR_INSTRUCTION = ['AI指导', 'instruction'];

/** 分配下一个 AM 码（读当前最大编码 +1；与 shujuku 自身填表存在理论竞态，可接受） */
export function nextAmCode(): string {
  const sheet = findSheet(SHEET_SUMMARY);
  if (!sheet) return 'AM0001';
  const column = pickHeader(sheet.headers, COL_AM_CODE) ?? sheet.headers[1];
  let max = 0;
  for (const row of sheet.rows) {
    const match = /^AM(\d+)$/i.exec(String(row[column] ?? '').trim());
    if (match) max = Math.max(max, parseInt(match[1], 10));
  }
  return `AM${String(max + 1).padStart(4, '0')}`;
}

/* —— 委托取材摘要（保留原实现） —— */

/** 单行压缩为「列名：值」串，跳过空值与超长值 */
function formatRow(row: Record<string, unknown>, valueMax: number): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(row)) {
    if (key === 'row_id' || key === 'uid') continue;
    const text = String(value ?? '').trim();
    if (!text || text === '无' || text === '未确认') continue;
    parts.push(`${key}：${text.length > valueMax ? `${text.slice(0, valueMax)}…` : text}`);
  }
  return parts.join('；');
}

/**
 * 读取当前全局快照表格，压缩成委托 prompt 用的取材摘要。
 * @param budget 总字符预算（超出即截断）
 * @param rowsPerTable 每表最多取几行数据行
 */
export function readShujukuDigest(budget = 1600, rowsPerTable = 4): string {
  const sheets = getSheets();
  if (!sheets.length) return '';
  const lines: string[] = [];
  let used = 0;
  for (const sheet of sheets) {
    if (!sheet.rows.length) continue;
    const header = `- 【${sheet.name}】`;
    if (used + header.length > budget) break;
    lines.push(header);
    used += header.length;
    for (const row of sheet.rows.slice(-rowsPerTable)) {
      const line = `  · ${formatRow(row, 60)}`;
      if (!line.trim() || used + line.length > budget) break;
      lines.push(line);
      used += line.length;
    }
    if (used >= budget) break;
  }
  return lines.join('\n');
}

/* —— 纪要 / 导演规划 分层读取 —— */

/**
 * 纪要表最近 3—5 条，按「参与者 / 日期 / 场景」优先排序（日期命中 > 参与者命中 > 新旧）。
 * 返回已格式化的行文本，总长度受预算约束。
 * Counterfeit 适配表格没有「概览」列：标题与正文统一回退到「纪要」列，取前 26 字作标题。
 */
export function readSummaryRows(
  options: { limit?: number; date?: string; participantNames?: string[]; budget?: number } = {},
): string[] {
  const sheet = findSheet(SHEET_SUMMARY);
  if (!sheet) return [];
  const limit = Math.max(1, Math.min(5, options.limit ?? 4));
  const budget = options.budget ?? 600;
  const date = options.date ?? '';
  const names = (options.participantNames ?? []).map(String).filter(Boolean);
  const amHeader = pickHeader(sheet.headers, COL_AM_CODE) ?? sheet.headers[1];
  const timeSpanHeader = pickHeader(sheet.headers, COL_SUMMARY_TIME_SPAN);
  const overviewHeader = pickHeader(sheet.headers, COL_SUMMARY_OVERVIEW);
  const chronicleHeader = pickHeader(sheet.headers, COL_SUMMARY_CHRONICLE) ?? '纪要';
  const dateHit = (row: Record<string, unknown>) => {
    if (!date) return false;
    const span = timeSpanHeader ? String(row[timeSpanHeader] ?? '') : '';
    return span.includes(date);
  };
  const nameHit = (row: Record<string, unknown>) => {
    if (!names.length) return false;
    const text = [
      overviewHeader ? row[overviewHeader] : '',
      row[chronicleHeader],
      row[amHeader],
    ]
      .map(value => String(value ?? ''))
      .join('');
    return names.some(name => text.includes(name));
  };
  const scored = sheet.rows
    .map((row, index) => ({
      row,
      index,
      score: (dateHit(row) ? 2 : 0) + (nameHit(row) ? 1 : 0),
    }))
    .sort((a, b) => b.score - a.score || b.index - a.index)
    .slice(0, limit);
  const lines: string[] = [];
  let used = 0;
  for (const { row } of scored) {
    const code = String(row[amHeader] ?? '').trim();
    const overview = overviewHeader ? String(row[overviewHeader] ?? '').trim() : '';
    const chronicle = String(row[chronicleHeader] ?? '').trim();
    const title = overview || chronicle.slice(0, 26);
    const body = chronicle.slice(0, 90);
    const span = timeSpanHeader ? String(row[timeSpanHeader] ?? '').trim().slice(0, 24) : '';
    const line = `- ${code ? `[${code}] ` : ''}${title}${body ? `：${body}` : ''}${span ? `（${span}）` : ''}`;
    if (used + line.length > budget) break;
    lines.push(line);
    used += line.length;
  }
  return lines;
}

/**
 * 导演规划表：读取当前或最近有效的 1—2 条（缺状态/场景列时回退到最后非空记录）。
 * 返回的文本带「导演层资料，不是角色记忆」边界说明：
 * NPC 不得声称知道、看过或复述大纲；未发生内容不得作为事实、消息或秘密提前泄露。
 */
export function readDirectorPlanLines(
  options: { limit?: number; budget?: number } = {},
): string[] {
  const sheet = findSheet(SHEET_DIRECTOR_PLAN);
  if (!sheet) return [];
  const limit = Math.max(1, Math.min(2, options.limit ?? 2));
  const budget = options.budget ?? 600;
  const plotHeader = pickHeader(sheet.headers, COL_DIRECTOR_PLOT);
  const outlineHeader = pickHeader(sheet.headers, COL_DIRECTOR_OUTLINE);
  const instructionHeader = pickHeader(sheet.headers, COL_DIRECTOR_INSTRUCTION);
  const nonEmpty = sheet.rows.filter(row =>
    [plotHeader, outlineHeader, instructionHeader]
      .map(header => (header ? String(row[header] ?? '').trim() : ''))
      .some(Boolean),
  );
  const lines: string[] = [];
  let used = 0;
  for (const row of nonEmpty.slice(-limit)) {
    const bits: string[] = [];
    if (plotHeader) {
      const value = String(row[plotHeader] ?? '').trim();
      if (value) bits.push(`剧情走向：${value.slice(0, 120)}`);
    }
    if (outlineHeader) {
      const value = String(row[outlineHeader] ?? '').trim();
      if (value) bits.push(`大纲：${value.slice(0, 150)}`);
    }
    if (instructionHeader) {
      const value = String(row[instructionHeader] ?? '').trim();
      if (value) bits.push(`AI指导：${value.slice(0, 120)}`);
    }
    if (!bits.length) continue;
    const line = `- ${bits.join('；')}`;
    if (used + line.length > budget) break;
    lines.push(line);
    used += line.length;
  }
  return lines;
}

/** 导演规划注入块：标题即防剧透声明，任何角色不得直接复述大纲内容 */
export function buildDirectorPlanBlock(options: { limit?: number; budget?: number } = {}): string {
  const lines = readDirectorPlanLines(options);
  if (!lines.length) return '';
  return [
    '导演规划（导演层资料，不是角色记忆：仅供互动方向不与未来规划冲突；NPC 不得声称知道、看过或复述大纲；未发生内容不得作为事实、消息或秘密提前泄露）：',
    ...lines,
  ].join('\n');
}

export interface DbStatusRow {
  label: string;
  candidates: string;
  name: string | null;
  rowCount: number;
}

/** 数据库联动状态（设置界面显示命中的实际表名、行数与 API 状态） */
export function readDbStatus(): { available: boolean; sheets: DbStatusRow[] } {
  const available = shujukuAvailable();
  const targets: { label: string; candidates: string[] }[] = [
    { label: '纪要表', candidates: SHEET_SUMMARY },
    { label: '备忘录', candidates: SHEET_MEMO },
    { label: '恋爱日记表', candidates: SHEET_ROMANCE_DIARY },
    { label: '导演规划表', candidates: SHEET_DIRECTOR_PLAN },
    { label: '角色表', candidates: SHEET_CHARACTERS },
  ];
  const sheets: DbStatusRow[] = [];
  if (available) {
    for (const target of targets) {
      const sheet = findSheet(target.candidates);
      sheets.push({
        label: target.label,
        candidates: target.candidates.join('/'),
        name: sheet?.name ?? null,
        rowCount: sheet?.rows.length ?? 0,
      });
    }
  }
  return { available, sheets };
}
