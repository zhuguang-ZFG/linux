# 机制精讲 M07 · 明明装好了，为什么还说 command not found

> Shell 不搜全盘：PATH 清单、export 继承与配置加载顺序

- **对应章节**：[基础篇 · 第 7 章](../../docs/01-basics/07-环境变量与PATH.md)
- **成片**：`video-out/lectures/path/path-wide.mp4`（06:07）
- **字幕**：`video-out/lectures/path/path.srt`；**分段**：`video-out/lectures/path/chapters.txt`
- **讲稿源**：`scripts/video/lectures/path.json`；重新生成：`node scripts/video/produce-lecture.mjs path`
- **一句话结论**：**它不是没装，是没找着**

## 时间轴

| 时间 | 小节 | 画面类型 |
|---|---|---|
| 00:00 | 明明装好了，为什么还说 command not found | 标题 |
| 00:21 | Shell 不搜全盘，只按清单从左到右 | 机制 |
| 00:45 | 三条命令，先看它到底在哪找 | 命令 |
| 01:09 | 同一份清单，三种不同的结果 | 对照表 |
| 01:35 | export 决定这个变量给不给孩子 | 机制 |
| 01:58 | 普通变量和环境变量，各问一次 | 命令 |
| 02:25 | 配置文件有加载顺序，写错地方等于没写 | 机制 |
| 02:55 | 追加 PATH 的正确姿势 | 命令 |
| 03:24 | Shell 还会记路：hash 缓存 | 机制 |
| 03:47 | command not found 的决策顺序 | 对照表 |
| 04:18 | 五个把 PATH 玩坏的动作 | 避坑 |
| 04:49 | PATH 也是攻击面 | 机制 |
| 05:13 | 给自己造一个 bin 工具箱 | 命令 |
| 05:35 | 口诀 | 口诀 |
| 05:47 | 合上书，三问 | 自测 |

## 口播稿

> 与成片配音逐字一致；标点按停顿切分，可直接当提词器。

### 00:00 · 明明装好了，为什么还说 command not found

*开场 · 一句最常见的报错*

command not found。这大概是 Linux 上最常见、也最容易误判的一句报错。程序明明装好了，敲下去却说找不到。多数时候不是没装，是没找着。因为 Shell 根本不搜全盘，它只照一张清单挨个找，这张清单就是 PATH。

画面要点：
- 不是没装，是没找着
- Shell 只照一张清单找人
- 清单叫 PATH

### 00:21 · Shell 不搜全盘，只按清单从左到右

*机制*

PATH 本质上是一串目录，用冒号隔开。你敲一个不带斜杠的命令，Shell 就按顺序从左到右，在每个目录里找同名可执行文件，找到第一个就用，后面的不再看。所以同名命令谁排在前面谁赢。而你写斜杠 tmp 斜杠脚本，是明确给了路径，Shell 就不翻清单了。

画面要点：
- PATH 是一串用冒号分隔的目录
- 从左到右，找到第一个就用
- 同名命令，谁在前面谁赢
- 带斜杠才按路径走，否则只翻清单

### 00:45 · 三条命令，先看它到底在哪找

*看清清单*

先看清单本身。echo 美元符号 PATH，一串目录就出来了。which 告诉你最终命中的是哪一个，type 减 a 更彻底，会把所有同名候选、别名和函数都列出来。注意，当前目录默认不在 PATH 里，所以自己的脚本要写点斜杠。这不是麻烦，是安全设计。

画面要点：
- echo $PATH：看清单
- which：看最终命中哪一个
- type -a：看全部候选与别名
- 当前目录 . 默认不在清单里，这是安全设计

```bash
echo $PATH
# /usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

which ls        # /usr/bin/ls
type -a ls      # 把所有同名候选都列出来

./script.sh     # 带斜杠：不走 PATH
```

### 01:09 · 同一份清单，三种不同的结果

*优先级*

把四种情况摆在一起。敲 ls，Shell 沿 PATH 从左到右找。敲带完整路径的 run，直接按路径执行，压根不查清单。敲点斜杠 run 点 sh，执行当前目录这个文件，前提是它有执行权限。而只敲 run，Shell 只在 PATH 里找，当前目录就算有，也不会执行。

| 你敲的命令 | Shell 怎么找 | 结果 |
|---|---|---|
| ls | 沿 PATH 从左到右 | 命中第一个 /usr/bin/ls |
| /opt/tool/bin/run | 按给定路径直接执行 | 不查 PATH |
| ./run.sh | 当前目录下的 run.sh | 必须有 x 权限 |
| run | 只在 PATH 里找 | 当前目录有也不执行 |

### 01:35 · export 决定这个变量给不给孩子

*继承*

接下来是环境变量这个词里的环境。你赋一个普通变量，它只活在当前 Shell。加 export，它才进入环境，被之后启动的子进程继承。注意方向是单向的：子进程里改得再热闹，也不会回头改变父进程。想让变量常驻，就得写进启动配置文件。

画面要点：
- 普通变量：只在当前 Shell 里
- export 之后：子进程能继承
- 子进程改了，不回头影响父进程
- 想常驻，写进配置文件

### 01:58 · 普通变量和环境变量，各问一次

*亲手验证*

别背概念，做个实验。name 不 export，CITY 加 export。分别到子 Shell 里查岗：name 是空的，CITY 有值。这就叫继承。注意 bash 减 c 后面要用单引号，否则变量在当前 Shell 就先展开了，实验等于白做。最后 printenv 能看到 CITY，说明它真的在环境里。

画面要点：
- 没 export 的 name，子进程看不见
- export 过的 CITY，子进程看得见
- bash -c 用单引号，取值推迟到子进程

```bash
name="alice"
export CITY="Beijing"

bash -c 'echo "name=$name"'   # name=
bash -c 'echo "CITY=$CITY"'   # CITY=Beijing

printenv | grep CITY
```

### 02:25 · 配置文件有加载顺序，写错地方等于没写

*永久生效*

为什么改了配置不生效？因为配置文件分场合加载。登录 Shell，比如 tty 或 ssh 登录，会依次读 etc 下的 profile、你的点 profile，再在 Ubuntu 上引用点 bashrc。而你在图形终端里新开一个交互 Shell，通常只读点 bashrc，不读 profile。所以个人变量写点 bashrc 最稳。改完记得 source，已经开着的终端不会自己重读。

画面要点：
- 登录 Shell：/etc/profile → ~/.profile → ~/.bashrc
- 非登录交互 Shell：只读 ~/.bashrc
- /etc/profile.d/*.sh 是全局变量的干净入口
- 改完要 source，已开的终端不会自动重读

### 02:55 · 追加 PATH 的正确姿势

*写对地方*

追加 PATH 只有一个正确姿势：新值等于原有的 PATH 加冒号加新目录。写成 PATH 等于新目录，是覆盖，等于把系统命令全踢出清单，ls 都会失明。永久生效写到点 bashrc。系统级别直接改 etc profile，放到 profile 点 d 目录更干净。用 sudo tee 而不是重定向，因为重定向是当前 Shell 执行的，sudo 管不到。

画面要点：
- 永远保留 $PATH，否则系统命令全失明
- 系统级用 profile.d，不改 /etc/profile
- tee 而不是 >，因为 sudo 重定向由当前 Shell 执行

```bash
# 追加，不是覆盖
export PATH="$PATH:$HOME/bin"

# 永久写入
echo 'export PATH="$PATH:$HOME/bin"' >> ~/.bashrc
source ~/.bashrc

# 系统级（所有用户）
echo 'export PATH="$PATH:/opt/tool/bin"' | sudo tee /etc/profile.d/tool.sh
```

### 03:24 · Shell 还会记路：hash 缓存

*缓存*

还有一个很多人不知道的层：hash 缓存。Shell 找到一条命令后，会把路径记下来，下次直接用。这在平时是加速，在排查时是陷阱：你装了新版本、或者把旧路径删了，Shell 可能还拿着旧地址。hash 减 r 清空缓存，再敲一次，让它重新找。

画面要点：
- 命中过的命令路径会被记住
- 换了新版本或挪了目录，可能还指向旧的
- hash -r 清空缓存，重新找
- type -a 同时看缓存与候选

### 03:47 · command not found 的决策顺序

*三步排查*

把排查顺序固定下来。第一，拼错没有，用 Tab 补全。第二，装了没有，which 找不到多半是没装。第三，装了但目录不在 PATH 里。第四，刚换过版本，先 hash 减 r。第五，同一条命令终端能用、脚本不能用，多半是别名，脚本里请写命令全名。按这个顺序，九成的 not found 三十秒能定位。

| 先问 | 命令 | 结论 |
|---|---|---|
| 拼错了吗 | Tab 补全 | 别手打长命令 |
| 装了吗 | apt search / which | 找不到多半没装 |
| 在清单里吗 | echo $PATH | 装了但目录没进 PATH |
| 刚换过版本吗 | hash -r | 缓存指向旧路径 |
| 脚本里能用吗 | type -a / command -v | 脚本看不到终端 alias |

### 04:18 · 五个把 PATH 玩坏的动作

*避坑*

五个高频坑。第一，PATH 直接赋新值，覆盖了系统清单。第二，export 等号两边加空格，Shell 把它当命令。第三，变量没 export，脚本里当然是空。第四，改了配置不 source，老终端不会重读。第五，把密码写进 bashrc，配置文件最容易被截图和提交。每个坑都不难，难的是出事时想不起它。

| 现象 | 真正的原因 | 正确做法 |
|---|---|---|
| PATH=/home/me/bin | 覆盖而不是追加，系统命令全失效 | PATH="$PATH:/home/me/bin" |
| export CITY = "Beijing" | 等号两边有空格，被当成命令 | 等号两边不留空格 |
| 脚本里变量是空 | 忘了 export，子进程不继承 | 需要传下去就 export |
| 改了 .bashrc 没反应 | 已开的终端不重读 | source ~/.bashrc |
| 把密码写进 .bashrc | 配置文件会被截图、进仓库 | 密钥放专用工具或不入库文件 |

### 04:49 · PATH 也是攻击面

*安全*

PATH 不只是方便，它还是攻击面。把点放进 PATH，等于让当前目录里的任何同名文件抢先执行，你解压一个陌生压缩包，就可能中招。sudo 默认使用自己的 secure_path，不继承你的 PATH，就是为了防这个。原则很简单：可写目录不要放在系统目录前面。

画面要点：
- 把 . 放进 PATH，等于让当前目录抢先
- 下载的压缩包里可能有同名命令
- sudo 默认用 secure_path，不吃你的 PATH
- 别把可写目录放在系统目录前面

### 05:13 · 给自己造一个 bin 工具箱

*实验*

最后一个实验，把今天的东西串起来。建一个家目录下的 bin，写一个两行脚本 hello，加执行位，把目录追加进 PATH。然后换到 tmp 目录，敲 hello。目录进 PATH 只解决找得到，chmod 加 x 才解决能执行，两个条件缺一不可。

画面要点：
- 目录进 PATH 只解决找得到
- chmod +x 才解决能执行
- 两个条件缺一不可

```bash
mkdir -p ~/bin
printf '#!/bin/bash\necho hello, $USER\n' > ~/bin/hello
chmod +x ~/bin/hello
export PATH="$PATH:$HOME/bin"
cd /tmp && hello        # hello, alice
```

### 05:35 · 口诀

*记住这一句*

两句口诀：找不到命令，先问它在哪找；追加 PATH，永远记得带上原来的 PATH。把这两句记住，command not found 就不再是玄学。

画面要点：
- 找不到命令，先问它在哪找
- 追加记得带上 $PATH

### 05:47 · 合上书，三问

*自测*

合上书，三问。当前目录为什么默认不在 PATH 里？export 和不 export，到底差在哪一步？登录 Shell 和普通交互 Shell，读的配置文件有什么不同？答得出来，下一章我们把这些变量真正用起来。

画面要点：
- 为什么当前目录默认不在 PATH 里？
- export 与不 export，差在哪一步？
- 登录 Shell 和交互 Shell 读的配置文件有什么不同？

## 自测

1. 为什么当前目录默认不在 PATH 里？
2. export 与不 export，差在哪一步？
3. 登录 Shell 和交互 Shell 读的配置文件有什么不同？

做完再回到[本章实验](../../docs/01-basics/07-环境变量与PATH.md)，用真实输出对照视频里的示意。

---

成片与封面在 `video-out/`（本地渲染，不入库）；发布信息见同目录 `publish.json`。本文字稿入库，不依赖视频即可校对与检索。
