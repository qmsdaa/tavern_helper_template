// Counterfeit · 私密档案 CG 图数据（D15）
// 图源：catbox 合集（2026-08-06 用户提供）· 直链 files.catbox.moe/<file>.png
// 映射：规范全名 → 该角色合集直链（发送时随机取一张）；未列出的角色 = 暂无图（按钮占位）
// 清单维护：memory/D15-cg-图床清单.md（改图先改清单再改本文件）

const FILES = {
  '雪之下雪乃': [
    '4tdy5q', 'x6o7wn', 'xiqhg2', 'hf8n1m', 'l3kukf', 'c9njc2', 'du3brm', '7wx8vh',
    'dks4xi', '9ti6h8', 'vphwts', 'e9xpgw', 'hk943s', 'c9xrdd', 'vqluti', 'izr9dy',
    '4ldqho', 'nzl66d', 's5jkp2', 'hllr6x', 'them0z', 'tdcdfc', '4gfqhr', '0moiye',
    'ujk2ti', '7c3nmw', 'sufeqs', 'z4qcri', '5wd2q0', 'vymffh',
  ],
  '拉芙希妮·都柏林': [
    'yegk7v', '777lah', 'c0ifdx', '88gjuc', '23rn91', 'o4g6y9', 'uo0ivn', 'b8wdik',
    'p9jb4g', 'uzf81l', 'rpowk2', 'tswekl', 'a1q1at', '3c9lt8', 'okjkfb', 'yfwmkc',
    'q9njle', 'lp3zgq', '98v3yd', '0sbeyu', 'kbjht8', 'j3x5hu', 'lse2qu', 'kwzzot',
    '00z7mz',
  ],
  '由比滨结衣': [
    'd9trti', '0gckf5', 'nmwe9q', 'r2gode', 'ol8dkq', 'ofiueo', 'rg5njq', 'acnp8o',
    '2ocyrp', 'kdo312', 'md21ra', 'xwd32i', '92qf3g', '2z3jsj', 'pn5fyk', 'rcxmvf',
    '3umoyv', '1dlxkd', '7tpuk1', 'qsuz66', 'rh88oy', 'pvfh3v', 'nrrs8c', 'qwsi07',
  ],
  // 2026-08-07 追加：一色（20 张 · catbox.moe/c/2dy26u）、阳乃（17 张 · catbox.moe/c/akjx89）
  '一色彩羽': [
    'p7x18t', '0ax2cz', 'j7jbvx', 'uowt2b', 'gccxsw', '2seiuh', '6gzwb1', 'ztmy0g',
    'rubdxn', '1103bb', 'jwe0z1', 'o17mf7', 'coh110', 'gkn7sc', 'ykf92f', '4trf05',
    'pl3amc', '36e096', 'd0axeo', '9exqa1',
  ],
  '雪之下阳乃': [
    'l7s5iq', '1al8vt', 'i6t5qh', '109h0w', '1vynch', 'a0w61g', 'crxyzt', 'gsxo1e',
    '5fmhyh', 'g4y4gz', 'xxvqjz', '55iays', 'ogctbr', 'q0lt8c', 'wsuj7l', '7dk7qw',
    'zv486w',
  ],
};

const BASE = 'https://files.catbox.moe';

/** 规范全名 → 私密档案 CG 直链数组；无图角色返回空数组（按钮占位） */
export function cgUrlsOf(canonicalName: string): string[] {
  const files = FILES[canonicalName];
  return files ? files.map(file => `${BASE}/${file}.png`) : [];
}
