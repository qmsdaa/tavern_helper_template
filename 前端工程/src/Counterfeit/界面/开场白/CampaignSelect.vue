<template>
  <main class="campaign-select">
    <header>
      <p class="eyebrow">NEW GAME</p>
      <h2>选择故事</h2>
      <p class="notice">{{ CAMPAIGN_COPY.main.warning }}</p>
    </header>
    <div class="campaign-grid">
      <button v-for="id in ids" :key="id" class="campaign-card" @click="store.chooseCampaign(id)">
        <span class="badge">{{ CAMPAIGN_COPY[id].badge }}</span>
        <strong>{{ CAMPAIGN_COPY[id].title }}</strong>
      </button>
    </div>
    <button class="btn-ghost" @click="store.backToTitle()"><i class="fa-solid fa-arrow-left"></i> 返回标题</button>
  </main>
</template>

<script setup lang="ts">
import { CAMPAIGN_COPY } from './copy';
import { useOpeningStore, type CampaignId } from './store';
const store = useOpeningStore();
const ids: CampaignId[] = ['main', 'dlc_genderbend_hachiman', 'dlc_body_swap_mrs_yukinoshita'];
</script>

<style scoped lang="scss">
.campaign-select{min-height:100vh;min-height:100dvh;padding:32px 16px;display:flex;flex-direction:column;align-items:center;gap:22px;background:linear-gradient(160deg,var(--c-bg),var(--c-surface-muted))}header{max-width:560px;text-align:center}h2{font:600 28px var(--font-display);letter-spacing:4px;margin:6px 0}.eyebrow{font-size:11px;letter-spacing:4px;color:var(--c-primary-strong)}.notice{margin:10px auto 0;padding:9px 14px;max-width:520px;border-left:3px solid var(--c-warning);border-radius:6px;background:color-mix(in srgb,var(--c-warning) 8%,transparent);font-size:12px;line-height:1.6;color:var(--c-text-muted);text-align:left}.campaign-grid{width:100%;max-width:660px;display:grid;gap:14px}.campaign-card{text-align:left;padding:16px 18px;border:1px solid var(--c-border);border-radius:14px;background:var(--c-surface);display:flex;align-items:center;gap:12px;box-shadow:var(--shadow-card);transition:.18s}.campaign-card:hover{transform:translateY(-2px);border-color:var(--c-primary)}.campaign-card strong{font-size:19px}.badge{width:max-content;padding:3px 9px;border-radius:999px;background:var(--c-primary-soft);color:var(--c-primary-strong);font-size:11px}
</style>
