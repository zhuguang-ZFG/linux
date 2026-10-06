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

## 质量检查

需要 Node.js 22+ 和 Bash（Windows 可用 Git Bash，通过 `BASH_BIN` 指定其他位置）：

```bash
node scripts/check-content.mjs
node --test scripts/backup.test.mjs
python3 -B scripts/examples.test.py
```

SVG 用 PowerShell 的 XML 解析器检查，Windows 和装有 pwsh 的 Linux 均可：

```powershell
pwsh -File scripts/check-svg.ps1
```

Windows PowerShell 用户也可直接运行 `& ./scripts/check-svg.ps1`。Python 检查会解析配套源码并实际启动回环 HTTP 服务验证响应，不依赖 Docker。

有 Docker 环境时执行真实构建、启动与 HTTP 响应验证：

```bash
bash scripts/check-docker.sh
```

备份回归测试使用独立临时目录，验证路径边界、恢复内容、保留数量、预演、失败清理和锁冲突。内容检查覆盖本地文件链接、38 章目录一致性、6 套练习、6 张速查表与 Bash 语法；不声称验证了每个外部网站或每条需要系统权限的教学命令。

备份脚本面向 Bash + GNU 工具，不直接支持 macOS 的 BSD find/sort。它使用专用目标目录，清理该目录直属的 `backup_*.tar.gz` 文件。强制终止后如有旧锁，确认没有写入者再处理；数据库应先按应用要求导出一致性备份，不能只打包正在写入的数据目录。

> 建议：先把脚本当课文读，再逐行敲进自己的终端 —— 敲一遍胜过看十遍。
