// Counterfeit · 状态栏主题（多套配色）
// 四套：sakura（樱白·默认）/ dark（暗色）/ eyecare（护眼）/ auto（跟随酒馆明暗）。
//
// 机制：只往 <html> 写 data-cf-theme="<已解析主题>"，配色全部由 global.css 的
// 属性选择器覆盖语义变量（--c-*）提供——不改任何盒模型尺寸，故与 2026-08-05
// 移动端高度链修复完全正交。
//
// 持久化：localStorage。srcdoc iframe 与宿主页同源共享同一个 localStorage（已实测），
// 因此楼层摘要 iframe、弹窗 iframe、宿主页三方看到的是同一份选择；
// storage 事件在同源的其它 iframe 中触发（已实测两个楼层 iframe 均收到），
// 所以切换主题会实时同步到所有已挂载楼层，无需刷新。

export type ThemeName = 'sakura' | 'dark' | 'eyecare' | 'auto';
export type ResolvedTheme = 'sakura' | 'dark' | 'eyecare';

export const THEME_KEY = 'counterfeit-statusbar-theme';

export interface ThemeOption {
  name: ThemeName;
  label: string;
  hint: string;
}

export const THEMES: ReadonlyArray<ThemeOption> = [
  { name: 'sakura', label: '樱白', hint: '默认浅色' },
  { name: 'dark', label: '暗色', hint: '深底低亮' },
  { name: 'eyecare', label: '护眼', hint: '暖色低蓝光' },
  { name: 'auto', label: '跟随酒馆', hint: '按酒馆明暗自动' },
];

const VALID = new Set<ThemeName>(['sakura', 'dark', 'eyecare', 'auto']);

/** 各主题的弹窗底色：宿主遮罩给 iframe 预置背景，避免打开瞬间闪白底 */
export const PANEL_BG: Record<ResolvedTheme, string> = {
  sakura: '#fdf7f4',
  dark: '#241d24',
  eyecare: '#f2ece0',
};

export function readTheme(): ThemeName {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    if (raw && VALID.has(raw as ThemeName)) return raw as ThemeName;
  } catch {
    // 隐私模式/禁用存储：按默认主题运行，不报错
  }
  return 'sakura';
}

function writeTheme(name: ThemeName): void {
  try {
    localStorage.setItem(THEME_KEY, name);
  } catch {
    // 存不下就只在本 iframe 生效，不影响渲染
  }
}

// —— 「跟随酒馆」：读宿主页实际底色判明暗 ——
// 楼层 iframe 的 parent 就是酒馆页面（同源，已实测 document 可读）。
// 逐级向上找第一个非透明背景色，算相对亮度；读不到就退回系统深色偏好。

function parseRgb(value: string): [number, number, number, number] | null {
  const match = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+))?/i.exec(value);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3]), match[4] === undefined ? 1 : Number(match[4])];
}

function relativeLuminance(r: number, g: number, b: number): number {
  const channel = (raw: number) => {
    const c = raw / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** 宿主页是否深色主题；无法判定时返回 null */
function hostIsDark(): boolean | null {
  try {
    const host = window.parent && window.parent !== window ? window.parent : null;
    if (!host) return null;
    const doc = host.document;
    if (!doc) return null;
    // 从 body 往上找第一个不透明底色（酒馆主题多半染在 body 或 html 上）
    const chain: Element[] = [];
    if (doc.body) chain.push(doc.body);
    if (doc.documentElement) chain.push(doc.documentElement);
    for (const element of chain) {
      const raw = host.getComputedStyle(element).backgroundColor;
      const rgb = parseRgb(raw || '');
      if (!rgb || rgb[3] === 0) continue;
      return relativeLuminance(rgb[0], rgb[1], rgb[2]) < 0.25;
    }
    // 底色全透明时退而求其次：用正文颜色反推（浅色文字 ⇒ 深色背景）
    if (doc.body) {
      const rgb = parseRgb(host.getComputedStyle(doc.body).color || '');
      if (rgb) return relativeLuminance(rgb[0], rgb[1], rgb[2]) > 0.5;
    }
  } catch {
    // 跨域或宿主不可读：交给系统偏好
  }
  return null;
}

function systemPrefersDark(): boolean {
  try {
    return !!window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

export function resolveTheme(name: ThemeName): ResolvedTheme {
  if (name !== 'auto') return name;
  const host = hostIsDark();
  const dark = host === null ? systemPrefersDark() : host;
  return dark ? 'dark' : 'sakura';
}

/** 通知宿主挂载器换弹窗底色（仅弹窗 iframe 有宿主可通知；楼层 iframe 也发，宿主自行忽略） */
function notifyHost(resolved: ResolvedTheme): void {
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(
        { source: 'counterfeit-statusbar', type: 'theme-bg', color: PANEL_BG[resolved] },
        '*',
      );
    }
  } catch {
    // 顶层预览无父页
  }
}

let current: ThemeName = 'sakura';
const listeners = new Set<(name: ThemeName, resolved: ResolvedTheme) => void>();

function paint(name: ThemeName): ResolvedTheme {
  const resolved = resolveTheme(name);
  try {
    document.documentElement.dataset.cfTheme = resolved;
    // 让原生控件（滚动条/表单）跟随明暗
    document.documentElement.style.colorScheme = resolved === 'dark' ? 'dark' : 'light';
  } catch {
    // 极端环境下拿不到 documentElement：保持默认样式
  }
  return resolved;
}

/** 当前选择（未解析，auto 就是 auto） */
export function currentTheme(): ThemeName {
  return current;
}

/** 切换主题：立即上色 + 落 localStorage + 通知宿主与其它楼层 */
export function setTheme(name: ThemeName): void {
  if (!VALID.has(name)) return;
  current = name;
  const resolved = paint(name);
  writeTheme(name);
  notifyHost(resolved);
  listeners.forEach(listener => listener(name, resolved));
}

export function onThemeChange(listener: (name: ThemeName, resolved: ResolvedTheme) => void): void {
  listeners.add(listener);
}

/** 入口调用一次：上色 + 绑定跨 iframe 同步与系统偏好变化 */
export function initTheme(): void {
  current = readTheme();
  const resolved = paint(current);
  notifyHost(resolved);

  // 其它楼层/弹窗改了主题 → 本 iframe 同步（同源 localStorage 的 storage 事件）
  try {
    window.addEventListener('storage', event => {
      if (event.key !== THEME_KEY) return;
      const next = event.newValue && VALID.has(event.newValue as ThemeName) ? (event.newValue as ThemeName) : 'sakura';
      if (next === current) return;
      current = next;
      const nextResolved = paint(next);
      listeners.forEach(listener => listener(next, nextResolved));
    });
  } catch {
    // 不支持 storage 事件：仅当前 iframe 生效
  }

  // auto 模式下跟随系统深色偏好变化
  try {
    const query = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
    if (query && typeof query.addEventListener === 'function') {
      query.addEventListener('change', () => {
        if (current !== 'auto') return;
        const nextResolved = paint('auto');
        notifyHost(nextResolved);
        listeners.forEach(listener => listener('auto', nextResolved));
      });
    }
  } catch {
    // 老内核无 matchMedia：auto 退化为初始判定一次
  }
}
