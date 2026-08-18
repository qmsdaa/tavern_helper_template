<template>
  <main class="dlc-setup">
    <section class="card setup-card">
      <header class="setup-head">
        <span class="badge">{{ copy.badge }}</span>
        <h2>{{ copy.title }}</h2>
        <p>{{ copy.premise }}</p>
      </header>
      <figure class="identity-art">
        <img :src="identityArt.url" :alt="identityArt.alt" />
        <figcaption><strong>{{ identityArt.title }}</strong><span>{{ identityArt.caption }}</span></figcaption>
      </figure>
      <section class="picker-block">
        <h3>玩家意识</h3>
        <div v-if="store.campaignId === 'dlc_body_swap_mrs_yukinoshita'" class="mind-picker">
          <button :class="{active:store.dlcMind==='hachiman'}" @click="store.dlcMind='hachiman'">
            <strong>比企谷八幡的意识</strong><span>开局位于雪之下夫人的身体</span>
          </button>
          <button :class="{active:store.dlcMind==='mrs_yukinoshita'}" @click="store.dlcMind='mrs_yukinoshita'">
            <strong>雪之下夫人的意识</strong><span>开局位于比企谷八幡的身体</span>
          </button>
        </div>
        <div v-else class="fixed-mind"><strong>比企谷八幡</strong><span>外观变化不会创建第二个八幡。</span></div>
      </section>
      <section class="picker-block">
        <h3>恋爱难度</h3>
        <div class="difficulty-row">
          <button v-for="d in DIFFICULTY_LIST" :key="d" :class="{active:store.difficulty===d}" @click="store.difficulty=d">
            <strong>{{ DIFFICULTY_COPY[d].label }}</strong><span>{{ DIFFICULTY_COPY[d].desc }}</span>
          </button>
        </div>
      </section>
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
.dlc-setup{min-height:100vh;min-height:100dvh;display:flex;align-items:flex-start;justify-content:center;padding:40px 16px;background:linear-gradient(160deg,var(--c-bg),var(--c-surface-muted))}
.setup-card{width:100%;max-width:640px;padding:0 0 20px;display:grid;gap:0;overflow:hidden}
.setup-head{padding:26px 26px 20px;background:linear-gradient(135deg,var(--c-primary-soft),transparent 70%);border-bottom:1px solid var(--c-border);display:grid;gap:8px;justify-items:start}
.badge{padding:3px 10px;border-radius:999px;background:var(--c-surface);border:1px solid var(--c-primary);color:var(--c-primary-strong);font-size:11px;letter-spacing:1px}
.setup-head h2{font:600 26px var(--font-display);letter-spacing:3px}
.setup-head p{line-height:1.75;color:var(--c-text-muted);font-size:13.5px}
.identity-art{margin:20px 26px 0;padding:14px 18px 0;border:1px solid var(--c-border);border-radius:14px;background:radial-gradient(120% 140% at 18% 100%,var(--c-primary-soft),transparent 55%),linear-gradient(135deg,var(--c-surface-muted),var(--c-surface));display:grid;grid-template-columns:150px 1fr;align-items:end;gap:18px;overflow:hidden}
.identity-art img{width:150px;height:188px;object-fit:contain;object-position:center bottom;filter:drop-shadow(0 8px 12px rgb(34 26 30 / .2))}
.identity-art figcaption{align-self:center;display:grid;gap:6px;padding-bottom:6px}
.identity-art figcaption strong{font-size:15px}
.identity-art figcaption span{font-size:12px;line-height:1.65;color:var(--c-text-muted)}
.picker-block{margin:22px 26px 0;display:grid;gap:10px}
.picker-block h3{font-size:12px;letter-spacing:3px;color:var(--c-text-muted);display:flex;align-items:center;gap:10px}
.picker-block h3::after{content:'';flex:1;height:1px;background:var(--c-border)}
.mind-picker,.difficulty-row{display:grid;gap:10px}
.mind-picker button,.difficulty-row button,.fixed-mind{padding:13px 15px;border:1px solid var(--c-border);border-radius:12px;background:var(--c-surface-muted);display:flex;flex-direction:column;gap:4px;text-align:left;transition:border-color .15s ease,box-shadow .15s ease,background .15s ease,transform .15s ease}
.mind-picker button:hover,.difficulty-row button:hover{border-color:var(--c-primary);transform:translateY(-1px)}
.mind-picker button.active,.difficulty-row button.active{border-color:var(--c-primary);background:var(--c-primary-soft);box-shadow:0 0 0 1px var(--c-primary),0 6px 16px rgb(183 149 245 / .18)}
button span,.fixed-mind span{font-size:11.5px;line-height:1.5;color:var(--c-text-muted)}
.fixed-mind{background:var(--c-surface)}
.difficulty-row{grid-template-columns:repeat(3,1fr)}
.difficulty-row button{text-align:center;align-items:center}
.warning{margin:22px 26px 0;padding:11px 14px;border-left:3px solid var(--c-warning);border-radius:0 8px 8px 0;background:color-mix(in srgb,var(--c-warning) 8%,transparent);font-size:12.5px;line-height:1.65;color:var(--c-text-muted)}
footer{margin:24px 26px 0;display:flex;justify-content:space-between;align-items:center}
@media(max-width:520px){.dlc-setup{padding:20px 12px}.difficulty-row{grid-template-columns:1fr}.setup-head{padding:20px 18px 16px}.identity-art,.picker-block,.warning,footer{margin-left:18px;margin-right:18px}.identity-art{grid-template-columns:112px 1fr}.identity-art img{width:112px;height:168px}}
</style>
