# Git 速查

| 目的 | 命令 |
|---|---|
| 查看状态 | `git status`（未暂存/已暂存一目了然） |
| 看工作区改动 | `git diff` |
| 看已暂存改动 | `git diff --staged` |
| 暂存文件 | `git add 文件名` 或 `git add -A` |
| 提交 | `git commit -m "feat: 一句话说明"` |
| 丢弃工作区改动 | `git restore 文件名` |
| 取消暂存 | `git restore --staged 文件名` |
| 查看提交历史 | `git log --oneline --graph` |
| 新建并切换分支 | `git switch -c 分支名` |
| 合并分支 | `git switch main && git merge 分支名` |
| 压缩整理提交 | `git rebase -i HEAD~3`（改写历史，仅限未推送的分支） |
| 关联远程 | `git remote add origin 仓库地址` |
| 首次推送 | `git push -u origin main` |
| 拉取但不自动合并 | `git pull --ff-only` |
| 查看远程状态 | `git remote -v` |

提交信息写清「改了什么、为什么、怎么验证」；`git reset --hard` 会丢掉未提交的改动，执行前先确认没有想要保留的内容；变基会改写提交哈希，只对未推送的分支使用。参考 [Git 与学习笔记协作章节](../docs/02-advanced/09-Git与学习笔记协作.md)。
