# 工具导航：按问题选工具

沿用知识库的分类入口，但不按热度堆工具。每项都说明要观察什么、如何验证，以及哪些结论不能由单个工具推出。

| 任务 | 工具入口 | 验收方法 | 局限 |
|---|---|---|---|
| 看懂一条命令 | 本机 man、[tldr](https://tldr.sh)、[explainshell](https://explainshell.com) | 能逐个解释参数，再用临时数据验证 | 在线解释可能与本机版本不同 |
| 找文件和文字 | find、grep、sed、awk | 保存筛选前后的输入输出 | 文件名传递与文本行不是同一问题 |
| 检查脚本 | bash -n、[ShellCheck](https://www.shellcheck.net) | 语法/静态检查加失败路径测试 | 静态检查不能证明业务逻辑正确 |
| 查服务故障 | systemctl、journalctl、ss | 服务状态、日志与真实请求相互印证 | running 不等于用户请求成功 |
| 保存学习改进 | [Git](https://git-scm.com/book/zh/v2) | 提交能解释改动和验证方式 | Git 不自动清除已提交的秘密 |
| 复现应用环境 | [Docker](https://docs.docker.com/) | 构建、请求、重建、持久化都验证 | 镜像不等于运行中的全部数据 |
| 本地模型实验 | [Ollama](https://docs.ollama.com/docker)、[Open WebUI](https://docs.openwebui.com/getting-started/quick-start/) | CLI 与界面调用同一模型 | 运行成功不代表回答准确 |
| 认识真实硬件 | [实物图鉴](hardware-gallery.md) + lscpu/lsblk/lsusb | 实物、系统视图、任务需求能对应 | 外形不能证明兼容性 |
| 看懂数据流 | [动画实验室](visual-lab.md) | 先预测，再用命令复验 | 动画不是现场录像 |

## 选择工具前的四个问题

1. 我需要解释、测量、修改还是保存？
2. 这个工具的输入是否含敏感信息，能否在本机完成？
3. 它会改变文件、权限、网络或服务状态吗？
4. 我用什么独立证据判断它做对了？

例如磁盘“满了”，先看 df 的容量和 inode，再看 du 与打开的已删除文件；不是先安装一款清理工具。工具选择要跟问题对应。

继续：[提示词练习](prompt-lab.md) · [学习路线](../LEARNING_PATHS.md)。
