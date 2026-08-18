# Character Prompt Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改变剧情事实、MVU 字段与 EJS 门控的前提下，降低角色四层设定的重复度，并修正三面性语料的 OOC 与过度主题化。

**Architecture:** 保留现有角色文件和阶段判断代码，只改写输出给主模型的 YAML 文本。拉芙希妮四层整体重平衡；原作角色只修改已确认的高风险语料块，避免无必要的全量重写。

**Tech Stack:** YAML、EJS、PowerShell 静态检查、Counterfeit 世界书条目。

---

### Task 1: 同步规划契约

**Files:**
- Modify: `创作规划.yaml`

- [ ] **Step 1:** 增加 2026-08-12 角色提示词优化契约，明确基础信息、调色盘、三面性和二次解释的职责边界。
- [ ] **Step 2:** 明确保留全部 EJS/MVU 判断及既有阶段旗标。

### Task 2: 拉芙希妮四层重平衡

**Files:**
- Modify: `世界书/角色/拉芙希妮/基础信息.yaml`
- Modify: `世界书/角色/拉芙希妮/性格调色盘.yaml`
- Modify: `世界书/角色/拉芙希妮/三面性.yaml`
- Modify: `世界书/角色/拉芙希妮/二次解释.yaml`

- [ ] **Step 1:** 从外貌和关系项删除心理结论与重复创伤解释。
- [ ] **Step 2:** 在调色盘中提高阅读、料理、语言错位、干燥幽默和小任性的权重。
- [ ] **Step 3:** 将三面性语料改成纯台词，把重主题句留给对应剧情节点。
- [ ] **Step 4:** 将二次解释压缩为真正会纠正模型误读的规则。

### Task 3: 原作角色声线纠偏

**Files:**
- Modify: `世界书/角色/比企谷八幡/三面性.yaml`
- Modify: `世界书/角色/雪之下雪乃/三面性.yaml`
- Modify: `世界书/角色/由比滨结衣/三面性.yaml`
- Modify: `世界书/角色/一色彩羽/性格调色盘.yaml`
- Modify: `世界书/角色/一色彩羽/三面性.yaml`
- Modify: `世界书/角色/雪之下阳乃/性格调色盘.yaml`
- Modify: `世界书/角色/雪之下阳乃/三面性.yaml`
- Modify: `世界书/角色/平冢静/三面性.yaml`
- Modify: `世界书/角色/爱布拉娜/三面性.yaml`

- [ ] **Step 1:** 将八幡的正面护卫台词改为拆逻辑、接代价和留后路。
- [ ] **Step 2:** 将雪乃、结衣的独处台词从完整自我分析改为符合口语节奏的短句。
- [ ] **Step 3:** 恢复一色的拒绝连段、轻快算计和失败找补，减少账本隐喻。
- [ ] **Step 4:** 保留阳乃的暧昧与反复试探，不把被看穿等同于面具完全卸下。
- [ ] **Step 5:** 为平冢静与爱布拉娜增加日常辨识度，避免只剩旧事或悲惨独处。

### Task 4: 静态验证

**Files:**
- Test: 上述所有修改文件

- [ ] **Step 1:** 使用 Python YAML 解析器检查去除 EJS 行后的 YAML 结构；期望所有文件成功解析。
- [ ] **Step 2:** 比对修改前后 EJS 起止标记数量；期望数量不变且成对。
- [ ] **Step 3:** 扫描三面性语料中的括号动作、日文汉字和高频主题词；期望动作不再混入语料，`完美の阳乃`被清理。
- [ ] **Step 4:** 检查 `stat_data.arc_milestones`、`current_pov`、`commitment` 等门控表达未被改变。
