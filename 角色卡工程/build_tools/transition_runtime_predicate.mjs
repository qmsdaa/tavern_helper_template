export function transitionCampaignId(stat) {
  return typeof stat?.campaign_id === 'string' && stat.campaign_id ? stat.campaign_id : 'main';
}

export function transitionSceneNumber(stat) {
  const scene = Number(stat?.current_scene);
  return Number.isInteger(scene) && scene > 0 ? scene : null;
}

/**
 * Select exactly one transition for two adjacent AI-floor snapshots.
 * A jump uses the destination scene's transition and reports how many numbered
 * scenes were skipped; same-scene turns, rewinds, and campaign changes are inert.
 */
export function selectTransitionRuntime(transitionCards, previousStat, currentStat) {
  if (!transitionCards || !previousStat || !currentStat) return null;
  const previousCampaign = transitionCampaignId(previousStat);
  const currentCampaign = transitionCampaignId(currentStat);
  if (previousCampaign !== 'main' || currentCampaign !== 'main' || previousCampaign !== currentCampaign) return null;

  const previousScene = transitionSceneNumber(previousStat);
  const currentScene = transitionSceneNumber(currentStat);
  if (previousScene === null || currentScene === null || previousScene >= currentScene) return null;

  const transition = transitionCards[String(currentScene)];
  if (!transition) return null;
  return {
    ...transition,
    previous_scene: previousScene,
    current_scene: currentScene,
    skipped_scene_count: Math.max(0, currentScene - previousScene - 1),
  };
}
