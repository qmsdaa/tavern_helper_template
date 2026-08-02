<template>
  <div class="char-detail">
    <!-- 顶部角色概览 -->
    <div class="cm-overview">
      <div class="cm-portrait">
        <img v-if="character.portraitUrl" :src="character.portraitUrl" :alt="character.displayName" loading="lazy" />
        <span v-else class="cm-initial">{{ character.displayName.slice(0, 1) }}</span>
      </div>
      <div class="cm-head">
        <div class="cm-title">
          <b class="cm-name">{{ character.displayName }}</b>
          <span v-if="character.commitment === '恋人'" class="cm-badge lover">恋人</span>
          <span v-else-if="character.commitment === '仅朋友'" class="cm-badge friend">仅朋友</span>
        </div>
        <div class="cm-line">
          <span class="field-name">与玩家关系</span><span class="field-value">{{ character.label }}</span>
        </div>
        <div class="cm-line">
          <span class="field-name">当前状态</span><span class="field-value status">{{ oneLineStatus }}</span>
        </div>
      </div>
    </div>

    <!-- 关系数值 -->
    <section class="cm-section">
      <h3 class="sec-title">关系数值</h3>
      <div class="meter-row">
        <span class="meter-key">羁绊</span>
        <span class="meter-track"><span class="meter-fill bond" :style="{ width: `${character.bond}%` }"></span></span>
        <span class="meter-num">{{ character.bond }}</span>
      </div>
      <div class="meter-row">
        <span class="meter-key">恋爱</span>
        <span class="meter-track"><span class="meter-fill romance" :style="{ width: `${character.romance}%` }"></span></span>
        <span class="meter-num">{{ character.romance }}</span>
      </div>
    </section>

    <!-- 当前穿着：逐项换行 -->
    <section class="cm-section">
      <h3 class="sec-title">当前穿着</h3>
      <div v-for="item in outfitItems" :key="item.label" class="cm-line">
        <span class="field-name">{{ item.label }}</span>
        <span class="field-value" :class="{ unknown: item.value === '未确认' }">{{ item.value }}</span>
      </div>
    </section>

    <!-- 近况 -->
    <section class="cm-section">
      <h3 class="sec-title">近况</h3>
      <div class="cm-line">
        <span class="field-name">最近记得</span>
        <span class="field-value" :class="{ unknown: !character.memory }">{{ character.memory || '未确认' }}</span>
      </div>
      <div class="cm-line">
        <span class="field-name">没有说出口</span>
        <span class="field-value status" :class="{ unknown: !character.innerThought }">
          {{ character.innerThought ? `“${character.innerThought}”` : '未确认' }}
        </span>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { PresentCharacterView } from '../utils';

const props = defineProps<{
  character: PresentCharacterView;
}>();

const oneLineStatus = computed(() => {
  const text = props.character.innerThought || props.character.memory;
  return text || '未确认';
});

const OUTFIT_LABELS: ReadonlyArray<readonly [keyof PresentCharacterView['outfit'], string]> = [
  ['outerwear', '外套'],
  ['inner_layer', '内搭'],
  ['bottoms', '下装'],
  ['socks', '袜子'],
  ['underwear', '贴身'],
  ['shoes', '鞋'],
];

const outfitItems = computed(() => OUTFIT_LABELS.map(([key, label]) => ({ label, value: props.character.outfit[key] })));
</script>

<style scoped>
.char-detail {
  display: flex;
  flex-direction: column;
  gap: 22px;
}

/* 顶部概览：双栏（窄屏自动单栏） */
.cm-overview {
  display: flex;
  gap: 18px;
  align-items: flex-start;
}

.cm-portrait {
  width: 128px;
  height: 168px;
  flex: none;
  border-radius: 10px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--c-primary-soft);
  color: #fff;
  font-size: 42px;
  font-weight: 700;
}

.cm-portrait img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top;
}

.cm-head {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.cm-title {
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
}

.cm-name {
  font-size: 19px;
}

.cm-badge {
  padding: 0 10px;
  border-radius: 999px;
  font-size: 13px;
  line-height: 1.8;
}

.cm-badge.lover {
  background: rgba(236, 95, 146, 0.14);
  color: #d64d7f;
}

.cm-badge.friend {
  background: rgba(10, 132, 255, 0.12);
  color: #0a84ff;
}

/* 分组卡 */
.cm-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 16px;
  border: 1px solid var(--c-border);
  border-radius: 9px;
  background: var(--c-surface-muted);
}

.sec-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--c-text-muted);
  letter-spacing: 2px;
}

/* 字段名 + 字段值：字段名固定宽度，值占剩余空间并允许换行 */
.cm-line {
  display: flex;
  gap: 14px;
  line-height: 1.7;
}

.field-name {
  flex: none;
  width: 5.5em;
  color: var(--c-text-muted);
  font-size: 13px;
}

.field-value {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}

.field-value.status {
  color: var(--c-primary-strong);
  font-style: italic;
}

.field-value.unknown {
  color: var(--c-text-muted);
  font-style: normal;
}

/* 关系数值条：轨道占满剩余宽度，数值在右侧 */
.meter-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.meter-key {
  flex: none;
  width: 3em;
  color: var(--c-text-muted);
  font-size: 13px;
}

.meter-track {
  flex: 1;
  height: 9px;
  border-radius: 999px;
  background: var(--c-border);
  overflow: hidden;
}

.meter-fill {
  display: block;
  height: 100%;
  border-radius: 999px;
  transition: width 0.3s ease;
}

.meter-fill.bond {
  background: linear-gradient(90deg, #7fb3f0, #4a86d8);
}

.meter-fill.romance {
  background: linear-gradient(90deg, #f6a8c5, #ec5f92);
}

.meter-num {
  flex: none;
  width: 3em;
  text-align: right;
  font-variant-numeric: tabular-nums;
  color: var(--c-text-strong);
}

/* 窄屏：概览双栏变单栏，立绘居中 */
@media (max-width: 480px) {
  .cm-overview {
    flex-direction: column;
    align-items: center;
  }

  .cm-head {
    width: 100%;
  }
}
</style>
