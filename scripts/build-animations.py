"""Build six original, self-contained SVG teaching animations (standard library only)."""
from html import escape
from pathlib import Path
import json
from animation_scenes import EXTRA_SCENES

ROOT = Path(__file__).resolve().parents[1]
SCENES = [
    ("shell-pipeline", "管道：让文本依次经过四个工具", "看清数据从哪里来，每一步剩下什么", [
        ("01 读取日志", "cat access.log", "标准输出是一串文本", "原文件保持不变"),
        ("02 筛选记录", "grep 'ERROR'", "只留下匹配的行", "没有匹配时返回非零"),
        ("03 提取字段", "awk '{print $1}'", "每行只输出第一列", "下游不再收到整行"),
        ("04 排序统计", "sort | uniq -c", "相同内容聚到一起", "输出每个值的次数")
    ], "动手：分别运行管道的前 1、2、3、4 段，核对每一步输出。", "这是一条数据流示意，不代表进程严格逐个启动；管道可以并发处理。"),
    ("filesystem-mount", "挂载：把文件系统接入目录树", "目录路径、挂载点和存储设备是不同层次", [
        ("01 块设备", "disk.img / 数据盘", "先确认设备身份", "本教程用镜像文件"),
        ("02 文件系统", "ext4 / xfs", "组织目录与数据块", "格式化会改变内容"),
        ("03 挂载点", "mount → /mnt/lab", "把文件系统接到路径", "原目录内容会被遮住"),
        ("04 访问文件", "/mnt/lab/hello.txt", "读写落在挂载的存储", "卸载后路径视图改变")
    ], "动手：挂载前、挂载后、卸载后各执行一次 findmnt 和 ls。", "挂载不是复制文件；目录不存在、设备未挂载与空文件系统是不同状态。"),
    ("docker-volume", "容器重建，数据为什么还能留下？", "镜像描述程序；持久卷保存需要跨容器保留的状态", [
        ("01 创建容器 A", "image → container", "程序从镜像启动", "可写层属于这个容器"),
        ("02 写入命名卷", "appdata → /data", "把 keep.txt 写入卷", "确认应用写对路径"),
        ("03 删除容器 A", "docker rm", "容器可写层消失", "命名卷仍独立存在"),
        ("04 创建容器 B", "挂载同一个 appdata", "重新读取 keep.txt", "不是从镜像找回数据")
    ], "动手：用两个不同容器读写同一个命名卷，比较不挂卷时的结果。", "卷仍需备份；docker compose down -v 会删除相关命名卷。"),
    ("ssh-handshake", "SSH：服务器与用户各证明一次身份", "先识别你连的是谁，再证明你有权登录", [
        ("01 连接与协商", "TCP → SSH", "协商算法并交换密钥", "连接端口必须可达"),
        ("02 核对主机", "host key fingerprint", "客户端核对服务器", "首次指纹需可信来源"),
        ("03 验证用户", "public-key auth", "私钥留在客户端", "服务端验证签名证明"),
        ("04 登录会话", "shell / tunnel", "用户认证成功后访问", "权限仍由系统控制")
    ], "动手：阅读 ssh -v 输出，区分主机密钥检查与用户认证阶段。", "这是概念顺序图；加密传输在用户认证前建立，私钥不会发送给服务器。"),
    ("backup-transaction", "备份：先发布新归档，再清理旧文件", "失败不能把最后一份可恢复的数据一起带走", [
        ("01 检查与加锁", "路径 / 参数 / 锁", "备份目录在源目录外", "同目录一次只允许一写"),
        ("02 临时归档", "tar → 临时文件", "临时文件放在目标盘", "出错就保留全部旧备份"),
        ("03 校验与发布", "tar -tzf → rename", "确认归档能够读取", "同文件系统内改名"),
        ("04 保留五份", "新归档 + 四份旧归档", "NUL 分隔完整文件名", "只删除专用目录中的旧档")
    ], "动手：对比 --dry-run、成功备份与故意归档失败后的目录内容。", "预演不创建目录或锁；磁盘间复制不是原子改名，数据库还需一致性备份。"),
    ("ai-review-loop", "AI 辅助运维：建议必须经过验证", "把模型用于解释与提出假设，把操作依据留在证据里", [
        ("01 提供证据", "环境 + 错误 + 输出", "只提供必要且脱敏数据", "说明哪些事实尚未知"),
        ("02 提出假设", "原因 + 只读检查", "要求区分事实与推测", "先收集能证伪的证据"),
        ("03 人工审阅", "影响范围 + 回滚", "核对路径与权限边界", "高影响动作先隔离验证"),
        ("04 实测与记录", "执行 → 对比 → 复盘", "回到原始需求做验收", "失败就带新证据再分析")
    ], "动手：让 AI 解释一条报错，再用官方手册和测试环境验证它的建议。", "动画只展示学习流程，不连接任何模型，不会执行命令或上传日志。"),
]


SCENES.extend(scene[:-1] for scene in EXTRA_SCENES)


def render(slug, title, subtitle, cards, exercise, note, frames=None):
    esc = escape
    css = []
    for i in range(4):
        start, end = i * 25, (i + 1) * 25
        if i == 0:
            keyframes = "0%,24.9%{opacity:1}25%,100%{opacity:0}"
        elif i == 3:
            keyframes = "0%,74.9%{opacity:0}75%,100%{opacity:1}"
        else:
            keyframes = f"0%,{start - 0.1}%{{opacity:0}}{start}%,{end - 0.1}%{{opacity:1}}{end}%,100%{{opacity:0}}"
        css.append(f"@keyframes step{i}{{{keyframes}}}.phase-{i}{{animation:step{i} 12s linear 3}}")
    height = 640 if frames else 500
    parts = [f'''<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="{height}" viewBox="0 0 1080 {height}" role="img" aria-labelledby="title desc">
<title id="title">{esc(title)}</title>
<desc id="desc">{esc(subtitle)}。四步示意，每 12 秒一轮，播放三轮后停止。{esc(note)}</desc>
<style>
text{{font-family:"Noto Sans CJK SC","Microsoft YaHei",sans-serif}}
.code{{font-family:Consolas,monospace}}
.focus{{opacity:0}}
.output{{opacity:0}}.output.phase-0{{opacity:1}}
{''.join(css)}
@keyframes travel{{0%,15%{{transform:translateX(0)}}25%,40%{{transform:translateX(260px)}}50%,65%{{transform:translateX(520px)}}75%,100%{{transform:translateX(780px)}}}}
.token{{animation:travel 12s ease-in-out 3}}
@media (prefers-reduced-motion:reduce){{.focus,.token,.output{{animation:none}}.token{{display:none}}}}
</style>
<rect width="1080" height="{height}" rx="22" fill="#0d1117"/>
<text x="40" y="48" fill="#7ee787" font-size="13" letter-spacing="2">LINUX · VISUAL LAB</text>
<text x="40" y="88" fill="#f0f6fc" font-size="28" font-weight="bold">{esc(title)}</text>
<text x="40" y="120" fill="#9da7b3" font-size="16">{esc(subtitle)}</text>
<path d="M148 320 H928" fill="none" stroke="#303d4d" stroke-width="3"/>
''']
    for i, (heading, command, line1, line2) in enumerate(cards):
        x = 40 + i * 260
        parts.append(f'''<g>
<rect x="{x}" y="157" width="220" height="145" rx="14" fill="#161b22" stroke="#303d4d"/>
<rect class="focus phase-{i}" x="{x}" y="157" width="220" height="145" rx="14" fill="none" stroke="#58a6ff" stroke-width="3"/>
<text x="{x+16}" y="189" fill="#f0f6fc" font-size="18" font-weight="bold">{esc(heading)}</text>
<text class="code" x="{x+16}" y="221" fill="#79c0ff" font-size="13">{esc(command)}</text>
<text x="{x+16}" y="252" fill="#c9d1d9" font-size="14">{esc(line1)}</text>
<text x="{x+16}" y="276" fill="#9da7b3" font-size="14">{esc(line2)}</text>
<circle cx="{148+i*260}" cy="320" r="5" fill="#62758b"/>
</g>''')
    if frames:
        parts.append('<rect x="40" y="350" width="1000" height="123" rx="12" fill="#172735"/>')
        parts.append('<text x="58" y="375" fill="#7c9aab" font-size="12">示意输入与状态 · 非真实采样</text>')
        for index, lines in enumerate(frames):
            parts.append(f'<g class="output phase-{index}">')
            for line_index, line in enumerate(lines):
                parts.append(f'<text class="code" x="58" y="{407+line_index*27}" fill="#b5e4d4" font-size="16">{esc(line)}</text>')
            parts.append('</g>')
    offset = 140 if frames else 0
    parts.append(f'''<circle class="token" cx="148" cy="320" r="8" fill="#7ee787"/>
<rect x="40" y="{356+offset}" width="1000" height="106" rx="12" fill="#101f2c"/>
<text x="58" y="{390+offset}" fill="#e6edf3" font-size="16">{esc(exercise)}</text>
<text x="58" y="{421+offset}" fill="#9da7b3" font-size="14">{esc(note)}</text>
<text x="58" y="{445+offset}" fill="#7790a9" font-size="12">静态文字始终可读 · 支持减少动态效果设置 · 学习站可暂停与单步</text>
</svg>
''')
    return '\n'.join(parts)


if __name__ == '__main__':
    for scene in SCENES:
        target = ROOT / 'assets' / 'animations' / f'{scene[0]}.svg'
        target.write_text(render(*scene), encoding='utf-8', newline='\n')
        print(f'Generated {target.name}')
    catalog_path = ROOT / 'assets/animations/catalog.json'
    catalog = json.loads(catalog_path.read_text(encoding='utf-8'))
    existing = {entry['file']: entry for entry in catalog}
    chapters = {f'{scene[0]}.svg': scene[-1] for scene in EXTRA_SCENES}
    for scene in SCENES:
        filename = f'{scene[0]}.svg'
        entry = existing.get(filename)
        if entry is None:
            entry = {'file': filename, 'title': scene[1].split('：')[0], 'chapter': chapters[filename]}
            catalog.append(entry)
        entry['duration'] = 12
        entry['width'] = 1080
        entry['height'] = 640 if len(scene) > 6 else 500
        entry['steps'] = [{'title': card[0], 'description': '；'.join(card[2:])} for card in scene[3]]
    catalog_path.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
