# 第 4 章 · awk 文本分析

> 📍 位置：阶段 2 · 进阶篇 · 第 4 章 ｜ ⏱ 预计用时：45 分钟 ｜ 难度：★★★☆☆
>
> ⬅️ 上一章：[03-sed流编辑器](03-sed流编辑器.md) ｜ ➡️ 下一章：[05-Bash脚本编程](05-Bash脚本编程.md)

grep 管筛选，sed 管修改，到了 awk（以三位发明人 Aho、Weinberger、Kernighan 姓氏首字母命名）这里，文本终于变成了**有结构的数据**：它自动按列切分、带变量、能算术、有数组和循环——一门专注"按列分析文本"的小型编程语言。

## 🎯 学习目标

学完本章，你将能够：

- 写出 awk 的语法骨架 `awk '模式{动作}'`，并解释"省略模式"与"省略动作"时分别发生什么；
- 熟练使用 `$0`、`$1`、`$NF` 与内建变量 `NR`、`NF`、`FS`（含 `-F` 选项）；
- 用 `printf` 输出对齐美观的格式化结果，用 `BEGIN`/`END` 块补齐报表头尾；
- 用条件、正则、比较运算符过滤行，用关联数组完成词频与 IP 计数；
- 使用 `sub`、`gsub`、`length` 等内建函数；
- 独立完成三个实战：磁盘占用 Top、解析 `/etc/passwd`、生成简易报表。

## 🧠 核心概念


![awk原理动画](../../assets/animations/awk-aggregation.svg)

[在学习站暂停、单步或重播](https://zhuguang-zfg.github.io/linux/#animation=awk-aggregation.svg)。动画中的输入输出为教学示意，需用本章实验验证。
### 4.1 语法骨架：模式{动作}

```bash
awk '模式{动作}' 文件...
```

awk 逐行读入文件，**每行**执行一次判断：模式成立就执行动作。两个省略规则要刻进肌肉记忆：

- 省略模式 → **每行都执行**动作：`awk '{print $1}'`；
- 省略动作 → 打印整行：`awk '/root/'`（像极了 grep）。

### 4.2 字段与内建变量

awk 默认按**连续空白**切分每行（这一点比 `cut -d` 聪明），切出的片段叫字段（Field）：

| 写法 | 含义 | 记忆法 |
|---|---|---|
| `$0` | 整行 | zero = 一行都没切 |
| `$1` `$2` … | 第 1、2 … 个字段 | 面向 1 计数 |
| `$NF` | 最后一个字段 | NF 是字段总数，取它自己 |
| `NF` | 当前行字段个数 | `NF==0` 即空行 |
| `NR` | 当前行号（全局累计） | Number of Record |
| `FS` | 输入字段分隔符 | 命令行用 `-F:` 等价设置 |
| `OFS` | 输出字段分隔符 | print 时逗号连接的字段用它分隔 |

```bash
echo "alice  90  math" | awk '{print $1, $NF}'    # 字段引用
awk -F: '{print NR, $1}' /etc/passwd              # -F 指定冒号分隔
```

> 📌 注记：Ubuntu 22.04 默认的 awk 实现是 mawk；`sudo apt install gawk` 可换装 GNU awk。本章内容两者皆兼容，个别 gawk 扩展函数会在用到时标注。

### 4.3 三剑客分工

```mermaid
flowchart LR
    T["原始文本流"] --> G["grep<br/>过滤：决定哪些行留下"]
    G --> S["sed<br/>编辑：对行做替换增删"]
    S --> A["awk<br/>分析：按字段统计、计算、出报表"]
    A --> O["最终结果"]
```

三者职责常被总结为：**grep 找行、sed 改行、awk 切列**。实际工作中经常像上图一样串联，也常常各自单干。

## 🛠 命令实操

> 以下命令可直接复制运行（Ubuntu 22.04 / Debian 12 验证通过）。

### printf：对齐的报表感

`print` 用逗号拼接、默认不对齐；`printf` 按格式化占位符输出，跟 C 语言同款：

```bash
awk -F: '{printf "%-14s UID=%-4s SHELL=%s\n", $1, $3, $7}' /etc/passwd | head -3
```

```text
root           UID=0    SHELL=/bin/bash
daemon         UID=1    SHELL=/usr/sbin/nologin
bin            UID=2    SHELL=/usr/sbin/nologin
```

`%-14s` 左对齐占 14 列（无 `-` 则右对齐），`%4d` 整数占 4 列，`\n` 别忘写。

### BEGIN / END：开头与收尾

`BEGIN` 块在读入第一行**之前**执行（常用于打印表头、初始化变量），`END` 块在所有行处理完**之后**执行（常用于打印汇总）：

```bash
awk 'BEGIN{print "=== 用户清单 ==="} {n++} END{print "共", n, "个账户"}' /etc/passwd
```

```text
=== 用户清单 ===
共 36 个账户
```

中间孤零零的 `{n++}` 是"省略模式的动作"，每行计数一次——数行数就这么简单。

### 条件过滤与正则

```bash
awk -F: '$3 >= 1000 {print $1}' /etc/passwd          # UID>=1000 的普通用户
awk -F: '$7 ~ /bash$/ {print $1}' /etc/passwd        # 第 7 字段以 bash 结尾
awk -F: '$1=="root" || $1=="daemon" {print NR, $1}' /etc/passwd
awk 'NF == 0 {blank++} END{print "空行数:", blank}' /etc/ssh/sshd_config
```

`~` 表示"该字段匹配正则"，`!~` 为不匹配；比较运算符 `== != > <` 直接可用，字符串、数字都能比。

### 关联数组：一行代码做统计

awk 的数组下标可以是**任意字符串**（关联数组，类似 Python 字典），统计类任务因此只需要"一个数组 + 一个 END 块"：

```bash
# 词频统计（复用第 1 章实验 2 的 fruits.txt）
awk '{for(i=1;i<=NF;i++) cnt[$i]++} END{for(w in cnt) print cnt[w], w}' fruits.txt
```

```text
3 apple
3 banana
2 cherry
```

```bash
# IP 计数（日志场景，接第 2 章）
grep "Failed password" /var/log/auth.log \
  | grep -oE "([0-9]{1,3}\.){3}[0-9]{1,3}" \
  | awk '{cnt[$1]++} END{for(ip in cnt) print cnt[ip], ip}' \
  | sort -nr | head -3
```

注意：`END` 里 `for (w in cnt)` 的遍历顺序**不保证有序**，所以最后仍用 `sort -nr` 排名——awk 管统计，sort 管排序，各司其职。

### 内建函数：sub / gsub / length

```bash
echo "a-b-c" | awk '{gsub(/-/, "_"); print}'         # a_b_c（全量替换，返回次数）
echo "a-b-c" | awk '{sub(/-/, "_"); print}'          # a_b-c（只替换第一处）
echo "hello"  | awk '{print length($0)}'             # 5
awk -F: '{print toupper($1)}' /etc/passwd | head -1  # ROOT
```

`gsub(/re/, "新", 变量)` 第三个参数可指定只处理某字段，默认处理 `$0`。

### 实战三连

#### 实战一：统计磁盘占用 Top 5

```bash
du -k --max-depth=1 /home 2>/dev/null | sort -nr | head -5 \
  | awk '{printf "%8.1f MB  %s\n", $1/1024, $2}'
```

```text
  1024.0 MB  /home/zhugu
   512.0 MB  /home/ubuntu
   256.0 MB  /home/test
    64.0 MB  /home/guest
    12.5 MB  /home/backup
```

`%8.1f` 让小数右对齐占 8 列，KB 手动除以 1024 转 MB——awk 出报表的舒服之处就在这种"临门一脚的格式化"。

#### 实战二：解析 /etc/passwd

一次输出可登录用户清单 + 各 shell 分布：

```bash
awk -F: 'BEGIN{printf "%-14s %-8s %s\n", "USER", "UID", "SHELL"}
         $7 !~ /(nologin|false)$/ {printf "%-14s %-8s %s\n", $1, $3, $7; shell[$7]++}
         END{print "--- shell 分布 ---"; for(s in shell) print s, shell[s]}' \
  /etc/passwd
```

```text
USER           UID      SHELL
root           0        /bin/bash
zhugu          1000     /bin/bash
--- shell 分布 ---
/bin/bash 2
/bin/sync 1
```

#### 实战三：生成简易销售报表

准备 `sales.txt`（姓名 金额 两列）：

```text
alice 120
bob   80
alice 60
carol 200
bob   40
```

一条 awk 汇总每人小计与总金额：

```bash
awk '{sum[$1]+=$2; total+=$2}
     END{for(p in sum) printf "%-8s %6d\n", p, sum[p];
         printf "-------- ------\n合计      %d\n", total}' sales.txt
```

```text
alice       180
bob         120
carol       200
-------- ------
合计      500
```

`sum[$1]+=$2` 是整个 awk 精华的浓缩：按姓名累加金额，一行完成分组求和。

## 💡 避坑指南

1. **永远用单引号包 awk 脚本**。双引号里 `$1` 会被 shell 先展开成空字符串，awk 收到的是残缺脚本——这是 awk 新手第一大坑。
2. **想在 awk 里用 shell 变量**，走 `-v` 通道：`awk -v limit="$LIMIT" '$2 > limit' file`，不要在双引号里硬拼字符串。
3. **NR 与 NF 别搞混**：NR 是行号（第几行），NF 是当前行的字段个数（几列）。
4. **数组遍历无序**。需要顺序就先输出再 `sort`，或使用 gawk 扩展（如 `asorti`，mawk 不支持）。
5. **空字段与多余分隔符**：`-F` 后分隔符连续出现会产生空字段（如 `-F:` 遇 `a::b` 得到 `$2=""`），判断字段前先想到这点。
6. **数字还是字符串？** awk 会自动转换，但 `$1 > 9` 与 `"$1" > "9"` 结果可能不同（字符串按字典序比较）。从日志里取数字做比较时，加 `+0` 强制转数字最稳：`($2+0) > 100`。

## ✍️ 动手实验

### 实验 1：shell 分布调查

用一条 awk 命令统计 `/etc/passwd` 中每种 shell 出现的次数，按次数从高到低输出（awk 只负责计数，排序交给 sort）。

<details>
<summary>💡 参考解法（先自己试！）</summary>

```bash
awk -F: '{shell[$7]++} END{for(s in shell) print shell[s], s}' /etc/passwd \
  | sort -nr
```

```text
27 /usr/sbin/nologin
 6 /bin/bash
 2 /usr/bin/false
 1 /bin/sync
```

对照第 1 章的 `cut -d: -f7 | sort | uniq -c | sort -nr`——同一件事，awk 把"去重计数"三件套压缩成了数组一行。
</details>

### 实验 2：给自己的销售报表加料

在实战三的 `sales.txt` 上继续：输出**平均订单金额**与**最大单笔订单**（含下单人姓名）。

<details>
<summary>💡 参考解法（先自己试！）</summary>

```bash
awk 'NR==1{max=$2; mp=$1}
     {total+=$2; n++; if($2>max){max=$2; mp=$1}}
     END{printf "订单数: %d\n总金额: %d\n平均值: %.1f\n最大单: %s %d\n",
         n, total, total/n, mp, max}' sales.txt
```

```text
订单数: 5
总金额: 500
平均值: 100.0
最大单: carol 200
```

`if($2>max){...}` 也可以压成条件式 `max = ($2>max ? $2 : max)`——三目运算符 awk 同样支持。
</details>

## 📺 推荐视频

- [YouTube · awk 文本分析](https://www.youtube.com/watch?v=oPEnvuj9QrI) — Learn Linux TV，16分7秒。观看对应主题后，回到本章用实际输入和输出验证。

[![awk 文本分析 视频封面](https://i.ytimg.com/vi/oPEnvuj9QrI/hqdefault.jpg)](https://www.youtube.com/watch?v=oPEnvuj9QrI)

[在学习站查看配套媒体](https://zhuguang-zfg.github.io/linux/#read=docs%2F02-advanced%2F04-awk%E6%96%87%E6%9C%AC%E5%88%86%E6%9E%90.md) · [视频资料与核验说明](../../resources/videos.md)。标题、作者和分P已核对，未逐条完成实播，播放限制以原站为准。

## ✅ 自测清单

- [ ] 能解释 `awk '{print $1}'` 与 `awk '/root/'` 各省略了什么、行为如何
- [ ] 能说出 `$0`、`$1`、`$NF`、`NR`、`NF` 的含义并用一句话记忆
- [ ] 会用 `-F:` 处理冒号分隔的文件，并知道默认分隔符是什么
- [ ] 能用 printf 输出左对齐、固定列宽的两列表格
- [ ] 能说出 BEGIN 与 END 块的执行时机
- [ ] 能用关联数组写出"分组计数"与"分组求和"模板
- [ ] 知道 sub 与 gsub 的区别，以及为什么 END 遍历数组后还要 sort
- [ ] 知道 awk 脚本必须用单引号包住的原因

## 🔗 延伸阅读

- GNU awk 官方手册（awk 的"字典"）：[GNU gawk manual](https://www.gnu.org/software/gawk/manual/gawk.html)
- gawk 手册首页：[gnu.org/software/gawk/manual](https://www.gnu.org/software/gawk/manual/)
- gawk 手册页：[gawk(1)](https://man7.org/linux/man-pages/man1/gawk.1.html)
- 📝 章节练习：[02-进阶篇练习](../../exercises/02-进阶篇练习.md)
- ⏭ 工具攒够了，开始组装成脚本：[05-Bash脚本编程](05-Bash脚本编程.md)
