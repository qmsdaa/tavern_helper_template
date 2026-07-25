<template>
  <div class="app-screen">
    <AppHeader title="好友" />
    <div class="friends-scroll">
      <button v-for="friend in friends" :key="friend.name" class="friend-card" @click="openProfile(friend)">
        <span class="avatar" :style="{ background: friend.tint }">{{ friend.name.slice(0, 1) }}</span>
        <span class="friend-main">
          <span class="friend-name">{{ friend.name }}</span>
          <span class="affection-bar"><i :style="{ width: `${affectionOf(friend.name)}%` }"></i></span>
          <span class="friend-persona">{{ personaSnippet(friend.name) }}</span>
        </span>
        <span class="friend-tier">{{ tierOf(friend.name) }}</span>
      </button>
      <p v-if="!friends.length" class="empty-hint">进入游戏后，这里会出现好友</p>
    </div>

    <!-- 资料卡弹层 -->
    <Transition name="sheet">
      <div v-if="profile" class="profile-mask" @click="profile = null">
        <div class="profile-sheet" @click.stop>
          <span class="profile-avatar" :style="{ background: profile.tint }">{{ profile.name.slice(0, 1) }}</span>
          <h3 class="profile-name">{{ profile.name }}</h3>
          <div class="profile-affection">
            <span class="affection-bar"><i :style="{ width: `${affectionOf(profile.name)}%` }"></i></span>
            <span class="profile-tier">{{ tierOf(profile.name) }}</span>
          </div>
          <p class="profile-persona">{{ personaSnippet(profile.name, 240) || '还没有角色资料' }}</p>
          <button class="profile-chat-btn" @click="chatWith(profile.name)">
            <i class="fa-solid fa-message"></i> 发消息
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import AppHeader from './AppHeader.vue';
import { affectionTier, computeFriends, type FriendMeta } from './vars';
import { usePhoneStore } from './store';

const store = usePhoneStore();
const friends = computed(() => computeFriends(store.snapshot));
const profile = ref<FriendMeta | null>(null);

function affectionOf(name: string): number {
  const field = Object.entries({
    比企谷八幡: 'affection_hachiman',
    雪之下雪乃: 'affection_yukino',
    由比滨结衣: 'affection_yui',
    拉芙希妮: 'affection_laff',
    一色彩羽: 'affection_iroha',
  }).find(([n]) => n === name)?.[1];
  return field ? (store.snapshot.affection[field] ?? 0) : 0;
}

function tierOf(name: string): string {
  return affectionTier(affectionOf(name));
}

function personaSnippet(name: string, limit = 80): string {
  const text = (store.personas[name] ?? '').replace(/\s+/g, ' ').trim();
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

function openProfile(friend: FriendMeta) {
  profile.value = friend;
}

function chatWith(name: string) {
  store.pendingThread = name;
  profile.value = null;
  store.openApp('messages');
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

.friends-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.friend-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
  text-align: left;
}

.avatar {
  width: 48px;
  height: 48px;
  flex: none;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 18px;
  font-weight: 700;
}

.friend-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.friend-name {
  font-size: 15px;
  font-weight: 700;
}

.affection-bar {
  height: 5px;
  border-radius: 3px;
  background: #ececf1;
  overflow: hidden;

  i {
    display: block;
    height: 100%;
    border-radius: 3px;
    background: linear-gradient(90deg, var(--c-primary), var(--c-accent));
  }
}

.friend-persona {
  font-size: 11px;
  color: var(--c-ios-gray);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.friend-tier {
  flex: none;
  font-size: 12px;
  color: var(--c-primary-strong);
}

.empty-hint {
  padding: 40px 24px;
  text-align: center;
  font-size: 13px;
  color: var(--c-ios-gray);
}

.profile-mask {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: flex-end;
  z-index: 8;
}

.profile-sheet {
  width: 100%;
  background: var(--c-phone-screen);
  border-radius: 20px 20px 0 0;
  padding: 20px 20px 26px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.profile-avatar {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 28px;
  font-weight: 700;
  margin-top: -52px;
  border: 3px solid var(--c-phone-screen);
}

.profile-name {
  font-size: 18px;
  font-weight: 700;
}

.profile-affection {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;

  .affection-bar {
    flex: 1;
  }
}

.profile-tier {
  font-size: 12px;
  color: var(--c-primary-strong);
}

.profile-persona {
  font-size: 12px;
  color: var(--c-ios-gray);
  line-height: 1.8;
  max-height: 140px;
  overflow-y: auto;
}

.profile-chat-btn {
  margin-top: 4px;
  padding: 10px 28px;
  border-radius: 999px;
  background: var(--c-ios-blue);
  color: #fff;
  font-size: 14px;

  i {
    margin-right: 6px;
  }
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
