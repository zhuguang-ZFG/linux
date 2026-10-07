# scripts/

教程配套源码与检查入口。在仓库根目录执行下列命令；涉及 Linux 系统、Docker 或 GPIO 的脚本需要对应环境。

| 脚本 | 对应章节 | 用途 |
|------|---------|------|
| [backup.sh](backup.sh) | [Bash 编程](../docs/02-advanced/05-Bash脚本编程.md) | `bash scripts/backup.sh [--dry-run] 源目录 备份目录`，保留 5 份 |
| [health-report.sh](health-report.sh) | [巡检项目](../docs/04-projects/项目2-服务器巡检脚本.md) | `bash scripts/health-report.sh 85`，只读报告 |
| [Docker HTTP 示例](docker-hello/) | [容器章节](../docs/03-pro/04-容器与虚拟化.md) | 构建后返回中文问候 |
| [本地 AI Compose](local-ai/compose.yaml) | [本地 AI 项目](../docs/04-projects/项目4-Linux跑本地AI.md) | Ollama + Open WebUI |
| [blink.py](pi/blink.py) | [GPIO 章节](../docs/05-raspberry-pi/04-GPIO硬件编程.md) | 真机 LED 闪烁，Ctrl-C 释放资源 |
| [capture-frame.py](pi/capture-frame.py) | [边缘 AI](../docs/05-raspberry-pi/06-树莓派与边缘AI.md) | USB 摄像头采集图片 |
| [record-button.py](pi/record-button.py) | [按钮数据记录](../docs/05-raspberry-pi/07-从按钮到数据记录.md) | GPIO27 状态记录，支持明确标记的 `--simulate` 模式 |
| [recover_deleted.py](labs/recover_deleted.py) | [性能与恢复实验](../docs/03-pro/01-性能观测与调优.md) | Linux 上在全新目录演示打开文件被删除后的恢复 |
| [个人备份定时单元](scheduling/) | [自动化运维](../docs/03-pro/05-自动化运维.md) | 用户级 service/timer，路径与参数配套 |

## 质量检查

需要 Node.js 22+、Python 3.10+ 和 Bash（Windows 可用 Git Bash，通过 `BASH_BIN` 指定其他位置）：

```bash
node scripts/check-content.mjs
node --test scripts/backup.test.mjs
node --test scripts/chapter-navigation.test.mjs
node --test scripts/health-report.test.mjs
node --test scripts/serve-site.test.mjs
node --test scripts/audit-media.test.mjs
python3 -B scripts/examples.test.py
python3 -B scripts/media.test.py
python3 -B scripts/camera.test.py
python3 -B scripts/labs.test.py
```

上面全部内容检查可用 `pnpm run check:all` 一条命令跑完；`labs.test.py` 在 Windows 上自动跳过，由 Ubuntu CI 覆盖。

SVG 用 PowerShell 的 XML 解析器检查，Windows 和装有 pwsh 的 Linux 均可：

```powershell
pwsh -File scripts/check-svg.ps1
```

Windows PowerShell 用户也可直接运行 `& ./scripts/check-svg.ps1`。Python 检查会解析配套源码并实际启动回环 HTTP 服务验证响应，不依赖 Docker。

有 Docker 环境时执行真实构建、启动与 HTTP 响应验证：

```bash
bash scripts/check-docker.sh
```

备份回归测试使用独立临时目录，验证路径边界、恢复内容、保留数量、预演扫描失败、失败清理和锁冲突。内容检查覆盖本地文件链接、章节前后导航、章节与素材数量、6 套练习、6 张速查表与 Bash 语法。

`labs.test.py` 在 Linux 上实际运行 `/proc` 恢复、压缩、sed，以及 cron/service 中的备份命令；Windows 上明确跳过，由 Ubuntu CI 覆盖。测试不注册系统定时任务。摄像头测试使用模拟驱动检查资源释放、编码失败和文件保护，不代表硬件实测。

`health-report.sh` 退出码为 0（磁盘未达阈值）、1（磁盘告警）、2（参数/依赖/采集错误）；缺少可选的 free/ss 会在报告中标注，已安装工具执行失败则不返回健康结果。检查不声称验证了每个外部网站或每条需要系统权限的教学命令。运行实验前可查 [环境对照表](../resources/environment-matrix.md)。

## 素材维护

- `python3 -B scripts/build-animations.py` 重新生成 57 个 SVG；另有 6 个原始动画。[动画目录](../assets/animations/catalog.json) 记录全部 63 个动画与对应章节、时长和步骤。
- `scripts/fetch-course-photos.py` 是照片的来源记录与增量下载脚本，额外需要 Pillow。它跳过已存在文件、合并 SOURCES 清单，日常检查和 CI 不运行下载、不需要联网或 Pillow。
- `node scripts/audit-media.mjs [--json 报告路径] [--strict] [--timeout 毫秒]` 只读核查 [videos.json](../resources/videos.json) 里每条记录的供应商元数据端点：B 站走公开 view API（按 bvid），YouTube 走官方 oEmbed（按 watch 地址）。脚本不下载、不内嵌任何媒体，`reachable` 仅表示元数据接口可用，**不代表视频可播放**。默认始终退出 0，适合手动维护；`--strict` 在有记录不可达时退出 1。回归测试：`node --test scripts/audit-media.test.mjs`（纯函数，不联网）。CI 中 `.github/workflows/media-audit.yml` 每周（及手动触发）运行一次，上传 JSON 报告工件；审计步骤 `continue-on-error`，不阻塞内容检查、站点构建或 Pages 部署，其证据不构成播放保证。
- `pnpm run check:overflow`（`node scripts/check-overflow.mjs`）遍历 [动画目录](../assets/animations/catalog.json) 中全部带播放元数据的动画，在 `_site` 副本上断言播放器就绪、步骤卡片数量、时间推进与输出帧可见，并测量 SVG 文本右边界不越过卡片/面板/整幅限额。需要先 `pnpm run build`，由 CI 在站点测试后自动执行；原始 6 个手写动画无 steps/duration 元数据，不参与播放器契约，跳过。

## 学习站与视频映射

见 [站点开发说明](../web/README.md)。核心检查：`node scripts/check-media.mjs`、`node scripts/sync-media.mjs --check`、`pnpm run build`、`pnpm run test:site`。视频数据在 [videos.json](../resources/videos.json)，推荐关系在 [chapter-media.json](../resources/chapter-media.json)。

备份脚本面向 Bash + GNU 工具，不直接支持 macOS 的 BSD find/sort。它使用专用目标目录，清理该目录直属的 `backup_*.tar.gz` 文件。强制终止后如有旧锁，确认没有写入者再处理；数据库应先按应用要求导出一致性备份，不能只打包正在写入的数据目录。

> 建议：先把脚本当课文读，再逐行敲进自己的终端 —— 敲一遍胜过看十遍。
