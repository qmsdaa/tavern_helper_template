<template>
  <div class="app-screen">
    <AppHeader title="论坛" />
    <div class="forum-scroll">
      <div class="forum-actions">
        <button class="gen-btn" :disabled="loading" @click="generate()">
          <i class="fa-solid fa-bolt"></i> {{ loading ? '生成中…' : '刷一刷' }}
        </button>
        <p class="forum-hint">总武高匿名版·内容是 AI 现场编的，别当真</p>
      </div>

      <p v-if="!posts.length && !loading" class="empty">点「刷一刷」生成最新校园传闻</p>

      <article v-for="(post, i) in posts" :key="i" class="post-card" :class="{ expanded: post.expanded }">
        <button class="post-head" @click="toggle(post)">
          <h3 class="post-title">{{ post.title }}</h3>
          <div class="post-meta">
            <span class="post-author">{{ post.author }}</span>
            <span class="post-floor">1 楼</span>
            <span class="post-reply-count">
              <i class="fa-solid fa-comment-dots"></i>
              {{ post.replies.length ? `${post.replies.length} 条回复` : '回复链' }}
            </span>
          </div>
          <p class="post-body">{{ post.body }}</p>
        </button>

        <!-- 回复链（展开后按需生成） -->
        <div v-if="post.expanded" class="reply-chain">
          <div v-for="(reply, j) in post.replies" :key="j" class="reply-row">
            <span class="reply-floor">{{ j + 2 }} 楼</span>
            <span class="reply-author">{{ reply.author }}</span>
            <p class="reply-body">{{ reply.body }}</p>
          </div>
          <p v-if="!post.replies.length && !post.loadingReplies" class="reply-empty">还没有回复，让校友们在楼下吵起来</p>
          <button class="reply-gen-btn" :disabled="post.loadingReplies" @click="generateReplies(post)">
            <i class="fa-solid fa-rotate"></i>
            {{ post.loadingReplies ? '生成中…' : post.replies.length ? '换一批回复' : '生成回复链' }}
          </button>
        </div>
      </article>

      <p v-if="error" class="error-hint">{{ error }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import AppHeader from './AppHeader.vue';
import { buildGenerateExtra, readStoryContext } from './settings';
import { usePhoneStore } from './store';

interface ForumReply {
  author: string;
  body: string;
}

interface ForumPost {
  title: string;
  author: string;
  body: string;
  expanded: boolean;
  loadingReplies: boolean;
  replies: ForumReply[];
}

const THEMES = ['校园传闻', '奉仕部观察', '食堂测评', '考试互助', '恋爱相谈', '体育祭预热', '社团招新吐槽'];

const store = usePhoneStore();
const posts = ref<ForumPost[]>([]);
const loading = ref(false);
const error = ref('');

async function callLlm(prompt: string): Promise<string> {
  if (typeof generateRaw !== 'function') {
    throw new Error('no generateRaw');
  }
  const raw = await generateRaw({
    user_input: prompt,
    should_silence: true,
    ...buildGenerateExtra(store.llm),
  } as Parameters<typeof generateRaw>[0]);
  return typeof raw === 'string' ? raw : String(raw ?? '');
}

function toggle(post: ForumPost) {
  post.expanded = !post.expanded;
}

async function generate() {
  if (loading.value) {
    return;
  }
  loading.value = true;
  error.value = '';
  try {
    const theme = THEMES[Math.floor(Math.random() * THEMES.length)];
    const story = await readStoryContext(store.snapshot);
    const prompt = [
      `你在玩《我的青春恋爱物语果然有问题》AU 文字游戏。请生成"总武高匿名论坛"的 4 条帖子，主题方向：${theme}。`,
      `背景：故事进行到${story.actName || '高三日常'}${story.sceneTitle ? `，最近的剧情事件是「${story.sceneTitle}」` : ''}。可以影射奉仕部、学生会、京王联合活动等校园元素与近期事件，但用学生八卦口吻，不要点名道姓地说破任何人的隐私，不要剧透未发生的剧情。`,
      `格式（严格遵守，每条三行）：`,
      `【标题】帖子标题`,
      `【作者】匿名网名（如：匿名希望、总武之狼、柠檬苏打）`,
      `【内容】1-3 句正文`,
      `只输出帖子内容，不要解释。`,
    ].join('\n');
    const text = await callLlm(prompt);
    posts.value = parsePosts(text).map(p => ({ ...p, expanded: false, loadingReplies: false, replies: [] }));
    if (!posts.value.length) {
      posts.value = [{ title: theme, author: '匿名希望', body: text.slice(0, 200), expanded: false, loadingReplies: false, replies: [] }];
    }
  } catch (e) {
    error.value = '预览模式无法生成论坛内容（接入酒馆后可用）';
    console.info('[手机·论坛] 生成失败', e);
  } finally {
    loading.value = false;
  }
}

/** 回复链：给指定帖子生成 3-5 楼回复 */
async function generateReplies(post: ForumPost) {
  if (post.loadingReplies) {
    return;
  }
  post.loadingReplies = true;
  error.value = '';
  try {
    const story = await readStoryContext(store.snapshot);
    const known = post.replies.map((r, j) => `${j + 2} 楼 ${r.author}：${r.body}`).join('\n');
    const prompt = [
      `你在玩《我的青春恋爱物语果然有问题》AU 文字游戏。这是"总武高匿名论坛"的一条帖子：`,
      `标题：${post.title}`,
      `1 楼 ${post.author}：${post.body}`,
      `背景：故事进行到${story.actName || '高三日常'}${story.sceneTitle ? `（近期事件「${story.sceneTitle}」）` : ''}。`,
      `请为这条帖子生成 4 条学生回复（回帖接龙）：有人附和、有人歪楼、有人唱反调、有人爆料小道消息；用学生八卦口吻，不要点名道姓说破任何人的隐私，不要剧透未发生的剧情。`,
      known ? `已有回复（请接在它们后面，别重复观点）：\n${known}` : '',
      `格式（严格遵守，每条两行）：`,
      `【作者】匿名网名`,
      `【内容】1-2 句回复`,
      `只输出回复内容，不要解释。`,
    ]
      .filter(Boolean)
      .join('\n');
    const text = await callLlm(prompt);
    const replies = parseReplies(text);
    post.replies = replies.length ? replies : [{ author: '匿名希望', body: text.slice(0, 120) }];
  } catch (e) {
    error.value = '回复链生成失败（接入酒馆后可用）';
    console.info('[手机·论坛] 回复链生成失败', e);
  } finally {
    post.loadingReplies = false;
  }
}

function parsePosts(text: string): Omit<ForumPost, 'expanded' | 'loadingReplies' | 'replies'>[] {
  const result: { title: string; author: string; body: string }[] = [];
  let title = '';
  let author = '';
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (t.startsWith('【标题】')) {
      title = t.slice(4).trim();
    } else if (t.startsWith('【作者】')) {
      author = t.slice(4).trim();
    } else if (t.startsWith('【内容】')) {
      if (title || author) {
        result.push({ title: title || '无题', author: author || '匿名希望', body: t.slice(4).trim() });
        title = '';
        author = '';
      }
    } else if (result.length && t) {
      result[result.length - 1].body += `\n${t}`;
    }
  }
  return result;
}

function parseReplies(text: string): ForumReply[] {
  const result: ForumReply[] = [];
  let author = '';
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (t.startsWith('【作者】')) {
      author = t.slice(4).trim();
    } else if (t.startsWith('【内容】')) {
      result.push({ author: author || '匿名希望', body: t.slice(4).trim() });
      author = '';
    } else if (result.length && t) {
      result[result.length - 1].body += `\n${t}`;
    }
  }
  return result.filter(r => r.body);
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

  i {
    margin-right: 6px;
  }
}

.forum-hint {
  font-size: 11px;
  color: var(--c-ios-gray);
}

.empty {
  padding: 30px 0;
  text-align: center;
  font-size: 13px;
  color: var(--c-ios-gray);
}

.post-card {
  background: #fff;
  border-radius: 14px;
  padding: 12px 14px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  border-left: 3px solid var(--c-accent);

  &.expanded {
    border-left-color: var(--c-ios-blue);
  }
}

.post-head {
  width: 100%;
  text-align: left;
  display: block;
}

.post-title {
  font-size: 14px;
  font-weight: 700;
  margin-bottom: 6px;
}

.post-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}

.post-author {
  font-size: 11px;
  color: var(--c-success);
}

.post-floor {
  font-size: 11px;
  color: var(--c-ios-gray);
}

.post-reply-count {
  margin-left: auto;
  font-size: 11px;
  color: var(--c-ios-blue);

  i {
    margin-right: 3px;
  }
}

.post-body {
  font-size: 13px;
  line-height: 1.7;
  color: var(--c-text);
  white-space: pre-line;
}

/* —— 回复链 —— */

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
  grid-template-columns: auto auto 1fr;
  column-gap: 8px;
  align-items: baseline;
  padding-left: 8px;
  border-left: 2px solid var(--c-separator);
}

.reply-floor {
  font-size: 10px;
  color: var(--c-ios-gray);
  white-space: nowrap;
}

.reply-author {
  font-size: 11px;
  color: var(--c-success);
  white-space: nowrap;
}

.reply-body {
  grid-column: 1 / -1;
  font-size: 12.5px;
  line-height: 1.6;
  color: var(--c-text);
  white-space: pre-line;
}

.reply-empty {
  font-size: 12px;
  color: var(--c-ios-gray);
  text-align: center;
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

  i {
    margin-right: 5px;
  }
}

.error-hint {
  font-size: 12px;
  color: var(--c-danger);
  text-align: center;
}
</style>
