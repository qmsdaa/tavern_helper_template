<template>
  <section>
    <h3 class="text-sm font-semibold text-[#a5737f] mb-2 tracking-wide">头像自定义</h3>
    <div class="max-h-64 overflow-y-auto space-y-2 pr-1">
      <div v-for="name in names" :key="name" class="flex items-center gap-2 py-1.5 border-b border-dashed border-[#f0e4e7]">
        <img :src="avatarSrc(name)" class="w-9 h-9 rounded-full object-cover bg-[#f3ece2]" />
        <span class="w-24 text-xs font-semibold truncate">{{ name }}</span>
        <input
          type="text"
          :value="customUrls[name] || ''"
          placeholder="图片 URL"
          class="flex-1 min-w-0 text-xs border border-[#e3d3d8] rounded-lg px-2 py-1 bg-white"
          @change="onUrlChange(name, ($event.target as HTMLInputElement).value)"
        />
        <button class="px-2 py-1 text-xs rounded-lg border border-[#e87a90] text-[#c05a72] hover:bg-[#e87a90] hover:text-white" @click="uploadAvatar(name)">上传</button>
        <button class="px-2 py-1 text-xs rounded-lg border border-[#e3d3d8] text-[#a08a90] hover:border-[#e87a90]" @click="resetAvatar(name)">重置</button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { AVATAR_TABLE, KNOWN_NO_AVATAR } from '../avatar-data';
import { loadCustomUrls, saveCustomUrls, idbPut, idbDelete } from '../idb';
import { loadConfig } from '../store';

const props = defineProps<{ seenNames?: string[] }>();
const customUrls = ref<Record<string, string>>(loadCustomUrls());
const uploadCache = ref<Record<string, string>>({});

const names = computed(() => {
  const set = new Set([...Object.keys(AVATAR_TABLE), ...KNOWN_NO_AVATAR, ...(props.seenNames || [])]);
  return [...set];
});

function avatarSrc(name: string) {
  return uploadCache.value[name] || customUrls.value[name] || AVATAR_TABLE[name] || '';
}

function onUrlChange(name: string, value: string) {
  const urls = { ...customUrls.value };
  if (value.trim()) urls[name] = value.trim();
  else delete urls[name];
  customUrls.value = urls;
  saveCustomUrls(urls);
  window.parent.postMessage({ source: 'cf-bubble-panel', type: 'config-update', config: { ...loadConfig(), _avatarTick: Date.now() } }, '*');
}

async function uploadAvatar(name: string) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    await idbPut(name, file);
    uploadCache.value[name] = URL.createObjectURL(file);
    window.parent.postMessage({ source: 'cf-bubble-panel', type: 'config-update', config: { ...loadConfig(), _avatarTick: Date.now() } }, '*');
  };
  input.click();
}

async function resetAvatar(name: string) {
  const urls = { ...customUrls.value };
  delete urls[name];
  customUrls.value = urls;
  saveCustomUrls(urls);
  await idbDelete(name);
  delete uploadCache.value[name];
  window.parent.postMessage({ source: 'cf-bubble-panel', type: 'config-update', config: { ...loadConfig(), _avatarTick: Date.now() } }, '*');
}
</script>
