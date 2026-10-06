# 第 2 章 · 查看与编辑文件：Vim

> 📍 位置：阶段 1 · 基础篇 · 第 2 章 ｜ ⏱ 预计用时：30-45 分钟 ｜ 难度：★★☆☆☆
>
> ⬅️ 上一章：[01-文件与目录操作](01-文件与目录操作.md) ｜ ➡️ 下一章：[03-用户与权限](03-用户与权限.md)

上一章你会"搬运"文件了，这一章学会"看"与"改"。看文件有一串轻量工具：`cat`、`less`、`head`、`tail`；改文件绕不开 Linux 世界的事实标准——**Vim**。别怕它"出不去"的段子，跟着本章走，五步就能生存，十步就能干活。

## 🎯 学习目标

学完本章，你应该能够：

- 用 `cat`、`less`、`head`、`tail` 从容查看任意大小的文件；
- 用 `tail -f` 实时盯着日志滚动，用 `wc`、`file`、`stat` 给文件做"体检"；
- 画出 Vim 的**三种模式**关系图，并走通"生存五步"；
- 在 Vim 里移动光标、搜索、剪切/复制/粘贴一行；
- 写出一份最小可用的 `.vimrc` 配置。

## 🧠 核心概念

![Vim 模式原理动画](../../assets/animations/vim-modes.svg)

[在学习站暂停、单步或重播](https://zhuguang-zfg.github.io/linux/#animation=vim-modes.svg)。动画中的输入输出为教学示意，需用本章实验验证。

### 看文件：按"块头"选工具

| 场景 | 工具 |
|---|---|
| 小文件，整篇看 | `cat` |
| 大文件，慢慢翻 | `less` |
| 只看头/尾几行 | `head` / `tail` |
| 盯着日志实时滚动 | `tail -f` |

### cat：小文件的直通车

`cat`（concatenate，连接输出）把文件内容原样倒到屏幕上。文件小还行，文件一大就"刷屏淹没"——这也是它最常被误用的地方。

### less：大文件的正确打开方式

`less` 是分页查看器（pager），名字来自梗"less is more"（比老前辈 `more` 更强）。它只把当前屏加载进来，打开几个 GB 的文件也秒开，看日志、看 `man` 手册用的都是它。

### head 与 tail：只看一头一尾

`head` 默认取前 10 行，`tail` 默认取后 10 行。运维最爱的 `tail -f`（follow）会"咬住"文件不放，新内容一写入就滚出来，看日志必备。

### wc / file / stat：三个体检小工具

- `wc`（word count）：数行数、单词数、字节数；
- `file`：判断文件**真实类型**（不看扩展名，看内容特征）；
- `stat`：查看文件的元数据（大小、时间戳、权限、inode），为第 3 章埋个伏笔。

### Vim：为什么是它

`vi` 是 Unix 老将，`Vim`（Vi IMproved）是它的增强版，Ubuntu 里 `vi` 就是 `vim` 的别名。服务器上几乎没有它不在的时候——学会它是为了在**任何一台 Linux 机器**上都能改配置。

Vim 的核心心智模型是**三种模式**：普通模式下达指令，插入模式才打字，命令行模式做保存退出。大多数"Vim 劝退"事故，都是把普通模式当成打字模式狂敲一通。

```mermaid
stateDiagram-v2
    state "Normal 普通模式（默认）" as N
    state "Insert 插入模式" as I
    state "Command 命令行模式" as C
    [*] --> N: vim 文件名 启动
    N --> I: 按 i / a / o
    I --> N: 按 Esc
    N --> C: 按 :
    C --> N: 回车执行或 Esc
    C --> [*]: :wq 保存并退出
    N --> [*]: :q! 不保存强制退出
```

## 🛠 命令实操

### cat 与 -n：带行号输出

```bash
echo -e "first line\nsecond line\nthird line" > hello.txt   # 造一个练习文件
cat hello.txt
cat -n hello.txt    # -n：显示行号（number）
```

```text
     1  first line
     2  second line
     3  third line
```

### less：翻页、搜索、退出

```bash
less /etc/services      # 一个几千行的现成大文件
```

| 按键 | 作用 |
|---|---|
| `空格` / `f` | 下一页 |
| `b` | 上一页 |
| `↑` `↓` 或回车 | 逐行滚动 |
| `/关键词` | 向下搜索，`n` 下一个、`N` 上一个 |
| `?关键词` | 向上搜索 |
| `g` / `G` | 跳到文件开头 / 结尾 |
| `q` | 退出 |

### head / tail / tail -f

```bash
head /etc/passwd         # 默认前 10 行
head -n 3 /etc/passwd    # 前 3 行
tail -n 5 /etc/passwd    # 后 5 行
tail -f /var/log/syslog  # 实时跟踪日志（Ctrl+C 退出）
```

```text
$ head -n 3 /etc/passwd
root:x:0:0:root:/root:/bin/bash
daemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin
bin:x:2:2:bin:/bin:/usr/sbin/nologin
```

再开一个终端往练习文件里追加内容，就能看到 `-f` 的滚动效果：

```bash
tail -f demo.log &
echo "hello" >> demo.log    # 切回 tail 所在终端，新行已经滚出来了
```

> 💡 发行版注记：Ubuntu/Debian 系统日志是 `/var/log/syslog`；Fedora/RHEL 系是 `/var/log/messages`。

### wc：数一数

```text
$ wc /etc/passwd
   45    82  2789 /etc/passwd
$ wc -l /etc/passwd
45 /etc/passwd
```

不带选项输出三列：**行数、单词数、字节数**（数字因系统而异）；`-l` 只要行数。

### file 与 stat：透视文件

```text
$ file hello.txt photo.png /bin/ls
hello.txt: ASCII text
photo.png: PNG image data, 1920 x 1080, 8-bit/color RGBA, non-interlaced
/bin/ls:   ELF 64-bit LSB pie executable, x86-64, dynamically linked
```

`file` 看的是文件头部的"魔数"，扩展名改成 `.jpg` 也骗不过它。

```text
$ stat hello.txt
  File: hello.txt
  Size: 33          Blocks: 8          IO Block: 4096   regular file
Device: 10305h/66309d    Inode: 524347      Links: 1
Access: (0664/-rw-rw-r--)  Uid: ( 1000/  alice)   Gid: ( 1000/  alice)
Modify: 2026-10-06 10:30:00.123456789 +0800
```

`Access:` 一行就是权限（第 3 章的主角），`Modify:` 是内容最后修改时间。

### Vim 生存五步

1. **打开**：`vim hello.txt`——此刻在普通模式，敲什么都不会变成文字；
2. **进入插入模式**：按 `i`，左下角出现 `-- INSERT --`，现在可以打字了；
3. **打完回普通模式**：按 `Esc`；
4. **保存并退出**：输入 `:wq` 再回车（write + quit）；
5. **反悔了**：输入 `:q!` 回车，不保存强退。

记住口诀：**`i` 写、`Esc` 停、`:wq` 走人、`:q!` 逃跑**。

### 光标移动与搜索（普通模式）

| 按键 | 作用 |
|---|---|
| `h` `j` `k` `l` | 左、下、上、右（方向键也可以） |
| `gg` / `G` | 跳文件开头 / 结尾 |
| `0` / `$` | 行首 / 行尾 |
| `w` / `b` | 下一个 / 上一个单词 |
| `/关键词` | 向下搜索；`n` 下一个，`N` 上一个 |
| `dd` | 剪切（删除）整行 |
| `yy` | 复制整行 |
| `p` | 粘贴到下一行 |
| `u` | 撤销（undo） |

### .vimrc：一段最小配置

把下面内容写进 `~/.vimrc`，下次打开 Vim 生效：

```vim
" ~/.vimrc —— 最小可用配置（Vim 注释用双引号）
syntax on          " 语法高亮
set number         " 显示行号
set hlsearch       " 搜索结果高亮
set incsearch      " 边输入边搜索
set tabstop=4      " Tab 显示为 4 格
set shiftwidth=4   " 自动缩进 4 格
set expandtab      " Tab 展开成空格
set mouse=a        " 启用鼠标
```

> 🎓 系统自带交互教程：终端里敲 `vimtutor`，半小时跟着练一遍胜读十篇文章。

## 💡 避坑指南

1. **大文件别用 `cat`**：会刷屏且拖慢终端。`less` 才是通用姿势，`man` 手册内部用的也是它。
2. **Vim 里"打不出字"**：你八成在普通模式。先按 `Esc` 再按 `i`。
3. **Vim "关不掉"**：按几下 `Esc` 确保在普通模式，再输入 `:q!` 回车。`:` 没反应说明还在插入模式。
4. **看到 `.hello.txt.swp`**：那是 Vim 异常退出留下的交换文件（swap file），确认无误后可 `rm` 掉，下次打开不再弹警告。
5. **`tail -f` 不会自己停**：它是故意不退出的，用 `Ctrl+C` 收手。
6. **别用 Vim 直接改二进制文件**：会破坏内容，先 `file` 判断类型。

## ✍️ 动手实验

### 实验 1：给文件做体检

对 `/etc/passwd` 依次执行：统计行数、看前 5 行、看后 5 行、判断类型；再用 `stat` 查出它的权限位。

<details><summary>💡 参考解法（先自己试！）</summary>

```bash
wc -l /etc/passwd
head -n 5 /etc/passwd
tail -n 5 /etc/passwd
file /etc/passwd
stat /etc/passwd
```

```text
$ file /etc/passwd
/etc/passwd: ASCII text
```

`stat` 输出里的 `Access: (0644/-rw-r--r--)` 就是本章埋的伏笔，下一章正式拆解它。
</details>

### 实验 2：Vim 生存挑战

新建 `~/hello.txt`，要求：输入三行文字 → 删掉中间一行 → 撤销 → 复制最后一行并粘贴 → 搜索某个词 → 保存退出。全程不允许碰 `:q!`（不许逃跑）。

<details><summary>💡 参考解法（先自己试！）</summary>

```text
vim ~/hello.txt        # 打开
i                      # 进插入模式，输入 three lines
Esc                    # 回普通模式
gg                     # 回开头（若光标不在目标行，用 j/k 移过去）
dd                     # 删除当前行
u                      # 撤销删除
yy                     # 复制当前行
p                      # 粘贴到下一行
/line                  # 搜索 line，按 n 在结果间跳转
:wq                    # 保存退出
```

只要这串按键你一口气敲完不看笔记，Vim 生存就算过关了。
</details>

## 📺 推荐视频

- [B站 · Vim 快速入门](https://www.bilibili.com/video/BV1Sv411r7vd/?p=16) — 韩顺平，P16，8分32秒。观看对应主题后，回到本章用实际输入和输出验证。

[![Vim 快速入门 视频封面](https://i0.hdslb.com/bfs/archive/0647f0151e2550455c3d3e0d8d38f5a4c641bf78.jpg)](https://www.bilibili.com/video/BV1Sv411r7vd/?p=16)

[在学习站查看配套媒体](https://zhuguang-zfg.github.io/linux/#read=docs%2F01-basics%2F02-%E6%9F%A5%E7%9C%8B%E4%B8%8E%E7%BC%96%E8%BE%91%E6%96%87%E4%BB%B6-Vim.md) · [视频资料与核验说明](../../resources/videos.md)。标题、作者和分P已核对，未逐条完成实播，播放限制以原站为准。

## ✅ 自测清单

- [ ] 我知道什么情况用 `cat`、什么情况必须用 `less`
- [ ] 我能在 `less` 里翻页、搜索、退出
- [ ] 我会用 `tail -f` 盯日志，并知道怎么停
- [ ] 我能画出 Vim 三种模式的切换关系
- [ ] 我能背出 Vim 生存五步：`i` → 打字 → `Esc` → `:wq`（或 `:q!`）
- [ ] 我会用 `dd`/`yy`/`p` 完成整行剪切、复制、粘贴
- [ ] 我的 `~/.vimrc` 里已经有行号和语法高亮

## 🔗 延伸阅读

- [vimhelp.org](https://vimhelp.org)：Vim 官方用户手册在线版
- [man7.org · Linux man-pages](https://man7.org/linux/man-pages/)：`less(1)`、`stat(1)` 的权威说明
- [tldr.sh](https://tldr.sh)：`tldr vim` 直接给常用例子（第 8 章详讲）
- [鸟哥的 Linux 私房菜](https://linux.vbird.org)：vi/vim 章节的中文经典
- 📝 巩固练习：[01-基础篇练习](../../exercises/01-基础篇练习.md)
