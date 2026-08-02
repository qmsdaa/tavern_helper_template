<template>
  <div class="app-screen">
    <template v-if="!activeThread">
      <AppHeader title="消息">
        <button class="add-group-btn" title="新建群聊" @click="showGroupCreator = true">
          <i class="fa-solid fa-pen-to-square"></i>
        </button>
      </AppHeader>
      <div class="thread-list">
        <button v-for="thread in store.threads" :key="thread.id" class="thread-item" @click="openThread(thread.id)">
          <span class="avatar" :style="{ background: tintForName(thread.title) }">
            <i v-if="thread.type === 'group'" class="fa-solid fa-user-group"></i>
            <template v-else>{{ thread.title.slice(0, 1) }}</template>
          </span>
          <span class="thread-main">
            <span class="thread-name">
              {{ thread.title }}
              <small>{{ thread.type === 'group' ? `${thread.participants.length}人群聊` : '私聊' }}</small>
            </span>
            <span class="thread-preview">{{ previewOf(thread.id) }}</span>
          </span>
          <span v-if="thread.unread" class="unread-badge">{{ thread.unread }}</span>
          <i class="fa-solid fa-chevron-right thread-arrow"></i>
        </button>
        <p v-if="!store.threads.length" class="empty-hint">
          还没有会话。可以从好友资料发起私聊，或点击右上角创建群聊。
        </p>
      </div>
    </template>

    <template v-else>
      <div class="app-header">
        <button class="back-btn" @click="activeThreadId = ''"><i class="fa-solid fa-chevron-left"></i></button>
        <div class="title-block">
          <h2 class="app-title">{{ activeThread.title }}</h2>
          <span>{{ activeThread.type === 'group' ? activeThread.participants.join('、') : '私聊' }}</span>
        </div>
        <button class="clear-btn" title="清空聊天" @click="clearActiveThread">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>

      <div ref="scrollEl" class="bubble-scroll">
        <div
          v-for="message in store.messagesOf(activeThread.id)"
          :key="message.id"
          class="bubble-row"
          :class="{ me: message.sender === playerName, them: message.sender !== playerName }"
        >
          <span v-if="activeThread.type === 'group' && message.sender !== playerName" class="sender-label">
            {{ message.sender }}
          </span>
          <span class="bubble">{{ message.text }}</span>
        </div>
        <div v-if="typing" class="bubble-row them">
          <span class="bubble typing"><i></i><i></i><i></i></span>
        </div>
      </div>

      <p v-if="blocked" class="blocked-hint">该联系人已被屏蔽，无法继续私聊。解除屏蔽不会恢复已清空的消息。</p>
      <div class="input-bar">
        <input
          v-model="draft"
          type="text"
          :disabled="typing || blocked"
          :placeholder="blocked ? '已屏蔽联系人' : activeThread.type === 'group' ? '发送群消息' : 'iMessage 信息'"
          @keydown.enter="send()"
        />
        <button class="send-btn" :disabled="typing || blocked || !draft.trim()" @click="send()">
          <i class="fa-solid fa-arrow-up"></i>
        </button>
      </div>
    </template>

    <Transition name="sheet">
      <div v-if="showGroupCreator" class="creator-mask" @click="showGroupCreator = false">
        <div class="creator-sheet" @click.stop>
          <h3>新建群聊</h3>
          <label class="group-title-field">
            <span>群名</span>
            <input v-model.trim="groupTitle" maxlength="30" placeholder="例：奉仕部日常" />
          </label>
          <p class="creator-hint">创建群聊不会自动把成员添加为私聊联系人；以后删除联系人也不会退出群聊。</p>
          <div class="member-list">
            <label v-for="contact in store.contacts" :key="contact.character">
              <input v-model="groupMembers" type="checkbox" :value="contact.character" />
              <span>{{ contact.display_name }}</span>
            </label>
          </div>
          <button class="create-btn" :disabled="!groupMembers.length" @click="createGroup">
            创建群聊
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import AppHeader from './AppHeader.vue';
import { tintForName } from './vars';
import { usePhoneStore } from './store';

const store = usePhoneStore();
const activeThreadId = ref('');
const draft = ref('');
const typing = ref(false);
const scrollEl = ref<HTMLElement | null>(null);
const showGroupCreator = ref(false);
const groupTitle = ref('');
const groupMembers = ref<string[]>([]);

const playerName = computed(() => store.snapshot.playerName || store.snapshot.customName || '玩家');
const activeThread = computed(() => store.phone.threads[activeThreadId.value] ?? null);
const blocked = computed(() => {
  if (!activeThread.value || activeThread.value.type !== 'direct') return false;
  const target = activeThread.value.participants.find(name => name !== playerName.value);
  return Boolean(target && store.phone.contacts[target]?.status === 'blocked');
});

watch(
  () => store.pendingThread,
  threadId => {
    if (!threadId) return;
    openThread(threadId);
    store.pendingThread = '';
  },
  { immediate: true },
);

function previewOf(threadId: string): string {
  const list = store.messagesOf(threadId);
  if (!list.length) return '开始聊天吧';
  const last = list[list.length - 1];
  return `${last.sender === playerName.value ? '你' : last.sender}：${last.text}`;
}

function openThread(threadId: string) {
  if (!store.phone.threads[threadId]) return;
  store.clearUnread(threadId);
  activeThreadId.value = threadId;
  nextTick(scrollToBottom);
}

function scrollToBottom() {
  const el = scrollEl.value;
  if (el) el.scrollTop = el.scrollHeight;
}

async function send() {
  const text = draft.value.trim();
  if (!text || !activeThread.value || typing.value || blocked.value) return;
  const threadId = activeThread.value.id;
  draft.value = '';
  typing.value = true;
  nextTick(scrollToBottom);
  try {
    await store.sendThreadMessage(threadId, text);
  } catch (error) {
    console.warn('[手机·消息] 发送或回复失败', error);
  } finally {
    typing.value = false;
    nextTick(scrollToBottom);
  }
}

function clearActiveThread() {
  if (!activeThread.value) return;
  if (!window.confirm(`只清空“${activeThread.value.title}”的聊天记录？联系人和群聊本身会保留。`)) return;
  store.clearThread(activeThread.value.id);
}

function createGroup() {
  const thread = store.createGroup(groupTitle.value, groupMembers.value);
  showGroupCreator.value = false;
  groupTitle.value = '';
  groupMembers.value = [];
  openThread(thread.id);
}
</script>

<style lang="scss" scoped>
.app-screen {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--c-phone-screen);
  min-height: 0;
  position: relative;
}

.add-group-btn,
.clear-btn {
  width: 34px;
  height: 34px;
  color: var(--c-ios-blue);
  font-size: 14px;
}

.app-header {
  flex: none;
  min-height: 48px;
  display: flex;
  align-items: center;
  padding: 4px 12px;
  background: rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--c-separator);
}

.back-btn {
  width: 34px;
  height: 34px;
  color: var(--c-ios-blue);
}

.title-block {
  flex: 1;
  min-width: 0;
  text-align: center;

  h2 {
    font-size: 15px;
    font-weight: 700;
  }

  span {
    display: block;
    overflow: hidden;
    color: var(--c-ios-gray);
    font-size: 9px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.thread-list {
  flex: 1;
  overflow-y: auto;
}

.thread-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: #fff;
  text-align: left;

  & + .thread-item {
    border-top: 1px solid var(--c-separator);
  }
}

.avatar {
  width: 46px;
  height: 46px;
  flex: none;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 17px;
  font-weight: 700;
}

.thread-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.thread-name {
  font-size: 14px;
  font-weight: 700;

  small {
    margin-left: 5px;
    color: var(--c-ios-gray);
    font-size: 9px;
    font-weight: 400;
  }
}

.thread-preview {
  overflow: hidden;
  color: var(--c-ios-gray);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.thread-arrow {
  color: #c7c7cc;
  font-size: 12px;
}

.unread-badge {
  min-width: 20px;
  height: 20px;
  padding: 0 5px;
  border-radius: 10px;
  background: #ff3b30;
  color: #fff;
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-hint {
  padding: 40px 24px;
  text-align: center;
  color: var(--c-ios-gray);
  font-size: 12px;
  line-height: 1.8;
}

.bubble-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 14px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.bubble-row {
  display: flex;
  flex-direction: column;

  &.me {
    align-items: flex-end;
  }

  &.them {
    align-items: flex-start;
  }
}

.sender-label {
  margin: 0 8px 2px;
  color: var(--c-ios-gray);
  font-size: 9px;
}

.bubble {
  max-width: 76%;
  padding: 8px 13px;
  border-radius: 18px;
  font-size: 14px;
  line-height: 1.5;
  word-break: break-word;

  .me & {
    background: var(--c-ios-blue);
    color: #fff;
    border-bottom-right-radius: 4px;
  }

  .them & {
    background: var(--c-bubble-other);
    color: var(--c-text);
    border-bottom-left-radius: 4px;
  }

  &.typing {
    display: flex;
    gap: 4px;
    padding: 12px 14px;

    i {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #9c9ca1;
      animation: typing-blink 1.2s infinite;
    }
  }
}

@keyframes typing-blink {
  0%,
  60%,
  100% {
    opacity: 0.35;
  }
  30% {
    opacity: 1;
  }
}

.blocked-hint {
  padding: 6px 12px;
  background: rgba(255, 59, 48, 0.08);
  color: var(--c-danger);
  text-align: center;
  font-size: 10px;
}

.input-bar {
  flex: none;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px 10px;
  background: rgba(255, 255, 255, 0.85);
  border-top: 1px solid var(--c-separator);

  input {
    flex: 1;
    height: 36px;
    padding: 0 14px;
    border: 1px solid var(--c-separator);
    border-radius: 18px;
    background: #fff;
    font-size: 14px;
    outline: none;
  }
}

.send-btn {
  width: 34px;
  height: 34px;
  flex: none;
  border-radius: 50%;
  background: var(--c-ios-blue);
  color: #fff;

  &:disabled {
    opacity: 0.4;
  }
}

.creator-mask {
  position: absolute;
  inset: 0;
  z-index: 9;
  display: flex;
  align-items: flex-end;
  background: rgba(0, 0, 0, 0.4);
}

.creator-sheet {
  width: 100%;
  max-height: 78%;
  overflow-y: auto;
  padding: 20px;
  border-radius: 20px 20px 0 0;
  background: var(--c-phone-screen);

  h3 {
    margin-bottom: 12px;
    text-align: center;
    font-size: 17px;
  }
}

.group-title-field {
  display: flex;
  align-items: center;
  gap: 10px;

  span {
    color: var(--c-ios-gray);
    font-size: 12px;
  }

  input {
    flex: 1;
    padding: 8px 10px;
    border: 1px solid var(--c-separator);
    border-radius: 9px;
    background: #fff;
  }
}

.creator-hint {
  margin: 10px 0;
  color: var(--c-ios-gray);
  font-size: 10px;
  line-height: 1.6;
}

.member-list {
  display: flex;
  flex-direction: column;
  gap: 6px;

  label {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border-radius: 9px;
    background: #fff;
    font-size: 12px;
  }
}

.create-btn {
  width: 100%;
  margin-top: 14px;
  padding: 10px;
  border-radius: 10px;
  background: var(--c-ios-blue);
  color: #fff;

  &:disabled {
    opacity: 0.4;
  }
}
</style>
