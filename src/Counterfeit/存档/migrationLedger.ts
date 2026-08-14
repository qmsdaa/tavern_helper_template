export const CURRENT_CARD_VERSION = '0.6.0';
export const CURRENT_SAVE_SCHEMA_VERSION = 1;

export interface MigrationLedgerEntry {
  from: string;
  to: string;
  breakingCanon: boolean;
  legacyEstablishedFacts: string[];
  addedFields: string[];
  removedFields: string[];
  sceneAliases: Record<string, number>;
}

/**
 * 可审计的逐版迁移账本。breakingCanon=true 时必须同时给出已建立事实，
 * 否则迁移器会 fail closed，不会拿新版默认值覆盖旧聊天事实。
 */
export const MIGRATION_LEDGER: readonly MigrationLedgerEntry[] = [
  {
    from: '0.4.6', to: '0.5.0-preview', breakingCanon: false,
    legacyEstablishedFacts: [], addedFields: ['difficulty', 'arc_milestones'], removedFields: [], sceneAliases: {},
  },
  {
    from: '0.5.0-preview', to: '0.5.1', breakingCanon: false,
    legacyEstablishedFacts: [], addedFields: ['phone.version'], removedFields: [], sceneAliases: {},
  },
  {
    from: '0.5.1', to: '0.6.0', breakingCanon: false,
    legacyEstablishedFacts: [],
    addedFields: ['campaign_id', 'campaign_revision', 'campaign_completed', 'identity_state', 'collection'],
    removedFields: ['main_pov', 'scene_pov', 'pov'],
    sceneAliases: {},
  },
] as const;

export const SUPPORTED_CARD_VERSIONS = ['0.4.6', '0.5.0-preview', '0.5.1', CURRENT_CARD_VERSION] as const;

export function migrationPath(from: string): MigrationLedgerEntry[] | null {
  if (from === CURRENT_CARD_VERSION) return [];
  const result: MigrationLedgerEntry[] = [];
  let cursor = from;
  const visited = new Set<string>();
  while (cursor !== CURRENT_CARD_VERSION) {
    if (visited.has(cursor)) return null;
    visited.add(cursor);
    const entry = MIGRATION_LEDGER.find(candidate => candidate.from === cursor);
    if (!entry) return null;
    result.push(entry);
    cursor = entry.to;
  }
  return result;
}
