import { GALLERY_COPY } from './copy';
import { portraitUrl } from './data';

/**
 * 画廊后台管理（纯前端，无服务器）：
 * - 内置 CG：构建期生成（gallery.generated.ts），删除走 localStorage 墓碑名单（可一键恢复）
 * - 自定义 CG：图片本体存 IndexedDB（localStorage 5MB 放不下图），随浏览器持久化
 * - 界面层用 galleryItems 合并两源，ObjectURL 惰性创建、删除即回收
 */

export interface GalleryViewItem {
  /** `b:` 前缀 = 内置（值为图片路径）· `c:` 前缀 = 自定义（值为记录 id） */
  key: string;
  title: string;
  caption: string;
  /** null = 占位帧（copy.yaml 兜底文案，无图） */
  src: string | null;
  builtin: boolean;
}

interface CustomRecord {
  id: string;
  title: string;
  caption: string;
  blob: Blob;
  addedAt: number;
}

const TOMBSTONE_KEY = 'counterfeit.gallery.tombstones';
const DB_NAME = 'counterfeit-gallery';
const DB_STORE = 'images';

const tombstones = ref<string[]>(loadTombstones());
const customs = ref<CustomRecord[]>([]);
const objectUrls = new Map<string, string>();
let loaded = false;

function loadTombstones(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(TOMBSTONE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(x => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function saveTombstones(): void {
  localStorage.setItem(TOMBSTONE_KEY, JSON.stringify(tombstones.value));
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(DB_STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** 首次进入画廊时加载自定义 CG（IndexedDB 不可用时静默降级为仅内置） */
export async function initGalleryAdmin(): Promise<void> {
  if (loaded) {
    return;
  }
  loaded = true;
  try {
    const db = await openDb();
    const all = await new Promise<CustomRecord[]>((resolve, reject) => {
      const req = db.transaction(DB_STORE, 'readonly').objectStore(DB_STORE).getAll();
      req.onsuccess = () => resolve((req.result as CustomRecord[]) ?? []);
      req.onerror = () => reject(req.error);
    });
    customs.value = all.sort((a, b) => a.addedAt - b.addedAt);
  } catch (error) {
    console.warn('[画廊] IndexedDB 不可用，自定义 CG 功能停用', error);
  }
}

/** 合并清单：内置（滤掉墓碑）+ 自定义（Blob → ObjectURL） */
export const galleryItems = computed<GalleryViewItem[]>(() => {
  const builtins = GALLERY_COPY.items
    .filter(item => !item.image || !tombstones.value.includes(item.image))
    .map(item => ({
      key: `b:${item.image ?? item.title}`,
      title: item.title,
      caption: item.caption,
      src: item.image ? portraitUrl(item.image) : null,
      builtin: true,
    }));
  const customItems = customs.value.map(rec => {
    let url = objectUrls.get(rec.id);
    if (!url) {
      url = URL.createObjectURL(rec.blob);
      objectUrls.set(rec.id, url);
    }
    return { key: `c:${rec.id}`, title: rec.title, caption: rec.caption, src: url, builtin: false };
  });
  return [...builtins, ...customItems];
});

/** 内置 CG 被删数量（管理栏「恢复内置」按钮显隐用） */
export const tombstoneCount = computed(() => tombstones.value.length);

export async function addCustomItem(file: File, title: string, caption: string): Promise<GalleryViewItem['key']> {
  const rec: CustomRecord = {
    id: `c${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`,
    title: title.trim() || file.name.replace(/\.[^.]+$/, ''),
    caption: caption.trim(),
    blob: file,
    addedAt: Date.now(),
  };
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).put(rec);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  customs.value = [...customs.value, rec];
  return `c:${rec.id}`;
}

/** 删除：内置 → 加入墓碑名单；自定义 → 从 IndexedDB 移除并回收 ObjectURL */
export async function removeItem(item: GalleryViewItem): Promise<void> {
  if (item.builtin) {
    const image = item.key.slice(2);
    tombstones.value = [...tombstones.value, image];
    saveTombstones();
    return;
  }
  const id = item.key.slice(2);
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  const url = objectUrls.get(id);
  if (url) {
    URL.revokeObjectURL(url);
    objectUrls.delete(id);
  }
  customs.value = customs.value.filter(rec => rec.id !== id);
}

/** 一键恢复全部被删的内置 CG */
export function restoreBuiltins(): void {
  tombstones.value = [];
  saveTombstones();
}
