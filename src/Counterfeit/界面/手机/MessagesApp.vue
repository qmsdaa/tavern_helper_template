<template>
  <div class="app-screen">
    <!-- 会话列表 -->
    <template v-if="!activeFriend">
      <AppHeader title="消息" />
      <div class="thread-list">
        <button v-for="friend in friends" :key="friend.name" class="thread-item" @click="openThread(friend.name)">
          <span class="avatar" :style="{ background: friend.tint }">{{ friend.name.slice(0, 1) }}</span>
          <span class="thread-main">
            <span class="thread-name">{{ friend.name }}</span>
            <span class="thread-preview">{{ previewOf(friend.name) }}</span>
          </span>
          <span v-if="store.unread[friend.name]" class="unread-badge">{{ store.unread[friend.name] }}</span>
          <i class="fa-solid fa-chevron-right thread-arrow"></i>
        </button>
        <p v-if="!friends.length" class="empty-hint">进入游戏后，这里会出现可以聊天的人</p>
      </div>
    </template>

    <!-- 对话页 -->
    <template v-else>
      <div class="app-header">
        <button class="back-btn" @click="activeFriend = ''"><i class="fa-solid fa-chevron-left"></i></button>
        <h2 class="app-title">{{ activeFriend }}</h2>
      </div>

      <div ref="scrollEl" class="bubble-scroll">
        <div v-for="(msg, i) in messagesOf(activeFriend)" :key="i" class="bubble-row" :class="msg.from">
          <span class="bubble">{{ msg.text }}</span>
        </div>
        <div v-if="typing" class="bubble-row them">
          <span class="bubble typing"><i></i><i></i><i></i></span>
        </div>
      </div>

      <Transition name="toast">
        <div v-if="affectionToast" class="affection-toast">好感 +1 · 现在 {{ affectionToast }}</div>
      </Transition>

      <div class="input-bar">
        <input v-model="draft" type="text" placeholder="iMessage 信息" @keydown.enter="send()" />
        <button class="send-btn" :disabled="!draft.trim()" @click="send()">
          <i class="fa-solid fa-arrow-up"></i>
        </button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import AppHeader from './AppHeader.vue';
import { buildGenerateExtra } from './settings';
import { computeFriends } from './vars';
import { usePhoneStore } from './store';

const store = usePhoneStore();

const friends = computed(() => computeFriends(store.snapshot));
const messagesOf = (name: string) => store.sessions[name] ?? [];

const activeFriend = ref('');
const draft = ref('');
const typing = ref(false);
const affectionToast = ref('');
const scrollEl = ref<HTMLElement | null>(null);
let toastTimer = 0;

// 好友 app「发消息」跳转
watch(
  () => store.pendingThread,
  name => {
    if (name) {
      openThread(name);
      store.pendingThread = '';
    }
  },
  { immediate: true },
);

function previewOf(name: string): string {
  const list = messagesOf(name);
  return list.length ? list[list.length - 1].text : '开始聊天吧';
}

function openThread(name: string) {
  if (!store.sessions[name]) {
    store.sessions[name] = [];
  }
  store.clearUnread(name);
  activeFriend.value = name;
  nextTick(() => scrollToBottom());
}

function scrollToBottom() {
  const el = scrollEl.value;
  if (el) {
    el.scrollTop = el.scrollHeight;
  }
}

async function send() {
  const text = draft.value.trim();
  if (!text || !activeFriend.value) {
    return;
  }
  const friend = activeFriend.value;
  store.pushMessage(friend, { from: 'me', text, t: new Date().toISOString() });
  draft.value = '';
  typing.value = true;
  nextTick(() => scrollToBottom());

  try {
    const reply = await requestReply(friend, text);
    for (const line of reply
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean)) {
      store.pushMessage(friend, { from: 'them', text: line, t: new Date().toISOString() });
    }
    // 攻略主战场：完成一次对话，好感 +1（可在设置·NPC 互动里关闭）
    if (store.npc.affectionGain) {
      const next = store.bumpAffection(friend, 1);
      if (next != null) {
        affectionToast.value = String(next);
        window.clearTimeout(toastTimer);
        toastTimer = window.setTimeout(() => (affectionToast.value = ''), 1600);
      }
    }
  } catch (error) {
    console.info('[手机·消息] 预览模式无法生成回复', error);
    store.pushMessage(friend, { from: 'them', text: '（预览模式：接入酒馆后这里会由对方亲自回复）' });
  } finally {
    typing.value = false;
    store.persistMessages();
    nextTick(() => scrollToBottom());
  }
}

async function requestReply(friend: string, text: string): Promise<string> {
  if (typeof generateRaw !== 'function') {
    throw new Error('no generateRaw');
  }
  const hero = store.snapshot.customName || '玩家';
  const persona = (store.personas[friend] ?? '').slice(0, 1500);
  const history = messagesOf(friend)
    .slice(-store.npc.historyLength)
    .map(m => `${m.from === 'me' ? hero : friend}：${m.text}`)
    .join('\n');
  const extra = store.npc.extraPrompt.trim();
  const prompt = [
    `你正在《我的青春恋爱物语果然有问题》的平行世界 AU 里扮演「${friend}」，用手机和「${hero}」发消息。`,
    persona ? `「${friend}」的角色资料：\n${persona}` : '',
    `要求：以「${friend}」的口吻与性格回复；用简体中文；1-3 条短消息，每条一行；不要解释、不要旁白、不要带角色名前缀。`,
    extra ? `附加要求：${extra}` : '',
    `对话记录：\n${history}`,
  ]
    .filter(Boolean)
    .join('\n\n');
  const raw = await generateRaw({
    user_input: prompt,
    should_silence: true,
    ...buildGenerateExtra(store.llm),
  } as Parameters<typeof generateRaw>[0]);
  return typeof raw === 'string' ? raw : String(raw ?? '');
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

.app-header {
  flex: none;
  height: 48px;
  display: flex;
  align-items: center;
  padding: 0 12px;
  background: rgba(255, 255, 255, 0.75);
  backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--c-separator);

  .back-btn {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    color: var(--c-ios-blue);
    font-size: 15px;
  }

  .app-title {
    flex: 1;
    text-align: center;
    font-size: 16px;
    font-weight: 700;
    transform: translateX(-17px);
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

  &:active {
    background: #f2f2f7;
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
  font-size: 18px;
  font-weight: 700;
}

.thread-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.thread-name {
  font-size: 15px;
  font-weight: 700;
}

.thread-preview {
  font-size: 13px;
  color: var(--c-ios-gray);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.thread-arrow {
  color: #c7c7cc;
  font-size: 13px;
}

.unread-badge {
  min-width: 20px;
  height: 20px;
  padding: 0 5px;
  border-radius: 10px;
  background: #ff3b30;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-hint {
  padding: 40px 24px;
  text-align: center;
  font-size: 13px;
  color: var(--c-ios-gray);
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

  &.me {
    justify-content: flex-end;
  }

  &.them {
    justify-content: flex-start;
  }
}

.bubble {
  max-width: 74%;
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

      &:nth-child(2) {
        animation-delay: 0.2s;
      }
      &:nth-child(3) {
        animation-delay: 0.4s;
      }
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

.affection-toast {
  position: absolute;
  left: 50%;
  bottom: 64px;
  transform: translateX(-50%);
  padding: 6px 14px;
  border-radius: 999px;
  background: rgba(28, 28, 30, 0.85);
  color: #fff;
  font-size: 12px;
  letter-spacing: 1px;
  z-index: 6;
}

.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 0.25s ease,
    transform 0.25s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 8px);
}

.input-bar {
  flex: none;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px 10px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(14px);
  border-top: 1px solid var(--c-separator);

  input {
    flex: 1;
    height: 36px;
    padding: 0 14px;
    border: 1px solid var(--c-separator);
    border-radius: 18px;
    font-size: 14px;
    font-family: inherit;
    outline: none;
    background: #fff;

    &:focus {
      border-color: var(--c-ios-blue);
    }
  }
}

.send-btn {
  width: 34px;
  height: 34px;
  flex: none;
  border-radius: 50%;
  background: var(--c-ios-blue);
  color: #fff;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;

  &:disabled {
    opacity: 0.4;
  }
}
</style>
