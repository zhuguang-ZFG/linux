# 🤝 参与贡献

感谢愿意让「通往 Linux 之路」变得更好！

## 报告问题

- 🐛 发现错误或异常：使用 [Bug 模板](.github/ISSUE_TEMPLATE/bug_report.md) 提交 issue，写清期望 vs 实际、复现步骤与环境。
- ✨ 建议新章节/动画/功能：使用 [功能建议模板](.github/ISSUE_TEMPLATE/feature_request.md)，附可验证的验收标准。
- 🔒 安全漏洞：**不要**发公开 issue，请走 [SECURITY.md](SECURITY.md) 的私有报告渠道。

## 可以做什么

- 🐛 修正命令错误、过期参数、错别字
- ✍️ 新增章节或补充「动手实验」
- 🎬 增加动画/Mermaid 图解（遵循现有模板）
- 📺 推荐视频（必须给出可访问的 B站 BV 号或 YouTube 链接，维护者会核验后合并）
- 🍓 补充树莓派实验（附接线图或照片请使用自有版权或自由版权素材）

## 章节写作规范

1. 每章基于 [docs/TEMPLATE.md](docs/TEMPLATE.md) 模板：学习目标 → 核心概念 → 命令实操 → 避坑指南 → 动手实验 → 推荐视频 → 自测清单 → 延伸阅读
2. 命令示例默认 Ubuntu/Debian，其他发行版差异需标注
3. 所有命令必须真实可运行，给出预期输出
4. 中文书写，术语首次出现附英文原文，如「挂载（mount）」
5. 图片仅使用自由版权素材并在 [assets/images/CREDITS.md](assets/images/CREDITS.md) 登记来源

## 提交流程

```bash
# 1. Fork 后创建分支
git checkout -b feat/add-chapter-xxx

# 2. 提交（一个 PR 聚焦一件事）
git commit -m "docs: 补充第 X 章动手实验"

# 3. 推送并打开 Pull Request
```

PR 描述里请说明：改了什么、为什么改、如何在本地验证。

## 提交前检查

- 在仓库根目录运行 `node scripts/check-content.mjs`，确保目录统计、本地链接与 Bash 语法一致。
- 新增/调整章节时同时修改首页顺序和前后导航；`node --test scripts/chapter-navigation.test.mjs` 验证导航检查器。
- 文件系统实验在独立临时目录运行 `python3 -B scripts/labs.test.py`；Linux 专属测试不能在 Windows 上伪装为已通过。
- 修改巡检或摄像头示例后分别运行 `node --test scripts/health-report.test.mjs`、`python3 -B scripts/camera.test.py`，核对失败退出码与已有文件保护。
- 修改备份逻辑时运行 `node --test scripts/backup.test.mjs`；不要用真实备份目录验证删除行为。
- 修改 SVG 后运行 `pwsh -File scripts/check-svg.ps1`；只通过字符串搜索不足以证明 XML 合法。
- 修改容器示例后运行 `bash scripts/check-docker.sh`，验证真实 HTTP 正文。
- 新章节遵循模板，并写明环境前提、预期输出、验收和清理方式。没有实际执行的步骤不能标为“验证通过”。
- 更新媒体后运行 `node scripts/check-media.mjs` 和 `node scripts/sync-media.mjs --check`；标题/作者等元数据核验不能标为完整视频实播通过。
- 站点变更需 `pnpm run build` 和 `pnpm run test:site` 通过，详见 [学习站开发说明](web/README.md)。

> ⚖️ 提交即表示同意你的贡献以 Apache 2.0 许可证随本仓库发布。
