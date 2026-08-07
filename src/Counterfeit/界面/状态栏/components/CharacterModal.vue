<template>
  <div class="char-detail">
    <div class="cm-layout" :class="{ 'is-lover': isLover }">
      <div class="cm-portrait" :class="{ 'is-placeholder': !character.portraitUrl }">
        <img
          v-if="character.portraitUrl"
          :src="character.portraitUrl"
          :alt="`${character.displayName} 高清立绘`"
          width="1408"
          height="2048"
          decoding="async"
        />
        <span v-else class="cm-initial">{{ character.displayName.slice(0, 1) }}</span>
      </div>

      <div class="cm-content">
        <div class="cm-head">
          <div class="cm-title">
            <b class="cm-name">{{ character.displayName }}</b>
            <span v-if="isLover" class="cm-badge lover">♥ 恋人</span>
            <span v-else-if="character.commitment === '仅朋友'" class="cm-badge friend">仅朋友</span>
          </div>
          <div class="cm-line">
            <span class="field-name">与玩家关系</span><span class="field-value">{{ character.label }}</span>
          </div>
          <div class="cm-line">
            <span class="field-name">当前状态</span><span class="field-value status">{{ oneLineStatus }}</span>
          </div>
        </div>

        <!-- 基础信息（D14）：静态资料表，未收录角色整段显示未公开，不编造 -->
        <section class="cm-section">
          <h3 class="sec-title">基础信息</h3>
          <div v-for="item in baseInfoItems" :key="item.label" class="cm-line">
            <span class="field-name">{{ item.label }}</span>
            <span class="field-value" :class="{ unknown: !item.value }">{{ item.value || '未公开' }}</span>
          </div>
          <p v-if="showEstimateNote" class="cm-note">† 为同人推定值，非官方公开数据</p>
        </section>

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

        <!-- 攻略指南（D14）：只读展示世界书既有判定文本，默认收起 -->
        <section class="cm-section">
          <details class="cm-details">
            <summary class="cm-summary">
              <span class="sec-title">攻略指南</span>
              <span class="cm-summary-tag">{{ isLover ? '已翻转' : '未翻转' }}</span>
            </summary>
            <div class="cm-details-body">
              <template v-if="guide">
                <div v-if="guide.note" class="cm-line">
                  <span class="field-name">接近说明</span>
                  <span class="field-value">{{ guide.note }}</span>
                </div>
                <div class="cm-line">
                  <span class="field-name">有效证据</span>
                  <span class="field-value">{{ guide.positive }}</span>
                </div>
                <div class="cm-line">
                  <span class="field-name">负面证据</span>
                  <span class="field-value">{{ guide.negative }}</span>
                </div>
                <div class="cm-line">
                  <span class="field-name">关系翻转</span>
                  <span class="field-value">{{ guide.commitment }}</span>
                </div>
              </template>
              <p v-else class="cm-note">该角色暂无公开的关系判定资料</p>
            </div>
          </details>
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

        <!-- 私密档案（D14 亲密记忆 + D15 CG 发送）：默认收起，避免旁人一眼扫到 -->
        <section class="cm-section">
          <details class="cm-details">
            <summary class="cm-summary">
              <span class="sec-title">私密档案</span>
              <span class="cm-summary-tag">{{ character.intimateMemory || character.intimateSexualMemory ? '有记录' : '空' }}</span>
            </summary>
            <div class="cm-details-body">
              <div class="cm-line">
                <span class="field-name">亲密记忆</span>
                <span class="field-value" :class="{ unknown: !character.intimateMemory }">
                  {{ character.intimateMemory || '还没有只属于你们两个人的片段' }}
                </span>
              </div>
              <div class="cm-line">
                <span class="field-name">性爱回忆</span>
                <span class="field-value" :class="{ unknown: !character.intimateSexualMemory }">
                  {{ character.intimateSexualMemory || '还没有你们身体亲近的回忆' }}
                </span>
              </div>
              <button type="button" class="cg-send-btn" :disabled="sending" @click="sendCg">
                {{ sending ? '发送中…' : '查看私密照片' }}
              </button>
              <p v-if="hint" class="cg-hint" :class="{ error: !hasCg }">{{ hint }}</p>
            </div>
          </details>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PresentCharacterView } from '../utils';
import { cgUrlsOf } from '../cg';
import { baseInfoOf, guideOf, hasEstimatedValue } from '../profile';

const props = defineProps<{
  character: PresentCharacterView;
}>();

const oneLineStatus = computed(() => {
  const text = props.character.innerThought || props.character.memory;
  return text || '未确认';
});

const isLover = computed(() => props.character.commitment === '恋人');

const baseInfo = computed(() => baseInfoOf(props.character.key));
const guide = computed(() => guideOf(props.character.key));
const showEstimateNote = computed(() => hasEstimatedValue(baseInfo.value));

const baseInfoItems = computed(() => {
  const info = baseInfo.value;
  return [
    { label: '身高', value: info?.height ?? '' },
    { label: '体重', value: info?.weight ?? '' },
    { label: '生日', value: info?.birthday ?? '' },
    { label: '血型', value: info?.bloodType ?? '' },
    { label: '爱好', value: info?.hobbies ?? '' },
  ];
});

const hasCg = computed(() => cgUrlsOf(props.character.key).length > 0);

const sending = ref(false);
const hint = ref('');

let hintTimer: ReturnType<typeof setTimeout> | null = null;
function flashHint(text: string) {
  hint.value = text;
  if (hintTimer) clearTimeout(hintTimer);
  hintTimer = setTimeout(() => {
    hint.value = '';
  }, 2500);
}

/** 弹窗 iframe → 宿主页 postMessage（挂载脚本监听并转发执行） */
function postToHost(payload: Record<string, unknown>): boolean {
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ source: 'counterfeit-statusbar', ...payload }, '*');
      return true;
    }
  } catch {
    // 顶层预览（无父页）时走内联降级
  }
  return false;
}

/** 点击「查看私密照片」：随机取该角色一张 CG 发送到聊天；无图角色提示占位 */
function sendCg() {
  if (sending.value) return;
  const urls = cgUrlsOf(props.character.key);
  if (!urls.length) {
    flashHint('该角色暂无 CG 图');
    return;
  }
  const url = urls[Math.floor(Math.random() * urls.length)];
  if (!postToHost({ type: 'send-cg', key: props.character.key, url })) {
    flashHint('预览环境无法发送');
    return;
  }
  sending.value = true;
  flashHint('已发送');
  setTimeout(() => {
    sending.value = false;
  }, 800);
}

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
  min-width: 0;
}

/* 独立窗口主布局：高清立绘在左，状态档案在右；窄屏自动单栏 */
.cm-layout {
  display: grid;
  grid-template-columns: minmax(240px, 0.82fr) minmax(0, 1.55fr);
  gap: clamp(18px, 3vw, 34px);
  align-items: start;
}

.cm-portrait {
  width: 100%;
  max-width: 430px;
  justify-self: center;
  border-radius: 12px;
  overflow: hidden;
  background: transparent;
  line-height: 0;
}

.cm-portrait.is-placeholder {
  min-height: 420px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--c-primary-soft);
  color: var(--c-on-primary);
  font-size: 42px;
  font-weight: 700;
  line-height: normal;
}

.cm-portrait img {
  display: block;
  width: 100%;
  height: auto;
  object-fit: contain;
  object-position: center top;
}

.cm-content {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.cm-head {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 2px 2px 4px;
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
  background: var(--c-lover-badge-bg);
  color: var(--c-lover-text);
}

.cm-badge.friend {
  background: var(--c-friend-badge-bg);
  color: var(--c-friend-text);
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

.cm-note {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--c-text-muted);
}

/* 可折叠段：原生 details，不自建滚动容器、不设固定高度，展开后仅撑高 modal-body */
.cm-details {
  min-width: 0;
}

.cm-summary {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  padding: 2px 0;
  cursor: pointer;
  user-select: none;
  list-style: none;
}

.cm-summary::-webkit-details-marker {
  display: none;
}

.cm-summary .sec-title {
  flex: 1;
  min-width: 0;
}

.cm-summary-tag {
  flex: none;
  padding: 0 10px;
  border-radius: 999px;
  background: var(--c-border);
  color: var(--c-text-muted);
  font-size: 12px;
  line-height: 1.9;
}

.cm-summary::after {
  content: '';
  flex: none;
  width: 8px;
  height: 8px;
  margin-right: 4px;
  border-right: 2px solid var(--c-text-muted);
  border-bottom: 2px solid var(--c-text-muted);
  transform: rotate(45deg) translate(-2px, -2px);
  transition: transform 0.15s ease;
}

.cm-details[open] > .cm-summary::after {
  transform: rotate(-135deg) translate(-2px, -2px);
}

.cm-details-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 8px;
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
  background: linear-gradient(90deg, var(--c-bond-from), var(--c-bond-to));
}

.meter-fill.romance {
  background: linear-gradient(90deg, var(--c-romance-from), var(--c-romance-to));
}

.meter-num {
  flex: none;
  width: 3em;
  text-align: right;
  font-variant-numeric: tabular-nums;
  color: var(--c-text-strong);
}

/* —— 恋人态：配色 + 结构性差异 ——
   与其它关系态的区别不止颜色，但结构改动只落在「安全位置」，即
   ① 只在已有盒子内部加装饰（border-left 加粗、border-bottom 分隔线、
      绝对定位伪元素），box-sizing:border-box 下不产生溢出；
   ② 绝不引入 vh/dvh、固定高度、或新的滚动容器 —— 2026-08-05 移动端
      高度链修复的三条根因一条都不碰，展开后仍只由 .modal-body 滚动。
   加粗左边框会让区块内文本少 2px 可用宽度、可能多折一行，这由 .modal-body
   正常滚动吸收；已在 412×915 三档可见高（915/819/450）实测上下溢出均为 0。 */
.cm-layout.is-lover .cm-portrait {
  position: relative;
  outline: 2px solid var(--c-lover-outline);
  outline-offset: -2px;
}

/* 立绘右上角心形角标：绝对定位在已 overflow:hidden 的容器内，不参与文档流 */
.cm-layout.is-lover .cm-portrait::after {
  content: '♥';
  position: absolute;
  top: 8px;
  right: 10px;
  z-index: 1;
  color: var(--c-lover-text);
  font-size: 18px;
  line-height: 1;
  text-shadow: 0 1px 3px var(--c-scrim);
  pointer-events: none;
}

/* 头部与档案之间加一条恋人色分隔线（1px + 8px 间距，均在 .cm-head 自身盒内） */
.cm-layout.is-lover .cm-head {
  padding-bottom: 12px;
  border-bottom: 1px solid var(--c-lover-rule);
}

/* 区块左侧加粗成恋人色书脊：只改 border-left-width，border-box 不外溢 */
.cm-layout.is-lover .cm-section {
  border-color: var(--c-lover-border);
  border-left-width: 3px;
  background: var(--c-lover-tint);
}

.cm-layout.is-lover .sec-title {
  color: var(--c-lover-text);
}

.cm-layout.is-lover .cm-badge.lover {
  border: 1px solid var(--c-lover-border);
}

.cm-layout.is-lover .cm-summary-tag {
  background: var(--c-lover-tag-bg);
  color: var(--c-lover-text);
}

.cm-layout.is-lover .cm-summary::after {
  border-right-color: var(--c-lover-text);
  border-bottom-color: var(--c-lover-text);
}

/* 恋爱值轨道在恋人态染色，与羁绊条区分开 */
.cm-layout.is-lover .meter-fill.romance {
  box-shadow: 0 0 6px var(--c-lover-tag-bg);
}

/* 私密档案 CG 发送按钮（D15）：通栏大按钮，触控目标不低于 44px，不依赖视口单位 */
.cg-send-btn {
  width: 100%;
  min-height: 44px;
  padding: 10px 16px;
  border: 1px solid var(--c-primary-soft);
  border-radius: 9px;
  background: var(--c-primary-soft);
  /* 文字色不用 --c-primary-strong：它在 --c-primary-soft 底色上只有 2.31:1，
     远不到 AA。改用专供该底色的 --c-on-primary-soft（三套主题各自实测 ≥5:1）。 */
  color: var(--c-on-primary-soft);
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 2px;
  cursor: pointer;
  user-select: none;
  transition:
    background 0.15s ease,
    color 0.15s ease,
    opacity 0.15s ease;
}

.cg-send-btn:hover:not(:disabled) {
  background: var(--c-primary-strong);
  color: var(--c-on-primary);
}

.cg-send-btn:active:not(:disabled) {
  opacity: 0.8;
}

.cg-send-btn:disabled {
  cursor: default;
  opacity: 0.7;
}

.cg-hint {
  margin: -2px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--c-primary-strong);
}

.cg-hint.error {
  color: var(--c-text-muted);
}

/* 窄屏：独立窗口单栏，立绘限制在半屏高度以内（完整等比显示、不裁切），档案继续由外层 modal-body 滚动 */
@media (max-width: 720px) {
  .cm-layout {
    grid-template-columns: 1fr;
  }

  /* 容器收缩贴合图片实际显示尺寸；img 用 auto 尺寸 + max 约束保持原比例，
     vh 在前作回退、 dvh 覆盖——兼容不支持动态视口单位的老内核 */
  .cm-portrait {
    width: auto;
    max-width: min(100%, 340px);
  }

  .cm-portrait img {
    width: auto;
    max-width: 100%;
    max-height: 46vh;
    max-height: 46dvh;
  }

  .cm-portrait.is-placeholder {
    width: 100%;
    min-height: 300px;
  }

  /* 窄屏字段名收窄，给长文本（攻略指南整段）留出可读宽度 */
  .field-name {
    width: 4.5em;
  }
}
</style>
