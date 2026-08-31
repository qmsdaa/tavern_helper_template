<template>
  <div class="app-screen">
    <AppHeader title="委托" />
    <div class="request-scroll">
      <div v-if="!enabled" class="mode-banner">
        <i class="fa-solid fa-circle-info"></i>
        奉仕部委托面向开放世界模式；POV 剧本模式与剧情自建下只保留既有委托记录，不生成新委托（事件方向由主线注入提供）。
      </div>

      <div class="request-actions">
        <button class="gen-btn" :disabled="!enabled || loading" @click="generate">
          <i class="fa-solid fa-bolt"></i> {{ loading ? '生成中…' : '刷新委托' }}
        </button>
        <p class="request-hint">
          委托是开放世界的「事件方向提示」，不是已经发生的事实；接受后会随手机上下文注入主线，由剧情自然推进
        </p>
      </div>

      <p v-if="!visibleRequests.length && !loading" class="empty">
        {{ enabled ? '点“刷新委托”，结合当前日期、在场人物与数据库记录生成新的求助' : '当前还没有委托记录' }}
      </p>

      <article
        v-for="item in visibleRequests"
        :key="item.id"
        class="request-card"
        :class="[item.status, { expanded: expanded.has(item.id) }]"
      >
        <button class="request-head" @click="toggle(item.id)">
          <div class="request-tags">
            <span :class="`st-${item.status}`">{{ statusText(item.status) }}</span>
            <span v-if="item.location"><i class="fa-solid fa-location-dot"></i> {{ item.location }}</span>
            <span>{{ item.story_time }}</span>
          </div>
          <h3 class="request-title">{{ item.title }}</h3>
          <div class="request-meta">
            <span class="request-client"><i class="fa-solid fa-user"></i> {{ item.client }}</span>
          </div>
          <p class="request-body">{{ item.body }}</p>
        </button>

        <div v-if="expanded.has(item.id)" class="request-detail">
          <p v-if="item.hint" class="request-hint-line"><i class="fa-solid fa-signs-post"></i> {{ item.hint }}</p>
          <div class="request-btns">
            <button
              v-if="item.status === 'open'"
              class="mini-btn accept"
              @click="store.setRequestStatus(item.id, 'accepted')"
            >
              <i class="fa-solid fa-handshake"></i> 接受委托
            </button>
            <button
              v-if="item.status === 'accepted'"
              class="mini-btn done"
              @click="store.setRequestStatus(item.id, 'done')"
            >
              <i class="fa-solid fa-check"></i> 标记完成
            </button>
            <button
              v-if="item.status === 'open' || item.status === 'accepted'"
              class="mini-btn drop"
              @click="store.setRequestStatus(item.id, 'dropped')"
            >
              <i class="fa-solid fa-xmark"></i> 放弃
            </button>
            <button
              v-if="item.status === 'done' || item.status === 'dropped'"
              class="mini-btn"
              @click="store.setRequestStatus(item.id, 'open')"
            >
              <i class="fa-solid fa-rotate-left"></i> 重新打开
            </button>
          </div>
        </div>
      </article>

      <p v-if="error" class="error-hint">{{ error }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import AppHeader from './AppHeader.vue';
import type { PhoneRequest } from './phoneData';
import { usePhoneStore } from './store';

const store = usePhoneStore();
const loading = ref(false);
const error = ref('');
const expanded = reactive(new Set<string>());

const enabled = computed(() => store.requestsEnabled());
const visibleRequests = computed(() => [...store.requests].reverse());

function toggle(id: string) {
  if (expanded.has(id)) expanded.delete(id);
  else expanded.add(id);
}

function statusText(status: PhoneRequest['status']): string {
  switch (status) {
    case 'accepted':
      return '已接受';
    case 'done':
      return '已完成';
    case 'dropped':
      return '已放弃';
    default:
      return '待接受';
  }
}

async function generate() {
  if (loading.value) return;
  loading.value = true;
  error.value = '';
  try {
    const added = await store.generateRequests('manual');
    if (added === 0) {
      error.value = '这次没有生成新委托（可能与既有委托重复或素材不足），既有委托已保留。';
    }
  } catch (cause) {
    console.warn('[手机·委托] 生成失败', cause);
    error.value = '委托生成失败；既有委托仍已保留。';
  } finally {
    loading.value = false;
  }
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

.request-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.mode-banner {
  padding: 8px 12px;
  border-radius: 12px;
  background: rgba(255, 149, 0, 0.1);
  color: #b26a00;
  font-size: 11px;
  line-height: 1.6;
}

.request-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.gen-btn {
  padding: 10px 28px;
  border-radius: 999px;
  background: var(--c-ios-blue);
  color: #fff;
  font-size: 14px;

  &:disabled {
    opacity: 0.5;
  }
}

.request-hint,
.empty,
.error-hint {
  color: var(--c-ios-gray);
  text-align: center;
  font-size: 11px;
  line-height: 1.7;
}

.empty {
  padding: 30px 0;
}

.error-hint {
  color: var(--c-danger);
}

.request-card {
  padding: 12px 14px;
  border-left: 3px solid var(--c-accent);
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);

  &.expanded {
    border-left-color: var(--c-ios-blue);
  }

  &.done,
  &.dropped {
    opacity: 0.66;
  }
}

.request-head {
  width: 100%;
  display: block;
  text-align: left;
}

.request-tags {
  display: flex;
  gap: 5px;
  margin-bottom: 6px;

  span {
    padding: 1px 6px;
    border-radius: 999px;
    background: rgba(10, 132, 255, 0.08);
    color: var(--c-ios-blue);
    font-size: 9px;
  }

  .st-accepted {
    color: var(--c-success);
  }

  .st-done {
    color: var(--c-ios-gray);
  }

  .st-dropped {
    color: var(--c-danger);
  }
}

.request-title {
  margin-bottom: 6px;
  font-size: 14px;
  font-weight: 700;
}

.request-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  color: var(--c-ios-gray);
  font-size: 10px;
}

.request-client {
  color: var(--c-success);
}

.request-body {
  color: var(--c-text);
  font-size: 13px;
  line-height: 1.7;
  white-space: pre-line;
}

.request-detail {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px dashed var(--c-separator);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.request-hint-line {
  color: var(--c-ios-gray);
  font-size: 12px;
  line-height: 1.6;
}

.request-btns {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
}

.mini-btn {
  padding: 6px 16px;
  border-radius: 999px;
  background: rgba(10, 132, 255, 0.1);
  color: var(--c-ios-blue);
  font-size: 12px;

  &.accept {
    background: rgba(40, 199, 111, 0.12);
    color: var(--c-success);
  }

  &.done {
    background: rgba(40, 199, 111, 0.12);
    color: var(--c-success);
  }

  &.drop {
    background: rgba(255, 59, 48, 0.08);
    color: var(--c-danger);
  }
}
</style>
