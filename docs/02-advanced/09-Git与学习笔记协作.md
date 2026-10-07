# 第 9 章 · Git 与学习笔记协作

> 📍 阶段 2 · 进阶篇 · 第 9 章 ｜ ⏱ 60 分钟 ｜ 难度：★★★☆☆
> ⬅️ [网络与远程连接](08-网络基础与远程连接.md) ｜ ➡️ [性能观测](../03-pro/01-性能观测与调优.md)

知识库会不断更新，自己的实验也会不断修正。用 Git 保存学习笔记，可以回答“改了什么、为什么改、怎样复现”，再把修正提交给共同维护的项目。

## 🎯 学习目标

- 区分工作区、暂存区和提交历史。
- 在独立练习仓库中完成分支、提交和合并。
- 提交包含问题、证据与复验方式的文档改进。

## 🧠 核心概念

![Git 提交三区原理动画](../../assets/animations/git-commit.svg)

[在学习站暂停、单步或重播](https://zhuguang-zfg.github.io/linux/#animation=git-commit.svg)。动画中的输入输出为教学示意，需用本章实验验证。

![Git 分支原理动画](../../assets/animations/git-branches.svg)

[在学习站暂停、单步或重播](https://zhuguang-zfg.github.io/linux/#animation=git-branches.svg)。动画中的输入输出为教学示意，需用本章实验验证。

```mermaid
flowchart LR
    A[工作区编辑] -->|git add| B[暂存区]
    B -->|git commit| C[本地历史]
    C -->|git push| D[远端仓库]
    D -->|Pull Request| E[协作审阅]
```

commit 是本地快照，push 才会把提交传到远端。Git 不会自动判断内容正确，也不能替代敏感信息管理；误提交密码后仅删除文件还不够，历史中可能仍有副本。

## 🛠 命令实操

本实验不修改教程仓库。安装 Git 后，在临时目录创建自己的练习仓库：

```bash
sudo apt install git
git_lab=$(mktemp -d)
cd "$git_lab"
git init -b main
# 只设置这个练习仓库的身份，不改全局配置
git config user.name 'Linux Learner'
git config user.email 'learner@example.invalid'
printf '# Linux notes\n\n查看目录：pwd\n' > notes.md
git status --short
git add notes.md
git diff --cached
git -c commit.gpgsign=false commit -m 'docs: record first Linux command'
```

预期第一次 status 显示 `?? notes.md`，提交后工作区干净。接着开一个改进分支：

```bash
git switch -c add-disk-note
printf '\n查看根文件系统：df -h /\n' >> notes.md
git diff
git add notes.md
git -c commit.gpgsign=false commit -m 'docs: add disk inspection note'
git switch main
git merge --ff-only add-disk-note
git log --oneline --graph --all
```

预期有两条提交，main 包含新增的磁盘命令。`--ff-only` 在不能快进时拒绝合并，提醒你先理解分叉，不自动创建意外的合并提交。

### 从笔记到贡献

对公开知识库提改进时，先 Fork、克隆到自己的目录、创建分支；修改后按 [贡献说明](../../CONTRIBUTING.md) 运行检查，再提交 Pull Request。PR 描述写清：

```text
问题：哪一章、什么环境、哪一步出现了什么错误。
修改：具体改了哪条命令或解释。
证据：复现命令、实际输出、官方手册依据。
验证：修改后原来的操作是否成功，还有什么环境没测过。
```

## 💡 避坑指南

- `git diff` 看未暂存改动，`git diff --cached` 看即将提交的改动。
- 不把 `.env`、私钥、真实日志和个人设备标识加入仓库。
- `git restore 文件` 会丢弃未提交修改，先看 diff；不要用 reset --hard 处理每一种问题。
- 多人同时编辑时先协调文件范围，遇到新改动不要直接覆盖别人的内容。

## ✍️ 动手实验

在新分支中给 notes.md 增加一个“常见误解与证据”，提交后回到 main 合并。最后能通过 `git show` 说明自己的修改，不依赖记忆。

<details><summary>参考验收</summary>

`git log --oneline` 包含你的新提交；`git show HEAD` 能看到新解释；`git status --short` 没有输出。不要伪造运行结果，没验证的环境直接写明。
</details>

## 📺 推荐视频

- [YouTube · Git 与 GitHub 入门](https://www.youtube.com/watch?v=RGOj5yH7evk) — freeCodeCamp.org，68分30秒。观看对应主题后，回到本章用实际输入和输出验证。

[![Git 与 GitHub 入门 视频封面](https://i.ytimg.com/vi/RGOj5yH7evk/hqdefault.jpg)](https://www.youtube.com/watch?v=RGOj5yH7evk)

[在学习站查看配套媒体](https://zhuguang-zfg.github.io/linux/#read=docs%2F02-advanced%2F09-Git%E4%B8%8E%E5%AD%A6%E4%B9%A0%E7%AC%94%E8%AE%B0%E5%8D%8F%E4%BD%9C.md) · [视频资料与核验说明](../../resources/videos.md)。标题、作者和分P已核对，未逐条完成实播，播放限制以原站为准。

## ✅ 自测清单

- [ ] 能解释 add、commit、push 分别改变哪里。
- [ ] 能在自己的练习仓库完成分支与合并。
- [ ] 能写一份可复验的贡献说明。

## 🔗 延伸阅读

- [Pro Git 中文书](https://git-scm.com/book/zh/v2)
- [进阶篇练习](../../exercises/02-进阶篇练习.md)
