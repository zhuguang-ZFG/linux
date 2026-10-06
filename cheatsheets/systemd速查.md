# systemd 速查

以下以系统服务为例；用户服务用 `systemctl --user`，日志用 `journalctl --user`，不要混用管理器。

| 目的 | 命令 |
|---|---|
| 查看状态 | `systemctl status 服务 --no-pager` |
| 查看失败单元 | `systemctl --failed` |
| 启动 / 停止 | `sudo systemctl start 服务` / `sudo systemctl stop 服务` |
| 开机启用并立即启动 | `sudo systemctl enable --now 服务` |
| 取消启用并停止 | `sudo systemctl disable --now 服务` |
| 修改 unit 后重读 | `sudo systemctl daemon-reload` |
| 重启进程 | `sudo systemctl restart 服务` |
| 查看合并前配置文件 | `systemctl cat 服务` |
| 最近 50 行日志 | `sudo journalctl -u 服务 -n 50 --no-pager` |
| 跟随日志 | `sudo journalctl -u 服务 -f` |
| 本次启动内核日志 | `sudo journalctl -k -b` |
| 查看 timer | `systemctl list-timers --all` |

`is-active` 在服务未运行时返回非零，这是查询结果。`daemon-reload` 不会自动重启应用；`reload` 需要应用支持。参考 [systemd 章节](../docs/02-advanced/06-systemd服务与日志.md)。
