export const AVATAR_BASE = 'https://cdn.jsdelivr.net/gh/qmsdaa/tavern_helper_template_cdn@c947510/assets/Counterfeit/状态栏/avatars';

export const AVATAR_KEYS: Record<string, string> = {
  '比企谷八幡': 'hachiman', '八幡': 'hachiman', '比企谷八幡（性转）': 'genderbend_hachiman',
  '雪之下雪乃': 'yukino', '雪乃': 'yukino', '由比滨结衣': 'yui', '结衣': 'yui',
  '拉芙希妮·都柏林': 'laff', '拉芙希妮': 'laff', '一色彩羽': 'iroha', '三浦优美子': 'yumiko',
  '叶山隼人': 'hayama', '平冢静': 'shizuka', '户冢彩加': 'saika',
  '雪之下阳乃': 'haruno', '爱布拉娜·都柏林': 'eblana', '爱布拉娜': 'eblana',
  '比企谷小町': 'komachi', '川崎沙希': 'saki', '雪之下夫人': 'mrs_yukinoshita',
  '材木座义辉': 'zaimokuza', '海老名姬菜': 'ebina', '相模南': 'sagami',
  '折本香织': 'orimoto', '户部翔': 'tobe',
};

export const AVATAR_TABLE: Record<string, string> = Object.fromEntries(
  Object.entries(AVATAR_KEYS).map(([name, key]) => [name, `${AVATAR_BASE}/${key}.webp`])
);

export const KNOWN_NO_AVATAR = ['大和', '大冈', '城廻巡', '玉绳', '由比滨母亲', '鹤见留美', '川崎京华'];
