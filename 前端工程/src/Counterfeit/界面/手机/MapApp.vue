<template>
  <div class="app-screen">
    <AppHeader title="地图" />
    <div class="map-scroll">
      <!-- SVG 示意图（坐标版） -->
      <section class="map-card">
        <svg viewBox="0 0 360 300" class="map-svg">
          <!-- 海面（东京湾） -->
          <path class="sea" d="M 305 -5 Q 288 70 318 140 Q 344 205 328 305 L 365 305 L 365 -5 Z" />
          <text class="sea-label" x="336" y="284">东京湾</text>

          <!-- 总武学区 -->
          <rect class="zone" x="128" y="76" width="106" height="128" rx="16" />
          <text class="zone-label" x="138" y="92">总武学区</text>

          <!-- 街道 -->
          <path v-for="(d, i) in STREETS" :key="i" class="street" :d="d" />

          <!-- 地点节点 -->
          <g
            v-for="loc in MAP_LOCATIONS"
            :key="loc.name"
            class="map-node"
            :class="{ current: currentLocation === loc.name }"
            @click="selected = loc"
          >
            <circle
              v-if="currentLocation === loc.name"
              class="node-pulse"
              :cx="loc.x"
              :cy="loc.y"
              :r="10"
              :fill="layerColor(loc.layer)"
            />
            <circle class="node-dot" :cx="loc.x" :cy="loc.y" r="5" :fill="layerColor(loc.layer)" />
            <text
              class="node-label"
              :x="loc.x + loc.lx"
              :y="loc.y + loc.ly"
              :text-anchor="loc.anchor"
              >{{ loc.short }}</text
            >
          </g>
        </svg>
        <div class="map-legend">
          <span v-for="layer in MAP_LAYERS" :key="layer" class="legend-item">
            <i class="legend-dot" :style="{ background: layerColor(layer) }"></i>{{ layer }}
          </span>
        </div>
      </section>

      <!-- 分层列表 -->
      <section v-for="layer in MAP_LAYERS" :key="layer" class="layer-card">
        <h3 class="layer-title">{{ layer }}</h3>
        <div class="location-grid">
          <button
            v-for="loc in locationsOf(layer)"
            :key="loc.name"
            class="location-chip"
            :class="{ current: currentLocation === loc.name }"
            @click="selected = loc"
          >
            <span class="loc-dot"></span>
            <span class="loc-name">{{ loc.name }}</span>
          </button>
        </div>
      </section>
      <p v-if="!currentLocation" class="map-hint">当前位置变量未识别到已知地点；随剧情推进，这里会高亮你所在的地点。</p>
    </div>

    <!-- 地点详情弹层 -->
    <Transition name="sheet">
      <div v-if="selected" class="sheet-mask" @click="selected = null">
        <div class="sheet" @click.stop>
          <h3 class="sheet-title">{{ selected.name }}</h3>
          <p class="sheet-layer">{{ selected.layer }}</p>
          <p class="sheet-desc">{{ descOf(selected) }}</p>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import AppHeader from './AppHeader.vue';
import { resolveWorldbookName } from './vars';
import { usePhoneStore } from './store';

interface MapLocation {
  name: string;
  /** 地图短标签 */
  short: string;
  layer: string;
  keywords: string[];
  /** SVG 坐标（viewBox 360×300） */
  x: number;
  y: number;
  /** 标签相对偏移 */
  lx: number;
  ly: number;
  anchor: 'start' | 'middle' | 'end';
}

const MAP_LAYERS = ['校外', '校园', '室内'];
const LAYER_COLORS: Record<string, string> = {
  校外: '#0a84ff',
  校园: '#30a852',
  室内: '#f0a53a',
};

/** 街道（示意图折线，仅装饰） */
const STREETS = [
  'M 58 52 L 168 108', // 千叶站 → 总武高中
  'M 168 108 L 226 96', // 总武高中 → 中高滨公园
  'M 168 108 Q 220 130 258 146', // 总武高中 → MARINPIA
  'M 258 146 Q 276 180 282 212', // MARINPIA → 海滨公园
  'M 58 52 L 62 128', // 千叶站 → 比企谷家
  'M 62 128 Q 70 190 96 216', // 比企谷家 → 萨莉亚
  'M 96 216 Q 140 240 186 246', // 萨莉亚 → 拉芙公寓
  'M 186 246 Q 220 220 240 188', // 拉芙公寓 → 雪乃公寓
  'M 226 96 Q 250 76 268 62', // 中高滨公园 → 浅间神社
];

const MAP_LOCATIONS: MapLocation[] = [
  { name: '千叶站', short: '千叶站', layer: '校外', keywords: ['千叶站', '车站'], x: 58, y: 52, lx: 0, ly: -9, anchor: 'middle' },
  { name: '千叶站前拉面馆', short: '拉面馆', layer: '校外', keywords: ['拉面馆', '站前拉面'], x: 34, y: 96, lx: 0, ly: -9, anchor: 'middle' },
  { name: '千叶市图书馆', short: '图书馆', layer: '校外', keywords: ['图书馆'], x: 128, y: 42, lx: 0, ly: -9, anchor: 'middle' },
  { name: '千叶都市单轨电车', short: '单轨电车', layer: '校外', keywords: ['单轨', '美滨区', '通学路线'], x: 88, y: 34, lx: 9, ly: 3, anchor: 'start' },
  { name: 'MARINPIA商场', short: 'MARINPIA', layer: '校外', keywords: ['MARINPIA', '商场'], x: 258, y: 146, lx: -9, ly: 3, anchor: 'end' },
  { name: '稻毛海滨公园', short: '海滨公园', layer: '校外', keywords: ['稻毛海滨公园', '海滨公园', '海滨'], x: 282, y: 212, lx: -9, ly: 3, anchor: 'end' },
  { name: '中高滨公园', short: '中高滨公园', layer: '校外', keywords: ['中高滨公园', '学校对面公园', '街对面公园'], x: 226, y: 96, lx: 9, ly: -4, anchor: 'start' },
  { name: '稻毛浅间神社', short: '浅间神社', layer: '校外', keywords: ['浅间神社', '神社'], x: 268, y: 62, lx: -9, ly: 3, anchor: 'end' },
  { name: '萨莉亚家庭餐厅', short: '萨莉亚', layer: '校外', keywords: ['萨莉亚', '家庭餐厅'], x: 96, y: 216, lx: 0, ly: 17, anchor: 'middle' },
  { name: '格兰皇宫酒店', short: '格兰皇宫', layer: '校外', keywords: ['格兰皇宫'], x: 312, y: 38, lx: -9, ly: 3, anchor: 'end' },
  { name: '千叶港湾酒店', short: '港湾酒店', layer: '校外', keywords: ['千叶港湾酒店', '港湾酒店'], x: 298, y: 108, lx: 9, ly: 3, anchor: 'start' },
  { name: '幕张Messe', short: '幕张Messe', layer: '校外', keywords: ['幕张', 'Messe'], x: 322, y: 248, lx: -9, ly: 3, anchor: 'end' },
  { name: '便利店', short: '便利店', layer: '校外', keywords: ['便利店', 'LAWSON', '7-11', '711'], x: 60, y: 178, lx: 0, ly: 17, anchor: 'middle' },
  { name: '奉仕部活动室', short: '奉仕部', layer: '校园', keywords: ['活动室', '特别栋', '奉仕部'], x: 152, y: 142, lx: -8, ly: 3, anchor: 'end' },
  { name: '体育馆', short: '体育馆', layer: '校园', keywords: ['体育馆'], x: 196, y: 140, lx: 8, ly: 3, anchor: 'start' },
  { name: '操场', short: '操场', layer: '校园', keywords: ['操场', '后山'], x: 150, y: 178, lx: 0, ly: 15, anchor: 'middle' },
  { name: '总武高中', short: '总武高中', layer: '校园', keywords: ['总武高中', '学校'], x: 168, y: 108, lx: 0, ly: -8, anchor: 'middle' },
  { name: '拉芙希妮的公寓', short: '拉芙公寓', layer: '室内', keywords: ['拉芙希妮的公寓', '拉芙的公寓'], x: 186, y: 246, lx: 0, ly: 17, anchor: 'middle' },
  { name: '雪之下雪乃的公寓', short: '雪乃公寓', layer: '室内', keywords: ['雪之下雪乃的公寓', '雪乃的公寓'], x: 240, y: 188, lx: 10, ly: 14, anchor: 'start' },
  { name: '比企谷家', short: '比企谷家', layer: '室内', keywords: ['比企谷家', '八幡家'], x: 62, y: 128, lx: 9, ly: 3, anchor: 'start' },
];

const store = usePhoneStore();
const selected = ref<MapLocation | null>(null);
const currentLocation = ref('');
const descriptions = ref<Record<string, string>>({});

const locationsOf = (layer: string) => MAP_LOCATIONS.filter(l => l.layer === layer);
const layerColor = (layer: string) => LAYER_COLORS[layer] ?? '#8e8e93';

function descOf(loc: MapLocation): string {
  return descriptions.value[loc.name] || `常去之处：${loc.keywords.join('、')}。`;
}

/** 文本 → 地图地点：先精确名，再关键词包含（双向） */
function matchLocation(text: string): string | null {
  const value = String(text ?? '').trim();
  if (!value) return null;
  for (const loc of MAP_LOCATIONS) {
    if (loc.name === value) return loc.name;
  }
  for (const loc of MAP_LOCATIONS) {
    if (loc.keywords.some(keyword => value.includes(keyword) || keyword.includes(value))) {
      return loc.name;
    }
  }
  return null;
}

/** 定位当前地点：① MVU world.current_location → ② 场景条目日期窗口（fallback） */
async function detectCurrentLocation() {
  try {
    // ① 直接读 MVU 变量（POV/free 模式都维护 world.current_location），不再绕道日期匹配
    const direct = matchLocation(store.snapshot.location);
    if (direct) {
      currentLocation.value = direct;
    }
    const book = await resolveWorldbookName();
    if (!book || typeof getWorldbook !== 'function') {
      return;
    }
    const entries = await getWorldbook(book);
    // 地点描述（按条目名直接匹配）
    for (const e of entries) {
      for (const loc of MAP_LOCATIONS) {
        if (e.name === loc.name && e.content) {
          descriptions.value[loc.name] = String(e.content).slice(0, 200);
        }
      }
    }
    // ② 日期窗口未命中（或地点变量为空）时兜底：匹配覆盖当前日期的场景条目
    if (direct || !store.snapshot.date) {
      return;
    }
    const today = store.snapshot.date;
    const cnToday = `${today.slice(0, 4)}年${Number(today.slice(5, 7))}月${Number(today.slice(8, 10))}日`;
    for (const e of entries) {
      if (!/^场景/.test(e.name ?? '')) {
        continue;
      }
      const keys = Array.isArray(e.strategy?.keys) ? e.strategy.keys.map(String) : [];
      if (!keys.includes(cnToday)) {
        continue;
      }
      const content = String(e.content ?? '');
      const placeLine = content.split('\n').find(l => l.startsWith('地点')) ?? '';
      for (const loc of MAP_LOCATIONS) {
        if (loc.keywords.some(k => placeLine.includes(k) || content.slice(0, 200).includes(k))) {
          currentLocation.value = loc.name;
          return;
        }
      }
    }
  } catch {
    /* 忽略 */
  }
}

onMounted(() => {
  void detectCurrentLocation();
});
</script>

<style lang="scss" scoped>
.app-screen {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--c-phone-screen);
  min-height: 0;
}

.map-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 8px 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* —— SVG 示意图 —— */

.map-card {
  background: #fff;
  border-radius: 16px;
  padding: 10px 10px 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
}

.map-svg {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 10px;
  background: linear-gradient(170deg, #eef6ec, #f4f7fb 60%, #eef2f7);
}

.sea {
  fill: #cfe6f7;
}

.sea-label {
  font-size: 9px;
  fill: #7fa8c9;
  letter-spacing: 2px;
}

.zone {
  fill: rgba(48, 168, 82, 0.06);
  stroke: rgba(48, 168, 82, 0.45);
  stroke-width: 1;
  stroke-dasharray: 4 3;
}

.zone-label {
  font-size: 8.5px;
  fill: rgba(48, 130, 82, 0.75);
  letter-spacing: 1px;
}

.street {
  fill: none;
  stroke: #d5d8e0;
  stroke-width: 2.5;
  stroke-linecap: round;
}

.map-node {
  cursor: pointer;

  .node-dot {
    stroke: #fff;
    stroke-width: 1.5;
    transition: r 0.15s ease;
  }

  &:active .node-dot {
    r: 6.5;
  }

  &.current .node-label {
    font-weight: 700;
  }
}

.node-label {
  font-size: 9.5px;
  fill: #3a3a3f;
  paint-order: stroke;
  stroke: rgba(255, 255, 255, 0.85);
  stroke-width: 2.5px;
  pointer-events: none;
}

.node-pulse {
  opacity: 0.5;
  transform-box: fill-box;
  transform-origin: center;
  animation: node-pulse 1.6s ease-out infinite;
  pointer-events: none;
}

@keyframes node-pulse {
  0% {
    opacity: 0.55;
    transform: scale(0.6);
  }
  100% {
    opacity: 0;
    transform: scale(1.8);
  }
}

.map-legend {
  display: flex;
  gap: 14px;
  justify-content: center;
  padding-top: 8px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: var(--c-ios-gray);
}

.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

/* —— 分层列表 —— */

.layer-card {
  background: #fff;
  border-radius: 16px;
  padding: 14px 16px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
}

.layer-title {
  font-size: 13px;
  color: var(--c-ios-gray);
  letter-spacing: 2px;
  margin-bottom: 10px;
}

.location-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.location-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 999px;
  background: var(--c-phone-screen);
  font-size: 13px;
  transition: transform 0.15s ease;

  &:active {
    transform: scale(0.95);
  }

  &.current {
    background: rgba(10, 132, 255, 0.12);
    outline: 1.5px solid var(--c-ios-blue);

    .loc-dot {
      background: var(--c-ios-blue);
      animation: loc-pulse 1.6s ease-out infinite;
    }
  }
}

.loc-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #c7c7cc;
}

@keyframes loc-pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(10, 132, 255, 0.4);
  }
  100% {
    box-shadow: 0 0 0 8px rgba(10, 132, 255, 0);
  }
}

.map-hint {
  font-size: 12px;
  color: var(--c-ios-gray);
  line-height: 1.8;
  padding: 0 4px;
}

.sheet-mask {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: flex-end;
  z-index: 8;
}

.sheet {
  width: 100%;
  background: var(--c-phone-screen);
  border-radius: 20px 20px 0 0;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sheet-title {
  font-size: 17px;
  font-weight: 700;
}

.sheet-layer {
  font-size: 12px;
  color: var(--c-ios-blue);
}

.sheet-desc {
  font-size: 13px;
  color: var(--c-text);
  line-height: 1.8;
  white-space: pre-line;
}

.sheet-enter-active,
.sheet-leave-active {
  transition:
    opacity 0.25s ease,
    transform 0.25s ease;
}

.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
  transform: translateY(30px);
}
</style>
