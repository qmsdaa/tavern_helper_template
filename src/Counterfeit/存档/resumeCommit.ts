import { ACU_CHAT_ID_SUFFIX } from './acuTables';
import type { MigrationResult } from './types';

export interface ResumeCommitDeps {
  getMessage0: () => unknown;
  getFloor0Variables: () => unknown;
  getChatVariables: () => unknown;
  setMessage0: (messages: unknown) => Promise<void>;
  setFloor0Variables: (updater: (vars: any) => any) => Promise<void>;
  setChatVariables: (updater: (vars: any) => any) => Promise<void>;
  /** shujuku 表格迁移：不传则跳过表格写入（stat_data 迁移不受影响） */
  getChatMetadata?: () => Record<string, any>;
  saveMetadata?: () => Promise<void>;
  getCurrentChatId?: () => string;
}

const clone = <T>(value: T): T => (value === undefined ? value : JSON.parse(JSON.stringify(value)));

/** 空安全读取聊天元数据：getChatMetadata 未提供或返回非对象（undefined/null）一律视作不可用 */
function readMetadata(deps: ResumeCommitDeps): Record<string, any> | null {
  if (typeof deps.getChatMetadata !== 'function') return null;
  const meta = deps.getChatMetadata();
  return meta && typeof meta === 'object' ? meta : null;
}

/**
 * 覆盖式深比较：expected 的每个字段都在 target 里深相等即通过。
 * 真实酒馆里 MVU 回读变量时可能补默认字段、调整键序，
 * 严格的 JSON.stringify 全等会把这些无害差异误判成"校验失败"并回滚整个迁移。
 */
function covers(target: unknown, expected: unknown): boolean {
  if (expected === null || typeof expected !== 'object') return Object.is(target, expected);
  if (Array.isArray(expected)) {
    return Array.isArray(target) && target.length === expected.length && expected.every((item, index) => covers(target[index], item));
  }
  if (target === null || typeof target !== 'object' || Array.isArray(target)) return false;
  return Object.entries(expected as Record<string, unknown>).every(([key, value]) =>
    covers((target as Record<string, unknown>)[key], value),
  );
}

export async function commitPortableResume(result: MigrationResult, deps: ResumeCommitDeps): Promise<void> {
  if (!result.statData) throw new Error('存档不兼容，不能提交');
  const tableSheets = result.tableSheets ?? null;
  const metadata = readMetadata(deps);
  const canMigrateTables =
    tableSheets !== null &&
    metadata !== null &&
    typeof deps.saveMetadata === 'function';
  if (tableSheets !== null && metadata === null) {
    console.warn('[Counterfeit·迁移] 聊天元数据不可用，数据库表格未迁移（stat_data 迁移不受影响）');
  }
  const tableKeys = canMigrateTables ? Object.keys(tableSheets) : [];
  const before = {
    message0: clone(deps.getMessage0()),
    floor0: clone(deps.getFloor0Variables()),
    chat: clone(deps.getChatVariables()),
    /** 表格写入前的 metadata 旧值（undefined 表示键原先不存在，回滚时删除） */
    metadata: null as Record<string, unknown> | null,
  };
  if (canMigrateTables && metadata !== null) {
    before.metadata = {};
    for (const key of tableKeys) {
      before.metadata[key] = clone(metadata[key]);
      before.metadata[key + ACU_CHAT_ID_SUFFIX] = clone(metadata[key + ACU_CHAT_ID_SUFFIX]);
    }
  }
  const stat = clone(result.statData);
  const capsule = `<counterfeit_resume_capsule version="1">\n${JSON.stringify(
    {
      stat_data: stat,
      resume_tail: result.resumeTail,
      legacy_established_facts: result.legacyEstablishedFacts,
      provenance: { source: result.provenance.source, sha256: result.provenance.sha256 },
      warnings: result.report.warnings,
    },
    null,
    2,
  )}\n</counterfeit_resume_capsule>`;

  try {
    await deps.setFloor0Variables(vars => ({ ...(vars ?? {}), stat_data: clone(stat) }));
    await deps.setChatVariables(vars => ({ ...(vars ?? {}), stat_data: clone(stat) }));
    await deps.setMessage0([{ message_id: 0, message: capsule }]);
    const floor = (deps.getFloor0Variables() as any)?.stat_data;
    const chat = (deps.getChatVariables() as any)?.stat_data;
    if (!covers(floor, stat) || !covers(chat, stat)) {
      throw new Error('提交后快照校验失败');
    }
    if (canMigrateTables) {
      const meta = readMetadata(deps);
      if (!meta) throw new Error('数据库表格写入前聊天元数据不可用');
      const chatId = typeof deps.getCurrentChatId === 'function' ? deps.getCurrentChatId() : null;
      for (const key of tableKeys) {
        meta[key] = clone(tableSheets![key]);
        // 绑定标记改写为新聊天 ID，否则 shujuku 会把表格判定为旧聊天所属
        if (chatId) meta[key + ACU_CHAT_ID_SUFFIX] = chatId;
      }
      await deps.saveMetadata!();
      const check = readMetadata(deps);
      for (const key of tableKeys) {
        if (!check?.[key] || typeof check[key] !== 'object') {
          throw new Error('数据库表格写入后校验失败');
        }
      }
    }
  } catch (error) {
    let rollbackError: unknown = null;
    try {
      if (before.metadata) {
        const meta = readMetadata(deps);
        if (meta) {
          for (const [key, value] of Object.entries(before.metadata)) {
            if (value === undefined) delete meta[key];
            else meta[key] = clone(value);
          }
          // 内存对象已恢复；落盘失败不升级为回滚失败——酒馆下一次正常保存会带上恢复后的值
          try {
            await deps.saveMetadata!();
          } catch (persistError) {
            console.info('[Counterfeit·迁移] 表格回滚落盘失败（内存已恢复，将由后续保存兜底）', persistError);
          }
        } else {
          console.warn('[Counterfeit·迁移] 表格回滚时聊天元数据不可用，仅回滚变量与楼层');
        }
      }
      await deps.setMessage0(before.message0);
      await deps.setFloor0Variables(() => clone(before.floor0));
      await deps.setChatVariables(() => clone(before.chat));
    } catch (rollback) {
      rollbackError = rollback;
    }
    const reason = error instanceof Error ? error.message : String(error);
    if (rollbackError) throw new Error(`迁移失败且回滚失败：${reason}`);
    throw new Error(`迁移失败，已回滚：${reason}`);
  }
}
