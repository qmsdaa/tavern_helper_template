import { test } from 'node:test';
import assert from 'node:assert/strict';

/**
 * shujuku 通过 window.AutoCardUpdaterAPI 访问数据库。
 * 测试在 import 前先挂 window 桩；未挂桩的用例单独用动态导入验证降级。
 */
let exportCalls = 0;
let insertCalls: { table: string; data: Record<string, unknown> }[] = [];
let updateCalls: { table: string; rowIndex: number; data: Record<string, unknown> }[] = [];

const MOCK_API = {
  exportTableAsJson: () => {
    exportCalls += 1;
    return {
      mate: { type: 'chatSheets' },
      sheet_chronicle: {
        name: '纪要表',
        content: [
          ['row_id', '编码索引', '时间跨度', '纪要', '重要对话'],
          [1, 'AM0001', '2013-05-20 09:00 ~ 2013-05-20 12:00', '八幡与雪乃在侍奉部讨论了修学旅行分组。', '雪乃："分组名单我来确认。"'],
          [2, 'AM0002', '2013-05-21 15:00 ~ 2013-05-21 18:00', '结衣拉八幡去看新开的面包店，聊了泳装店打工的事。', '结衣："那家店的面包超好吃！"'],
          [3, 'AM0003', '2013-05-22 10:00 ~ 2013-05-22 12:00', '一色拜托雪乃帮忙准备学生会招新材料。', '一色："前辈，帮帮忙嘛。"'],
        ],
      },
      sheet_director_plan: {
        name: '导演规划表',
        content: [
          ['row_id', '剧情走向', '大纲', 'AI指导'],
          [1, '第三幕进入二学期', '暑假结束后关系升温，舞会线索埋设', '让互动自然，不要提前揭开舞会真相'],
          [2, '', '主线大纲B', ''],
        ],
      },
      sheet_memo: {
        name: '备忘录',
        content: [['row_id', '备忘标题', '详细内容', '当前状态']],
      },
    };
  },
  insertRow: async (table: string, data: Record<string, unknown>) => {
    insertCalls.push({ table, data });
    return 4;
  },
  updateRow: async (table: string, rowIndex: number, data: Record<string, unknown>) => {
    updateCalls.push({ table, rowIndex, data });
    return true;
  },
};

async function loadShujuku() {
  (globalThis as Record<string, unknown>).window = {
    AutoCardUpdaterAPI: MOCK_API,
  } as unknown as Window;
  insertCalls = [];
  updateCalls = [];
  exportCalls = 0;
  const s = await import('./.build/shujuku.ts');
  s.invalidateSheets(); // 模块实例跨测试缓存，必须清掉快照缓存
  return s;
}

/* —— 表名/列名候选解析（Counterfeit 适配表格） —— */

test('findSheet 按候选名命中 纪要表/sheet_chronicle 与 导演规划表', async () => {
  const s = await loadShujuku();
  assert.ok(s.findSheet(s.SHEET_SUMMARY));
  assert.equal(s.findSheet(s.SHEET_SUMMARY)!.name, '纪要表');
  assert.ok(s.findSheet(s.SHEET_DIRECTOR_PLAN));
  assert.equal(s.findSheet(s.SHEET_DIRECTOR_PLAN)!.name, '导演规划表');
  assert.equal(s.findSheet(['不存在的表']), null);
});

test('pickHeader 支持 概览/概要/summary 与 纪要/chronicle_text 候选', async () => {
  const s = await loadShujuku();
  const sheet = s.findSheet(s.SHEET_SUMMARY)!;
  assert.equal(s.pickHeader(sheet.headers, s.COL_SUMMARY_TIME_SPAN), '时间跨度');
  assert.equal(s.pickHeader(sheet.headers, s.COL_SUMMARY_CHRONICLE), '纪要');
  assert.equal(s.pickHeader(sheet.headers, s.COL_SUMMARY_OVERVIEW), null, '适配表格没有概览列');
  assert.equal(s.pickHeader(sheet.headers, s.COL_AM_CODE), '编码索引');
});

/* —— 纪要读取：适配表格无概览列时读取正文 —— */

test('readSummaryRows 读取正文（前26字作标题），日期/参与者优先排序', async () => {
  const s = await loadShujuku();
  const lines = s.readSummaryRows({
    limit: 4,
    date: '2013-05-21',
    participantNames: ['由比滨结衣'],
  });
  assert.equal(lines.length, 3);
  // 日期命中（AM0002）+ 参与者命中 → 排最前
  assert.match(lines[0], /AM0002/);
  assert.match(lines[0], /泳装店打工/);
  // 其余按新旧顺序
  assert.match(lines[1], /AM0003/);
  assert.match(lines[2], /AM0001/);
  assert.doesNotMatch(lines.join(''), /undefined/);
});

test('readSummaryRows 预算截断：超长内容按预算裁剪', async () => {
  const s = await loadShujuku();
  const tiny = s.readSummaryRows({ limit: 4, budget: 40 });
  assert.ok(tiny.length <= 1, '预算极小时最多 1 行');
  const total = tiny.join('').length;
  assert.ok(total <= 40);
});

/* —— 导演大纲：导演层资料 + 防剧透 —— */

test('readDirectorPlanLines 取最近有效 1-2 条（跳过全空记录）', async () => {
  const s = await loadShujuku();
  const lines = s.readDirectorPlanLines({ limit: 2 });
  assert.equal(lines.length, 2, '取最近两条非空记录');
  assert.match(lines[0], /剧情走向：第三幕进入二学期/);
  assert.match(lines[0], /大纲：暑假结束后关系升温/);
  assert.match(lines[1], /大纲：主线大纲B/, '第二行只有大纲列也不丢');
});

test('buildDirectorPlanBlock 带防剧透边界声明', async () => {
  const s = await loadShujuku();
  const block = s.buildDirectorPlanBlock({ limit: 2 });
  assert.match(block, /导演层资料，不是角色记忆/);
  assert.match(block, /NPC 不得声称知道、看过或复述大纲/);
  assert.match(block, /未发生内容不得作为事实、消息或秘密提前泄露/);
});

/* —— 写入：缓存失效 + AM 码递增 + 真实列写入 —— */

test('insertTableRow 成功后缓存立即失效（重新拉取），且不再重复归档依赖水位线', async () => {
  const s = await loadShujuku();
  s.getSheets();
  assert.equal(exportCalls, 1);
  const result = await s.insertTableRow(s.SHEET_SUMMARY, {
    编码索引: 'AM0004',
    时间跨度: '2013-05-23 09:00 ~ 2013-05-23 12:00',
    纪要: '【手机】测试归档',
    重要对话: null,
  });
  assert.equal(result.ok, true);
  assert.equal(insertCalls.length, 1);
  assert.equal(insertCalls[0].table, '纪要表');
  assert.equal(insertCalls[0].data['纪要'], '【手机】测试归档', '来源标记写进真实存在的纪要列');
  assert.ok(!('概览' in insertCalls[0].data), '绝不写入不存在的概览列');
  // 写入后缓存失效：再次 getSheets 会重新调 API
  s.getSheets();
  assert.equal(exportCalls, 2);
});

test('nextAmCode 从现有最大编码 +1', async () => {
  const s = await loadShujuku();
  assert.equal(s.nextAmCode(), 'AM0004');
});

test('updateRowWhere 按列定位并更新，成功后失效缓存', async () => {
  const s = await loadShujuku();
  s.getSheets();
  const memoResult = await s.updateRowWhere(s.SHEET_MEMO, s.COL_MEMO_TITLE, '某条备忘', { 当前状态: '已兑现' });
  assert.equal(memoResult.ok, false, '表无该行时降级返回');
  const result = await s.updateRowWhere(s.SHEET_SUMMARY, s.COL_AM_CODE, 'AM0001', { 纪要: '更新' });
  assert.equal(result.ok, true);
  assert.equal(updateCalls.length, 1);
  assert.equal(updateCalls[0].rowIndex, 1, 'shujuku 行索引含表头');
});

/* —— 数据库插件缺失安全降级 —— */

test('API 缺失时全部读接口降级为空、写接口按安全降级码返回', async () => {
  const s = await loadShujuku();
  delete (globalThis as Record<string, unknown>).window;
  s.invalidateSheets(); // 快照缓存也必须随 API 缺失一起失效
  assert.equal(s.shujukuAvailable(), false);
  assert.deepEqual(s.getSheets(), []);
  assert.equal(s.findSheet(s.SHEET_SUMMARY), null);
  assert.deepEqual(s.readSummaryRows(), []);
  assert.deepEqual(s.readDirectorPlanLines(), []);
  // 无 API 且无缓存：找不到表 → sheet_not_found（安全降级，不影响普通聊天）
  const insert = await s.insertTableRow(s.SHEET_SUMMARY, {});
  assert.equal(insert.ok, false);
  assert.equal(insert.code, 'sheet_not_found');
  const update = await s.updateRowWhere(s.SHEET_SUMMARY, s.COL_AM_CODE, 'AM0001', {});
  assert.equal(update.ok, false);
  assert.equal(update.code, 'sheet_not_found');

  // 无 API 但有缓存快照：表可解析 → api_unavailable
  s.invalidateSheets();
  (globalThis as Record<string, unknown>).window = {
    AutoCardUpdaterAPI: MOCK_API,
  } as unknown as Window;
  s.getSheets();
  delete (globalThis as Record<string, unknown>).window;
  const insert2 = await s.insertTableRow(s.SHEET_SUMMARY, {});
  assert.equal(insert2.ok, false);
  assert.equal(insert2.code, 'api_unavailable');
});

test('表不存在时写接口降级为 sheet_not_found，不影响其他能力', async () => {
  const s = await loadShujuku();
  const result = await s.insertTableRow(['不存在的表'], {});
  assert.equal(result.ok, false);
  assert.equal(result.code, 'sheet_not_found');
  // 普通读取不受影响
  assert.ok(s.findSheet(s.SHEET_SUMMARY));
});

/* —— DB 状态（设置界面显示） —— */

test('readDbStatus 返回 API 状态与命中的实际表名/行数', async () => {
  const s = await loadShujuku();
  const status = s.readDbStatus();
  assert.equal(status.available, true);
  const summary = status.sheets.find(row => row.label === '纪要表');
  assert.equal(summary!.name, '纪要表');
  assert.equal(summary!.rowCount, 3);
  const director = status.sheets.find(row => row.label === '导演规划表');
  assert.equal(director!.name, '导演规划表');
  assert.equal(director!.rowCount, 2);
  const memo = status.sheets.find(row => row.label === '备忘录');
  assert.equal(memo!.name, '备忘录');
  assert.equal(memo!.rowCount, 0);
});
