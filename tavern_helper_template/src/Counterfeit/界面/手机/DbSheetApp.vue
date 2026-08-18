<template>
  <div class="app-screen">
    <AppHeader :title="title">
      <button class="refresh-btn" title="重新读取数据库" @click="refresh">
        <i class="fa-solid fa-rotate"></i>
      </button>
    </AppHeader>
    <div class="sheet-scroll">
      <div v-if="!available" class="db-banner">
        <i class="fa-solid fa-database"></i>
        未检测到数据库（shujuku · SP·数据库）。安装并导入表格模板后，这里会显示「{{ title }}」的内容。
      </div>
      <p v-else-if="!sheet" class="empty">数据库里还没有「{{ title }}」这张表（当前模板：{{ sheetNames }}）</p>
      <p v-else-if="!visibleRows.length" class="empty">「{{ sheet.name }}」还没有数据行</p>

      <template v-else>
        <article v-for="row in visibleRows" :key="rowKey(row)" class="record-card" :class="kind">
          <!-- 纪要表 -->
          <template v-if="kind === 'summary'">
            <div class="record-tags">
              <span class="am-badge">{{ cell(row, ['编码索引', 'code_index']) }}</span>
              <span>{{ cell(row, ['时间跨度', 'time_span']) }}</span>
            </div>
            <!-- 适配表格没有「概览」列：用纪要正文前 26 字作为标题 -->
            <h3 class="record-title">{{ summaryTitle(row) }}</h3>
            <p class="record-body">{{ cell(row, ['纪要', 'chronicle_text']) }}</p>
            <blockquote v-if="cell(row, ['重要对话', 'key_dialogue'])" class="record-quote">
              {{ cell(row, ['重要对话', 'key_dialogue']) }}
            </blockquote>
          </template>

          <!-- 备忘录 -->
          <template v-else-if="kind === 'memo'">
            <div class="record-tags">
              <span class="status-chip">{{ cell(row, ['当前状态']) || '待定' }}</span>
              <span>{{ cell(row, ['相关时间']) }}</span>
            </div>
            <h3 class="record-title">{{ cell(row, ['备忘标题', '标题']) }}</h3>
            <p class="record-body">{{ cell(row, ['详细内容', '内容']) }}</p>
            <p v-if="cell(row, ['相关角色'])" class="record-sub">
              <i class="fa-solid fa-user"></i> {{ cell(row, ['相关角色']) }}
            </p>
          </template>

          <!-- 恋爱日记 -->
          <template v-else-if="kind === 'diary'">
            <div class="record-tags">
              <span class="writer-chip">{{ cell(row, ['写作角色', '角色']) }}</span>
              <span>{{ cell(row, ['发生时间', '日期']) }}</span>
              <span v-if="cell(row, ['关联AM码'])" class="am-badge">{{ cell(row, ['关联AM码']) }}</span>
            </div>
            <p class="record-body diary-body">{{ cell(row, ['日记内容', '内容']) }}</p>
          </template>

          <!-- 物品表 -->
          <template v-else-if="kind === 'inventory'">
            <div class="inv-row">
              <span class="inv-name">{{ cell(row, ['物品名称', '名称']) }}</span>
              <span v-if="cell(row, ['数量'])" class="inv-count">×{{ cell(row, ['数量']) }}</span>
            </div>
            <p class="record-body">{{ cell(row, ['描述', '情感分量', '品质']) }}</p>
          </template>

          <!-- 角色档案 -->
          <template v-else-if="kind === 'character'">
            <div class="record-tags">
              <span class="writer-chip">{{ cell(row, ['姓名', '角色']) }}</span>
              <span>{{ cell(row, ['角色类型', '类型']) }}</span>
              <span>{{ cell(row, ['在场状态']) }}</span>
            </div>
            <p v-if="cell(row, ['一句话介绍'])" class="record-body">{{ cell(row, ['一句话介绍']) }}</p>
            <p v-if="cell(row, ['当下想法'])" class="record-sub thought">
              <i class="fa-solid fa-comment-dots"></i> {{ cell(row, ['当下想法']) }}
            </p>
            <p v-if="cell(row, ['所在地点'])" class="record-sub">
              <i class="fa-solid fa-location-dot"></i> {{ cell(row, ['所在地点']) }}
            </p>
            <p v-if="cell(row, ['人际关系'])" class="record-sub">
              <i class="fa-solid fa-people-arrows"></i> {{ cell(row, ['人际关系']) }}
            </p>
          </template>

          <!-- 通用兜底：非空列键值对 -->
          <template v-else>
            <div v-for="pair in genericPairs(row)" :key="pair[0]" class="generic-row">
              <span class="generic-key">{{ pair[0] }}</span>
              <span class="generic-value">{{ pair[1] }}</span>
            </div>
          </template>
        </article>

        <button v-if="visibleCount < rows.length" class="more-btn" @click="visibleCount += PAGE_SIZE">
          <i class="fa-solid fa-angle-down"></i> 加载更早记录（{{ rows.length - visibleCount }}）
        </button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import AppHeader from './AppHeader.vue';
import { findSheet, getSheets, invalidateSheets, pickHeader, shujukuAvailable, type SheetData } from './shujuku';

export type DbSheetKind = 'summary' | 'memo' | 'diary' | 'inventory' | 'character' | 'generic';

const props = defineProps<{
  /** 界面标题（也用于空态提示） */
  title: string;
  /** 表候选名（display name 或 sheet key） */
  sheetCandidates: string[];
  kind: DbSheetKind;
}>();

const available = ref(false);
const sheet = ref<SheetData | null>(null);
const sheetNames = ref('');
const PAGE_SIZE = 20;
const visibleCount = ref(PAGE_SIZE);

/** 最新在上 */
const rows = computed(() => (sheet.value ? [...sheet.value.rows].reverse() : []));
const visibleRows = computed(() => rows.value.slice(0, visibleCount.value));

function cell(row: Record<string, unknown>, candidates: string[]): string {
  const current = sheet.value;
  if (!current) return '';
  const header = pickHeader(current.headers, candidates) ?? candidates.find(candidate => candidate in row);
  return header ? String(row[header] ?? '').trim() : '';
}

/** 纪要标题：有概览列取概览；否则取纪要正文前 26 字（Counterfeit 适配表格无概览列） */
function summaryTitle(row: Record<string, unknown>): string {
  const overview = cell(row, ['概览', '概要', 'summary']);
  if (overview) return overview;
  const chronicle = cell(row, ['纪要', 'chronicle_text']);
  const cleaned = chronicle.replace(/^【手机】/, '').trim();
  return cleaned ? `${cleaned.slice(0, 26)}${cleaned.length > 26 ? '…' : ''}` : '（无标题）';
}

function rowKey(row: Record<string, unknown>): string {
  return String(row.row_id ?? row['编码索引'] ?? row['物品名称'] ?? row['姓名'] ?? JSON.stringify(row).slice(0, 40));
}

function genericPairs(row: Record<string, unknown>): [string, string][] {
  return Object.entries(row)
    .filter(([key, value]) => key !== 'row_id' && key !== 'uid' && String(value ?? '').trim() !== '')
    .map(([key, value]) => [key, String(value ?? '').trim()] as [string, string]);
}

function load() {
  available.value = shujukuAvailable();
  sheet.value = available ? findSheet(props.sheetCandidates) : null;
  sheetNames.value = available
    ? getSheets()
        .map(item => item.name)
        .join('、') || '（空）'
    : '';
  visibleCount.value = PAGE_SIZE;
}

function refresh() {
  invalidateSheets();
  load();
}

onMounted(load);
</script>

<style lang="scss" scoped>
.app-screen {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--c-phone-screen);
  min-height: 0;
}

.sheet-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.refresh-btn {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: rgba(10, 132, 255, 0.1);
  color: var(--c-ios-blue);
  font-size: 13px;
}

.db-banner {
  padding: 14px 16px;
  border-radius: 12px;
  background: rgba(255, 149, 0, 0.1);
  color: #b26a00;
  font-size: 12px;
  line-height: 1.7;
}

.empty {
  padding: 30px 0;
  color: var(--c-ios-gray);
  text-align: center;
  font-size: 12px;
  line-height: 1.7;
}

.record-card {
  padding: 12px 14px;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  border-left: 3px solid var(--c-accent);

  &.diary {
    border-left-color: #ec5f92;
  }

  &.inventory {
    border-left-color: #f0a53a;
  }
}

.record-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-bottom: 6px;

  span {
    padding: 1px 6px;
    border-radius: 999px;
    background: rgba(10, 132, 255, 0.08);
    color: var(--c-ios-blue);
    font-size: 9px;
  }

  .am-badge {
    background: rgba(240, 165, 58, 0.15);
    color: #b26a00;
  }

  .status-chip {
    background: rgba(40, 199, 111, 0.12);
    color: var(--c-success);
  }

  .writer-chip {
    background: rgba(236, 95, 146, 0.12);
    color: #ec5f92;
  }
}

.record-title {
  margin-bottom: 6px;
  font-size: 14px;
  font-weight: 700;
}

.record-body {
  color: var(--c-text);
  font-size: 13px;
  line-height: 1.7;
  white-space: pre-line;
}

.diary-body {
  color: #8a4a63;
}

.record-quote {
  margin-top: 8px;
  padding: 6px 10px;
  border-left: 2px solid var(--c-separator);
  color: var(--c-ios-gray);
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-line;
}

.record-sub {
  margin-top: 6px;
  color: var(--c-ios-gray);
  font-size: 11px;

  &.thought {
    color: #8a4a63;
  }
}

.inv-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.inv-name {
  font-size: 14px;
  font-weight: 700;
}

.inv-count {
  color: #b26a00;
  font-size: 13px;
  font-weight: 600;
}

.generic-row {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 4px 10px;
  padding: 3px 0;
  font-size: 12px;
}

.generic-key {
  color: var(--c-ios-gray);
  white-space: nowrap;
}

.generic-value {
  color: var(--c-text);
  white-space: pre-line;
}

.more-btn {
  align-self: center;
  padding: 8px 22px;
  border-radius: 999px;
  background: rgba(10, 132, 255, 0.1);
  color: var(--c-ios-blue);
  font-size: 12px;
}
</style>
