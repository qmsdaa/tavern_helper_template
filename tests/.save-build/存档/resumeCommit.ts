import type { MigrationResult } from './types.ts';

export interface ResumeCommitDeps {
  getMessage0: () => unknown;
  getFloor0Variables: () => unknown;
  getChatVariables: () => unknown;
  setMessage0: (messages: unknown) => Promise<void>;
  setFloor0Variables: (updater: (vars: any) => any) => Promise<void>;
  setChatVariables: (updater: (vars: any) => any) => Promise<void>;
}

const clone = <T>(value: T): T => (value === undefined ? value : JSON.parse(JSON.stringify(value)));

export async function commitPortableResume(result: MigrationResult, deps: ResumeCommitDeps): Promise<void> {
  if (!result.statData) throw new Error('存档不兼容，不能提交');
  const before = {
    message0: clone(deps.getMessage0()),
    floor0: clone(deps.getFloor0Variables()),
    chat: clone(deps.getChatVariables()),
  };
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
    if (JSON.stringify(floor) !== JSON.stringify(stat) || JSON.stringify(chat) !== JSON.stringify(stat)) {
      throw new Error('提交后快照校验失败');
    }
  } catch (error) {
    let rollbackError: unknown = null;
    try {
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
