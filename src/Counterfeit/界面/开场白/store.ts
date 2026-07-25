import { OPENING_TEXTS, povByKey, renderCustomOpening, type PovKey } from './copy';
import { showToast } from './toast';

export type Step = 'gate' | 'intro' | 'title' | 'mode' | 'pov' | 'custom' | 'opening' | 'gallery' | 'done';
export type Mode = 'pov' | 'custom';

export interface CustomForm {
  /** 姓名 */
  name: string;
  /** 性别 */
  gender: '' | '男' | '女' | '其他';
  /** 所在班级 */
  className: string;
  /** 身份（如「二年J班转学生」） */
  identity: string;
  /** 过往经历 */
  past: string;
  /** 性格 */
  personality: string;
  /** 相貌 */
  appearance: string;
}

const emptyForm = (): CustomForm => ({
  name: '',
  gender: '',
  className: '',
  identity: '',
  past: '',
  personality: '',
  appearance: '',
});

/** 转义 XML 属性值中的特殊字符 */
function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// 注意：本模板环境中 pinia 经 jsdelivr +esm 引入、携带自己的 vue 副本，而组件渲染用的是酒馆注入的全局 Vue。
// 因此 store 必须使用 setup 写法 + 自动导入的（全局 Vue 的）ref/reactive/computed，
// 让响应式依赖挂到全局 Vue 的 effect 系统上；options 写法的 state() 会挂在 pinia 那份 vue 上，界面不更新。
/** 预览调试：?screen=title|gallery|intro… 直达指定屏（缺省 gate 启动门） */
function initialStep(): Step {
  const target = new URLSearchParams(window.location.search).get('screen');
  const valid: Step[] = ['gate', 'intro', 'title', 'mode', 'pov', 'custom', 'opening', 'gallery', 'done'];
  return valid.includes(target as Step) ? (target as Step) : 'gate';
}

export const useOpeningStore = defineStore('counterfeit-opening', () => {
  const step = ref<Step>(initialStep());
  const mode = ref<Mode | null>(null);
  const selectedPov = ref<PovKey | null>(null);
  const form = reactive<CustomForm>(emptyForm());
  const submitting = ref(false);
  /** 已提交的设定摘要块（done 屏展示） */
  const committedSummary = ref('');
  /** 已提交的开场文本（done 屏展示） */
  const committedText = ref('');
  /** 是否纯浏览器预览模式（无酒馆 API 时的降级提交） */
  const previewMode = ref(false);

  const povInfo = computed(() => (selectedPov.value ? povByKey(selectedPov.value) : null));

  /** 当前选择对应的开场文本 */
  const openingText = computed<string>(() => {
    if (mode.value === 'pov' && selectedPov.value) {
      return OPENING_TEXTS[selectedPov.value];
    }
    if (mode.value === 'custom') {
      return renderCustomOpening(form.name);
    }
    return '';
  });

  /** 结构化设定摘要块 */
  const summaryBlock = computed<string>(() => {
    if (mode.value === 'pov' && selectedPov.value) {
      const info = povByKey(selectedPov.value);
      const lines = [
        `<opening_setup mode="pov" pov="${info.key}" name="${escapeAttr(info.name)}">`,
        `定位: ${info.role}`,
        `简介: ${info.tagline}`,
      ];
      if (info.exclusive) {
        lines.push(`独占内容: ${info.exclusive}`);
      }
      lines.push('</opening_setup>');
      return lines.join('\n');
    }
    if (mode.value === 'custom') {
      return [
        `<opening_setup mode="custom" name="${escapeAttr(form.name.trim())}">`,
        `性别: ${form.gender || '未填写'}`,
        `所在班级: ${form.className || '未填写'}`,
        `身份: ${form.identity.trim() || '未填写'}`,
        `过往经历: ${form.past.trim() || '未填写'}`,
        `性格: ${form.personality.trim() || '未填写'}`,
        `相貌: ${form.appearance.trim() || '未填写'}`,
        '</opening_setup>',
      ].join('\n');
    }
    return '';
  });

  function toIntro() {
    step.value = 'intro';
  }

  /** 序奏结束（或跳过）→ 标题屏 */
  function toTitle() {
    step.value = 'title';
  }

  function toMode() {
    step.value = 'mode';
  }

  function toGallery() {
    step.value = 'gallery';
  }

  function backToTitle() {
    step.value = 'title';
  }

  function backToMode() {
    step.value = 'mode';
  }

  /** 点击 POV 卡：未选中则选中高亮；再次点击已选中的卡则直接进入确认屏 */
  function selectPov(key: PovKey) {
    if (selectedPov.value === key) {
      confirmPov();
      return;
    }
    selectedPov.value = key;
  }

  function confirmPov() {
    if (!selectedPov.value) {
      showToast('请先选择一个视角', 'info');
      return;
    }
    mode.value = 'pov';
    step.value = 'pov';
  }

  function toCustom() {
    mode.value = 'custom';
    step.value = 'custom';
  }

  /** 自建角色确认创建（姓名必填，其余可空） */
  function confirmCustom() {
    if (!form.name.trim()) {
      showToast('请至少填写主角姓名', 'error');
      return;
    }
    mode.value = 'custom';
    step.value = 'opening';
  }

  function toOpening() {
    step.value = 'opening';
  }

  /** 提交：组装设定摘要 → 写 MVU 变量（容错）→ 替换 0 楼 <OpeningUI/> 占位符 */
  async function commit() {
    if (submitting.value) {
      return;
    }
    submitting.value = true;
    try {
      const summary = summaryBlock.value;
      const text = openingText.value;
      const payload = `${summary}\n\n${text}`;

      // MVU 写入：按 MVU-DESIGN §2.1 全量写入 24 变量（双模式各自的 commit 集）
      // 变量全部写入，因此即使 stat_data 尚未初始化也能建立完整初始状态
      try {
        if (typeof getVariables === 'function' && typeof updateVariablesWith === 'function') {
          const variables = getVariables({ type: 'message', message_id: 0 });
          if (variables) {
            updateVariablesWith(
              vars => {
                const stat = _.get(vars, 'stat_data') ?? {};
                // 双模式公共项
                stat.current_scene = 1;
                stat.current_date = '2013-05-20';
                stat['Ω_resonance'] = 0;
                for (const hammer of [
                  'hammer_thunder_1', 'hammer_tea_1', 'hammer_tea_2',
                  'hammer_teddy_1', 'hammer_thunder_2', 'hammer_outcast_1',
                  'hammer_teddy_2', 'hammer_outcast_2', 'hammer_tea_3',
                ]) {
                  stat[hammer] = 'pending';
                }
                stat.laff_knows_fire_truth = false;
                stat.laff_reed_authorized_yukino = false;
                stat.dalloway_pen_used = false;
                stat.branch_choice = null;
                if (mode.value === 'pov') {
                  // §2.1 commit(pov)：mode/POV + 好感覆写 30/30/30/20/15
                  stat.mode = 'pov';
                  stat.current_pov = selectedPov.value;
                  stat.custom_protagonist = null;
                  stat.affection_hachiman = 30;
                  stat.affection_yukino = 30;
                  stat.affection_yui = 30;
                  stat.affection_laff = 20;
                  stat.affection_iroha = 15;
                } else {
                  // §2.1 commit(custom)：七字段 + 好感全 15
                  stat.mode = 'custom';
                  stat.current_pov = null;
                  stat.custom_protagonist = { ...form };
                  stat.affection_hachiman = 15;
                  stat.affection_yukino = 15;
                  stat.affection_yui = 15;
                  stat.affection_laff = 15;
                  stat.affection_iroha = 15;
                }
                _.set(vars, 'stat_data', stat);
                return vars;
              },
              { type: 'message', message_id: 0 },
            );
            console.info('[开场白] 已写入 MVU 变量（全量 commit）');
          } else {
            console.error('[开场白] getVariables 返回空，MVU 变量未能写入');
          }
        } else {
          console.error('[开场白] 无 MVU API（getVariables/updateVariablesWith 缺失），变量未能写入');
        }
      } catch (error) {
        console.error('[开场白] MVU 变量写入失败', error);
        showToast('变量写入失败，请检查 MVU 脚本是否启用', 'error', 4000);
      }

      // 落盘开场：替换 0 楼的 <OpeningUI/> 占位符，占位符消失后界面随刷新卸载
      if (typeof getChatMessages === 'function' && typeof setChatMessages === 'function') {
        const original = getChatMessages(0)[0]?.message ?? '';
        const next = original.includes('<OpeningUI/>')
          ? original.replace('<OpeningUI/>', payload)
          : `${original}\n\n${payload}`;
        if (!original.includes('<OpeningUI/>')) {
          console.warn('[开场白] 0 楼未找到 <OpeningUI/> 占位符，已改为追加到文末');
        }
        await setChatMessages([{ message_id: 0, message: next }], { refresh: 'affected' });
        console.info('[开场白] 已写入 0 楼消息');
        committedSummary.value = summary;
        committedText.value = text;
        // 正常随楼层刷新卸载；若未卸载则兜底展示完成态
        step.value = 'done';
      } else {
        // 纯浏览器预览：无酒馆 API，完整打印 payload 并进入完成态
        console.info('[开场白·预览模式] 提交 payload：\n' + payload);
        previewMode.value = true;
        committedSummary.value = summary;
        committedText.value = text;
        step.value = 'done';
      }
    } catch (error) {
      console.error('[开场白] 提交失败', error);
      showToast(`提交失败：${error instanceof Error ? error.message : String(error)}`, 'error', 4000);
    } finally {
      submitting.value = false;
    }
  }

  return {
    step,
    mode,
    selectedPov,
    form,
    submitting,
    committedSummary,
    committedText,
    previewMode,
    povInfo,
    openingText,
    summaryBlock,
    toMode,
    toIntro,
    toTitle,
    toGallery,
    backToTitle,
    backToMode,
    selectPov,
    confirmPov,
    toCustom,
    confirmCustom,
    toOpening,
    commit,
  };
});
