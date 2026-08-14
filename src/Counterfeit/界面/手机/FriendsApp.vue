<template>
  <div class="app-screen">
    <AppHeader title="好友">
      <button class="manage-btn" @click="showManaged = !showManaged">{{ showManaged ? '完成' : '管理' }}</button>
    </AppHeader>

    <div class="friends-scroll">
      <template v-if="!showManaged">
        <button
          v-for="contact in store.contacts"
          :key="contact.character"
          class="friend-card"
          @click="profile = contact"
        >
          <span class="avatar" :style="{ background: tintForName(contact.character) }">
            <img v-if="avatarUrlFor(contact.character)" :src="avatarUrlFor(contact.character)!" class="avatar-img" :alt="contact.display_name" loading="lazy" />
            <template v-else>{{ contact.display_name.slice(0, 1) }}</template>
          </span>
          <span class="friend-main">
            <span class="friend-name">{{ contact.display_name }}</span>
            <span class="friend-basis">{{ contact.basis || '已拥有联系方式' }}</span>
          </span>
          <i class="fa-solid fa-chevron-right friend-arrow"></i>
        </button>
        <p v-if="!store.contacts.length" class="empty-hint">
          通讯录还是空的。只有主线中明确交换号码、被拉入群聊后保存、第三方转交或身份预设，才会添加联系人。
        </p>

        <div class="scan-zone">
          <button class="scan-btn" :disabled="scanning" @click="scanLatest">
            <i class="fa-solid" :class="scanning ? 'fa-spinner fa-spin' : 'fa-magnifying-glass'"></i>
            {{ scanning ? '正在检索…' : '从最近剧情检索联系人' }}
          </button>
          <p v-if="scanResult" class="scan-result" :class="scanResult.tone">{{ scanResult.text }}</p>
        </div>
      </template>

      <template v-else>
        <h3 class="section-title">已移除与已屏蔽</h3>
        <button
          v-for="contact in inactiveContacts"
          :key="contact.character"
          class="friend-card muted"
          @click="profile = contact"
        >
          <span class="avatar" :style="{ background: tintForName(contact.character) }">
            <img v-if="avatarUrlFor(contact.character)" :src="avatarUrlFor(contact.character)!" class="avatar-img" :alt="contact.display_name" loading="lazy" />
            <template v-else>{{ contact.display_name.slice(0, 1) }}</template>
          </span>
          <span class="friend-main">
            <span class="friend-name">{{ contact.display_name }}</span>
            <span class="friend-basis">{{ contact.status === 'blocked' ? '已屏蔽' : '已从通讯录移除' }}</span>
          </span>
          <i class="fa-solid fa-chevron-right friend-arrow"></i>
        </button>
        <p v-if="!inactiveContacts.length" class="empty-hint">没有已移除或已屏蔽的联系人</p>
      </template>
    </div>

    <Transition name="sheet">
      <div v-if="profile" class="profile-mask" @click="profile = null">
        <div class="profile-sheet" @click.stop>
          <span class="profile-avatar" :style="{ background: tintForName(profile.character) }">
            <img v-if="avatarUrlFor(profile.character)" :src="avatarUrlFor(profile.character)!" class="avatar-img" :alt="profile.display_name" loading="lazy" />
            <template v-else>{{ profile.display_name.slice(0, 1) }}</template>
          </span>
          <h3 class="profile-name">{{ profile.display_name }}</h3>
          <span class="status-pill" :class="profile.status">{{ statusLabel(profile.status) }}</span>
          <p class="profile-basis">联系方式依据：{{ profile.basis || '未记录' }}</p>
          <p class="profile-persona">{{ bioSnippet(profile) }}</p>
          <button
            v-if="!profile.profile_bio && !bioLoading"
            class="bio-btn"
            :disabled="bioLoading"
            @click="generateBio(profile.character)"
          >
            <i class="fa-solid fa-wand-magic-sparkles"></i> 生成手机简介
          </button>
          <p v-else-if="bioLoading" class="bio-loading">正在提炼简介…</p>

          <div class="profile-actions">
            <button v-if="profile.status !== 'blocked'" class="primary-btn" @click="chatWith(profile.character)">
              <i class="fa-solid fa-message"></i> 发消息
            </button>
            <button v-if="profile.status === 'active'" class="secondary-btn" @click="setStatus('removed')">
              删除联系人
            </button>
            <button v-if="profile.status === 'removed'" class="secondary-btn" @click="setStatus('active')">
              恢复联系人
            </button>
            <button
              class="danger-btn"
              @click="setStatus(profile.status === 'blocked' ? 'active' : 'blocked')"
            >
              {{ profile.status === 'blocked' ? '解除屏蔽' : '屏蔽联系人' }}
            </button>
          </div>
          <p class="boundary-hint">删除联系人不会清空聊天或退出群聊；只有屏蔽会禁止私聊联系。</p>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import AppHeader from './AppHeader.vue';
import type { ContactStatus, PhoneContact } from './phoneData';
import { avatarUrlFor, tintForName } from './vars';
import { usePhoneStore, type IngestOutcome } from './store';

const store = usePhoneStore();
const profile = ref<PhoneContact | null>(null);
const showManaged = ref(false);

const inactiveContacts = computed(() => store.allContacts.filter(contact => contact.status !== 'active'));

function personaSnippet(name: string, limit = 80): string {
  const text = (store.personas[name] ?? '').replace(/\s+/g, ' ').trim();
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

/** Bug10：优先展示缓存的手机简介，未生成时回退世界书资料摘要 */
function bioSnippet(contact: PhoneContact): string {
  if (contact.profile_bio) return contact.profile_bio;
  const fallback = personaSnippet(contact.character, 320);
  return fallback ? `${fallback}（可点下方按钮生成专属手机简介）` : '还没有角色资料，可生成手机简介';
}

const bioLoading = ref(false);

async function generateBio(name: string) {
  if (bioLoading.value || !profile.value) return;
  bioLoading.value = true;
  try {
    const bio = await store.generateContactBio(name);
    if (bio && profile.value) {
      profile.value = store.phone.contacts[name] ?? null;
    }
  } catch (error) {
    console.warn('[手机·简介] 生成失败', error);
  } finally {
    bioLoading.value = false;
  }
}

function statusLabel(status: ContactStatus): string {
  return status === 'active' ? '联系人' : status === 'removed' ? '已移除' : '已屏蔽';
}

function chatWith(name: string) {
  const thread = store.openDirectThread(name);
  store.pendingThread = thread.id;
  profile.value = null;
  store.openApp('messages');
}

function setStatus(status: ContactStatus) {
  if (!profile.value) return;
  const name = profile.value.character;
  store.updateContactStatus(name, status);
  profile.value = store.phone.contacts[name] ?? null;
}

/* —— 主线检索：把原本只在设置页、且成功失败无从区分的解析搬到好友页 —— */

const scanning = ref(false);
const scanResult = ref<{ text: string; tone: 'ok' | 'none' | 'error' } | null>(null);

async function scanLatest() {
  if (scanning.value) return;
  scanning.value = true;
  scanResult.value = null;
  try {
    const outcome = await store.parseLatestMainline();
    scanResult.value = describeOutcome(outcome);
  } catch (error) {
    scanResult.value = {
      text: `检索失败：${error instanceof Error ? error.message : String(error)}`,
      tone: 'error',
    };
  } finally {
    scanning.value = false;
  }
}

function describeOutcome(outcome: IngestOutcome): { text: string; tone: 'ok' | 'none' | 'error' } {
  if (outcome.status === 'error') {
    return { text: `检索失败：${outcome.error || '解析未能完成，请检查设置中的 LLM 配置'}`, tone: 'error' };
  }
  if (outcome.status === 'no-message') {
    return { text: '还没有可供检索的主线回复', tone: 'none' };
  }
  if (outcome.status === 'busy') {
    return { text: '正在解析中，请稍候', tone: 'none' };
  }
  if (outcome.addedContacts.length) {
    const names = outcome.addedContacts
      .map(name => store.phone.contacts[name]?.display_name || name)
      .join('、');
    return { text: `已添加 ${outcome.addedContacts.length} 位联系人：${names}`, tone: 'ok' };
  }
  const extra: string[] = [];
  if (outcome.addedGroups) extra.push(`${outcome.addedGroups} 个群聊`);
  if (outcome.addedFacts) extra.push(`${outcome.addedFacts} 条事实`);
  if (outcome.addedAppointments) extra.push(`${outcome.addedAppointments} 项约定`);
  if (extra.length) {
    return { text: `没有新联系人，但记录了${extra.join('、')}`, tone: 'ok' };
  }
  return { text: '最近剧情里没有明确交换联系方式', tone: 'none' };
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

.manage-btn {
  color: var(--c-ios-blue);
  font-size: 13px;
}

.friends-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-title {
  padding: 2px 2px 4px;
  color: var(--c-ios-gray);
  font-size: 12px;
  letter-spacing: 1px;
}

/* 主线检索区：贴在列表末尾，空态与有联系人时都可用 */
.scan-zone {
  margin-top: 2px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.scan-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 11px 14px;
  border-radius: 14px;
  border: 1px dashed var(--c-ios-gray);
  color: var(--c-ios-blue);
  font-size: 13px;

  &:disabled {
    opacity: 0.6;
  }
}

.scan-result {
  padding: 0 4px;
  font-size: 12px;
  line-height: 1.6;
  overflow-wrap: anywhere;

  &.ok {
    color: var(--c-ios-blue);
  }

  &.none {
    color: var(--c-ios-gray);
  }

  &.error {
    color: #d9534f;
  }
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

  &.muted {
    opacity: 0.72;
  }
}

.avatar {
  width: 48px;
  height: 48px;
  flex: none;
  border-radius: 50%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 18px;
  font-weight: 700;
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
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

.friend-basis {
  font-size: 11px;
  color: var(--c-ios-gray);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.friend-arrow {
  color: #c7c7cc;
  font-size: 12px;
}

.empty-hint {
  padding: 40px 20px;
  text-align: center;
  font-size: 12px;
  line-height: 1.8;
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
  max-height: 88%;
  overflow-y: auto;
  background: var(--c-phone-screen);
  border-radius: 20px 20px 0 0;
  padding: 20px 20px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 9px;
}

.profile-avatar {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  overflow: hidden;
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

.status-pill {
  padding: 2px 10px;
  border-radius: 999px;
  background: rgba(10, 132, 255, 0.1);
  color: var(--c-ios-blue);
  font-size: 11px;

  &.removed {
    background: rgba(142, 142, 147, 0.12);
    color: var(--c-ios-gray);
  }

  &.blocked {
    background: rgba(255, 59, 48, 0.1);
    color: var(--c-danger);
  }
}

.profile-basis,
.profile-persona,
.boundary-hint {
  width: 100%;
  font-size: 11px;
  color: var(--c-ios-gray);
  line-height: 1.7;
}

.profile-persona {
  max-height: 110px;
  overflow-y: auto;
}

.bio-btn {
  width: 100%;
  padding: 9px 10px;
  border-radius: 10px;
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

.bio-loading {
  width: 100%;
  text-align: center;
  font-size: 11px;
  color: var(--c-ios-gray);
}

.profile-actions {
  width: 100%;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;

  button {
    padding: 9px 10px;
    border-radius: 10px;
    font-size: 12px;
  }
}

.primary-btn {
  background: var(--c-ios-blue);
  color: #fff;
}

.secondary-btn {
  background: #fff;
  color: var(--c-ios-blue);
}

.danger-btn {
  background: rgba(255, 59, 48, 0.1);
  color: var(--c-danger);
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
