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
  // 2026-08-07 追加：小町（10 张 · catbox.moe/c/wtkwcn）、平冢静（10 张 · catbox.moe/c/cpqwpu）
  '比企谷小町': [
    'a6wrco', 'ul9s9g', '7vjqnt', 'wclq4r', 'bvopvy', 'vzyqmn', '324pam', 're5j27',
    '1xwosi', 'q6qrhy',
  ],
  '平冢静': [
    'jkh78i', '3hur36', 'yqh7cy', 't1czhk', 'uwy9d0', 'vjnvye', 'ciro08', 'g1ggko',
    'k8iqns', '7h4yim',
  ],
  // 2026-08-07 追加：川崎沙希（10 张 · pixhost.to 合集 9958 · img2.pixhost.to 直链）
  '川崎沙希': [
    'https://img2.pixhost.to/images/9958/757030106_2ff95716-216c-4f67-a299-123c7e517032.png',
    'https://img2.pixhost.to/images/9958/757030110_3a29a7c0-d82d-4d08-84a6-6bcc5dda067b.png',
    'https://img2.pixhost.to/images/9958/757030115_70ec0c7d-d226-4e5f-91c5-7f9407ee85a6.png',
    'https://img2.pixhost.to/images/9958/757030118_524a326e-4c59-407a-80b4-157b60e086fd.png',
    'https://img2.pixhost.to/images/9958/757030122_716acca6-d76c-4e22-92f0-bcfaceb4e8ae.png',
    'https://img2.pixhost.to/images/9958/757030126_8406b6e7-bc0b-4da3-b9fa-82003c15821c.png',
    'https://img2.pixhost.to/images/9958/757030128_3313947d-66e4-4e86-83e0-5d218d12136b.png',
    'https://img2.pixhost.to/images/9958/757030133_a9f51fd8-1ea7-4bbf-80f9-ac8c1744b97e.png',
    'https://img2.pixhost.to/images/9958/757030138_c519cc76-c2fe-427e-bde4-5b10992c8306.png',
    'https://img2.pixhost.to/images/9958/757030142_d9ea1c9c-0f86-4679-8780-2ba479644939.png',
  ],
};

const BASE = 'https://files.catbox.moe';

/** 规范全名 → 私密档案 CG 直链数组；无图角色返回空数组（按钮占位）。完整 URL 原样返回，catbox 简写拼 BASE */
export function cgUrlsOf(canonicalName: string): string[] {
  const files = FILES[canonicalName];
  if (!files) return [];
  return files.map(file => (file.startsWith('http') ? file : `${BASE}/${file}.png`));
}
