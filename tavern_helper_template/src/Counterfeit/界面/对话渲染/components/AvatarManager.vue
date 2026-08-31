<template>
  <section>
    <h3 class="text-sm font-semibold text-[#a5737f] mb-2 tracking-wide">头像自定义</h3>
    <div class="max-h-64 overflow-y-auto space-y-2 pr-1">
      <div v-for="name in names" :key="name" class="flex items-center gap-2 py-1.5 border-b border-dashed border-[#f0e4e7]">
        <img :src="avatarSrc(name) || placeholder" class="w-10 h-14 rounded-md object-cover bg-[#f3ece2] cursor-zoom-in" @click="openZoom(name)" />
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
const placeholder = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';

const names = computed(() => {
  const set = new Set([...Object.keys(AVATAR_TABLE), ...KNOWN_NO_AVATAR, ...(props.seenNames || [])]);
  return [...set];
});

function avatarSrc(name: string) {
  return uploadCache.value[name] || customUrls.value[name] || AVATAR_TABLE[name] || '';
}

function openZoom(name: string) {
  const src = avatarSrc(name);
  const mask = document.createElement('div');
  mask.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(20,14,18,.72);display:flex;align-items:center;justify-content:center;flex-direction:column;cursor:zoom-out;';
  mask.innerHTML = src
    ? `<img src="${src}" style="width:min(320px,70vw);aspect-ratio:9/13;max-height:80vh;object-fit:cover;border-radius:12px;box-shadow:0 12px 48px rgba(0,0,0,.45);" /><div style="color:#f3e6e0;font-size:13px;margin-top:14px;letter-spacing:1px;">${name}</div>`
    : `<div style="width:min(320px,70vw);aspect-ratio:9/13;border-radius:12px;background:#3a2f34;color:#c08a97;display:flex;align-items:center;justify-content:center;font-size:120px;font-weight:600;">${(name || '？').replace(/[？\\s]/g, '').charAt(0) || '？'}</div>`;
  mask.addEventListener('click', () => mask.remove());
  document.body.appendChild(mask);
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
