// 自定义序幕文案 · 纯逻辑模块（无任何导入，供 store.ts 与 node 测试共用）
// 约束（2026-08-09 卡体稳定批次）：
//  - 自定义正文只改变 0 楼的可见叙事文字；<opening_setup> 摘要块与全部 MVU 变量
//    （mode / current_pov / custom_protagonist / current_scene / 日期 / 地点 / 难度 / 初始关系）
//    一律由官方 commit 流程写入，自定义文案无权触碰
//  - 结构性标记（<opening_setup> / <UpdateVariable> / <JSONPatch> / <% / %>）安全转义为全角可见字符
//  - 长度上限约 3000 字；空文本回退官方默认序幕
//  - 草稿只保存在界面内存（pinia store ref），不写入全局 localStorage，只对当前新存档生效
//  - 编辑文案不等于自选起始日期或起始场景

/** 自定义序幕长度上限（字符数） */
export const OPENING_DRAFT_MAX = 3000;

export interface SanitizeResult {
  /** 清洗后的可提交文本（已转义、已限长、已去首尾空白） */
  text: string;
  /** 是否发生了结构性字符转义（用于提示用户） */
  escaped: boolean;
  /** 是否因超长被截断 */
  truncated: boolean;
}

/**
 * 安全转义：把 < > 全角化（<opening_setup>/<UpdateVariable>/<JSONPatch>/<% 全部失效），
 * 并把 %> 转义为 %＞。转义后文本作为叙事文字可见但对酒馆/MVU/EJS 完全惰性。
 */
export function sanitizeOpeningDraft(raw: string): SanitizeResult {
  const input = String(raw ?? '');
  let text = input.replace(/</g, '＜').replace(/>/g, '＞').replace(/%>/g, '%＞');
  const escaped = text !== input;
  let truncated = false;
  if (text.length > OPENING_DRAFT_MAX) {
    text = text.slice(0, OPENING_DRAFT_MAX);
    truncated = true;
  }
  return { text: text.trim(), escaped, truncated };
}

/** 是否包含结构性标记（编辑界面保存前给出明确提示；提交时仍会被 sanitize 兜底转义） */
export function hasStructuralMarkers(raw: string): boolean {
  return /<\/?(opening_setup|UpdateVariable|JSONPatch|Analysis)\b/i.test(raw) || /<%|%>/.test(raw);
}

/**
 * 最终用于 commit 的正文：
 * 草稿为 null（未编辑）或清洗后为空 → 回退官方默认序幕；否则用清洗后的草稿。
 */
export function resolveOpeningText(draft: string | null | undefined, official: string): string {
  if (draft == null || draft.trim().length === 0) return official;
  const { text } = sanitizeOpeningDraft(draft);
  return text.length > 0 ? text : official;
}
