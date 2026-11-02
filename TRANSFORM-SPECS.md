# 改造规格 TRANSFORM-SPECS

> 目标：用四套已安装 skill 彻底改造本工程（书籍 + 视频），逐级迭代至**经典级**——
> 趣味可读、生动形象、简单易懂、过目不忘、由浅入深。
> 状态标记：⬜ 未开始 ｜ 🔶 进行中 ｜ ✅ 完成
> 方法论来源：[craft-anything](https://github.com/storytold/craft-anything) 的证据循环——
> brief → plan → hypothesis → finding → verify → handoff，每级迭代留 checkpoint。

## 一、Skills → 改造面映射

| Skill | 来源 | 在本项目中的用途 | 产出形态 | 能力分级 |
|---|---|---|---|---|
| humanizer-zh | op7418/dsh-guizang-design | 43 章正文 + 6 部讲稿 JSON 去 AI 味（31 类模式） | 就地改写 md/json | 本地可执行 |
| stack-diagram | caru-ini/stack-diagram | 机制架构图：工程图纸风、官方 logo、正交箭头、自包含 HTML | `assets/diagrams/*.html` + PNG×2 主题 | 本地可渲染（py 3.12 + 项目 Playwright） |
| guizang-page-skill | 〃 | 传播样张：章节精排网页（杂志/瑞士风），可导 PDF/长图 | `promo/` 精排 HTML | 本地可渲染（已接 node_modules junction） |
| guizang-social-card-skill | 〃 | 发布图卡：21:9 头图 / 1:1 分享卡 / 3:4 首图 | HTML+PNG | 本地可渲染（同上） |
| guizang-ppt-skill | 〃 | 讲义 PPT（视频分镜底稿、数据大字报） | HTML deck | 本地可渲染 |
| handraw-style | yang0/handraw-style | 367 画风插图/封面**提示词**（#001–#367 + C-01–C-36） | `promo/prompts/*.md` | **仅提示词**（本环境无生图工具） |
| image-prompt-reverse | LunarXuan | 反推：把现有 SVG 动画/海报截图沉淀为可复用提示词 | 提示词 | 仅提示词（需图输入） |
| craft-anything | storytold | 不编译（early alpha Rust）；采纳其调查方法论 | 流程约束 | — |

**能力分级含义**：本地可渲染 = 改完即见成品；仅提示词 = 交付高质量提示词包，出图需外部生图模型（gpt-image / Midjourney 等）。

## 二、质量红线（每章验收 rubric，经典级可操作化）

1. **钩子**：前 5 行内出现现象 / 故事 / 反直觉事实，不说「本章将介绍」；
2. **类比链**：每个新概念有生活类比，且全库类比不冲突（同一比喻不在两章指不同事物）；
3. **一图胜千言**：每章 ≥1 张机制图（stack-diagram 工程图 / 现有 SVG 动画）；
4. **动手闭环**：实验 + 自测清单保留（现已有，不回退）；
5. **记忆锚点**：口诀 / 对照表 /「一句话记忆」列；
6. **去 AI 味**：humanizer 31 类模式抽检 ≤1 处/千字；
7. **由浅入深**：概念首次出现必有定义或前章链接；
8. **代码与事实保护**：命令、代码块、front matter、表格数据、版本号一律不改写。

## 三、硬约束（公共契约，不可破坏）

- 章节文件名、标题层级、锚点、目录结构不变；
- `check-content.mjs` 契约：README 徽章计数 = 实际动画/实物图/视频数；**新增任何视觉资产必须同批更新** `assets/animations/catalog.json` / `resources/videos.json` / `chapter-media.json` / README 计数；
- 每级迭代收口必须 `pnpm run check:all` EXIT=0（基线 2026-11-02：83/83 动画过检）+ Playwright 34/34 不回归；
- 视频管线 `scripts/video/produce-lecture.mjs` 只改讲稿文案与分镜语义，不动渲染器核心；
- `md` 是唯一内容源；guizang 精排页仅作传播样张，不反向替代站内阅读视图。

## 四、分级迭代计划

**L2 状态（2026-11-03）：✅ 完成。** onboarding 5 章：rubric 全检通过（钩子/类比链/机制图/实验自测/AI 味 0 命中），文字仅 1 处修复（章 5 L57 「staring」→「盯着」）；五章精排页 + 长图入库 `promo/page-samples/onb0{1..5}-*-magazine.{html,png}`（杂志风·忠实模式，drop 导航 + checklist 自测，逐章 DOM 验证全绿）；五章视觉已足（动画+mermaid+照片），无新增 stack-diagram 需求。

**L3 状态（2026-11-03）：✅ 完成。** 01-basics 9 章（02-Vim/03-权限/04-归档/05-软件包/06-进程/07-环境变量/08-求助/09-硬件）rubric 全检通过，**正文 0 改动**（AI 味全库 grep 0 命中；每章均有钩子/类比链/2 动画+mermaid/实验/自测）；9 张精排页+长图入库 `promo/page-samples/b0{2..9}…-magazine.{html,png}`（b01 沿用 L1 的 ch01 样张），逐章 DOM 验证全绿（navGone/checklist 数/图片全载/无请求失败）。讲稿抽检 3/6（path=L1、perm、oom）：口语化口播、类比与机制链路完整，**不重写**，与 L1 finding 一致。注意：basics 章导航块在 L3-5（章 9 仅 L3-4），drop 标注按章 grep。

**L4 状态（2026-11-03）：✅ 完成。** 02-advanced 9 章 rubric 全检通过：文字仅 1 处修复（a03 实验 2 提示句删除悬空碎片「或用正则 `\L` 前不必纠结」，`\L` 未在任何解法中出现，信息零损失）；specs 预告的「管道/sed/awk 系列补配图」评估结论为**不需要**——每章已有 2-4 部动画 + mermaid 机制图（a04 三剑客分工、a06 systemd 架构等），视觉足量。9 张精排页+长图入库 `promo/page-samples/a0{1..9}-*-magazine.{html,png}`，逐章 DOM 验证全绿（navGone / checklist 8·8·8·8·8·8·8·8·7 / mermaid svg 全渲 / 图片全载 / 请求失败 0）。注意：a09 导航块仅 L3-4 两行（无空行隔断），drop 标注比其他章少一条。附注：行内代码里的链接示例（右方括号紧跟圆括号形态）会被 check-content 链接检查误判为死链，specs 内一律用文字描述语法。

| 级 | 范围 | 内容 | 状态 |
|---|---|---|---|
| **L0** | 本文档 | specs 固化 | ✅ |
| **L1 试点** | 第 1 章 + 1 部讲稿 | humanize 章 1 → stack-diagram 画「目录树与挂载」机制图 → handraw 封面提示词 → guizang 精排样张 → 全链验证 → **用户确认风格基调** | ✅ 基调已确认（书=杂志风 / 传播=瑞士风，两套并行） |
| **L2** | 00-onboarding 5 章 | 套用 L1 定稿管线，每章 rubric 全检 3 章 | ✅ 2026-11-03（5/5 全检+样张入库） |
| **L3** | 01-basics 9 章 + 6 部讲稿 | 正文 + 讲稿 humanize；机制图补缺 | ✅ 2026-11-03（9/9 全检 0 改动 + 9 样张入库 + 讲稿抽检 3/6 不重写） |
| **L4** | 02-advanced 9 章 | 同上 + 管道/sed/awk 系列配图 | ✅ |
| **L5** | 03-pro 7 章 + 04-projects 6 章 + 05-raspberry-pi 7 章 | 收尾全库 | ⬜ |
| **L6** | 传播矩阵 | 社交卡 + 精排样张批量出片（发布侧另行授权） | ⬜ |

每级收口：check:all → 抽检 rubric → `problem_checkpoint` → 更新本表状态。

## 五、L1 验收标准（试点完成判据）

- [x] 章 1 过 rubric（逐条证据：钩子=L14 比喻链、类比=目录表一句话记忆列、机制图=新增挂载工程图、实验/自测=L230/L281 保留、记忆锚点=表格口诀列、AI 味抽检 0 命中、首现有定义；修复 1 处内容自相矛盾：L17 学习目标原承诺「rm -i 别名保护」与正文「别名靠不住」冲突，已改为与正文一致的表述）；
- [x] 新机制图：stack-diagram 全流程（fetch_icons 10 枚 svgl/Lucide → build 102KB 自包含 HTML → 双主题 PNG；DOM 验证零问题 + 组框包含断言通过；U 盘画在机器组框外，挂载边穿框接入）；
- [x] 讲稿试点（lectures/path.json）：通读 15 beats，31 类 AI 模式 0 命中，口播稿已是高质量口语（TTS 读法为刻意设计），**未改写**——finding：现有讲稿质量基线高，L3 起讲稿环节以抽检代替全改；
- [x] guizang 精排样张：`promo/page-samples/ch01-files-magazine.html`（杂志风·忠实模式，drop×2 导航行 + checklist×1，浏览器验证图片 3/3、TOC 9 节、导航残留 0）+ 长图 PNG 1.44 万像素级交付；
- [x] `check:all` EXIT=0（103 md / 899 链接 / 83 动画过检）+ Playwright 站点测试 34/34；
- [x] 用户确认基调后冻结管线，进入 L2（2026-11-03 确认：书=杂志风 / 传播=瑞士风；handraw 封面提示词补齐于 `promo/cover-prompt-ch01.md`，仅提示词、不生图）。

## 六、基调决议（2026-11-03 用户确认）

- **两套并行**：书内章节精排页 = 杂志风（Monocle 复印件质感）；传播物料（社交卡 / 海报 / PPT）= 瑞士风（克莱因蓝锚点）。
- **挂载工程图待定**：图已插入章 1（`assets/diagrams/directory-tree.*`），用户查看渲染效果后决定保留 / 调整 / 撤下；L2 期间不动该引用。
- L2 起管线冻结：humanize 抽检（ finding：文字底子已达标）→ stack-diagram 机制图按章评估 → guizang 精排页（杂志风）→ rubric 全检 → gates。
- **渲染器补丁（2026-11-03）**：guizang `render.mjs` 修复 4 个解析缺陷——checklist 任务标记 `- [ ]` 残留、嵌套图链（在图片语法外再包一层超链接的写法）输出字面残句、mermaid 代码块以源码呈现（现经本地 `node_modules/mermaid` 离线渲染为 SVG，样张相对路径 `../../node_modules/…`）、`<details>`/`<summary>` 标记落进段落分支产生空 `<p>`（现原样透传；注意 docs 内存在双行与单行 `<details><summary>…` 两种形态，须前缀匹配）。全部 23 份样张（onb×5 + b02-09 + ch01 + a×9）已重渲+重导出 PNG，DOM 复验全绿（导航块标记零残留、无空段落、mermaid svg 渲染、图片全载、请求失败 0）。
