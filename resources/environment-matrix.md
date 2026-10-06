# 先确认实验环境，再复制命令

同样的终端窗口，背后可能是 Windows、WSL、Linux 虚拟机、容器或树莓派。命令报错时先检查环境，避免把“系统不具备这个能力”误判为自己操作错误。

## 哪些环境能完成哪些实验

| 实验 | Ubuntu/Debian 虚拟机或物理机 | WSL2 | 普通应用容器 | Windows 原生终端 | 树莓派 OS |
|---|---|---|---|---|---|
| 文件、grep/sed/awk、Bash | 可完成 | 可完成 | 安装对应工具后可完成 | Git Bash 只能近似部分命令，不作为本教程 Linux 基线 | 可完成 |
| systemd 服务与日志 | 需实际运行 systemd | 先确认 PID 1 是 systemd | 通常不是 systemd 环境 | 不适用 | 通常可完成 |
| loop 挂载、文件系统 | 需要相关内核能力和 sudo | 取决于内核/配置 | 默认能力受限，改用虚拟机 | 不适用 | 支持时可完成 |
| `/proc` 误删文件恢复 | 可完成自己的文件实验 | 可完成 | 需可用的 `/proc/self/fd` | 不适用 | 可完成 |
| Docker 项目 | 需 Docker Engine 可用 | 需 Engine 或 Desktop 集成 | 不默认开放宿主 Docker socket | Docker Desktop 的 Linux 容器可做容器实验 | 需 ARM64 镜像支持 |
| GPIO 与摄像头 | 需要真实设备与驱动 | 不默认具备设备访问 | 设备映射另行配置 | 可做明确标记的软件模拟 | 按板型、权限与接线确认 |

Ubuntu 22.04、24.04 和 Debian 12 的包名、PHP 版本与内核工具不完全相同。章节明确指定版本时，以该章为准；不要把 Ubuntu 的软件源加到 Debian 或 Raspberry Pi OS 上。

## 开始前记录四项事实

在 Linux Shell 中执行：

```bash
cat /etc/os-release
uname -sr
ps -p 1 -o comm=
id -u
```

分别记录发行版、内核、PID 1 的程序和当前用户 ID。`id -u` 为 0 表示 root，不代表必须用 root 学所有命令。分享记录时不用附真实用户名、设备序列号或公网地址。

## 按实验检查前提

### Bash 与文件实验

```bash
bash --version | head -n 1
command -v tar find sort gzip
```

本仓库的备份脚本面向 Bash 和 GNU 工具。macOS 自带的 BSD find/sort 参数不同；Windows Git Bash 可运行部分测试，不代表其 `/proc` 与 Linux 完全一致。

### systemd

```bash
ps -p 1 -o comm=
systemctl is-system-running
```

第一条应显示 systemd。第二条可能返回 degraded，表示有失败单元，需进一步查看 `systemctl --failed`；它不同于“没有 systemd”。用户服务还要求可用的用户会话，出现 bus 错误时先区分系统管理器和用户管理器。

### Docker

```bash
docker version
docker compose version
docker info --format '{{.OSType}}'
```

仅看到客户端版本不够，还要能访问服务端。本教程镜像要求 Linux 容器；Windows Desktop 环境的最后一条应为 `linux`。拒绝访问时先检查 daemon、context 和权限，不用给 Docker socket 开放 777 权限。

### 树莓派与模拟模式

真实实验先完成型号识别、系统更新和断电接线。没有硬件时可运行：

```bash
python3 scripts/pi/record-button.py button-simulation.csv --simulate --seconds 2
```

这只验证文件格式和软件流程，不证明物理引脚、供电和设备驱动正确。保留 `source=simulated` 标签。

## 环境不匹配时怎么处理

1. 记录原命令与完整报错。
2. 对照本页判断缺的是工具、权限、服务还是内核/硬件能力。
3. 工具缺失按发行版安装；能力不具备时换到合适的测试环境。
4. 不通过格式化真实磁盘、禁用安全机制或映射宿主机全部设备来“试着修好”。

返回 [学习路线](../LEARNING_PATHS.md) · [如何使用教程](../docs/00-如何使用本教程.md) · [实验源码](../scripts/README.md)。
