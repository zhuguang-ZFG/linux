## 改了什么

<!-- 一句话说明改动内容，例如：新增第 X 章 / 修复某命令错误 / 新增动画 -->

## 为什么改

<!-- 背景与动机：解决什么问题，为什么这样解决 -->

## 验证方式

<!-- 请至少勾选实际运行过的检查，并粘贴关键输出 -->

- [ ] `node scripts/check-content.mjs`（链接、章节计数、Bash 语法）
- [ ] `node scripts/check-media.mjs && node scripts/sync-media.mjs --check`
- [ ] `python3 -B scripts/labs.test.py`（文件系统实验，Linux 专属）
- [ ] `node --test scripts/*.test.mjs`（改到对应脚本时）
- [ ] `pnpm run build && pnpm run test:site`（站点变更时）
- [ ] 其他：<!-- 例如真实机器/容器中跑通某命令 -->

## 影响范围

<!-- 是否影响章节导航、README 计数、动画目录、视频元数据等；新增章节请同步首页与前后导航 -->

## 自查

- [ ] 遵循 [CONTRIBUTING.md](https://github.com/zhuguang-ZFG/linux/blob/main/CONTRIBUTING.md) 的写作规范
- [ ] 一个 PR 只聚焦一件事
- [ ] 命令示例真实可运行并给出预期输出（内容类改动）
- [ ] 图片/视频素材符合版权要求并登记来源
