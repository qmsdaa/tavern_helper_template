<template>
  <main class="campaign-select">
    <header>
      <p class="eyebrow">NEW GAME</p>
      <h2>选择故事</h2>
      <p>战役决定连续性与开局；进入存档后不能切换。</p>
    </header>
    <div class="campaign-grid">
      <button v-for="id in ids" :key="id" class="campaign-card" @click="store.chooseCampaign(id)">
        <span class="badge">{{ CAMPAIGN_COPY[id].badge }}</span>
        <strong>{{ CAMPAIGN_COPY[id].title }}</strong>
        <span>{{ CAMPAIGN_COPY[id].premise }}</span>
        <small>{{ CAMPAIGN_COPY[id].warning }}</small>
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
.campaign-select{min-height:100vh;min-height:100dvh;padding:32px 16px;display:flex;flex-direction:column;align-items:center;gap:22px;background:linear-gradient(160deg,var(--c-bg),var(--c-surface-muted))}header{max-width:560px;text-align:center}h2{font:600 28px var(--font-display);letter-spacing:4px;margin:6px 0}.eyebrow{font-size:11px;letter-spacing:4px;color:var(--c-primary-strong)}header>p:last-child{font-size:13px;color:var(--c-text-muted)}.campaign-grid{width:100%;max-width:660px;display:grid;gap:14px}.campaign-card{text-align:left;padding:18px;border:1px solid var(--c-border);border-radius:14px;background:var(--c-surface);display:grid;gap:8px;box-shadow:var(--shadow-card);transition:.18s}.campaign-card:hover{transform:translateY(-2px);border-color:var(--c-primary)}.campaign-card strong{font-size:19px}.campaign-card>span:not(.badge){font-size:13px;line-height:1.65}.campaign-card small{color:var(--c-text-muted);line-height:1.55}.badge{width:max-content;padding:3px 9px;border-radius:999px;background:var(--c-primary-soft);color:var(--c-primary-strong);font-size:11px}
</style>
