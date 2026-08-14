<template>
  <div class="app-screen">
    <AppHeader title="CG" />
    <div class="cg-scroll">
      <div v-if="items.length" class="cg-grid">
        <button v-for="item in items" :key="item.id" class="cg-item" :class="{ locked: !item.unlocked }" @click="item.unlocked && (active = item)">
          <img v-if="item.unlocked" :src="item.image" :alt="item.alt" loading="lazy" draggable="false" />
          <span v-else class="cg-lock"><i class="fa-solid fa-lock"></i></span>
          <span class="cg-title">{{ item.unlocked ? item.title : `第${item.act}幕 · 未解锁` }}</span>
        </button>
      </div>
      <div v-else class="cg-empty">
        <i class="fa-regular fa-images"></i>
        <p>还没有 CG</p>
        <p class="cg-empty-hint">
          把图片放进 tavern_helper_template/assets/Counterfeit/开场白/画廊/，<br />
          运行 build_gallery.py 后这里就会出现
        </p>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="active" class="lightbox" @click="active = null">
        <figure class="lightbox-inner" @click.stop>
          <img :src="active.image" :alt="active.alt" draggable="false" />
          <figcaption class="lightbox-info">
            <span class="lightbox-title">{{ active.title }}</span>
            <span v-if="active.caption" class="lightbox-caption">{{ active.caption }}</span>
          </figcaption>
          <button class="lightbox-close" aria-label="关闭" @click="active = null">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </figure>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import AppHeader from './AppHeader.vue';
import { CG_MANIFEST } from '../../generated/cg-manifest.generated';
import { isCgUnlocked } from '../../generated/cg-unlock.generated';
import { usePhoneStore } from './store';

interface CgItem {
  id: string;
  image: string;
  title: string;
  alt: string;
  caption: string;
  act: number;
  unlocked: boolean;
}

const store = usePhoneStore();
const stat = computed(() => ({ campaign_id: store.snapshot.campaignId, current_scene: store.snapshot.scene ?? 1, campaign_completed: store.snapshot.campaignCompleted, collection: store.snapshot.collection }));
const items = computed<CgItem[]>(() => CG_MANIFEST.items.map(item => ({ id: item.id, image: `${CG_MANIFEST.images_base}/${encodeURIComponent(item.file)}`, title: item.title, alt: item.alt, caption: `${item.date} · 场景 ${item.scene}`, act: item.act, unlocked: isCgUnlocked(item, stat.value) })));
const active = ref<CgItem | null>(null);
</script>

<style lang="scss" scoped>
.app-screen {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--c-phone-screen);
  min-height: 0;
}

.cg-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 12px 14px 20px;
}

.cg-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.cg-item {
  display: flex;
  flex-direction: column;
  gap: 5px;
  align-items: center;

  img {
    width: 100%;
    aspect-ratio: 16 / 10;
    object-fit: cover;
    border-radius: 12px;
    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.12);
  }
}

.cg-lock {
  display: grid;
  place-items: center;
  width: 100%;
  aspect-ratio: 16 / 10;
  border-radius: 12px;
  background: linear-gradient(145deg, #ece9ee, #d9d4dc);
  color: #8b8590;
}

.cg-title {
  font-size: 11px;
  color: var(--c-text);
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cg-empty {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--c-ios-gray);

  i {
    font-size: 44px;
    opacity: 0.5;
  }
}

.cg-empty-hint {
  font-size: 12px;
  line-height: 1.8;
  text-align: center;
}

.lightbox {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(20, 14, 18, 0.82);
  backdrop-filter: blur(6px);
  padding: 20px;
}

.lightbox-inner {
  position: relative;
  max-width: min(92vw, 960px);
  margin: 0;
  background: var(--c-surface, #fff);
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5);

  img {
    display: block;
    width: 100%;
    max-height: 72vh;
    object-fit: contain;
    background: #141013;
  }
}

.lightbox-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 16px 14px;
  background: #fff;
}

.lightbox-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--c-text);
}

.lightbox-caption {
  font-size: 12px;
  color: var(--c-ios-gray);
}

.lightbox-close {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  background: rgba(20, 14, 18, 0.55);
  color: #fff;
  font-size: 15px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
