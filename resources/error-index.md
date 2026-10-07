# 错误信息索引：看到报错先查表

报错信息是系统在向你说话。**先读完整原文，再按表定位**——绝大多数报错只需要一条只读命令就能缩小范围。

使用方式：复制报错的关键短语（英文部分）到本表搜索，找到「第一诊断」，先跑只读检查，再决定是否动手。

> 本页所有检查命令都是只读的。任何会改文件、权限、服务状态的操作，先在测试环境确认。

## 命令与 Shell

| 报错关键短语 | 第一诊断 | 只读检查 | 常见原因 |
|---|---|---|---|
| `command not found` | 命令没装或不在 PATH | `command -v 命令`；`echo $PATH` | 未安装；装在 `/usr/local/bin` 未入 PATH；拼写 |
| `No such file or directory`（执行脚本时） | 解释器不存在或行尾是 CRLF | `head -1 脚本`；`file 脚本`；`cat -A 脚本 \| head -3` | shebang 路径错；Windows 编辑产生 `\r` |
| `bad interpreter` | 同上 | 同上 | `#!/bin/bash\r` 这类隐藏字符 |
| `syntax error near unexpected token` | Shell 语法或引号不配对 | `bash -n 脚本` | 中文引号；缺引号；`do/done` 不配对 |
| `Argument list too long` | 展开的参数超过系统上限 | `getconf ARG_MAX` | `rm *.log` 通配符太多，改用 `find -delete` 或 `xargs` |
| `Text file busy` | 二进制正在运行却被覆盖 | `fuser 文件`；`lsof 文件` | 升级运行中的程序；先停止服务 |
| `Segmentation fault` | 程序崩溃或内存/硬件问题 | `dmesg \| tail -20` | 程序缺陷；内存故障；库版本不匹配 |
| `history expansion`（`!` 相关） | 交互式 Shell 的历史展开 | 换单引号包裹 | `bash -c` 或脚本中不会展开 |

## 权限与文件

| 报错关键短语 | 第一诊断 | 只读检查 | 常见原因 |
|---|---|---|---|
| `Permission denied` | 权限位、属主或挂载选项 | `ls -ld 路径`；`id`；`findmnt -T 路径` | 缺 rwx；属主不对；挂载了 `noexec`/`ro` |
| `Operation not permitted` | 能力或属性限制 | `lsattr 文件`；`getcap 程序` | 文件带 `i`（不可变）属性；缺 CAP 权限 |
| `Read-only file system` | 内核把文件系统重挂为只读 | `findmnt -T 路径`；`dmesg \| tail` | 文件系统错误后自保护；磁盘故障 |
| `Is a directory` / `Not a directory` | 把目录当文件用（或反之） | `ls -ld 路径` | 重定向目标写成目录；路径缺一级 |
| `Too many levels of symbolic links` | 软链接成环 | `namei -l 路径` | 链接互指；用绝对路径重建 |
| `File exists` | 目标已存在且禁止覆盖 | `ls -ld 路径` | `mkdir` 无 `-p`；`unzip` 同名冲突 |
| `No such file or directory`（`cd`/读文件） | 路径不存在或大小写不符 | `ls -l 路径` | Linux 区分大小写；相对路径基准不是你以为的目录 |

## 磁盘与存储

| 报错关键短语 | 第一诊断 | 只读检查 | 常见原因 |
|---|---|---|---|
| `No space left on device` | **先分容量与 inode** | `df -h /`；`df -i /`；`du -x --max-depth=1 路径 \| sort -h` | 容量满；小文件过多 inode 耗尽；已删除文件仍被占用（`lsof +L1`） |
| `Structure needs cleaning` | 文件系统损坏 | `dmesg \| tail` | 断电/硬件错误，需修复前先备份 |
| `Input/output error` | 磁盘或链路故障 | `dmesg \| tail`；`smartctl -a /dev/sdX` | 坏道；线缆；磁盘寿命 |
| `Failed to mount` | 设备、UUID 或文件系统不匹配 | `blkid`；`findmnt`；`journalctl -b \| grep -i mount` | UUID 变了；`/etc/fstab` 写错；文件系统类型不对 |
| `target is busy` | 目录或设备被占用 | `lsof +D 挂载点`；`fuser -m 挂载点` | 有进程的工作目录在其中 |
| `missing codepage or helper program` | 文件系统工具缺失 | `cat /proc/filesystems` | 未安装 `exfat`/`ntfs-3g` 等驱动包 |

## 包管理与构建

| 报错关键短语 | 第一诊断 | 只读检查 | 常见原因 |
|---|---|---|---|
| `Unable to locate package` | 索引旧、包名错或源不匹配 | `apt update`；`apt-cache search 关键字` | 没更新索引；发行版/代号不匹配 |
| `Could not get lock /var/lib/dpkg/lock` | 另一个包管理进程在运行 | `ps aux \| grep -E 'apt\|dpkg'`；`fuser /var/lib/dpkg/lock` | 上一次没结束；**不要**直接删 lock 文件 |
| `dpkg: error processing` / 半装状态 | 依赖破损 | `dpkg -l \| grep '^iU'` | 中断的安装，用 `sudo apt -f install` 修复 |
| `Held broken packages` | 依赖冲突 | `apt-cache policy 包名` | 版本钉住；多源混用 |
| `GPG error` / `NO_PUBKEY` | 软件源签名缺失 | `apt-key list` 或查看源 keyring | 源被替换却没导入密钥 |
| `Missing dependency` / `undefined reference`（编译） | 缺开发包 | `apt search lib名称-dev` | 只装了运行时库，未装 `-dev` |

## 服务与启动

| 报错关键短语 | 第一诊断 | 只读检查 | 常见原因 |
|---|---|---|---|
| `Job for X failed` | 服务启动失败 | `systemctl status X`；`journalctl -u X -n 50` | 配置错；端口被占；权限不足 |
| `System has not been booted with systemd` | 容器/特殊环境没有 systemd | `ps -p 1 -o comm=` | 容器内应直接运行进程而非 systemctl |
| `Address already in use` / `EADDRINUSE` | 端口被占用 | `ss -ltnp \| grep 端口` | 旧进程未退出；两个服务配了同端口 |
| `Unit not found` | 服务名或单元文件不在 | `systemctl list-unit-files \| grep 关键字` | 拼错名字；单元文件未 `daemon-reload` |
| `Failed to start ... timeout` | 启动超时 | `journalctl -u X`；`systemctl show X -p Type` | 前台进程以为会后台化；缺 `Type=simple` |
| `Unit is masked` | 被显式禁用 | `systemctl status X` | 有人 `mask` 过，需 `unmask` |

## 网络

| 报错关键短语 | 第一诊断 | 只读检查 | 常见原因 |
|---|---|---|---|
| `Could not resolve host` | DNS 解析失败 | `getent hosts 域名`；`cat /etc/resolv.conf` | DNS 配置；内网域名未注册 |
| `Connection refused` | 目标没有在听 | `nc -vz host port`；`ss -ltnp`（对端） | 服务未启动；只监听 127.0.0.1；防火墙 reject |
| `Connection timed out` | 包被丢弃 | `ip route`；`ping`；`traceroute` | 防火墙 drop；路由缺失；安全组 |
| `Network is unreachable` | 没有可用路由 | `ip -br address`；`ip route` | 接口未启用；网关缺失 |
| `Connection reset by peer` | 对端主动断开 | 对端日志 | 服务崩溃；超时配置；代理中断 |
| `Temporary failure in name resolution` | DNS 临时不可用 | `resolvectl status` | 网络未就绪；resolv.conf 被覆盖 |
| `Host key verification failed` | SSH 主机密钥变了 | `ssh-keygen -F 主机` | 重装系统/中间人；确认后清理旧记录 |

## 资源与崩溃

| 报错关键短语 | 第一诊断 | 只读检查 | 常见原因 |
|---|---|---|---|
| `Killed`（进程无输出地消失） | 很可能是 OOM 杀进程 | `dmesg \| grep -i -E 'oom\|killed'`；`free -h` | 内存耗尽；容器内存限制 |
| `Cannot allocate memory` | 内存或限额不足 | `free -h`；`ulimit -a`；`cat /sys/fs/cgroup/memory.max` | 容器限额；过量并发 |
| `Too many open files` | 文件描述符上限 | `ulimit -n`；`ls /proc/PID/fd \| wc -l` | 程序泄漏 fd；上限太低 |
| `Resource temporarily unavailable` | 进程/线程数或锁限制 | `ulimit -u`；`ps -eLf \| wc -l` | 线程上限；非阻塞资源竞争 |
| `Disk quota exceeded` | 用户配额 | `quota -s`（若有） | 教育/企业环境的磁盘配额 |

## 用错表的三种情况

1. **同样的报错，不同根因**：`No space left on device` 可能是容量、inode 或已删除占用——所以本表强调「先检查，再判断」。
2. **报错来自上一层**：脚本报错往往是它调用的命令失败；往上翻日志找**第一条**错误。
3. **中文报错**：把关键名词翻译回英文（权限/磁盘/端口）再查；也可以直接搜索完整原句。

继续：[故障排查 20 例](../docs/04-projects/项目5-故障排查20例.md) 提供完整案例演练 · [工具导航](toolbox.md) 按层次选工具 · [环境对照](environment-matrix.md) 先确认环境差异。
