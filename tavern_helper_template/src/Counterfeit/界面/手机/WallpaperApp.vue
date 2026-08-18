<template>
  <div class="app-screen">
    <AppHeader title="壁纸" />

    <div class="wallpaper-scroll">
      <!-- 当前 -->
      <section class="section">
        <h3 class="section-title">当前壁纸</h3>
        <div class="current-preview" :style="previewStyle">
          <span v-if="store.wallpaper.type === 'default'" class="preview-label">晨曦粉紫</span>
        </div>
      </section>

      <!-- 默认 -->
      <section class="section">
        <h3 class="section-title">默认</h3>
        <div class="wall-grid">
          <button
            class="wall-item"
            :class="{ active: store.wallpaper.type === 'default' }"
            @click="store.setWallpaper({ type: 'default', value: '' })"
          >
            <span class="wall-thumb wall-thumb--default"></span>
            <span class="wall-name">晨曦粉紫</span>
            <i v-if="store.wallpaper.type === 'default'" class="fa-solid fa-circle-check wall-check"></i>
          </button>
        </div>
      </section>

      <!-- 内置 -->
      <section v-if="presets.length" class="section">
        <h3 class="section-title">内置</h3>
        <div class="wall-grid">
          <button
            v-for="p in presets"
            :key="p.image"
            class="wall-item"
            :class="{ active: isActivePreset(p.image) }"
            @click="store.setWallpaper({ type: 'preset', value: p.image })"
          >
            <span class="wall-thumb" :style="{ backgroundImage: `url('${assetUrl(p.image)}')` }"></span>
            <span class="wall-name">{{ p.name }}</span>
            <i v-if="isActivePreset(p.image)" class="fa-solid fa-circle-check wall-check"></i>
          </button>
        </div>
      </section>

      <!-- 自定义 -->
      <section class="section">
        <h3 class="section-title">自定义</h3>
        <div class="wall-grid">
          <button class="wall-item" @click="fileInput?.click()">
            <span class="wall-thumb wall-thumb--upload"><i class="fa-solid fa-plus"></i></span>
            <span class="wall-name">上传照片</span>
          </button>
          <button v-if="store.wallpaper.type === 'custom'" class="wall-item active">
            <span class="wall-thumb" :style="{ backgroundImage: `url('${store.wallpaper.value}')` }"></span>
            <span class="wall-name">我的照片</span>
            <i class="fa-solid fa-circle-check wall-check"></i>
          </button>
        </div>
        <input ref="fileInput" type="file" accept="image/*" hidden @change="onUpload" />
        <p class="hint">上传的照片会压缩到 1080px 并随存档保存；换存档互不影响。</p>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import AppHeader from './AppHeader.vue';
import { DEFAULT_HOME_BG } from './apps';
import { assetUrl } from './vars';
import { usePhoneStore } from './store';
import { GENERATED_WALLPAPERS } from './wallpapers.generated';

const store = usePhoneStore();
const presets = GENERATED_WALLPAPERS;
const fileInput = ref<HTMLInputElement | null>(null);

const previewStyle = computed(() => {
  const w = store.wallpaper;
  if (w.type === 'preset') {
    return { backgroundImage: `url('${assetUrl(w.value)}')` };
  }
  if (w.type === 'custom') {
    return { backgroundImage: `url('${w.value}')` };
  }
  return { backgroundImage: DEFAULT_HOME_BG };
});

function isActivePreset(image: string): boolean {
  return store.wallpaper.type === 'preset' && store.wallpaper.value === image;
}

function onUpload(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1080 / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      let dataUrl = canvas.toDataURL('image/webp', 0.82);
      if (!dataUrl.startsWith('data:image/webp')) {
        dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      }
      store.setWallpaper({ type: 'custom', value: dataUrl });
    };
    img.src = String(reader.result);
  };
  reader.readAsDataURL(file);
  input.value = '';
}
</script>

<style lang="scss" scoped>
.app-screen {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--c-phone-screen);
  min-height: 0;
}

.wallpaper-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 8px 16px 20px;
}

.section {
  margin-bottom: 18px;
}

.section-title {
  font-size: 13px;
  color: var(--c-ios-gray);
  letter-spacing: 2px;
  margin-bottom: 10px;
}

.current-preview {
  height: 180px;
  border-radius: 18px;
  background-size: cover;
  background-position: center;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.18);
  display: flex;
  align-items: flex-end;
  padding: 12px;
}

.preview-label {
  color: #fff;
  font-size: 13px;
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.5);
}

.wall-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.wall-item {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 5px;
  align-items: center;

  &.active .wall-thumb {
    outline: 2.5px solid var(--c-ios-blue);
    outline-offset: 2px;
  }
}

.wall-thumb {
  width: 100%;
  aspect-ratio: 9 / 16;
  border-radius: 14px;
  background-size: cover;
  background-position: center;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.12);

  &--default {
    background-image:
      radial-gradient(120% 90% at 20% 0%, rgba(229, 138, 165, 0.35), transparent 55%),
      radial-gradient(120% 100% at 90% 100%, rgba(167, 139, 250, 0.4), transparent 60%),
      linear-gradient(165deg, #3a3040, #241d2c 55%, #17121c);
  }

  &--upload {
    background: #fff;
    border: 2px dashed var(--c-separator);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--c-ios-blue);
    font-size: 24px;
    box-shadow: none;
  }
}

.wall-name {
  font-size: 11px;
  color: var(--c-text);
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wall-check {
  position: absolute;
  top: -5px;
  right: -5px;
  color: var(--c-ios-blue);
  background: #fff;
  border-radius: 50%;
  font-size: 17px;
}

.hint {
  margin-top: 10px;
  font-size: 12px;
  color: var(--c-ios-gray);
  line-height: 1.7;
}
</style>
