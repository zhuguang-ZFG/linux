"""Additional teaching scenes: state snapshots are illustrative, not captured production logs."""
EXTRA_SCENES = [
    ("git-branches", "Git 分支：提交怎样进入主线", "分支名指向提交；合并前先看清两条历史", [
        ("01 共同起点", "main → A", "工作区干净", "先确认当前分支"),
        ("02 分支改进", "feature → A—B", "新增一次独立提交", "main 仍停在 A"),
        ("03 回到主线", "git switch main", "工作区切到主线版本", "并非删除分支提交"),
        ("04 快进合并", "merge --ff-only", "main 前移到 B", "分叉时会拒绝快进")
    ], "动手：在独立 Git 练习仓库里比较 switch 前后的 log 与文件。", "这里演示快进合并；存在分叉时必须先理解冲突和历史。",
    [["main: A", "feature: 尚未创建"], ["main: A", "feature: A → B（新增磁盘笔记）"], ["当前分支: main", "notes.md 暂时没有 B 中的新内容"], ["main: A → B", "提交未丢失，工作区包含改进后的笔记"]], "docs/02-advanced/09-Git与学习笔记协作.md"),
    ("stdout-stderr", "重定向顺序：两个输出去哪里", "从左到右更新文件描述符，先后次序会改变结果", [
        ("01 初始状态", "stdout=1 / stderr=2", "两个通道都指向终端", "它们可以独立重定向"),
        ("02 改标准输出", "> out.log", "fd 1 指向日志文件", "fd 2 仍指向终端"),
        ("03 复制指向", "2>&1", "fd 2 复制 fd 1 的目标", "此时都写进日志"),
        ("04 对照反序", "2>&1 > out.log", "先复制的是旧目标", "错误仍可能到终端")
    ], "动手：用 printf 分别向 stdout/stderr 写文字，交换重定向顺序。", "最后一步是另一条独立命令的对照，不是给前一命令继续追加操作。",
    [["fd 1 → terminal", "fd 2 → terminal"], ["fd 1 → out.log", "fd 2 → terminal"], ["cmd > out.log 2>&1", "stdout + stderr → out.log"], ["cmd 2>&1 > out.log", "stdout → out.log；stderr → terminal"]], "docs/02-advanced/01-管道与重定向.md"),
    ("sed-replace", "sed：匹配、替换，再保留原件", "文本模式与文件参数分别处理，不把文件名按空格拆开", [
        ("01 读取原文", "listen 8080;", "原文件仍在磁盘上", "先看不写盘的结果"),
        ("02 匹配模式", "s/8080/9090/g", "找出匹配字符串", "g 表示每行全部匹配"),
        ("03 查看输出", "listen 9090;", "默认只输出到终端", "没有修改原文件"),
        ("04 保存与备份", "sed -i.bak", "确认后才原地修改", "先确认旧 .bak 不冲突")
    ], "动手：对带空格的 .conf 文件做替换，再比较文件与 .bak。", "sed 模式需要边界；贪婪的 .* 可能吞掉你想保留的前缀。",
    [["input:  listen 8080;", "disk:   listen 8080;"], ["pattern: 8080", "replacement: 9090"], ["stdout: listen 9090;", "disk:   listen 8080;（仍未修改）"], ["config.conf:     listen 9090;", "config.conf.bak: listen 8080;"]], "docs/02-advanced/03-sed流编辑器.md"),
    ("awk-aggregation", "awk：按字段逐行累加", "先定义记录和字段，再看计数器怎样变化", [
        ("01 第一条记录", "192.0.2.1 GET /", "$1 是客户端地址", "给对应计数器加一"),
        ("02 第二条记录", "192.0.2.2 GET /a", "遇到另一个地址", "创建新的计数项"),
        ("03 第三条记录", "192.0.2.1 GET /b", "再次遇到第一个地址", "在原计数上累加"),
        ("04 结束输出", "END { ... }", "输出汇总结果", "需要顺序时另外排序")
    ], "动手：增加第四条日志，先预测汇总，再执行 awk 验证。", "数组遍历顺序不固定；带复杂引号的 CSV 不应简单用 -F, 处理。",
    [["count[192.0.2.1] = 1", "已处理 1 条记录"], ["count[192.0.2.1] = 1", "count[192.0.2.2] = 1"], ["count[192.0.2.1] = 2", "count[192.0.2.2] = 1"], ["2 192.0.2.1", "1 192.0.2.2（排序后的示意输出）"]], "docs/02-advanced/04-awk文本分析.md"),
    ("systemd-restart", "systemd：失败后的恢复过程", "重启策略帮助恢复，但不能代替根因排查", [
        ("01 正常运行", "active (running)", "主进程提供服务", "用请求验证真实可用"),
        ("02 异常退出", "exit status ≠ 0", "管理器记录失败", "日志留下退出信息"),
        ("03 等待策略", "RestartSec=3", "按配置延迟重启", "频繁失败可能触发限流"),
        ("04 再次启动", "Restart=on-failure", "新进程重新运行", "还要重新验证请求")
    ], "动手：在自己的用户服务中制造一次失败，观察 journal 和恢复。", "主动 stop 不应靠重启策略强行复活；错误配置需要修复而不是无限重试。",
    [["MainPID=示例进程 A", "HTTP check: 200"], ["Main process exited, status=1", "journal: 记录失败原因"], ["等待 RestartSec", "此时服务请求可能失败"], ["MainPID=示例进程 B", "检查日志与 HTTP 响应，确认恢复"]], "docs/02-advanced/06-systemd服务与日志.md"),
    ("cron-schedule", "cron：时间命中之后发生什么", "五个时间字段决定触发，命令的环境和路径仍需正确", [
        ("01 等待时间", "30 3 * * *", "按系统时区解释", "尚未命中 03:30"),
        ("02 时间匹配", "03:30", "cron 启动一个 Shell", "它不会加载你的终端配置"),
        ("03 执行命令", "backup src dst", "传入完整目录参数", "日志必须对任务用户可写"),
        ("04 核对结果", "log + archive", "不是保存任务就算成功", "检查实际归档与退出码")
    ], "动手：临时每分钟执行个人备份，看到真实日志后再恢复每日配置。", "cron 不自动补跑停机时错过的任务；迁移 timer 时要移除重复调度。",
    [["03:29 → 未触发", "规则: 分 时 日 月 周"], ["03:30 → 创建任务进程", "PATH 通常比交互 Shell 更精简"], ["源目录 → 新归档", "stdout/stderr → 个人日志"], ["日志出现备份完成", "新归档存在且能够恢复"]], "docs/03-pro/05-自动化运维.md"),
    ("process-signals", "TERM 与 KILL：进程能否收尾", "对照两种独立情况，先尝试有序结束", [
        ("01 进程运行", "running", "正在写数据或持有资源", "记录正确的目标 PID"),
        ("02 情况 A：TERM", "kill PID", "程序可处理信号", "有机会完成清理"),
        ("03 情况 B：KILL", "kill -9 PID", "内核强制终止", "程序无法执行清理回调"),
        ("04 检查后果", "文件 / 锁 / 服务", "验证目标确实结束", "检查遗留状态与恢复")
    ], "动手：只对自己的 sleep 或测试进程发信号，记录退出状态。", "KILL 不能被 trap 捕获；本图中的 A/B 是对照，不是先后对同一进程执行。",
    [["PID 来自刚启动的测试进程", "不要按相似名字猜测目标"], ["TERM → handler → 清理 → 退出", "是否处理取决于程序实现"], ["KILL → 立即终止", "EXIT/TERM 清理逻辑没有机会运行"], ["确认进程状态", "需要时处理已确认的遗留锁与临时文件"]], "docs/01-basics/06-进程管理.md"),
    ("memory-cache", "内存缓存：free 小不等于不足", "用 available 与工作负载一起判断，别只盯空闲列", [
        ("01 初始状态", "total = 8 GiB", "应用占用一部分内存", "其余为空闲与缓存"),
        ("02 读取文件", "page cache 增加", "内核缓存磁盘内容", "free 因此变小"),
        ("03 应用申请", "可回收缓存让位", "内存重新分配给应用", "并非所有缓存都能马上回收"),
        ("04 综合判断", "available + si/so", "观察可用量与换页趋势", "再决定是否真的吃紧")
    ], "动手：在测试环境比较 free -h 的 free、buff/cache 与 available。", "下面数字只说明分配关系；available 是内核估算，不是简单恒等式。",
    [["应用 2 GiB · free 5 GiB · cache 1 GiB", "总计 8 GiB（示意）"], ["应用 2 GiB · free 2 GiB · cache 4 GiB", "读取文件后缓存增长"], ["应用 6 GiB · free 1 GiB · cache 1 GiB", "部分缓存被回收供应用使用"], ["看 available 与持续换页", "不要单凭 free 一列宣判内存泄漏"]], "docs/03-pro/01-性能观测与调优.md"),
    ("inode-links", "硬链接：两个名字，一份文件", "目录项指向 inode；删除一个名字不等于删除所有引用", [
        ("01 创建文件", "data.txt → inode 42", "一个目录项", "链接计数为 1"),
        ("02 建硬链接", "ln data.txt copy.txt", "两个名字指向同一 inode", "链接计数变成 2"),
        ("03 删一个名字", "rm data.txt", "copy.txt 仍然存在", "链接计数回到 1"),
        ("04 继续读取", "cat copy.txt", "内容仍然可读", "最后的打开引用也很重要")
    ], "动手：用 ls -li 比较 inode，再修改内容和删除一个链接。", "inode 42 是示意编号；软链接指向路径，行为与硬链接不同。",
    [["data.txt ──→ inode 42 ──→ 内容", "links = 1"], ["data.txt ─┐", "copy.txt ─┴→ inode 42；links = 2"], ["data.txt：目录项移除", "copy.txt ──→ inode 42；links = 1"], ["copy.txt 仍可读取同一份内容", "空间回收还受打开的文件描述符影响"]], "docs/02-advanced/07-磁盘与文件系统.md"),
    ("dns-lookup", "DNS：从名字找到目标地址", "名字解析成功，只是访问应用的其中一层", [
        ("01 本机查询", "example.com", "先检查本机解析与缓存", "命中时可跳过远端查询"),
        ("02 递归解析", "resolver", "向配置的解析器查询", "解析器也可能使用缓存"),
        ("03 获得记录", "A / AAAA", "返回地址与缓存时间", "同一名字可能有多个地址"),
        ("04 连接应用", "IP + port", "继续路由、连接和 TLS", "DNS 正常不保证服务正常")
    ], "动手：比较 getent ahosts 与 curl 的结果，分清解析错误和连接错误。", "图中地址使用文档示例网段；实际地址和缓存行为以当前环境为准。",
    [["输入：example.com", "本机解析配置决定下一步"], ["客户端 → 配置的 DNS 解析器", "缓存未命中时继续查询"], ["示例 A 记录：192.0.2.10", "记录在 TTL 内可能被缓存"], ["尝试访问 192.0.2.10:443", "仍可能出现超时、拒绝连接或 TLS 错误"]], "docs/02-advanced/08-网络基础与远程连接.md"),
    ("lnmp-request", "LNMP：一次动态请求的往返", "Nginx、PHP-FPM 与数据库各做不同的事", [
        ("01 浏览器请求", "GET /index.php", "客户端发起 HTTP 请求", "先到 Nginx"),
        ("02 转交 PHP", "FastCGI / socket", "Nginx 把动态请求交给后端", "后端失联可能出现 502"),
        ("03 查询数据", "PHP → MariaDB", "应用读取文章等状态", "数据库使用专用账户"),
        ("04 返回响应", "HTML → browser", "结果经 Nginx 返回", "检查页面，不只看进程状态")
    ], "动手：访问站点并对照 Nginx、PHP 与数据库日志定位请求路径。", "静态文件可以由 Nginx 直接返回；图中数据库查询仅表示动态请求的一种情况。",
    [["浏览器 → Nginx: GET /index.php", "请求进入站点配置"], ["Nginx → PHP-FPM socket", "找不到 socket 时先查后端配置"], ["WordPress → 数据库：读取文章", "数据库文件与上传文件分别持久保存"], ["HTTP 响应返回客户端", "以页面和业务结果判断是否成功"]], "docs/04-projects/项目1-LNMP网站服务器.md"),
    ("gpio-debounce", "按钮消抖：一次按下为何有多次变化", "机械触点会抖动，采样与过滤影响最终记录", [
        ("01 按钮松开", "pull_up=True", "上拉给输入稳定默认状态", "按下时接到 GND"),
        ("02 触点抖动", "0 → 1 → 0 → 1", "短时间出现多次边沿", "不能每个边沿都当新点击"),
        ("03 过滤抖动", "bounce_time", "按配置抑制短暂变化", "过滤窗口不是越大越好"),
        ("04 记录状态", "pressed / released", "状态变化时写 CSV", "高频脉冲可能被漏采")
    ], "动手：分别慢按、快按、长按，比较 CSV 行数并解释差异。", "波形是原理示意；实际消抖由库与后端实现，不能当成实测时序。",
    [["GPIO27：默认 released", "接线前断电，信号不接 5V"], ["触点瞬间：抖动、反复通断", "一段机械动作 ≠ 多次独立点击"], ["设置合适的消抖窗口", "过大可能忽略快速操作"], ["elapsed_s,state,source", "0.500,pressed,gpio27（示意）"]], "docs/05-raspberry-pi/07-从按钮到数据记录.md"),
    ("path-lookup", "PATH 查找：命令究竟从哪里来", "同名命令可能来自不同目录，查找顺序由 PATH 决定", [
        ("01 输入命令", "git status", "Shell 先判断是不是路径", "含 / 的才按路径处理"),
        ("02 依次查找", "echo $PATH", "从左到右逐个目录查找", "靠前的目录抢先命中"),
        ("03 命中执行", "/usr/bin/git", "执行第一个匹配文件", "后面的同名命令被跳过"),
        ("04 继承规则", "export PATH=…", "导出的变量才进子进程", "临时赋值只影响当前命令")
    ], "动手：用 command -v 与 type -a 找出命令来源，再临时改 PATH 验证顺序。", "示意动画：hash 缓存、内建命令与不同 Shell 会改变查找结果，以本机 type -a 为准。",
    [["$ git status", "PATH=/usr/local/bin:/usr/bin:/bin"], ["找 /usr/local/bin/git → 没有", "找 /usr/bin/git → 命中"], ["执行 /usr/bin/git，参数 status", "其余同名文件不再参与"], ["export PATH=\"$HOME/bin:$PATH\"", "子进程继承的是导出后的 PATH"]], "docs/01-basics/07-环境变量与PATH.md"),
    ("grep-regex", "grep 匹配：逐行筛选与三种退出码", "命中、未命中与出错是三个不同结果", [
        ("01 逐行读取", "line = 1 行文本", "模式按行匹配", "默认不跨行匹配"),
        ("02 匹配模式", "-E 'ERROR|WARN'", "正则分支任一命中即可", "默认打印整行原文"),
        ("03 输出结果", "grep -n -o", "选项改变输出内容", "不改变是否命中"),
        ("04 退出码", "0 / 1 / 2", "未命中是 1，不是错误", "读不到文件才是 2")
    ], "动手：构造命中、未命中与文件不存在三种情况，核对退出码与 stderr。", "示意动画：正则方言由 -E/-P 等选项决定，复杂模式请在本机版本验证。",
    [["input: 12 ERROR auth failed", "逐行交给模式匹配"], ["pattern: ERROR|WARN → 命中", "其余行不输出"], ["stdout: 12 ERROR auth failed", "stderr: （空）"], ["exit 0 命中｜1 未命中｜2 出错", "$ grep -c ERROR access.log"]], "docs/02-advanced/02-grep文本搜索.md"),
    ("archive-compress", "归档与压缩：两步而不是一步", "tar 负责打包，gzip/xz 负责变小", [
        ("01 打包归档", "tar cf backup.tar 目录/", "多个文件合成一个归档", "体积几乎不变"),
        ("02 选择压缩", "gzip backup.tar", "算法决定压缩率与速度", "得到 .tar.gz"),
        ("03 查看内容", "tar tzf backup.tar.gz", "先列清单再决定解包", "不改动原归档"),
        ("04 解包落位", "tar xzf … -C /目标", "解到指定目录", "覆盖前先确认同名文件")
    ], "动手：打包一个目录，再执行 tzf 查看与 xzf -C 解包，比较前后内容。", "示意动画：zip 是归档压缩二合一；解包陌生归档前先看成员路径与覆盖行为。",
    [["input: notes/（多个文件）", "tar 只做归档，体积接近原样"], ["archive.tar → gzip → .tar.gz", "压缩率与速度需要权衡"], ["tar tzf backup.tar.gz", "列出成员，不动磁盘内容"], ["tar xzf … -C /tmp/out", "先确认目标目录与同名文件"]], "docs/01-basics/04-压缩与归档.md"),
    ("vim-modes", "Vim 模式：为什么按键不变成文字", "普通模式下按键是指令，插入模式才输入文字", [
        ("01 普通模式", "vim hello.txt", "打开后默认在普通模式", "此时敲字被当指令"),
        ("02 进入插入", "i", "左下角出现 -- INSERT --", "这时才可以输入文字"),
        ("03 回到普通", "Esc", "退回普通模式执行指令", "保存前先确认内容"),
        ("04 保存退出", ":wq 回车", "write + quit 一次完成", "放弃修改用 :q!")
    ], "动手：走完「i 输入 → Esc → :wq」，再在终端用 cat 复核落盘内容。", "示意动画：模式混淆是 Vim 最常见的挫败来源；不确定时先按 Esc 回到普通模式。",
    [["mode: -- NORMAL --", "按键 = 指令，不写入文本"], ["press i → -- INSERT --", "输入的文字进入缓冲区"], ["press Esc → -- NORMAL --", "dd / yy / : 指令在此生效"], [":wq ⏎ → 写入文件并退出", "cat hello.txt 复核落盘结果"]], "docs/01-basics/02-查看与编辑文件-Vim.md"),
    ("install-choices", "选安装方式：先划清磁盘边界", "WSL2、虚拟机、云主机与双系统风险不同", [
        ("01 先问目标", "只想日常敲命令？", "WSL2 起步最快", "几乎无风险"),
        ("02 需要桌面", "VirtualBox + Ubuntu", "整机虚拟化可随时删除", "性能约打八折"),
        ("03 云端机器", "一台可销毁的云主机", "适合练远程运维", "注意按量计费"),
        ("04 双系统风险", "分区 + 引导", "动磁盘前必须先备份", "新手阶段先不碰")
    ], "动手：按对比表选一条路线装好环境，记录发行版与内核作为环境名片。", "示意动画：双系统会改动分区与引导；没有备份经验时先完成前三条路线。",
    [["目标：日常命令行练习", "→ 路线① WSL2（无桌面）"], ["目标：体验完整桌面", "→ 路线② 虚拟机（可删除）"], ["目标：练远程运维", "→ 路线③ 云主机（可销毁）"], ["目标：原生性能且敢动分区", "→ 路线④ 双系统（先备份）"]], "docs/00-onboarding/04-安装你的第一个Linux.md"),
    ("edge-inference", "边缘识别：一次本地 OCR 链路", "采集、保存、识别、核对是四件事", [
        ("01 采集图像", "capture-frame.py", "USB 摄像头走设备节点", "设备编号不一定是 0"),
        ("02 保存文件", "photo.jpg", "父目录需已存在", "同名文件拒绝覆盖"),
        ("03 本地识别", "tesseract 图片 输出", "推理在设备本地完成", "不套用桌面 GPU 速度"),
        ("04 核对结果", "人工比对原文", "记录耗时与识别错误", "相机与模型问题分开查")
    ], "动手：拍一张清晰文字图片跑通识别并记录耗时；没有相机就用准备好的图片走后续步骤。", "示意动画：摄像头权限、设备节点与模型参数是不同问题；耗时以本机实测为准。",
    [["camera → /dev/video*", "先确认设备节点与占用者"], ["photo.jpg（独占创建）", "父目录必须已存在"], ["tesseract photo.jpg out", "本机推理，数据不出设备"], ["对照原文核对识别结果", "耗时与错误率以实测为准"]], "docs/05-raspberry-pi/06-树莓派与边缘AI.md"),
    ("local-ai-request", "本地模型：一次请求经过谁", "界面与命令行都调同一个本地模型服务", [
        ("01 界面或命令", "浏览器 :3000 / curl", "两种客户端任选", "都请求本地服务"),
        ("02 调用 API", "/v1/chat/completions", "OpenAI 兼容接口", "Ollama 端口 11434"),
        ("03 本地推理", "qwen2.5:7b", "模型在容器内加载推理", "显存不足会混合内存"),
        ("04 返回结果", "流式返回 tokens", "数据不出网卡", "首次加载慢属正常")
    ], "动手：用 curl 调一次兼容接口，再用 WebUI 问同一句话，比较耗时与结果。", "示意动画：本地只花电费但速度受硬件限制；模型回答的正确性仍需自己核对。",
    [["浏览器 http://IP:3000", "curl http://IP:11434"], ["POST /v1/chat/completions", "OpenAI 兼容请求体"], ["Ollama 加载模型层（GPU/CPU）", "已下载模型保存在磁盘"], ["流式返回 tokens → 客户端", "记录实际响应时间与错误"]], "docs/04-projects/项目4-Linux跑本地AI.md"),
    ("apt-deps", "apt 依赖：一条命令装齐全家桶", "包管理器替你解析依赖，手动装包只是兜底", [
        ("01 刷新索引", "sudo apt update", "拉取镜像站索引", "写入 /var/lib/apt/lists/"),
        ("02 请求安装", "sudo apt install A", "解析 A→B→C→D 依赖链", "缺一环就装不起来"),
        ("03 自动装齐", "A、B、C、D", "依赖地狱一次解决", "卸载也用同一条链路"),
        ("04 手动兜底", "sudo apt -f install", "dpkg 手动装包缺依赖时报错", "用它自动补齐依赖")
    ], "动手：用 apt install 装一个带依赖的小工具，再用 apt-cache depends 看依赖树。", "示意动画：依赖关系由仓库索引决定；混用外来 .deb 可能破坏系统一致性。",
    [["$ sudo apt update", "索引写入 /var/lib/apt/lists/"], ["$ sudo apt install A", "解析：A → B → C → D"], ["A、B、C、D 一次装齐", "版本冲突由仓库索引判定"], ["dpkg -i app.deb → 依赖不满足", "apt -f install 自动补齐"]], "docs/01-basics/05-软件包管理.md"),
    ("file-ops", "文件操作：改名、移动与不可逆删除", "先分清复制、改名、移动和删除四种动作", [
        ("01 复制备份", "cp -r photos backup/", "目录必须加 -r", "cp -i 覆盖前询问"),
        ("02 改名移动", "mv notes.txt diary.txt", "同一位置换名字", "换目录则是移动"),
        ("03 删除不可逆", "rm -i diary.txt", "命令行 rm 绕过回收站", "先 ls 确认目标"),
        ("04 递归强制", "rm -rf projects/test", "-r 才能删目录", "-f 不再询问，敲错就没了")
    ], "动手：用 cp -i 复现覆盖询问，再把临时文件 mv 进自建 trash/ 目录后删除。", "示意动画：rm 不可逆；可以先 mv 进自建 trash/ 攒一批再删，别拿 rm -rf 试手。",
    [["$ cp -r photos backup/", "复制目录少了 -r 会报错"], ["$ mv notes.txt diary.txt", "改名：内容不动，只是换了名字"], ["$ rm -i diary.txt", "命令行 rm 没有回收站"], ["$ rm -rf projects/test", "-f 强制且不再提示，无法撤销"]], "docs/01-basics/01-文件与目录操作.md"),
    ("intranet-tunnel", "内网穿透：不暴露公网也能访问", "用加密覆盖网络把家里主机连进私有网", [
        ("01 本地服务", "docker compose up -d", "Nextcloud 与数据库容器", "数据存在命名卷里"),
        ("02 组建私有网", "sudo tailscale up", "设备加入加密 tailnet", "地址形如 100.x.x.x"),
        ("03 远程访问", "手机 / 笔记本", "任意网络访问家庭主机", "不向公网发布 8080"),
        ("04 直连或中继", "tailscale status", "优先直连，必要时中继", "不等同于公网暴露")
    ], "动手：部署 Nextcloud 后让第二台设备经 Tailscale 访问，记录实际路径是直连还是中继。", "示意动画：Tailscale 是加密覆盖网络；需要公网入口时再评估 frp 等方案。",
    [["$ docker compose up -d", "nextcloud:8080 + db_data / nextcloud_data"], ["$ sudo tailscale up", "设备加入 tailnet：100.x.x.x"], ["手机 → 家庭主机（无公网 IP）", "不直接向网络接口发布 8080"], ["tailscale status / ping 目标", "直连优先，打洞失败时经中继"]], "docs/04-projects/项目3-个人云盘与内网穿透.md"),
    ("triage-flow", "排障四段式：现象 → 原因 → 排查 → 解决", "先只看不动，证据支持假设之后再改", [
        ("01 记录现象", "报错原文 + 时间", "先抄全，不复述印象", "记录最近做过什么"),
        ("02 判断层级", "磁盘 / 网络 / 服务", "先缩小范围再深挖", "别一上来就重启"),
        ("03 只读取证", "dmesg | tail -n 20", "只读命令先取证", "输出留着做对比"),
        ("04 再动手", "确认原因后修复", "保留原始证据", "改完要能复现验证")
    ], "动手：任选一例按四段格式复现，写下每一步命令和实际输出。", "示意动画：案例结论以本机现场证据为准；未复现前不要照抄解决命令。",
    [["现象：分区突然只读", "先记录完整报错，不急着改"], ["层级：磁盘 / 文件系统", "ext4 遇底层错误会自我保护降级"], ["$ dmesg | tail -n 20", "只读命令先取证"], ["确认原因后再修复并复验", "保留原始输出用于前后对比"]], "docs/04-projects/项目5-故障排查20例.md"),
    ("flash-first-boot", "烧录系统：整卡覆盖与首次启动", "写卡会覆盖整张 microSD，先确认目标设备", [
        ("01 选择镜像", "Raspberry Pi Imager", "按板型选 64 位系统", "镜像来自官方下载"),
        ("02 确认目标卡", "整张 microSD", "写卡覆盖整卡内容", "先备份卡内已有数据"),
        ("03 预配置检查", "用户名 / SSH / Wi-Fi", "设置 SSID、密码与国家", "不把设置文件传仓库"),
        ("04 首次启动", "ssh 用户@pi-lab.local", "DHCP 列表或 mDNS 找地址", "关机用 sudo poweroff")
    ], "动手：烧录后用 DHCP 租约表或 mDNS 找到树莓派并首次登录，关机时用 sudo poweroff。", "示意动画：不确定设备名就拔插读卡器对比容量；首次启动期间不要断电。",
    [["Imager → 选型号 + 系统", "镜像从官方渠道获取"], ["目标：整张 microSD", "选错设备可能覆盖电脑磁盘"], ["预配置：用户名 / SSH / Wi-Fi", "设置文件与截图不要上传仓库"], ["首次启动 → ssh 用户@pi-lab.local", "关机用 sudo poweroff，别直接拔电"]], "docs/05-raspberry-pi/02-烧录系统与首次启动.md"),
    ("kernel-distro", "内核与发行版：三层结构各管什么", "三层结构各管什么，验明身份的两条命令", [
        ("01 硬件之上", "CPU / 内存 / 硬盘 / 网卡", "内核驱动与调度", "你操作的是抽象层"),
        ("02 内核调度", "uname -r", "只显示内核版本号", "6.8.0-45-generic"),
        ("03 发行版组装", "cat /etc/os-release", "内核 + 工具 + 仓库", "ID_LIKE 暴露家族出身"),
        ("04 用户界面", "桌面环境 GNOME / KDE", "窗口、图标、任务栏", "你不直接指挥发动机")
    ], "动手：运行 uname -r 与 cat /etc/os-release，说出内核版本、发行版版本与三层结构各对应哪个角色。", "严格说 Linux 只是内核；完整系统 = 内核 + GNU 工具 + 发行版软件。Free 指自由而非免费。",
    [["硬件之上：CPU、内存、硬盘、网卡", "内核：驱动硬件、分配资源"], ["uname -r → 6.8.0-45-generic", "内核版本与发行版版本是两回事"], ["发行版：把内核和工具组装成整车", "ID_LIKE=debian → 属于 Debian 系"], ["桌面环境：窗口、图标、任务栏", "你操作驾驶舱，不直接指挥发动机"]], "docs/00-onboarding/02-Linux的前世今生.md"),
    ("distro-family", "发行版家族：同一内核长出上百种整车", "同一颗内核，长出上百种整车", [
        ("01 一颗内核", "Linux 内核 1991", "GPL 保证组装自由", "上百种整车由此而来"),
        ("02 四大家族", "apt dnf pacman zypper", "Debian / RHEL / Arch / SUSE", "包管理器就是方言"),
        ("03 按需选型", "新手 LTS / 服务器求稳", "极客滚动更新", "国产化 openEuler 与 UOS"),
        ("04 验明出身", "cat /etc/os-release", "ID_LIKE 对号入座", "apt 与 dnf 别用混")
    ], "动手：用决策表为三类人各选一个发行版——新手桌面、生产服务器、国产化办公，并各说一句理由。", "发行版 = 内核 + GNU 工具 + 应用组装成的整车，附软件仓库；认准 LTS 别追新。",
    [["Linux 内核 1991 → 上百种发行版", "发动机一样，整车各不同"], ["Debian 系 apt .deb｜RHEL 系 dnf .rpm", "Arch 系 pacman｜SUSE 系 zypper"], ["新手认准 LTS，服务器求稳", "极客随便折腾，场景决定一切"], ["cat /etc/os-release → ID_LIKE=debian", "按 ID_LIKE 换包管理器，别混用"]], "docs/00-onboarding/03-发行版全景图.md"),
    ("man-help", "man 手册：求助三步走", "权威、速览、例题，各回答一个问题", [
        ("01 不认识的命令", "别背，查手册", "man 是官方说明书", "--help 是速览卡片"),
        ("02 权威精读", "man 5 passwd", "分节 1 命令 5 配置", "8 是系统管理命令"),
        ("03 关键词反查", "man -k password", "等于 apropos", "拿到命令名再精读"),
        ("04 速抄例题", "tldr tar", "一页几个常用例子", "先 tldr 后 man")
    ], "动手：忘了一个命令的名字，用 man -k 反查，再用 man 精读，全程不出终端，最后 q 退出。", "man 5 passwd 讲的是 /etc/passwd 文件格式，不是命令；tldr 是例题不是规范。",
    [["遇到不认识的命令", "man 权威说明 / --help 速览 / tldr 例题"], ["man 内部就是 less：空格翻页", "/关键词 搜索，q 退出"], ["man -k password → passwd (1) (5)", "反查 → 精读 两步走"], ["tldr tar → 十行给出常用例子", "出问题再回 man 精读"]], "docs/01-basics/08-高效求助-man与tldr.md"),
    ("hardware-detect", "硬件识别：实物对应系统命令", "内存、磁盘、总线与网卡，各有查看命令", [
        ("01 内存工作台", "free -h", "应用可用内存", "free 小不等于不足"),
        ("02 持久存储", "lsblk -o NAME,TYPE", "数据写在哪块盘", "挂载点看 findmnt"),
        ("03 总线设备", "lspci / lsusb", "PCI 与 USB 枚举", "枚举 ≠ 能取画面"),
        ("04 网络接口", "ip -br link", "网卡接口列表", "有接口 ≠ 有路由")
    ], "动手：用 lscpu、free -h、findmnt /、ip -br link 做一份不含序列号的硬件记录，注明运行环境。", "虚拟机和容器看到的设备视图受限；软件容量与包装数字注意 GB/GiB 单位。",
    [["CPU 内存 磁盘 网卡：四类实物", "虚拟机看到的是虚拟硬件"], ["lscpu / free -h → 计算与内存", "逻辑 CPU 不等于物理核心数"], ["lsblk → 数据落盘位置", "lspci / lsusb → 设备是否枚举"], ["ip -br link → 接口名称", "有接口不等于有可用路由"]], "docs/01-basics/09-从实物认识Linux硬件.md"),
    ("pi-buying", "选购要点：按任务核对配件", "先明确要做什么，再逐项核对五项配件", [
        ("01 先问用途", "命令行 / 桌面 / 硬件控制", "Pi 4/5 完整 Linux", "Zero 适合轻量任务"),
        ("02 分清系列", "Pi vs Zero vs Pico", "Pico 是微控制器", "不跑完整 Linux"),
        ("03 核对配件", "电源 存储 散热 网络 接口", "先看需求再看价格", "低功率充电器别凑合"),
        ("04 验明板子", "uname -m", "常见 aarch64", "先查再配系统")
    ], "动手：写一份「我已有 / 我缺少 / 为什么需要」的配件清单，并定一个第一周目标（SSH、共享目录或点灯）。", "能亮灯不等于电源稳定；GPIO 是信号接口，不直接驱动电机或大功率负载。",
    [["你要做什么？", "Linux 命令行 / 桌面 / 低功耗硬件控制"], ["Pi 4/5：完整 Linux + GPIO", "Zero：轻量｜Pico：微控制器"], ["电源 存储 散热 网络 接口", "负载一高掉盘重启，先查供电"], ["查板型：/proc/device-tree/model", "uname -m → aarch64"]], "docs/05-raspberry-pi/01-树莓派是什么与选购.md"),
    ("pi-remote", "远程配置：公钥登录三步", "密钥认证、稳定寻址与基础配置", [
        ("01 生成密钥", "ssh-keygen -t ed25519", "本机生成密钥对", "私钥留在本机"),
        ("02 复制公钥", "ssh-copy-id 用户@主机", "把公钥装到目标机", "主机名比 IP 好记"),
        ("03 密钥登录", "ssh 用户@主机名", "publickey 认证", "成功后再禁密码"),
        ("04 基础配置", "sudo raspi-config", "时区 / 网络 / 更新", "一次只改一项")
    ], "动手：重启后仍能用主机名与密钥重新登录；记录 hostname、timedatectl 与 vcgencmd measure_temp 输出。", "公钥登录成功后才考虑禁用密码；频繁掉线先查供电与无线信号，别直接怀疑 SSH。",
    [["$ ssh-keygen -t ed25519", "生成一对密钥，私钥留在本机"], ["$ ssh-copy-id 用户@pi-lab.local", "把公钥装进 authorized_keys"], ["$ ssh 用户@pi-lab.local", "PreferredAuthentications=publickey"], ["sudo raspi-config → 时区 / 网络", "timedatectl / vcgencmd measure_temp"]], "docs/05-raspberry-pi/03-远程连接与基础配置.md"),
    ("pi-homeserver", "家庭服务器：Samba 共享起步", "认证共享、验证落盘与盘外备份", [
        ("01 安装服务", "sudo apt install samba", "装共享服务与工具", "共享密码独立设置"),
        ("02 设置密码", "smbpasswd -a $USER", "独立认证共享账号", "guest ok = no"),
        ("03 启用验证", "testparm -s", "先验证配置再加载", "enable --now smbd"),
        ("04 访问备份", "smbclient -L localhost", "看到 pi-share 即成功", "备份要放在盘外")
    ], "动手：客户端上传文件 → 树莓派 sha256sum 记录 → 重启 → 下载比对；再备份到另一目录并恢复到第三目录。", "共享盘不是备份，客户端误删会同步影响；Pi-hole 只屏蔽命中的域名，不向公网开放递归 DNS。",
    [["$ sudo apt install samba", "客户端 smb://树莓派IP/pi-share 访问"], ["$ sudo smbpasswd -a 用户", "共享密码与登录密码相互独立"], ["testparm -s → 配置正确", "systemctl enable --now smbd"], ["smbclient -L localhost → pi-share", "共享不是备份：备份目标在源目录外"]], "docs/05-raspberry-pi/05-家庭服务器实战.md"),
    ("syscall-switch", "系统调用：用户态进内核态的唯一正门", "应用无权直接碰硬件，read() 必须陷入内核再返回", [
        ("01 用户态发起", "read(fd, buf, count)", "应用跑在受限的用户态", "不能直接读磁盘设备"),
        ("02 陷入内核", "syscall 指令", "glibc 触发特权级切换", "CPU 从用户态切到内核态"),
        ("03 内核代办", "校验 fd → 取数据", "命中页缓存直接拷贝", "未命中发起磁盘 IO 并睡眠"),
        ("04 返回用户态", "返回已读字节数", "数据拷回用户缓冲区", "strace 能看到每次调用")
    ], "动手：用 strace -e trace=read 跟踪一条读文件的命令，在输出里找出每次 read 系统调用，对照本章时序图。", "示意动画：特权级切换由 CPU 与中断机制完成；是否发生磁盘 IO 取决于页缓存是否命中，数值为示意。",
    [["app（用户态）：read(3, buf, 4096)", "想读文件，却无权直接访问磁盘"], ["执行 syscall 指令 → 陷入内核", "CPU 从用户态切到内核态"], ["内核校验 fd=3 → 查页缓存", "命中直接拷贝；未命中发起磁盘 IO"], ["read() = 4096，返回用户态", "strace 里能看到这次 read 调用"]], "docs/03-pro/02-内核与系统调用.md"),
    ("firewall-chains", "防火墙规则：逐条匹配，默认拒绝兜底", "入站包从上往下比对规则，命中即停，没命中由默认策略决定", [
        ("01 数据包到达", "入站 → :22 / :3306", "先过防火墙最外层", "再谈端口监听与应用"),
        ("02 逐条匹配", "ufw status 规则表", "从上往下比对规则", "第一条命中就停止"),
        ("03 命中动作", "ALLOW IN / DENY IN", "命中规则决定放行或丢弃", "22 放行、3306 拒绝"),
        ("04 默认兜底", "default deny incoming", "没有规则命中走默认", "所以先 allow SSH 再 enable")
    ], "动手：按 default deny → allow 22 → allow 80,443 → deny 3306 → enable 的顺序配置 UFW，核对规则表与默认策略。", "示意动画：真实匹配还涉及方向、协议与状态；enable 前没放行 SSH 会当场断线，顺序与默认策略共同决定结果。",
    [["入站包 → 本机 22/tcp（SSH）", "另一个入站包 → 3306/tcp（数据库）"], ["对照 ufw 规则表，从上往下比对", "22/tcp ALLOW IN ｜ 3306/tcp DENY IN"], ["SSH 包命中 ALLOW → 放行", "数据库包命中 DENY → 丢弃"], ["没有命中任何规则的包", "→ default deny incoming，直接丢弃"]], "docs/03-pro/03-安全加固.md"),
    ("container-isolation", "容器隔离：Namespace 与 Cgroups 的分工", "容器不是轻量虚拟机，而是被 Namespace 和 Cgroups 武装的普通进程", [
        ("01 普通进程", "应用 + 依赖 共享宿主机", "看得见所有进程与网络", "与别的服务抢资源"),
        ("02 Namespace", "PID / NET / MNT", "容器内自己像 PID 1", "独立网卡、端口与挂载视图"),
        ("03 Cgroups", "cpu / memory 配额", "最多 2 核、1GB 内存", "超限被限流而非失控"),
        ("04 武装进程", "docker run 创建容器", "MB 级、秒级启动", "共享内核，隔离弱于虚拟机")
    ], "动手：docker run --rm busybox ps -ef 看容器内 PID 1 是谁；再用 docker stats 观察 CPU/内存使用。", "示意动画：命名空间与配额由内核机制完成；容器共享宿主机内核，安全敏感场景用「VM 里再跑容器」。",
    [["app 进程：想读文件、开端口", "默认看到宿主机所有进程与网络"], ["PID namespace：容器内自己变 PID 1", "NET namespace：独立网卡与端口空间"], ["Cgroups：cpu=2 核、memory=1GB", "超限被限流，而不是失控"], ["docker run：秒级启动一个容器", "共享内核的普通进程，隔离弱于 VM"]], "docs/03-pro/04-容器与虚拟化.md"),
    ("load-vs-cpu", "load average 与 CPU 使用率", "磁盘卡死时 CPU 很闲、load 却高——队列与占比是两回事", [
        ("01 uptime 三数", "load: 0.52 0.48 0.45", "过去 1 / 5 / 15 分钟均值", "统计 R + D 状态任务数"),
        ("02 磁盘卡住", "进程进入 D 状态", "等磁盘 IO 连信号都不应", "CPU 很闲、load 却高"),
        ("03 CPU 使用率", "us / sy / wa / id", "忙碌时间占采样周期", "是采样瞬间的快照"),
        ("04 联合判读", "负载高 / CPU 低", "高负载 + 低 CPU → 查磁盘", "都高 → 过载；都低 → 突发")
    ], "动手：运行 yes > /dev/null & 制造 CPU 压力，对比 uptime 与 vmstat 的 r、us 列；kill %1 观察负载回落。", "示意动画：负载是队列长度视角、使用率是时间占比视角；D 状态任务会让 CPU 闲而负载高。",
    [["uptime → load average: 0.52 0.48 0.45", "统计 R + D 状态的任务数，是队列长度"], ["磁盘卡住：任务进 D 状态排队", "CPU 很闲、load 却高 → 先查磁盘"], ["vmstat：r=等待 CPU 的任务数", "us/sy/wa/id 是时间占比快照"], ["负载高 + CPU 低 → 查 IO", "都高 → 计算过载；都低 → 短时突发"]], "docs/03-pro/01-性能观测与调优.md"),
    ("sudo-elevation", "su 与 sudo：借权的两种姿势", "日常首选 sudo：输自己的密码，只借执行这一条命令", [
        ("01 普通用户 alice", "想改系统配置", "没有 root 不能直接动", "需要借 root 的力"),
        ("02 su - bob", "彻底切换身份", "输目标用户的密码", "切过去全程是对方"),
        ("03 sudo 单条命令", "sudo apt update", "输自己的密码", "只限被放行的命令"),
        ("04 /etc/sudoers", "sudo visudo 编辑", "谁有资格用 sudo", "全程可审计")
    ], "动手：用 sudo visudo 查看自己的 sudoers 条目；对比 su - 与 sudo -i 的提示符，结束后 exit。", "示意动画：sudo 放行范围由 /etc/sudoers 决定；真实审计记录在 /var/log/auth.log。",
    [["alice：要改系统配置，但没权限", "root 能越过一切权限检查"], ["su - bob：输 bob 的密码，彻底切换", "切过去全程以 bob/root 身份干活"], ["sudo apt update：输自己的密码", "只以 root 执行这一条命令"], ["/etc/sudoers 决定谁能用 sudo", "必须 visudo 编辑，记录可审计"]], "docs/01-basics/03-用户与权限.md"),
    ("git-commit", "Git 提交三区：工作区、暂存区与历史", "git add 选内容，git commit 钉快照，git push 才上传", [
        ("01 工作区", "编辑 notes.md", "改动只在本机文件里", "git status 显示 ?? / M"),
        ("02 暂存区", "git add notes.md", "挑出本次要提交的内容", "git diff --cached 预览"),
        ("03 本地提交", "git commit -m", "钉成本地历史快照", "commit 是本地快照"),
        ("04 推送协作", "git push / PR", "把提交传到远端仓库", "PR 写清问题证据与复验")
    ], "动手：在临时练习仓库按章操作：改 notes.md → git add → git diff --cached → git commit，再用 git show 说明改动。", "示意动画：Git 不会自动判断内容正确；误提交密码后仅删文件不够，历史中可能仍有副本。",
    [["工作区：notes.md 出现改动", "git status 显示 ?? 或 M"], ["git add → 暂存区", "git diff --cached 预览本次提交"], ["git commit → 本地历史多一条快照", "commit 是本地快照，push 才上传"], ["git push → 远端仓库", "PR 描述写清问题、修改、证据、验证"]], "docs/02-advanced/09-Git与学习笔记协作.md"),
    ("env-scope", "export：决定变量要不要传给孩子", "传的是拷贝，子进程里改不影响父进程", [
        ("01 普通变量", "name=\"alice\"", "只属于当前 Shell", "子进程看不到"),
        ("02 升舱", "export CITY=\"Beijing\"", "升舱为环境变量", "子进程会继承拷贝"),
        ("03 子进程查岗", "bash -c 'echo $CITY'", "子进程看到 Beijing", "看不到普通变量 name"),
        ("04 改动不回传", "子进程里改 CITY", "改的是自己的拷贝", "不影响父进程的值")
    ], "动手：name=\"alice\"、export CITY=\"Beijing\"，再用 bash -c 'echo $CITY' 在子进程查岗，验证继承与拷贝。", "示意动画：export 只决定是否随 fork 传递；写 ~/.bashrc 并 source 才能在当前会话永久生效。",
    [["bash：name=alice（普通变量）", "export CITY=Beijing（环境变量）"], ["子进程 bash -c 'echo $CITY'", "看到 Beijing；name 是空"], ["拷贝：子进程改 CITY 不影响父进程", "环境变量随 fork 继续传递"], ["永久生效：写 ~/.bashrc 再 source", "新终端自动加载，已开的要 source"]], "docs/01-basics/07-环境变量与PATH.md"),
    ("apt-flow", "apt 全流程：先刷新目录，再动手", "update 只刷新索引目录，upgrade 才升级已装软件", [
        ("01 刷新目录", "sudo apt update", "更新本地索引清单", "不升级任何软件"),
        ("02 升级已装", "sudo apt upgrade", "update 之后才动手", "把已装软件升到最新"),
        ("03 安装新软件", "sudo apt install tree", "自动解析并装好依赖", "一条命令装全家桶"),
        ("04 卸载回收", "sudo apt remove tree", "再 sudo apt autoremove", "回收不再被依赖的包")
    ], "动手：按 update → upgrade → install → show → remove → autoremove 走完 tree 生命周期，再用 apt list --installed 核对。", "示意动画：apt 依赖解析依据本地索引，索引过期会装错版本；dpkg 手动装包不会自动拉依赖。",
    [["sudo apt update", "只刷新 /var/lib/apt/lists 索引清单"], ["sudo apt upgrade", "真正升级已装软件（更新目录之后）"], ["sudo apt install tree", "自动解析依赖，装好全家桶"], ["sudo apt remove tree → sudo apt autoremove", "卸载并回收不再被依赖的包"]], "docs/01-basics/05-软件包管理.md"),
    ("ansible-flow", "Ansible：一句话管一群机器", "无 Agent：SSH 连过去执行，模块幂等、重跑安全", [
        ("01 主机清单", "inventory.ini", "告诉 Ansible 管谁", "web1 web2 db1"),
        ("02 SSH 连接", "先手动 ssh 通", "Ansible 无 Agent", "目标机只需 Python"),
        ("03 模块执行", "apt / copy / service", "声明目标状态", "已达成显示 ok"),
        ("04 幂等重跑", "ansible-playbook", "第二遍 changed=0", "配置进版本库可回滚")
    ], "动手：写 inventory-local.ini 把本机设为 local 连接，跑两遍 site.yml，观察第二遍 changed 归零。", "示意动画：Ansible 通过 SSH 执行模块；模块声明目标状态，未变化返回 ok 而非重复修改。",
    [["inventory.ini：webservers 组", "web1 / web2 / db1 主机清单"], ["ssh web1 免密直连", "无 Agent，目标机只需 Python"], ["apt: nginx state=present", "已装好显示 ok，有变化才 changed"], ["重跑 playbook：changed=0", "幂等 + 配置进版本库可回滚"]], "docs/03-pro/05-自动化运维.md"),
    ("vim-operations", "Vim 普通模式：整行操作与搜索", "先 Esc 回普通模式，再下达指令", [
        ("01 光标移动", "h j k l / gg G", "左右下上 / 文件头尾", "0 行首 $ 行尾"),
        ("02 搜索", "/关键词", "n 下一个 N 上一个", "hlsearch 高亮命中"),
        ("03 整行操作", "dd / yy / p", "dd 剪切行 yy 复制行", "p 粘贴到下一行"),
        ("04 撤销存盘", "u / :wq / :q!", "u 撤销上一步", ":wq 保存退出")
    ], "动手：按生存挑战走一遍：i 输入三行 → Esc → dd 删行 → u 撤销 → yy+p 复制粘贴 → /搜索 → :wq。", "示意动画：普通模式不产生文字，指令作用于行与光标；.swp 是异常退出残留。",
    [["普通模式：vim hello.txt 启动", "按 i 才进入插入模式"], ["h j k l / gg G / 0 $", "光标在行与文件间移动"], ["/关键词 → n N 跳转", "set hlsearch 高亮命中"], ["dd 剪切 / yy 复制 / p 粘贴", "u 撤销，:wq 保存退出"]], "docs/01-basics/02-查看与编辑文件-Vim.md"),
    ("model-fit", "本地模型选型：先看硬件再选规模", "7B 建议 16GB 内存，量化与混合推理降低门槛", [
        ("01 内存下限", "7B 建议 16GB", "1.5B-3B 流畅", "先 free -h 再选型"),
        ("02 显存加速", "GPU 8GB → 7B", "有 GPU 用显存跑", "不足则混合推理"),
        ("03 量化降门槛", "默认已量化", "压缩参数精度", "门槛比原生低"),
        ("04 按需加载", "ollama ps 看驻留", "list 有 ≠ 常驻内存", "吃紧时频繁换入换出")
    ], "动手：先 free -h 看内存再选模型规模；对比 ollama list 与 ollama ps，说明已下载与驻留的区别。", "示意动画：推理速度受硬件限制，纯 CPU 以秒/字计；模型按需加载，不常驻内存。",
    [["free -h：内存决定可选规模", "16GB 起跑 7B，8GB 用 3B"], ["GPU 显存加速；不足时混合推理", "部分层进内存，速度介于中间"], ["量化：默认下发已量化版本", "参数精度压缩，门槛更低"], ["ollama ps：此刻驻留的模型", "list 有 ≠ 已加载进内存"]], "docs/04-projects/项目4-Linux跑本地AI.md"),
    ("bash-exitcode", "Bash 退出码：脚本世界的错误信号", "0 成功、非 0 失败，&& 与 || 顺着信号短路", [
        ("01 每条命令留信号", "ls /no/such → 2", "0 成功，非 0 失败", "$? 保存上一条"),
        ("02 && 短路", "cmd1 && cmd2", "成功才继续往下", "失败即停不执行"),
        ("03 || 兜底", "cmd1 || 报错退出", "失败时走兜底", "exit 1 举手认输"),
        ("04 安全模式", "set -euo pipefail", "-e 失败即退出", "管道任一环失败算失败")
    ], "动手：写 disk-alert.sh：从 df 取根分区使用率，超过阈值 exit 1 否则 exit 0；再配 set -euo pipefail 验证两种分支。", "示意动画：if 判断与 && 语境中的失败不触发 set -e，这是设计；管道默认只看最后一环，需 pipefail 兜底。",
    [["ls /no/such → 退出码 2", "$? 保存上一条命令的退出码"], ["mkdir -p && install", "成功才继续，失败即停"], ["[[ -d dir ]] || exit 1", "失败时走兜底分支"], ["set -euo pipefail", "失败即退、未定义即报、管道全环"]], "docs/02-advanced/05-Bash脚本编程.md"),
    ("journal-query", "journalctl：服务日志的统一检索", "stdout/stderr 全进 journal，按条件过滤", [
        ("01 统一收集", "进程输出 → journald", "stdout / stderr 全收", "不再散落 /var/log"),
        ("02 按单元过滤", "journalctl -u ssh", "只看这个 unit", "-f 持续跟踪"),
        ("03 时间与级别", "--since / -b / -p err", "-b 本次开机", "-p 只看严重级别"),
        ("04 条件叠加", "-u ssh -p err --since", "多条件组合检索", "--disk-usage 看占用")
    ], "动手：按日志侦探实验：journalctl -u ssh -p err -b 查错误；--since 统计时段行数；-o verbose 统计 unit 排行。", "示意动画：journal 默认限制普通用户权限，读系统日志需 adm 组；日志进分页器后可继续搜索。",
    [["demo-web.service 输出", "stdout/stderr 统一进 journal"], ["journalctl -u demo-web.service", "-f 持续跟踪，Ctrl+C 退出"], ["journalctl -b / --since / -p err", "本次开机 / 时段 / 严重级别"], ["-u ssh -p err --since today", "多条件叠加，--disk-usage 看占用"]], "docs/02-advanced/06-systemd服务与日志.md"),
    ("event-record", "按钮数据记录：变化才落一行 CSV", "状态变化才写行，轮询本身不是点击", [
        ("01 轮询状态", "20ms 读 GPIO27", "循环采样引脚电平", "检测变化触发记录"),
        ("02 变化落行", "elapsed_s,state,source", "只有变化才写 CSV", "长按期间不再写新行"),
        ("03 来源标签", "simulated / gpio27", "模拟数据保留标记", "不删标签冒充实测"),
        ("04 局限与统计", "awk 统计 pressed", "快按可能漏采", "消抖 50ms 适合慢按钮")
    ], "动手：慢按、快按、长按三组各存一个 CSV，用 awk 统计 pressed 行数，解释长按不重复记、快按漏采的原因。", "示意动画：记录的是状态变化而非高精度中断计数；20ms 轮询可能漏掉很短脉冲，消抖参数按场景选择。",
    [["按钮接通/断开 → GPIO27", "循环轮询电平，检测变化"], ["变化时写一行 CSV", "elapsed_s, state, source 三列"], ["模拟模式 source=simulated", "真实模式 source=gpio27"], ["awk 统计 pressed 行数", "快按漏采、长按不重复记"]], "docs/05-raspberry-pi/07-从按钮到数据记录.md"),
    ("bash-trap", "trap：让脚本无论怎样退出都善终", "信号到达时先清理，EXIT 兜底覆盖所有退出路径", [
        ("01 脚本运行", "health.sh 处理中", "主进程持有临时文件", "终端等待任务完成"),
        ("02 用户打断", "Ctrl-C → SIGINT", "内核向前台进程发信号", "未设 trap 会立即终止"),
        ("03 trap 清理", "trap cleanup INT", "捕获信号先执行清理", "临时文件被移除"),
        ("04 EXIT 兜底", "exit → EXIT trap", "任何退出都走善终", "正常结束同样触发")
    ], "动手：写带临时文件的脚本，设 trap cleanup INT EXIT；Ctrl-C 与正常跑完各一次，对比临时文件是否残留。", "示意动画：SIGKILL 无法被捕获；trap '...' EXIT 在脚本无论以何种方式退出时都执行，是最后的兜底。",
    [["health.sh：处理中", "临时文件 /tmp/work.tmp 已创建"], ["Ctrl-C → SIGINT 到达", "未设 trap 时：立即终止、残留现场"], ["trap 捕获 → cleanup()", "rm 临时文件后干净退出"], ["exit → EXIT trap 兜底", "正常完成也走同一善终路径"]], "docs/03-pro/06-Shell脚本进阶.md"),
    ("cmd-execution", "一条命令：从键盘到屏幕的旅程", "终端收字符，Shell 翻译，内核执行，结果回显", [
        ("01 敲下命令", "whoami 逐字符回显", "终端窗口收集输入", "提示符等待命令"),
        ("02 Shell 解析", "拆词并查 PATH", "shell 翻译这条命令", "定位可执行程序"),
        ("03 内核执行", "fork + exec 运行", "内核真正启动程序", "stdout 收到输出"),
        ("04 回到终端", "屏幕显示 linuxboy", "输出流向终端窗口", "提示符再次出现")
    ], "动手：敲 whoami 观察回显与输出的先后；再敲 type whoami，看 shell 如何定位命令来源。", "示意动画：终端只负责字符收发与显示，解析与执行在 shell 与内核；省略了别名展开、环境变量等细节。",
    [["终端：whoami 逐字符回显", "提示符 linuxboy@ubuntu:~$"], ["Shell：拆词 + 查 PATH", "定位到 /usr/bin/whoami"], ["内核：fork + exec 运行", "程序输出写入 stdout"], ["终端：显示 linuxboy", "提示符恢复，等你下一条命令"]], "docs/00-onboarding/05-初见终端与Shell.md"),
    ("health-check", "每日巡检：测完再判，判完双写", "各指标独立采集，阈值决定三色，终端与落盘各一份", [
        ("01 定时触发", "systemd timer 09:00", "每天自动启动巡检", "Persistent=true 补跑"),
        ("02 逐项检查", "check_cpu / mem / disk", "一个指标一个函数", "采集当前数值"),
        ("03 阈值判定", "≥85% CRIT / 其余 OK", "人眼三秒扫完", "低于阈值绿色通过"),
        ("04 双写落盘", "tee + 去色", "终端看彩色原文", "报告存 /var/log")
    ], "动手：运行 bash scripts/health-report.sh 85，观察 0/1/2 三种退出码；详细版用 sed 去色后落盘对比。", "示意动画：阈值只是示例，按机器调整；落盘必须去 ANSI 色码，避免日志被转义序列污染。",
    [["timer 09:00 触发巡检", "错过的时间点自动补跑"], ["check_cpu: 72% / check_mem: 63%", "check_disk: / 已用 88%"], ["CRIT 磁盘 88% ≥ 85%", "CPU 72% / 内存 63% → OK"], ["终端：彩色 OK/WARN/CRIT", "报告：health-report-日期.log（纯文本）"]], "docs/04-projects/项目2-服务器巡检脚本.md"),
    ("path-navigation", "路径解析：绝对还是相对", "绝对路径从 / 写起；相对路径与 ..、~、- 都依赖当前位置", [
        ("01 查看位置", "pwd → /home/alice/projects", "相对路径从此处出发", "绝对路径恒从 / 写起"),
        ("02 相对前进", "cd web", "落到 projects 下 web", "相对写短但依赖位置"),
        ("03 上一级", "cd ..", ". 当前目录", ".. 上一级目录"),
        ("04 快捷方式", "cd ~/downloads", "~ 是家目录缩写", "绝对引用 /var/log 不迷路")
    ], "动手：在家目录用 pwd 与 cd 走一遍 相对、..、~、-，再对照绝对路径引用 /var/log。", "示意动画：- 表示上一次所在目录；- 与 ~ 只在交互 Shell 展开，脚本里注意写法。",
    [["当前目录 /home/alice/projects", "pwd 输出完整绝对路径"], ["cd web → /home/alice/projects/web", "相对路径依赖当前位置"], ["cd .. → /home/alice/projects", ". 当前 / .. 上一级"], ["cd ~/downloads → /home/alice/downloads", "绝对路径从任意位置一致"]], "docs/01-basics/01-文件与目录操作.md"),
    ("grep-options", "grep 选项：从匹配到过滤再到统计", "行级过滤逐行判断；选项叠加与管道让结果更精确", [
        ("01 行级匹配", "grep error app.log", "逐行读入判断", "匹配行打印到 stdout"),
        ("02 忽略大小写", "grep -i error", "ERROR / Error 都命中", "输出顺序不改变"),
        ("03 反向过滤", "grep -v '^#'", "去掉注释与空行", "输出不含模式的行"),
        ("04 管道统计", "grep -i error | wc -l", "下游继续处理", "与 -c 结果一致")
    ], "动手：对 sshd_config 叠加 -n -i -v 过滤，再用管道 wc -l 与 grep -c 对照计数。", "示意动画：-r 递归目录、-w 全词匹配、-C 显示上下文；这里演示最常用的选项组合。",
    [["app.log: ERROR → 匹配", "app.log: info → 跳过"], ["ERROR / error 都输出", "大小写不影响顺序"], ["^# 注释行被过滤", "剩余行继续带向下游"], ["grep -c error 与 wc -l 同值", "管道让 grep 成为过滤器"]], "docs/02-advanced/02-grep文本搜索.md"),
    ("gpio-button", "按钮输入：上拉、按下与事件", "内部上拉让电平确定；事件回调避免轮询占 CPU", [
        ("01 先接线", "GPIO27 + GND", "按钮断开 → 引脚悬空", "先核对器件内部连接"),
        ("02 内部上拉", "pull_up=True", "平时读到 1（高）", "松开时电平确定"),
        ("03 按下变化", "GND 接通 → 读到 0", "电平变化产生事件", "与轮询循环不同"),
        ("04 事件回调", "when_pressed → LED 亮", "按下亮、松开灭", "bounce_time 滤抖动")
    ], "动手：把 LED(17) 与 Button(27, pull_up=True) 组合，按下亮、松开灭；再与轮询读电平对比。", "示意动画：上拉是内部电阻，不必另接；事件回调由库在后台分发，程序在 pause() 等待。",
    [["GPIO27 —— 按钮断开", "接线前关机断电、对图 BCM 编号"], ["内部上拉 → 平时 GPIO27 = 1", "电平确定不悬浮"], ["按下 → GND 接通 → GPIO27 = 0", "电平变化触发事件"], ["when_pressed: LED 亮", "when_released: LED 灭"]], "docs/05-raspberry-pi/04-GPIO硬件编程.md"),
]
