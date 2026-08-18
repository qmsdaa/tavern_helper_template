// Generated from build_tools/cg_unlock_predicate.mjs. Do not edit.
export interface CgStatLike {
  campaign_id?: string;
  current_scene?: number;
  campaign_completed?: boolean;
  mainline_completed?: boolean;
  collection?: { cg_unlocks?: Record<string, boolean> };
}
export type CgUnlockPredicate =
  | { type: 'scene_completed'; scene: number }
  | { type: 'collection_unlock' | 'opening_seen' | 'fact_observed'; unlock_id?: string };
export interface CgManifestItem {
  id: string;
  campaign_id: string;
  scene?: number;
  unlock: CgUnlockPredicate;
  [key: string]: unknown;
}
export interface CgManifestLike { items?: readonly CgManifestItem[] }

export function campaignIdOf(stat: CgStatLike | null | undefined): string {
  return typeof stat?.campaign_id === 'string' && stat.campaign_id ? stat.campaign_id : 'main';
}

export function completedScene(stat: CgStatLike | null | undefined): number {
  if (!stat || campaignIdOf(stat) !== 'main') return 0;
  const currentScene = Math.min(150, Math.max(1, Number(stat.current_scene || 1)));
  return stat.campaign_completed === true || stat.mainline_completed === true ? 150 : currentScene - 1;
}

export function hasCollectionUnlock(stat: CgStatLike | null | undefined, unlockId: string | undefined): boolean {
  return Boolean(unlockId && stat?.collection?.cg_unlocks?.[unlockId] === true);
}

export function evaluateCgUnlockPredicate(unlock: CgUnlockPredicate | null | undefined, stat: CgStatLike | null | undefined, item: CgManifestItem | null | undefined): boolean {
  if (!unlock || !stat || !item) return false;
  if (unlock.type === 'scene_completed') {
    return campaignIdOf(stat) === item.campaign_id && completedScene(stat) >= Number(unlock.scene);
  }
  if (unlock.type === 'collection_unlock' || unlock.type === 'opening_seen' || unlock.type === 'fact_observed') {
    return hasCollectionUnlock(stat, unlock.unlock_id || item.id);
  }
  return false;
}

export function isCgUnlocked(item: CgManifestItem | null | undefined, stat: CgStatLike | null | undefined): boolean {
  if (!item || !stat) return false;
  return hasCollectionUnlock(stat, item.id) || evaluateCgUnlockPredicate(item.unlock, stat, item);
}

export function pickCgReveal(manifest: CgManifestLike | null | undefined, prevStat: CgStatLike | null | undefined, curStat: CgStatLike | null | undefined): CgManifestItem | null {
  if (!manifest || !Array.isArray(manifest.items) || !curStat) return null;
  const campaignId = campaignIdOf(curStat);
  const candidates = manifest.items.filter(item =>
    item?.campaign_id === campaignId && !isCgUnlocked(item, prevStat) && isCgUnlocked(item, curStat),
  );
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => Number(a.scene || 0) - Number(b.scene || 0) || String(a.id).localeCompare(String(b.id)));
  return candidates.at(-1) || null;
}

