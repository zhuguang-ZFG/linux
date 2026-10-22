# 机制精讲 M13 · free 还有内存，进程为什么还是被杀了

> 页缓存、OOM killer 打分与 cgroup 限额

- **对应章节**：[高级篇 · 第 1 章](../../docs/03-pro/01-性能观测与调优.md)
- **成片**：`video-out/lectures/oom/oom-wide.mp4`（05:56）
- **字幕**：`video-out/lectures/oom/oom.srt`；**分段**：`video-out/lectures/oom/chapters.txt`
- **讲稿源**：`scripts/video/lectures/oom.json`；重新生成：`node scripts/video/produce-lecture.mjs oom`
- **一句话结论**：**内存分两种：能还的，和不能还的**

## 时间轴

| 时间 | 小节 | 画面类型 |
|---|---|---|
| 00:00 | free 还有内存，进程为什么还是被杀了 | 标题 |
| 00:23 | free -h 的四列数字，藏着两个真相 | 机制 |
| 00:46 | 读过的文件，先躺在内存里当快取 | 机制 |
| 01:10 | 用三行命令，验证 available 的真相 | 命令 |
| 01:35 | 真没内存时，OOM killer 登场 | 机制 |
| 01:58 | 牺牲者不是随机选的：badness 分数 | 机制 |
| 02:26 | 被杀之后，去哪翻案 | 命令 |
| 02:52 | 容器里更安静：cgroup 先替你挡刀 | 机制 |
| 03:18 | swap：不是垃圾场，是周转仓库 | 机制 |
| 03:43 | 比 available 更早的报警：PSI | 机制 |
| 04:09 | 与其被杀，不如布三道防线 | 对照表 |
| 04:33 | 五个内存坑 | 避坑 |
| 05:02 | 十分钟实验：安全地触发一次 OOM | 命令 |
| 05:26 | 口诀 | 口诀 |
| 05:39 | 合上书，三问 | 自测 |

## 口播稿

> 与成片配音逐字一致；标点按停顿切分，可直接当提词器。

### 00:00 · free 还有内存，进程为什么还是被杀了

*开场 · 一个监控没抓住的现场*

先看一个让无数运维怀疑人生的现场：监控显示内存还有两 G，下一秒，数据库进程没了。没有报错，没有预警，只有一行谁都看不懂的内核日志。内存明明够，进程为什么还是被杀了？答案藏在 free 的数字里，和内核的一位清道夫身上。

画面要点：
- 监控没报警
- 进程说没就没
- 内存分两种：能还的和不能还的

### 00:23 · free -h 的四列数字，藏着两个真相

*读数*

先把 free 减 h 的四列看懂。total 是内存身家，used 是已经用掉的，free 是完全没人住的。关键在第四列 available：内核估算出还能分给新进程多少。used 很高不等于危险，因为里面一大半随时可以让位；available 持续走低，才是真的快没粮了。

画面要点：
- total 是身家，used 是已占
- free 是完全没人用
- available 才是真能用的
- used 高不等于危险

### 00:46 · 读过的文件，先躺在内存里当快取

*页缓存*

谁在占便宜？页缓存。你读过文件、跑过程序，内核就把这些文件页留在内存里，下次读直接命中，磁盘不用再转。内存一紧张，它们立刻让位回收。所以 used 高不是病，是内核在替你攒快取。把 free 当余粮，是从头就量错了。

画面要点：
- 读过的文件页留在内存
- 下次读直接命中
- 内存紧张时让位回收
- 把 free 当余粮，从一开始就量错了

### 01:10 · 用三行命令，验证 available 的真相

*验证*

别光听，动手。free 减 h，盯住 available。再读 proc 下的 meminfo，MemAvailable 就是内核替我们算好的余粮。想亲眼看到缓存让位，sync 之后把 3 写进 drop_caches，free 会立刻变大。注意，这步只是课堂演示，生产环境别乱用。

画面要点：
- free -h 盯住 available
- MemAvailable 是内核的估算
- drop_caches 能演示缓存让位，生产别乱用

```bash
free -h
grep -E 'MemTotal|MemAvailable' /proc/meminfo

sync; echo 3 | sudo tee /proc/sys/vm/drop_caches   # 仅课堂演示
```

### 01:35 · 真没内存时，OOM killer 登场

*清道夫*

那什么时候真被杀？当分配失败、缓存也让无可让，内核必须马上做决定：不杀一个，全机一起僵死。OOM killer 登场，它扫描所有进程，挑一个占用大、又不关键的杀掉，腾出内存。事后只在日志里留一行：Killed process，附进程号和分数。

画面要点：
- 分配失败，缓存也让无可让
- 不杀一个，全机僵死
- OOM killer 挑出牺牲者
- 日志里留下一行 Killed

### 01:58 · 牺牲者不是随机选的：badness 分数

*打分*

挑谁不是随机的。内核给每个进程打一个 badness 分：占用内存越多，分越高，分最高的先出局。这个分可以查：proc 下每个进程都有 oom_score。想保关键进程，就调它的 oom_score_adj，把分往低调。数据库被杀、监控活着，常常就是这张分数表决定的。

画面要点：
- 占用内存越多，分越高
- 分最高的先出局
- oom_score 可查当前分
- oom_score_adj 能手动调分

### 02:26 · 被杀之后，去哪翻案

*取证*

被杀之后怎么翻案？首选 journalctl 减 k 查内核日志，时间戳可信；dmesg 减 T 也行，但机器休眠过时间会漂。过滤 OOM 或 Killed process，能看到杀的是谁、分数多少、当时水位。更聪明的是事前排查：遍历 proc 里的 oom_score，先找出全机分数最高的进程。

画面要点：
- journalctl -k 时间戳最可靠
- dmesg -T 机器休眠过会漂
- 遍历 oom_score 能事前排查

```bash
sudo journalctl -k --since today | grep -i oom
sudo dmesg -T | grep -i 'killed process'

cat /proc/<pid>/oom_score     # 事发前：谁最危险
```

### 02:52 · 容器里更安静：cgroup 先替你挡刀

*容器*

在容器和 systemd 服务里，故事换了一版。cgroup 先给进程组设了上限，比如 MemoryMax 五百 M。组内超限，cgroup 直接组内动刀，宿主机常常毫无感觉。查案要去看 memory.events 里的 oom_kill 计数，或者按单元过滤 journalctl。看不到全局日志，不代表没发生。

画面要点：
- cgroup 给进程组设上限
- 超限先杀组内的
- 宿主机常常无感
- memory.events 记了 oom_kill 笔数

### 03:18 · swap：不是垃圾场，是周转仓库

*交换空间*

常被误解的还有 swap。它不是慢内存，而是周转仓库：内核把不活跃的页挪到磁盘，把宝贵的物理内存让给正在运行的程序。swappiness 决定内核多愿意换出，数据库这类延迟敏感的服务常把它调低。但调低不是清零：完全不要 swap，等于把最后一道缓冲也拆了，OOM 来得更早。

画面要点：
- 换出的是不活跃的页
- swappiness 决定换出倾向
- 数据库常把它调低
- 清零等于拆掉最后的缓冲

### 03:43 · 比 available 更早的报警：PSI

*预警*

最后再给一个进阶观测点：PSI，压力停等信息。读 proc 下 pressure 里的 memory 文件，它把内存压力分成 some 和 full 两档：some 表示有进程在等内存，full 表示所有非空闲任务都被卡住。available 还在降、PSI 已经在报警，这比事后的 OOM 日志早得多。内核四点二零之后的系统都有。

画面要点：
- /proc/pressure/memory 两档指标
- some：有进程在等内存
- full：全员被卡住
- 内核 4.20 之后的系统都有

### 04:09 · 与其被杀，不如布三道防线

*防线*

与其事后翻案，不如布三道防线。第一，报警盯 available，而不是 used。第二，留一块 swap，内核能把不活跃的内存挪出去，OOM 来得更晚。第三，关键机器上 earlyoom 或 systemd 的 oomd，水位一到阈值提前动手，把选择权留给你，而不是留给清道夫。

| 防线 | 做法 | 适用场景 |
|---|---|---|
| 盯住 available | 报警阈值设在 available，不看 used | 所有服务器 |
| 留一块 swap | 不活跃内存有地方可挪 | 桌面、小服务 |
| earlyoom / oomd | 水位到阈值提前动手 | 数据库等关键机 |

### 04:33 · 五个内存坑

*避坑*

五个高频坑。有内存却 OOM，是盯错了 free。数据库总被杀，是 badness 分太高，用 oom_score_adj 保它。容器里进程莫名退出，是 cgroup 安静动刀，查 memory.events。拿 drop_caches 当保洁，只清缓存治不了泄漏。swap 设零看似保性能，其实拆掉了最后的缓冲。

| 现象 | 真正的原因 | 正确做法 |
|---|---|---|
| 有内存却 OOM | 盯的是 free，不是 available | 报警改盯 available |
| 数据库总被杀 | badness 分高，被视为可牺牲 | 调 oom_score_adj 保它 |
| 容器里进程莫名退出 | cgroup 安静动刀，宿主机无日志 | 查 memory.events |
| 拿 drop_caches 当保洁 | 只清缓存，治不了泄漏 | 找到泄漏点再谈清理 |
| swap 设 0 保性能 | 把最后的缓冲也拆了 | 留一块小 swap 更稳 |

### 05:02 · 十分钟实验：安全地触发一次 OOM

*实验*

最后做个安全实验：用 systemd-run 建一个两百 M 的隔离舱，在里面跑一个不停吃内存的 python。涨到上限，cgroup 就把它杀掉，主机和其他进程毫发无损。再去 dmesg 里找 cgroup out of memory 那一行。这套动作，就是生产上排查内存被杀的完整流程。

画面要点：
- 隔离舱上限 200M
- 吃内存进程被杀，主机不受影响
- dmesg 里能找到动刀记录

```bash
sudo systemd-run --scope -p MemoryMax=200M \
  python3 -c 'a=[]; [a.append(b"x"*1048576) for _ in range(500)]'
# 涨到 200M 就被杀，主机毫发无损

sudo dmesg | grep -i 'cgroup out of memory'
```

### 05:26 · 口诀

*记住这一句*

两句话：used 高不是病，available 低才危险；真没内存了，内核先杀分最高的。把这两句刻进手上，内存的案子你就能破。

画面要点：
- used 高不是病，available 低才危险
- 真没内存了，内核先杀分最高的

### 05:39 · 合上书，三问

*自测*

合上书，三问。为什么 used 很高却不用慌？OOM killer 按什么挑牺牲者？容器里进程被杀，又该去哪找日志？答得出来，性能排障这第一关，你就过了。

画面要点：
- 为什么 used 很高却不用慌？
- OOM killer 按什么挑牺牲者？
- 容器里进程被杀，去哪找日志？

## 自测

1. 为什么 used 很高却不用慌？
2. OOM killer 按什么挑牺牲者？
3. 容器里进程被杀，去哪找日志？

做完再回到[本章实验](../../docs/03-pro/01-性能观测与调优.md)，用真实输出对照视频里的示意。

---

成片与封面在 `video-out/`（本地渲染，不入库）；发布信息见同目录 `publish.json`。本文字稿入库，不依赖视频即可校对与检索。
