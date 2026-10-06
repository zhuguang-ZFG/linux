# 动画实验室：先预测，再播放，最后动手

本库共 12 个原创 SVG 动画。GitHub 或本地浏览器可直接查看；如果平台只显示静态图，点击图片打开源文件。新增六个动画每轮 12 秒、播放三轮后停止，支持系统的“减少动态效果”设置，静态说明始终可读；重新加载可重播。

动画是原理示意，不是从真实机器采集的运行录像。验收仍要回到命令与实际输出。

## 管道中的数据变化

![管道数据流](../assets/animations/shell-pipeline.svg)

**先猜**：grep 不匹配时下游会收到什么？**动手**：把 [管道章节](../docs/02-advanced/01-管道与重定向.md) 的命令逐段运行，保存每一步输出。

## 文件系统如何挂到目录树

![文件系统挂载](../assets/animations/filesystem-mount.svg)

**先猜**：卸载后文件是丢失，还是路径看不到它？**动手**：用 [镜像文件挂载实验](../docs/02-advanced/07-磁盘与文件系统.md) 比较前后视图。

## 容器删除后，卷里的文件去哪了

![容器与持久卷](../assets/animations/docker-volume.svg)

**先猜**：镜像、容器可写层和命名卷哪一个保存数据？**动手**：按 [容器章节](../docs/03-pro/04-容器与虚拟化.md) 用不同容器读取同一命名卷。

## SSH 的两次身份检查

![SSH 身份检查](../assets/animations/ssh-handshake.svg)

**先猜**：主机指纹和用户公钥是谁验证谁？**动手**：读 [网络章节](../docs/02-advanced/08-网络基础与远程连接.md) 的 ssh -v 输出，找出两个阶段。

## 备份为何最后才删旧文件

![备份发布与清理](../assets/animations/backup-transaction.svg)

**先猜**：第六份归档失败时，五份旧备份应该怎样？**动手**：运行 [备份练习](../docs/02-advanced/05-Bash脚本编程.md)，比较预演、成功、失败三种结果。

## AI 建议如何变成可信笔记

![AI 建议审阅与验证](../assets/animations/ai-review-loop.svg)

**先猜**：模型给出一条命令，是否就能直接放进教程？**动手**：完成 [AI 辅助学习章节](../docs/03-pro/07-AI辅助学习与运维.md) 的手册核对与实测。

## 已有六个基础动画

| 动画 | 观察问题 | 继续学习 |
|---|---|---|
| [终端输入](../assets/animations/terminal-typing.svg) | 命令、参数和输出如何区分？ | [初见终端](../docs/00-onboarding/05-初见终端与Shell.md) |
| [网络包之旅](../assets/animations/packet-journey.svg) | 请求和响应经过哪些节点？ | [网络基础](../docs/02-advanced/08-网络基础与远程连接.md) |
| [进程生命周期](../assets/animations/process-lifecycle.svg) | 运行、等待和结束有什么区别？ | [进程管理](../docs/01-basics/06-进程管理.md) |
| [开机引导](../assets/animations/boot-sequence.svg) | 从上电到登录涉及哪些阶段？ | [内核与系统调用](../docs/03-pro/02-内核与系统调用.md) |
| [GPIO 点灯](../assets/animations/gpio-blink.svg) | 输出电平如何影响 LED？ | [GPIO](../docs/05-raspberry-pi/04-GPIO硬件编程.md) |
| [权限位](../assets/animations/permission-bits.svg) | 三组 rwx 分别属于谁？ | [用户与权限](../docs/01-basics/03-用户与权限.md) |

配合 [实物图鉴](hardware-gallery.md) 看真实设备，回到 [学习路线](../LEARNING_PATHS.md) 选择下一项成果。
