<template>
  <div class="gallery-screen">
    <div class="title-row">
      <h2 class="screen-title">{{ GALLERY_COPY.title }}</h2>
      <button
        class="admin-toggle"
        :class="{ 'is-on': adminMode }"
        :title="adminMode ? '退出管理模式' : '管理 CG'"
        @click="adminMode = !adminMode"
      >
        <i class="fa-solid" :class="adminMode ? 'fa-xmark' : 'fa-gear'"></i>
      </button>
    </div>
    <p class="gallery-hint">{{ GALLERY_COPY.hint }}</p>
    <div class="gallery-filters">
      <select v-model="actFilter" aria-label="按幕筛选">
        <option value="all">全部幕</option>
        <option v-for="act in 10" :key="act" :value="String(act)">第 {{ act }} 幕</option>
      </select>
      <label><input v-model="unlockedOnly" type="checkbox" /> 仅已解锁</label>
    </div>

    <!-- 管理栏 -->
    <div v-if="adminMode" class="admin-bar">
      <p class="admin-hint">
        管理模式：点帧上的 <i class="fa-solid fa-trash-can"></i> 删除（需点两次确认）· 自定义 CG 仅保存在本浏览器
      </p>
      <div class="admin-actions">
        <button class="btn-primary admin-add" @click="openAdd"><i class="fa-solid fa-plus"></i> 添加 CG</button>
        <button v-if="tombstoneCount > 0" class="btn-ghost" @click="onRestore">
          <i class="fa-solid fa-rotate-left"></i> 恢复内置 CG（{{ tombstoneCount }}）
        </button>
      </div>
    </div>

    <div class="film-strip" @mouseenter="paused = true" @mouseleave="paused = false">
      <div class="film-holes"></div>
      <div class="film-clip">
        <div class="film-track" :class="{ 'is-paused': paused || adminMode }" :style="{ animationDuration: `${duration}s` }">
          <figure v-for="(item, i) in loopItems" :key="i" class="film-frame" @click="openLightbox(item)">
            <div class="frame-thumb" :class="{ 'is-placeholder': !item.src }">
              <img v-if="item.src" :src="item.src" :alt="item.alt || item.title" draggable="false" />
              <template v-else>
                <i class="fa-regular fa-image"></i>
                <span>CG 占位</span>
              </template>
            </div>
            <figcaption class="frame-label">
              <span class="frame-no">{{ frameNo(i) }}</span>
              <span class="frame-title">{{ item.title }}</span>
              <span v-if="!item.builtin" class="frame-badge">自定义</span>
            </figcaption>
            <button
              v-if="adminMode && item.src"
              class="admin-del"
              :class="{ 'is-armed': armedKey === item.key }"
              :title="armedKey === item.key ? '再点一次确认删除' : '删除'"
              @click.stop="onDeleteFrame(item)"
            >
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </figure>
        </div>
      </div>
      <div class="film-holes"></div>
    </div>

    <div class="footer">
      <button class="btn-ghost" @click="store.backToTitle()"><i class="fa-solid fa-arrow-left"></i> 返回标题</button>
    </div>

    <!-- 放大灯箱 -->
    <Teleport to="body">
      <div v-if="active" class="lightbox" @click="active = null">
        <figure class="lightbox-inner" @click.stop>
          <img v-if="active.src" :src="active.src" :alt="active.title" draggable="false" />
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

    <!-- 添加 CG 对话框 -->
    <Teleport to="body">
      <div v-if="showAdd" class="add-dialog" @click.self="closeAdd">
        <div class="add-card">
          <h3 class="add-title"><i class="fa-solid fa-plus"></i> 添加 CG</h3>

          <label class="add-picker" :class="{ 'has-image': addPreview }">
            <input type="file" accept="image/*" @change="onPickFile" />
            <img v-if="addPreview" :src="addPreview" alt="预览" draggable="false" />
            <template v-else>
              <i class="fa-solid fa-cloud-arrow-up"></i>
              <span>点击选择图片（jpg / png / webp）</span>
            </template>
          </label>

          <label class="add-field">
            <span>标题</span>
            <input v-model="addTitle" type="text" maxlength="24" placeholder="留空则用文件名" />
          </label>
          <label class="add-field">
            <span>说明</span>
            <textarea v-model="addCaption" rows="2" maxlength="80" placeholder="一句话说明（可留空）"></textarea>
          </label>

          <div class="add-actions">
            <button class="btn-ghost" @click="closeAdd">取消</button>
            <button class="btn-primary" :disabled="!addFile || saving" @click="saveAdd">
              {{ saving ? '保存中…' : '保存' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { GALLERY_COPY } from './copy';
import {
  addCustomItem,
  galleryItems,
  initGalleryAdmin,
  refreshGalleryProgress,
  removeItem,
  restoreBuiltins,
  tombstoneCount,
  type GalleryViewItem,
} from './galleryAdmin';
import { useOpeningStore } from './store';
import { showToast } from './toast';

const store = useOpeningStore();
const paused = ref(false);
const active = ref<GalleryViewItem | null>(null);
const actFilter = ref('all');
const unlockedOnly = ref(false);

// —— 管理模式 ——
const adminMode = ref(false);
/** 删除二次确认：第一次点击只是「上膛」 */
const armedKey = ref<string | null>(null);
let armTimer: number | undefined;

onMounted(() => {
  refreshGalleryProgress();
  initGalleryAdmin();
  window.addEventListener('keydown', onGalleryKeydown);
});
onUnmounted(() => window.removeEventListener('keydown', onGalleryKeydown));

const baseItems = computed<GalleryViewItem[]>(() => galleryItems.value.filter(item => {
  if (unlockedOnly.value && item.unlocked === false) return false;
  if (actFilter.value !== 'all' && item.act !== Number(actFilter.value)) return false;
  return true;
}));

/** 单序列：条目太少时重复填充，保证轨道宽度足够无缝循环 */
const sequence = computed<GalleryViewItem[]>(() => {
  const repeat = Math.max(1, Math.ceil(6 / Math.max(1, baseItems.value.length)));
  return Array.from({ length: repeat }, () => baseItems.value).flat();
});

/** 双序列：动画平移 -50% 即回起点，形成无缝放映带 */
const loopItems = computed<GalleryViewItem[]>(() => [...sequence.value, ...sequence.value]);

/** 每帧约 5 秒，整条至少 30 秒 */
const duration = computed(() => Math.max(30, sequence.value.length * 5));

function frameNo(i: number): string {
  return String((i % Math.max(1, baseItems.value.length)) + 1).padStart(2, '0');
}

function openLightbox(item: GalleryViewItem) {
  if (adminMode.value) {
    return;
  }
  if (item.src) {
    active.value = item;
  }
}

function onGalleryKeydown(event: KeyboardEvent) {
  if (!active.value || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
  const unlocked = baseItems.value.filter(item => item.src);
  const index = unlocked.findIndex(item => item.key === active.value?.key);
  if (index < 0 || !unlocked.length) return;
  const delta = event.key === 'ArrowRight' ? 1 : -1;
  active.value = unlocked[(index + delta + unlocked.length) % unlocked.length];
}

async function onDeleteFrame(item: GalleryViewItem) {
  if (armedKey.value !== item.key) {
    armedKey.value = item.key;
    window.clearTimeout(armTimer);
    armTimer = window.setTimeout(() => (armedKey.value = null), 2200);
    return;
  }
  armedKey.value = null;
  try {
    await removeItem(item);
    showToast(`已删除「${item.title}」`, 'success');
  } catch (error) {
    console.error('[画廊] 删除失败', error);
    showToast('删除失败，请重试', 'error');
  }
}

function onRestore() {
  restoreBuiltins();
  showToast('已恢复全部内置 CG', 'success');
}

// —— 添加 CG 对话框 ——
const showAdd = ref(false);
const addFile = ref<File | null>(null);
const addPreview = ref('');
const addTitle = ref('');
const addCaption = ref('');
const saving = ref(false);

function openAdd() {
  showAdd.value = true;
}

function closeAdd() {
  showAdd.value = false;
  addFile.value = null;
  addTitle.value = '';
  addCaption.value = '';
  if (addPreview.value) {
    URL.revokeObjectURL(addPreview.value);
    addPreview.value = '';
  }
}

function onPickFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) {
    return;
  }
  if (!file.type.startsWith('image/')) {
    showToast('请选择图片文件', 'error');
    return;
  }
  addFile.value = file;
  if (addPreview.value) {
    URL.revokeObjectURL(addPreview.value);
  }
  addPreview.value = URL.createObjectURL(file);
  if (!addTitle.value) {
    addTitle.value = file.name.replace(/\.[^.]+$/, '');
  }
}

async function saveAdd() {
  if (!addFile.value || saving.value) {
    return;
  }
  saving.value = true;
  try {
    await addCustomItem(addFile.value, addTitle.value, addCaption.value);
    showToast('已加入画廊', 'success');
    closeAdd();
  } catch (error) {
    console.error('[画廊] 保存失败', error);
    showToast('保存失败：浏览器存储不可用或已满', 'error');
  } finally {
    saving.value = false;
  }
}
</script>

<style lang="scss" scoped>
.gallery-screen {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px 0 40px;
  overflow-x: hidden;
}

.title-row {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
}

.screen-title {
  font-family: var(--font-display);
  font-size: 24px;
  font-weight: 400;
  letter-spacing: 4px;
  color: var(--c-text);
  margin-bottom: 8px;
}

.admin-toggle {
  position: absolute;
  right: 16px;
  top: 0;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: var(--c-surface);
  box-shadow: var(--shadow-card);
  color: var(--c-text-muted);
  font-size: 15px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    color 0.15s ease,
    transform 0.15s ease;

  &:hover {
    color: var(--c-primary-strong);
    transform: rotate(30deg);
  }

  &.is-on {
    color: var(--c-primary-strong);
    transform: none;
  }
}

.gallery-hint {
  font-size: 13px;
  color: var(--c-text-muted);
  margin-bottom: 24px;
  padding: 0 16px;
  text-align: center;
}

/* —— 管理栏 —— */

.admin-bar {
  width: min(92vw, 480px);
  margin-bottom: 18px;
  padding: 12px 16px;
  border-radius: var(--radius-card);
  background: var(--c-surface);
  border: 1px dashed var(--c-border-strong);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.admin-hint {
  font-size: 12px;
  color: var(--c-text-muted);
  line-height: 1.6;

  i {
    color: var(--c-danger);
  }
}

.admin-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.admin-add {
  padding: 10px 22px;
  font-size: 14px;
}

/* —— 放映带 —— */

.film-strip {
  width: 100%;
  background: var(--c-film-bg);
  box-shadow: 0 10px 30px rgba(36, 29, 34, 0.35);
}

.film-holes {
  height: 16px;
  background-image: radial-gradient(circle, var(--c-film-hole) 2.6px, transparent 3.4px);
  background-size: 26px 100%;
  background-repeat: repeat-x;
  background-position: center;
}

.film-clip {
  overflow: hidden;
}

.film-track {
  display: flex;
  gap: 16px;
  width: max-content;
  padding: 12px 16px;
  animation: film-scroll linear infinite;

  &.is-paused {
    animation-play-state: paused;
  }
}

@keyframes film-scroll {
  to {
    transform: translateX(-50%);
  }
}

.film-frame {
  position: relative;
  flex: none;
  width: 220px;
  margin: 0;
  background: var(--c-film-bg-deep);
  border: 1px solid var(--c-film-frame-border);
  border-radius: 6px;
  overflow: hidden;
  cursor: pointer;
  transition:
    transform 0.25s ease,
    box-shadow 0.25s ease;

  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4);
  }
}

.frame-thumb {
  aspect-ratio: 16 / 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.04);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    user-select: none;
  }

  &.is-placeholder {
    color: var(--c-film-text);
    opacity: 0.55;
    font-size: 12px;

    i {
      font-size: 24px;
    }
  }
}

.frame-label {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  color: var(--c-film-text);
  font-size: 11px;
}

.frame-no {
  font-family: var(--font-latin);
  letter-spacing: 1px;
  opacity: 0.6;
}

.frame-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.frame-badge {
  flex: none;
  padding: 1px 6px;
  border-radius: 999px;
  background: rgba(229, 138, 165, 0.25);
  color: var(--c-primary-soft);
  font-size: 10px;
}

/* 删除按钮：管理模式显示，二次点击确认 */
.admin-del {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: rgba(20, 14, 18, 0.65);
  color: #fff;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition:
    background 0.15s ease,
    transform 0.15s ease;

  &:hover {
    background: var(--c-danger);
  }

  &.is-armed {
    background: var(--c-danger);
    transform: scale(1.15);
    animation: armed-pulse 0.7s ease-in-out infinite;
  }
}

@keyframes armed-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(217, 95, 95, 0.55);
  }
  50% {
    box-shadow: 0 0 0 7px rgba(217, 95, 95, 0);
  }
}

.footer {
  margin-top: 28px;
  width: 100%;
  max-width: 480px;
  display: flex;
  justify-content: flex-start;
  padding: 0 16px;
}

/* —— 放大灯箱 —— */

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
  background: var(--c-surface);
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
}

.lightbox-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--c-text);
}

.lightbox-caption {
  font-size: 12px;
  color: var(--c-text-muted);
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
  transition: background 0.2s ease;

  &:hover {
    background: rgba(20, 14, 18, 0.8);
  }
}

/* —— 添加 CG 对话框 —— */

.add-dialog {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(20, 14, 18, 0.72);
  backdrop-filter: blur(6px);
  padding: 20px;
}

.add-card {
  width: min(92vw, 420px);
  padding: 22px 20px;
  border-radius: var(--radius-card);
  background: var(--c-surface);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.add-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--c-text);

  i {
    color: var(--c-primary);
    margin-right: 6px;
  }
}

.add-picker {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 140px;
  border: 2px dashed var(--c-border-strong);
  border-radius: 12px;
  color: var(--c-text-muted);
  font-size: 13px;
  cursor: pointer;
  overflow: hidden;
  transition: border-color 0.15s ease;

  &:hover {
    border-color: var(--c-primary);
  }

  input[type='file'] {
    display: none;
  }

  i {
    font-size: 28px;
    color: var(--c-primary);
  }

  &.has-image {
    border-style: solid;
    min-height: 0;
  }

  img {
    width: 100%;
    max-height: 220px;
    object-fit: contain;
    background: var(--c-surface-muted);
  }
}

.add-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  color: var(--c-text-muted);

  input,
  textarea {
    padding: 10px 12px;
    border: 1px solid var(--c-border);
    border-radius: 10px;
    background: var(--c-surface-muted);
    font-size: 14px;
    resize: none;

    &:focus {
      outline: none;
      border-color: var(--c-primary);
      background: var(--c-surface);
    }
  }
}

.add-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;

  .btn-primary {
    padding: 10px 26px;
    font-size: 14px;
  }
}

@media (max-width: 480px) {
  .film-frame {
    width: 178px;
  }
}

/* 减少动态偏好：不自动放映，改手动横滑 */
@media (prefers-reduced-motion: reduce) {
  .film-clip {
    overflow-x: auto;
  }

  .film-track {
    animation: none;
  }
}
</style>
