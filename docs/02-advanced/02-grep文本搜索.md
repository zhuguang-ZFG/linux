# 第 2 章 · grep 文本搜索

> 📍 位置：阶段 2 · 进阶篇 · 第 2 章 ｜ ⏱ 预计用时：45 分钟 ｜ 难度：★★★☆☆
>
> ⬅️ 上一章：[01-管道与重定向](01-管道与重定向.md) ｜ ➡️ 下一章：[03-sed流编辑器](03-sed流编辑器.md)

上一章你学会了"把数据流接起来"，本章开始给流水线装上第一个核心部件：**grep**——文本过滤器。它回答的是运维和开发中最常见的问题："这堆文本里，哪些行是我要的？"日志排查、代码检索、配置定位，全是它的主场。

## 🎯 学习目标

学完本章，你将能够：

- 说出 grep 名字的由来（**g**lobal / **r**egular **e**xpression / **p**rint），并写出它的语法骨架；
- 熟练使用 `-i -v -n -r -c -l -w -A -B -C -E` 十个常用选项；
- 看懂并书写包含锚点、字符组、量词、转义的基础正则表达式（Regular Expression，简称 regex）；
- 用 `--include`、`--exclude-dir` 在目录树里安全高效地搜索代码；
- 把 grep 与 `find`、管道组合，完成一次真实的日志排查。

## 🧠 核心概念

![grep 匹配原理动画](../../assets/animations/grep-regex.svg)

[在学习站暂停、单步或重播](https://zhuguang-zfg.github.io/linux/#animation=grep-regex.svg)。动画中的输入输出为教学示意，需用本章实验验证。

### 2.1 语法骨架

```bash
grep [选项] 模式 [文件...]
```

不给文件时，grep 读取标准输入——这使它天生就是管道的一员：`命令 | grep 关键词`。给的是目录时，必须配合 `-r` 递归，否则会报错提示"这是一个目录"。

grep 的工作方式朴素而高效：逐行读入 → 用模式匹配 → 匹配成功的行打印到 stdout。所以它常被形容为"行级过滤器"。

### 2.2 十个常用选项

| 选项 | 全称 | 作用 | 示例 |
|---|---|---|---|
| `-i` | ignore-case | 忽略大小写 | `grep -i error app.log` |
| `-v` | invert | 反向匹配，输出**不含**模式的行 | `grep -v "^#" config.conf` |
| `-n` | line-number | 显示行号 | `grep -n "Port" sshd_config` |
| `-r` | recursive | 递归搜索目录 | `grep -r "TODO" src/` |
| `-c` | count | 只输出匹配的行数，不输出内容 | `grep -c "Failed" auth.log` |
| `-l` | files-with-matches | 只列出**包含**匹配的文件名 | `grep -rl "import os" .` |
| `-w` | word-regexp | 全词匹配，避免 `err` 匹中 `error` | `grep -w "err" app.log` |
| `-A n` | after | 同时显示匹配行**后** n 行 | `grep -A 2 "panic" dmesg.log` |
| `-B n` | before | 同时显示匹配行**前** n 行 | `grep -B 3 "error" app.log` |
| `-C n` | context | 前后各 n 行（= -A n -B n） | `grep -C 1 "restart" syslog` |

选项可以自由叠加，如 `grep -rn -i "password" .`，这正是管道精神的另一种体现——每个小部件只做一件事。

### 2.3 正则速成：四种积木

正则表达式就是"描述字符串形状的迷你语言"，初学只需掌握四种积木：

| 积木 | 写法 | 含义 | 示例 |
|---|---|---|---|
| 锚点 | `^` / `$` | 行首 / 行尾 | `^Error`、`\.log$` |
| 字符组 | `[abc]` `[0-9]` `[^0-9]` | 组内任一字符 / 范围 / **取反** | `^[A-Z]`、`[0-9]\{4\}` |
| 量词 | `*` `?` `+` `{n,m}` | 0+ 次 / 0-1 次 / 1+ 次 / n 到 m 次 | `ab+c`、`[0-9]{3}` |
| 转义 | `\.` `\*` | 让元字符变回普通字符 | `\.` 匹配真正的点 |

两个必须尽早建立的认知：

1. **默认是 BRE（Basic Regular Expression，基本正则）**：`+`、`?`、`{n,m}`、`|` 这些"扩展积木"需要转义才能用；加 `-E` 切换为 ERE（Extended Regular Expression，扩展正则）即可直接书写，本章一律推荐 `-E`。
2. `grep -F` 把模式当作**固定字符串**，完全绕开正则——搜 `a.b` 时不想匹配 `axb`，就用它，速度也最快。

### 2.4 grep 在流水线中的位置

```mermaid
flowchart LR
    A["文件 / 目录 / 上游命令"] --> B["grep：按模式过滤出需要的行"]
    B --> C["继续交给管道下游<br/>wc / sort / awk …"]
    B --> D["也可以直接输出到屏幕或文件"]
```

## 🛠 命令实操

> 以下命令可直接复制运行（Ubuntu 22.04 / Debian 12 验证通过）。

### 基本用法

```bash
grep "root" /etc/passwd
```

```text
root:x:0:0:root:/root:/bin/bash
```

加 `-n` 看行号，加 `-i` 忽略大小写：

```bash
grep -ni "nameserver" /etc/resolv.conf
```

```text
3:nameserver 8.8.8.8
```

### 上下文抓取：-A / -B / -C

排查问题时，错误行前后的"现场"往往比错误本身更有价值：

```bash
grep -B 2 -A 2 "Failed password" /var/log/auth.log
```

### 递归搜代码：-r 与 --include

在当前目录递归搜索，只要 `.py` 文件，并显示行号：

```bash
grep -rn --include="*.py" "import requests" .
```

```text
./spider/fetch.py:3:import requests
./tests/test_fetch.py:2:import requests
```

反过来排除不需要的目录（性能关键，见下文）：

```bash
grep -rn "TODO" . --exclude-dir={.git,node_modules,dist}
```

（花括号展开是 bash 提供的，等价于写三遍 `--exclude-dir=...`。）

### 与 find 管道组合

find 负责"圈地"（哪些文件），grep 负责"验收"（哪些文件里有目标）：

```bash
find /var/log -name "*.log" -mtime -7 | xargs grep -l "Failed"
```

```text
/var/log/auth.log
/var/log/kern.log
```

文件名可能带空格时，用更稳的 `-print0` / `xargs -0` 组合（上一章避坑第 4 条）：

```bash
find . -name "*.txt" -print0 | xargs -0 grep -l "关键词"
```

### 性能提示：大目录搜索的三个习惯

1. **永远排除垃圾目录**：`.git`、`node_modules`、`dist`、`venv` 动辄数万文件，`--exclude-dir` 能快一个数量级；
2. **知道格式就用 `-F`**：固定字符串不走正则引擎，又快又不会误伤；
3. **先用 find 缩小范围再 grep**：比如先按 `-name "*.log"` 和 `-mtime` 过滤，别让 grep 在二进制文件上浪费时间。

### 真实场景：SSH 日志排查五连

服务器疑似被暴力破解，一步步用 grep 拿到证据（`/var/log/auth.log` 需 sudo 读取，示例 IP 为文档保留地址）：

```bash
# 1. 有没有失败记录？先看 5 条感受一下格式
sudo grep "Failed password" /var/log/auth.log | head -5

# 2. 总共失败多少次？
sudo grep -c "Failed password" /var/log/auth.log

# 3. 用 -oE 把所有 IP 提取出来，配合上一章的 Top N 模板找出攻击源
sudo grep "Failed password" /var/log/auth.log \
  | grep -oE "([0-9]{1,3}\.){3}[0-9]{1,3}" \
  | sort | uniq -c | sort -nr | head -5

# 4. 盯住头号攻击 IP，看它前后各 1 行的完整行为
sudo grep "203.0.113.7" /var/log/auth.log -C 1 | less

# 5. 反向排查：除了失败记录，它有没有成功登录过？
sudo grep "203.0.113.7" /var/log/auth.log | grep -v "Failed"
```

第 3 步的典型输出：

```text
    842 203.0.113.7
     61 198.51.100.23
     12 192.0.2.44
      3 192.0.2.19
      1 192.0.2.201
```

一条流水线走完"过滤 → 提取 → 统计 → 排序 → 取前 N"，这就是第 1 章的模板在实战中的样子。

## 💡 避坑指南

1. **模式一定加引号**。`grep 192.168.1.1 file` 里的点会被 shell 当普通字符、被 grep 当"任意字符"双关；`grep Failed password file` 更是直接把 `password` 当成了文件名。引号包起来，一劳永逸。
2. **`binary file matches`**。grep 碰到二进制文件时只报这句而不给内容。确认要文本化处理可加 `-a`；更好的做法是上游用 find 圈定纯文本。
3. **正则是贪婪的**。`grep -oE ".*:" file` 会一直吃到**最后一个**冒号而不是最近的，提取字段时容易抓多。少用 `.*`，多用字符组如 `[^:]*`。
4. **BRE / ERE 混淆**。`grep "a+b"` 匹配不到 `aab`——BRE 里 `+` 是普通字符。要么 `grep -E "a+b"`，要么写成 `aa*b`。遇到"正则明明对却搜不到"，先怀疑这个。
5. **`-w` 不等于 `-x`**。`-w` 是整词匹配（词边界），`-x` 是整行匹配，别混。
6. **别在 `/`、`/proc`、`/sys` 上裸跑 `-r`**。轻则慢到怀疑人生，重则刷屏报错。要搜系统级内容，交给 find 圈好范围。

## ✍️ 动手实验

### 实验 1：代码库体检

在当前目录（没有代码就在 `/etc` 练手）完成三个任务：① 找出所有包含 `TODO` 的行及行号；② 只统计 `*.conf` 文件里出现 `TODO` 的总行数；③ 列出**不**包含 `TODO` 的 `.conf` 文件（提示：`-L` 是 `-l` 的反向版）。

<details>
<summary>💡 参考解法（先自己试！）</summary>

```bash
# ①
grep -rn --include="*.conf" "TODO" .
# ②
grep -rc --include="*.conf" "TODO" . | awk -F: '{s+=$2} END{print s}'
# ③
grep -rL --include="*.conf" "TODO" .
```

②用到了第 4 章的 awk，先用 `grep -rc ... | grep -v ":0"` 粗看每个文件的计数也可以。
</details>

### 实验 2：构造日志并排查

创建 `fake.log`（内容如下），用一条管道找出**失败次数最多的用户名**及次数：

```text
Oct  6 09:01:01 srv sshd[801]: Failed password for root from 203.0.113.7 port 55001
Oct  6 09:01:05 srv sshd[802]: Failed password for admin from 203.0.113.7 port 55002
Oct  6 09:01:09 srv sshd[803]: Failed password for root from 198.51.100.9 port 55003
Oct  6 09:01:15 srv sshd[804]: Accepted password for ubuntu from 192.0.2.8 port 55004
Oct  6 09:02:01 srv sshd[805]: Failed password for root from 203.0.113.7 port 55005
```

<details>
<summary>💡 参考解法（先自己试！）</summary>

```bash
grep "Failed password for" fake.log | awk '{print $8}' | sort | uniq -c | sort -nr
```

```text
      3 root
      1 admin
```

注意：`Failed password for root` 和 `Failed password for invalid user xxx` 两种格式里用户名字段位置不同，真实日志需要先 grep 看清格式再决定取第几列——先观察、后提取，是日志分析的铁律。
</details>

## 📺 推荐视频

- [B站 · find 与 grep](https://www.bilibili.com/video/BV1w4411B7a4/?p=12) — 韦东山，P12，7分21秒。观看对应主题后，回到本章用实际输入和输出验证。

[![find 与 grep 视频封面](https://i2.hdslb.com/bfs/archive/b2e859711cde6a85b2720841cf7c5d931b9a2614.jpg)](https://www.bilibili.com/video/BV1w4411B7a4/?p=12)

[在学习站查看配套媒体](https://zhuguang-zfg.github.io/linux/#read=docs%2F02-advanced%2F02-grep%E6%96%87%E6%9C%AC%E6%90%9C%E7%B4%A2.md) · [视频资料与核验说明](../../resources/videos.md)。标题、作者和分P已核对，未逐条完成实播，播放限制以原站为准。

## ✅ 自测清单

- [ ] 能写出 grep 的语法骨架，并解释不给文件时它从哪里读数据
- [ ] 能说出 `-i -v -n -r -c -l` 各自的作用
- [ ] 能用 `-A -B -C` 抓取匹配行的上下文
- [ ] 能写出包含锚点、字符组、量词的正则，并知道 `\. ` 为什么要点前加反斜杠
- [ ] 知道 `-E` 与 `-F` 的区别，以及"搜不到"时先检查哪一个
- [ ] 会用 `--include` 限定文件类型、`--exclude-dir` 排除 `.git` 与 `node_modules`
- [ ] 能独立完成"日志 → 提取 IP → Top N"的完整流水线

## 🔗 延伸阅读

- grep 手册（选项最全的权威出处）：[grep(1)](https://man7.org/linux/man-pages/man1/grep.1.html)
- Arch Wiki 对 grep/sed/awk 的对比速查：[Core utilities](https://wiki.archlinux.org/title/Core_utilities)
- TLDP《Bash Beginners Guide》文本过滤章节：[Bash-Beginners-Guide](https://tldp.org/LDP/Bash-Beginners-Guide/html/)
- 📝 章节练习：[02-进阶篇练习](../../exercises/02-进阶篇练习.md)
- ⏭ 下一章把"过滤"升级为"修改"：[03-sed流编辑器](03-sed流编辑器.md)
