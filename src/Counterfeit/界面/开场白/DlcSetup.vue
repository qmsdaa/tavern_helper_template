<template>
  <main class="dlc-setup">
    <section class="card setup-card">
      <span class="badge">{{ copy.badge }}</span>
      <h2>{{ copy.title }}</h2>
      <p>{{ copy.premise }}</p>
      <figure class="identity-art">
        <img :src="identityArt.url" :alt="identityArt.alt" />
        <figcaption><strong>{{ identityArt.title }}</strong><span>{{ identityArt.caption }}</span></figcaption>
      </figure>
      <div v-if="store.campaignId === 'dlc_body_swap_mrs_yukinoshita'" class="mind-picker">
        <h3>选择玩家意识</h3>
        <button :class="{active:store.dlcMind==='hachiman'}" @click="store.dlcMind='hachiman'">
          <strong>比企谷八幡的意识</strong><span>开局位于雪之下夫人的身体</span>
        </button>
        <button :class="{active:store.dlcMind==='mrs_yukinoshita'}" @click="store.dlcMind='mrs_yukinoshita'">
          <strong>雪之下夫人的意识</strong><span>开局位于比企谷八幡的身体</span>
        </button>
      </div>
      <div v-else class="fixed-mind"><strong>玩家意识：比企谷八幡</strong><span>外观变化不会创建第二个八幡。</span></div>
      <h3>恋爱难度</h3>
      <div class="difficulty-row">
        <button v-for="d in DIFFICULTY_LIST" :key="d" :class="{active:store.difficulty===d}" @click="store.difficulty=d">
          <strong>{{ DIFFICULTY_COPY[d].label }}</strong><span>{{ DIFFICULTY_COPY[d].desc }}</span>
        </button>
      </div>
      <p class="warning">{{ copy.warning }}</p>
      <footer><button class="btn-ghost" @click="store.toCampaign()">返回</button><button class="btn-primary" @click="store.confirmDlc()">预览开局</button></footer>
    </section>
  </main>
</template>

<script setup lang="ts">
import { CAMPAIGN_COPY, DIFFICULTY_COPY, DIFFICULTY_LIST } from './copy';
import { ASSET_VERSION, PORTRAIT_BASE } from '../../config';
import { useOpeningStore } from './store';
const store=useOpeningStore();
const copy=computed(()=>CAMPAIGN_COPY[store.campaignId]);
const portrait=(key:string)=>`${PORTRAIT_BASE}/${key}.webp?v=${ASSET_VERSION}`;
const identityArt=computed(()=>{
  if(store.campaignId==='dlc_genderbend_hachiman') return {
    url:portrait('genderbend_hachiman'),alt:'女性化身体的比企谷八幡全身立绘',title:'当前身份：比企谷八幡',caption:'身体呈现已经变化，意识、姓名与过去仍属于八幡。',
  };
  if(store.dlcMind==='mrs_yukinoshita') return {
    url:portrait('hachiman'),alt:'比企谷八幡身体的全身立绘',title:'开局身体：比企谷八幡',caption:'玩家意识是雪之下夫人；旁人首先看到的是八幡的身体。',
  };
  return {
    url:portrait('mrs_yukinoshita'),alt:'雪之下夫人身体的全身立绘',title:'开局身体：雪之下夫人',caption:'玩家意识是比企谷八幡；旁人首先看到的是雪之下夫人的身体。',
  };
});
</script>

<style scoped lang="scss">
.dlc-setup{min-height:100vh;min-height:100dvh;display:flex;justify-content:center;padding:28px 16px}.setup-card{width:100%;max-width:620px;padding:24px;display:grid;gap:14px}.badge{width:max-content;padding:3px 9px;border-radius:999px;background:var(--c-primary-soft);color:var(--c-primary-strong);font-size:11px}h2{font-size:24px}.setup-card>p{line-height:1.7;color:var(--c-text-muted)}.identity-art{min-height:188px;margin:0;padding:12px 14px 0;border:1px solid var(--c-border);border-radius:12px;background:linear-gradient(135deg,var(--c-surface-muted),var(--c-surface));display:grid;grid-template-columns:150px 1fr;align-items:end;gap:16px;overflow:hidden}.identity-art img{width:150px;height:188px;object-fit:contain;object-position:center bottom;filter:drop-shadow(0 7px 10px rgb(34 26 30 / .18))}.identity-art figcaption{align-self:center;display:grid;gap:6px}.identity-art figcaption strong{font-size:15px}.identity-art figcaption span{font-size:12px;line-height:1.6;color:var(--c-text-muted)}h3{font-size:14px;letter-spacing:2px}.mind-picker,.difficulty-row{display:grid;gap:9px}.mind-picker button,.difficulty-row button,.fixed-mind{padding:12px;border:1px solid var(--c-border);border-radius:10px;background:var(--c-surface-muted);display:flex;flex-direction:column;gap:3px;text-align:left}.mind-picker button.active,.difficulty-row button.active{border-color:var(--c-primary);box-shadow:0 0 0 1px var(--c-primary)}button span,.fixed-mind span{font-size:11px;color:var(--c-text-muted)}.difficulty-row{grid-template-columns:repeat(3,1fr)}.difficulty-row button{text-align:center}.warning{padding:10px;border-left:3px solid var(--c-warning);background:color-mix(in srgb,var(--c-warning) 8%,transparent)}footer{display:flex;justify-content:space-between;margin-top:8px}@media(max-width:520px){.difficulty-row{grid-template-columns:1fr}.setup-card{padding:18px}.identity-art{grid-template-columns:112px 1fr}.identity-art img{width:112px;height:168px}}
</style>
