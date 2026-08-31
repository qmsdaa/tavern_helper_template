import { Schema } from '../schema';
import { countAcuSheets } from './acuTables';
import {
  CURRENT_CARD_VERSION,
  CURRENT_SAVE_SCHEMA_VERSION,
  migrationPath,
  type MigrationLedgerEntry,
} from './migrationLedger';
import type { CampaignId, CompatibilityReport, MigrationResult, ParsedSaveSource } from './types';

const CAMPAIGNS: CampaignId[] = ['main', 'dlc_genderbend_hachiman', 'dlc_body_swap_mrs_yukinoshita'];
const MAIN_POVS = ['hachiman', 'yukino', 'yui', 'laff', null];
const CURRENT_FIELDS = ['campaign_id', 'campaign_revision', 'campaign_completed', 'identity_state', 'collection'];

export function inferLegacyVersion(stat: Record<string, any>): string {
  if ('campaign_id' in stat && 'campaign_completed' in stat) return CURRENT_CARD_VERSION;
  if ('mainline_completed' in stat && stat.phone?.version === 2) return '0.5.1';
  if ('difficulty' in stat && 'arc_milestones' in stat) return '0.5.0-preview';
  return '0.4.6';
}

function applyLedger(
  stat: Record<string, any>,
  entries: MigrationLedgerEntry[],
  steps: string[],
  addedFields: string[],
  discardedFields: string[],
  conflicts: string[],
): string[] {
  const facts: string[] = [];
  for (const entry of entries) {
    if (entry.breakingCanon && entry.legacyEstablishedFacts.length === 0) {
      conflicts.push(`版本 ${entry.from} → ${entry.to} 缺少 breaking-canon 迁移台账`);
      continue;
    }
    steps.push(`应用版本迁移 ${entry.from} → ${entry.to}`);
    for (const field of entry.addedFields) if (!(field in stat) && !addedFields.includes(field)) addedFields.push(field);
    for (const field of entry.removedFields) {
      if (!(field in stat)) continue;
      delete stat[field];
      discardedFields.push(field);
      steps.push(`移除已废弃字段 ${field}`);
    }
    const sceneKey = String(stat.current_scene);
    if (stat.campaign_id === 'main' && entry.sceneAliases[sceneKey] !== undefined) {
      const next = entry.sceneAliases[sceneKey];
      stat.current_scene = next;
      steps.push(`场景别名 ${sceneKey} → ${next}`);
    }
    facts.push(...entry.legacyEstablishedFacts);
  }
  return facts;
}

function addCurrentFields(stat: Record<string, any>, steps: string[]): void {
  if (!stat.campaign_id) { stat.campaign_id = 'main'; steps.push('缺失 campaign_id → main'); }
  if (!stat.campaign_revision) { stat.campaign_revision = 1; steps.push('缺失 campaign_revision → 1'); }
  if (!('campaign_completed' in stat)) {
    stat.campaign_completed = stat.campaign_id === 'main' && stat.mainline_completed === true;
    steps.push('campaign_completed 从主线完成态迁移');
  }
  if (!('identity_state' in stat)) { stat.identity_state = null; steps.push('补 identity_state=null'); }
  if (!stat.collection) {
    stat.collection = { version: 1, cg_unlocks: {}, ending_unlocks: {} };
    steps.push('建立客户端 collection');
  }
}

function migrateLegacyGenderbendIdentity(stat: Record<string, any>, steps: string[]): void {
  if (stat.campaign_id !== 'dlc_genderbend_hachiman'
      || stat.current_pov !== 'hachiman'
      || stat.identity_state?.kind !== 'transformation'
      || stat.identity_state.current_body !== 'hachiman'
      || stat.identity_state.legal_identity !== '比企谷八幡') return;

  stat.current_pov = 'hachiman_f';
  stat.identity_state.current_body = 'hachiman_f';
  stat.identity_state.legal_identity = '比企谷八幡（性转）';
  steps.push('旧《错位的日常》性转八幡身份三元组迁移为 hachiman_f/hachiman_f/比企谷八幡（性转）');
}

export function migrateParsedSave(source: ParsedSaveSource): MigrationResult {
  const stat = JSON.parse(JSON.stringify(source.statData));
  const steps: string[] = [];
  const conflicts: string[] = [];
  const addedFields: string[] = [];
  const discardedFields: string[] = [];
  const sourceVersion = source.cardVersion || inferLegacyVersion(stat);
  const schemaVersion = source.schemaVersion;
  const path = migrationPath(sourceVersion);

  if (schemaVersion !== null && schemaVersion !== CURRENT_SAVE_SCHEMA_VERSION) {
    conflicts.push(`不支持存档 schema version ${String(schemaVersion)}`);
  }
  if (!path) conflicts.push(`不支持卡片版本 ${sourceVersion}（当前 ${CURRENT_CARD_VERSION}）`);

  const beforeCurrentFields = new Set(Object.keys(stat));
  const ledgerFacts = path ? applyLedger(stat, path, steps, addedFields, discardedFields, conflicts) : [];
  addCurrentFields(stat, steps);
  migrateLegacyGenderbendIdentity(stat, steps);
  for (const field of CURRENT_FIELDS) {
    if (!beforeCurrentFields.has(field) && !addedFields.includes(field)) addedFields.push(field);
  }

  if (source.declaredCampaignId && source.declaredCampaignId !== stat.campaign_id) {
    conflicts.push('存档外层 campaign_id 与快照不一致');
  }
  if (source.declaredCampaignRevision !== undefined && source.declaredCampaignRevision !== null
      && source.declaredCampaignRevision !== stat.campaign_revision) {
    conflicts.push('存档外层 campaign_revision 与快照不一致');
  }
  if (!CAMPAIGNS.includes(stat.campaign_id)) conflicts.push(`未知战役 ${String(stat.campaign_id)}`);
  if (stat.campaign_revision !== 1) conflicts.push(`不支持战役修订 ${String(stat.campaign_revision)}`);
  if (stat.campaign_id === 'main' && Number.isInteger(stat.current_scene)
      && (stat.current_scene < 1 || stat.current_scene > 150)) {
    conflicts.push(`主线场景 ${stat.current_scene} 无有效迁移别名`);
  }
  if (stat.campaign_id === 'main' && !MAIN_POVS.includes(stat.current_pov ?? null)) conflicts.push('主线玩家视点非法');
  if (stat.campaign_id === 'dlc_genderbend_hachiman') {
    const dlcPovOk =
      (stat.current_pov === 'hachiman_f' && stat.identity_state?.kind === 'transformation') ||
      (['yukino', 'yui', 'laff'].includes(stat.current_pov ?? '') && stat.identity_state === null) ||
      (stat.current_pov === null && stat.identity_state === null && stat.custom_protagonist !== null);
    if (stat.mode !== 'free' || !dlcPovOk) {
      conflicts.push('《错位的日常》身份组合不合法');
    }
  }
  if (stat.campaign_id === 'dlc_body_swap_mrs_yukinoshita') {
    const occupants = stat.identity_state?.occupants;
    if (stat.mode !== 'free' || !['hachiman', 'mrs_yukinoshita'].includes(stat.current_pov)
        || stat.identity_state?.kind !== 'body_swap' || !occupants
        || occupants.body_hachiman === occupants.body_mrs_yukinoshita) {
      conflicts.push('《君的名字？》身份矩阵不合法');
    }
  }
  if (stat.campaign_id !== 'main') stat.mainline_completed = false;

  const parsed = Schema.safeParse(stat);
  if (!parsed.success) conflicts.push('当前变量结构校验失败');
  const campaignId = CAMPAIGNS.includes(stat.campaign_id) ? stat.campaign_id : 'unknown';
  const tableSheets = source.tableSheets ?? null;
  const tableSheetCount = countAcuSheets(tableSheets);
  if (tableSheetCount > 0) steps.push(`检测到数据库表格 ${tableSheetCount} 张，将随变量一并迁移`);
  const report: CompatibilityReport = {
    status: conflicts.length ? 'incompatible' : steps.length ? 'migratable' : 'exact',
    sourceVersion,
    schemaVersion,
    campaignId,
    campaignRevision: Number.isInteger(stat.campaign_revision) ? stat.campaign_revision : null,
    playerViewpoint: stat.current_pov ?? stat.custom_protagonist?.name ?? null,
    scene: Number.isInteger(stat.current_scene) ? stat.current_scene : null,
    date: stat.world?.current_date ?? null,
    location: stat.world?.current_location ?? null,
    recoveredFloor: source.recoveredFloor,
    messageCount: source.messageCount,
    tableSheetCount,
    migrationSteps: steps,
    addedFields,
    discardedFields,
    conflicts,
    warnings: source.warnings,
  };
  return {
    report,
    statData: conflicts.length || !parsed.success ? null : parsed.data as Record<string, any>,
    resumeTail: source.resumeTail,
    legacyEstablishedFacts: [...new Set([...(source.legacyEstablishedFacts ?? []), ...ledgerFacts])],
    tableSheets,
    provenance: source,
  };
}

export function isRecoverableStat(
  statData: Record<string, any>,
  declared: Pick<ParsedSaveSource, 'declaredCampaignId' | 'declaredCampaignRevision'> = {},
): boolean {
  return migrateParsedSave({
    source: 'sillytavern-jsonl', cardVersion: null, schemaVersion: null, ...declared, statData,
    resumeTail: [], messageCount: 0, recoveredFloor: null, warnings: [], sha256: '',
  }).statData !== null;
}
