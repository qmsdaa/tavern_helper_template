export interface AppMeta {
  id: string;
  icon: string;
  label: string;
  tint: string;
}

export const APPS: AppMeta[] = [
  { id: 'messages', icon: 'fa-solid fa-message', label: '消息', tint: 'linear-gradient(145deg, #5ee08a, #28c76f)' },
  { id: 'friends', icon: 'fa-solid fa-user-group', label: '好友', tint: 'linear-gradient(145deg, #64b5f6, #3b82d6)' },
  { id: 'status', icon: 'fa-solid fa-chart-simple', label: '状态', tint: 'linear-gradient(145deg, #4dd0e1, #26a0b5)' },
  { id: 'scenes', icon: 'fa-solid fa-book-open', label: '章节', tint: 'linear-gradient(145deg, #ffd54f, #f0a53a)' },
  { id: 'map', icon: 'fa-solid fa-map-location-dot', label: '地图', tint: 'linear-gradient(145deg, #b39ddb, #7e57c2)' },
  { id: 'cg', icon: 'fa-solid fa-images', label: 'CG', tint: 'linear-gradient(145deg, #f8bbd0, #ec5f92)' },
  { id: 'forum', icon: 'fa-solid fa-comments', label: '论坛', tint: 'linear-gradient(145deg, #ffab91, #f2704e)' },
  { id: 'requests', icon: 'fa-solid fa-clipboard-list', label: '委托', tint: 'linear-gradient(145deg, #a5d6a7, #43a047)' },
  { id: 'archive', icon: 'fa-solid fa-box-archive', label: '纪要', tint: 'linear-gradient(145deg, #80cbc4, #26a0b5)' },
  { id: 'diary', icon: 'fa-solid fa-heart', label: '日记', tint: 'linear-gradient(145deg, #f8bbd0, #ec5f92)' },
  { id: 'memo', icon: 'fa-solid fa-note-sticky', label: '备忘', tint: 'linear-gradient(145deg, #ffe082, #f0a53a)' },
  { id: 'inventory', icon: 'fa-solid fa-bag-shopping', label: '物品', tint: 'linear-gradient(145deg, #d7ccc8, #8d6e63)' },
  { id: 'profiles', icon: 'fa-solid fa-address-book', label: '档案', tint: 'linear-gradient(145deg, #9fa8da, #5c6bc0)' },
  { id: 'wallpaper', icon: 'fa-solid fa-photo-film', label: '壁纸', tint: 'linear-gradient(145deg, #f48fb1, #d81b60)' },
  { id: 'settings', icon: 'fa-solid fa-gear', label: '设置', tint: 'linear-gradient(145deg, #b0bec5, #78909c)' },
];

export const GRID_APPS = APPS;
export const DOCK_APPS = APPS.filter(a => ['messages', 'status', 'map', 'settings'].includes(a.id));

/** 默认主屏幕壁纸（晨曦粉紫 · 与项目色系一致） */
export const DEFAULT_HOME_BG = [
  'radial-gradient(120% 90% at 20% 0%, rgba(229, 138, 165, 0.35), transparent 55%)',
  'radial-gradient(120% 100% at 90% 100%, rgba(167, 139, 250, 0.4), transparent 60%)',
  'linear-gradient(165deg, #3a3040, #241d2c 55%, #17121c)',
].join(', ');
