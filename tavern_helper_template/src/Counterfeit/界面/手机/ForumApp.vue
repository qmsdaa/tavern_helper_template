<template>
  <div class="app-screen">
    <AppHeader title="论坛" />
    <div class="forum-scroll">
      <div class="forum-actions">
        <button class="gen-btn" :disabled="loadingBatch" @click="generateBatch">
          <i class="fa-solid fa-bolt"></i> {{ loadingBatch ? '刷新中…' : '刷新论坛' }}
        </button>
        <p class="forum-hint">帖子会按当前存档持续保存；传闻、猜测和夸张标题都不等于主线事实</p>
      </div>

      <p v-if="!posts.length && !loadingBatch" class="empty">点“刷新论坛”生成当前日期的校园帖子</p>

      <article
        v-for="post in visiblePosts"
        :key="post.id"
        class="post-card"
        :class="{ expanded: expanded.has(post.id), folded: post.folded }"
      >
        <button class="post-head" @click="toggle(post.id)">
          <div class="post-tags">
            <span>{{ post.board }}</span>
            <span>{{ post.type }}</span>
            <span :class="post.status">{{ statusText(post.status) }}</span>
          </div>
          <h3 class="post-title">{{ post.title }}</h3>
          <div class="post-meta">
            <span class="post-author">{{ post.author }}</span>
            <span>{{ post.story_time }}</span>
            <span class="post-heat"><i class="fa-solid fa-fire"></i> {{ post.heat }}</span>
            <span><i class="fa-solid fa-comment-dots"></i> {{ post.replies.length }}</span>
          </div>
          <p class="post-body">{{ post.body }}</p>
        </button>

        <div v-if="expanded.has(post.id)" class="reply-chain">
          <div v-for="(reply, index) in post.replies" :key="reply.id" class="reply-row">
            <span class="reply-floor">{{ index + 2 }} 楼</span>
            <span class="reply-author">{{ reply.author }}</span>
            <p class="reply-body">{{ reply.body }}</p>
          </div>
          <p v-if="!post.replies.length && !replyLoading[post.id]" class="reply-empty">暂时还没人回复</p>
          <button class="reply-gen-btn" :disabled="replyLoading[post.id]" @click="generateReplies(post.id)">
            <i class="fa-solid fa-comments"></i>
            {{ replyLoading[post.id] ? '生成中…' : '追加回复' }}
          </button>
        </div>
      </article>

      <button v-if="visibleCount < posts.length" class="more-btn" @click="loadMore">
        <i class="fa-solid fa-angle-down"></i> 加载更多旧帖（{{ posts.length - visibleCount }}）
      </button>

      <p v-if="error" class="error-hint">{{ error }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import AppHeader from './AppHeader.vue';
import type { ForumPost } from './phoneData';
import { usePhoneStore } from './store';

const store = usePhoneStore();
const loadingBatch = ref(false);
const replyLoading = reactive<Record<string, boolean>>({});
const expanded = reactive(new Set<string>());
const error = ref('');
const posts = computed(() => [...store.forumPosts].reverse());

/** Bug6：分页渲染，避免长列表一次性渲染拖慢手机 UI */
const PAGE_SIZE = 15;
const visibleCount = ref(PAGE_SIZE);
const visiblePosts = computed(() => posts.value.slice(0, visibleCount.value));

function loadMore() {
  visibleCount.value = Math.min(posts.value.length, visibleCount.value + PAGE_SIZE);
}

watch(posts, () => {
  if (visibleCount.value < PAGE_SIZE) visibleCount.value = PAGE_SIZE;
});

function toggle(postId: string) {
  if (expanded.has(postId)) expanded.delete(postId);
  else expanded.add(postId);
}

function statusText(status: ForumPost['status']): string {
  return status === 'resolved' ? '已解决' : status === 'locked' ? '已锁帖' : '讨论中';
}

async function generateBatch() {
  if (loadingBatch.value) return;
  loadingBatch.value = true;
  error.value = '';
  try {
    await store.generateForumBatch();
  } catch (cause) {
    console.warn('[手机·论坛] 批次生成失败', cause);
    error.value = '论坛刷新失败；旧帖子仍已保留。';
  } finally {
    loadingBatch.value = false;
  }
}

async function generateReplies(postId: string) {
  if (replyLoading[postId]) return;
  replyLoading[postId] = true;
  error.value = '';
  try {
    await store.generateForumReplies(postId);
  } catch (cause) {
    console.warn('[手机·论坛] 回复生成失败', cause);
    error.value = '回复生成失败，帖子本身没有被覆盖。';
  } finally {
    replyLoading[postId] = false;
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

.forum-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.forum-actions {
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

.forum-hint,
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

.post-card {
  padding: 12px 14px;
  border-left: 3px solid var(--c-accent);
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);

  &.expanded {
    border-left-color: var(--c-ios-blue);
  }

  &.folded {
    opacity: 0.72;

    .post-body {
      color: var(--c-ios-gray);
      font-size: 12px;
    }
  }
}

.more-btn {
  align-self: center;
  padding: 8px 22px;
  border-radius: 999px;
  background: rgba(10, 132, 255, 0.1);
  color: var(--c-ios-blue);
  font-size: 12px;

  &:disabled {
    opacity: 0.5;
  }
}

.post-head {
  width: 100%;
  display: block;
  text-align: left;
}

.post-tags {
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

  .resolved {
    color: var(--c-success);
  }

  .locked {
    color: var(--c-ios-gray);
  }
}

.post-title {
  margin-bottom: 6px;
  font-size: 14px;
  font-weight: 700;
}

.post-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  color: var(--c-ios-gray);
  font-size: 10px;
}

.post-author {
  color: var(--c-success);
}

.post-heat {
  margin-left: auto;
  color: #ff9500;
}

.post-body {
  color: var(--c-text);
  font-size: 13px;
  line-height: 1.7;
  white-space: pre-line;
}

.reply-chain {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px dashed var(--c-separator);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.reply-row {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 3px 8px;
  padding-left: 8px;
  border-left: 2px solid var(--c-separator);
}

.reply-floor {
  color: var(--c-ios-gray);
  font-size: 10px;
}

.reply-author {
  color: var(--c-success);
  font-size: 11px;
}

.reply-body {
  grid-column: 1 / -1;
  color: var(--c-text);
  font-size: 12px;
  line-height: 1.6;
}

.reply-empty {
  color: var(--c-ios-gray);
  text-align: center;
  font-size: 11px;
}

.reply-gen-btn {
  align-self: center;
  padding: 6px 18px;
  border-radius: 999px;
  background: rgba(10, 132, 255, 0.1);
  color: var(--c-ios-blue);
  font-size: 12px;

  &:disabled {
    opacity: 0.5;
  }
}
</style>
