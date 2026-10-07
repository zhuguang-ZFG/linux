"""Refresh public provider metadata. Metadata access is not a playback guarantee."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import sys
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
BILIBILI = [
    ("b-ssh", "BV1Sv411r7vd", 14, "SSH 远程登录", ["网络", "SSH"]),
    ("b-vim", "BV1Sv411r7vd", 16, "Vim 快速入门", ["Vim", "编辑"]),
    ("b-man", "BV1Sv411r7vd", 27, "帮助指令与手册", ["man", "求助"]),
    ("b-archive", "BV1Sv411r7vd", 37, "压缩与解压", ["tar", "压缩"]),
    ("b-permissions", "BV1Sv411r7vd", 44, "读懂 rwx 权限", ["权限", "chmod"]),
    ("b-cron", "BV1Sv411r7vd", 53, "crond 时间规则", ["cron", "自动化"]),
    ("b-disk", "BV1Sv411r7vd", 60, "磁盘使用情况查询", ["磁盘", "df"]),
    ("b-process", "BV1Sv411r7vd", 69, "ps 进程观察", ["进程", "ps"]),
    ("b-bash", "BV1Sv411r7vd", 91, "Shell 编程入门", ["Bash", "脚本"]),
    ("b-apt", "BV1Sv411r7vd", 112, "APT 原理", ["apt", "包管理"]),
    ("b-distros", "BV1ZZ37zdEp2", 9, "Linux 内核与发行版", ["发行版", "内核"]),
    ("b-env", "BV1ZZ37zdEp2", 15, "Shell 环境变量", ["环境变量", "PATH"]),
    ("b-redirection", "BV1ZZ37zdEp2", 30, "输入输出重定向", ["管道", "重定向"]),
    ("b-systemd", "BV1ZZ37zdEp2", 58, "systemctl 管理服务", ["systemd", "服务"]),
    ("b-grep", "BV1w4411B7a4", 12, "find 与 grep", ["grep", "文件搜索"]),
    ("b-partition", "BV1Sv411r7vd", 58, "磁盘分区机制", ["磁盘", "分区"]),
]
YOUTUBE = [
    ("y-linux100", "rrB13utjYV4", "Linux 的第一印象", ["启蒙", "概览"]),
    ("y-linux-things", "LKCVKw9CzFo", "Linux 知识全景", ["概览", "系统"]),
    ("y-linux-crash", "ROjZy1WbCIA", "Linux 入门课程", ["Linux", "基础"]),
    ("y-commands", "ZtqBQ68cfJc", "常用 Linux 命令", ["命令行", "基础"]),
    ("y-linux-full", "v392lEyM29A", "Linux 系统课程", ["Linux", "系统"]),
    ("y-pi-intro", "fCPM5072YPA", "树莓派课程介绍", ["树莓派", "课程介绍"]),
    ("y-pi-overview", "xiR14tSfc-U", "树莓派工作坊概览", ["树莓派", "课程介绍"]),
    ("y-git", "RGOj5yH7evk", "Git 与 GitHub 入门", ["Git", "协作"]),
    ("y-docker", "fqMOX6JJhGo", "Docker 容器入门", ["Docker", "容器"]),
    ("y-systemd", "Kzpm-rGAXos", "systemd 服务管理", ["systemd", "服务"]),
    ("y-ansible", "goclfp6a2IQ", "Ansible 101：入门", ["Ansible", "自动化"]),
    ("y-gpio", "iL_oZGHLHvU", "GPIO 与 gpiozero", ["树莓派", "GPIO"]),
    ("y-local-ai", "RQFfK7xIL28", "Ollama 与 Open WebUI", ["本地AI", "Docker"]),
    ("y-awk", "oPEnvuj9QrI", "awk 文本分析", ["awk", "文本处理"]),
    ("y-sed", "nXLnx8ncZyE", "sed 流编辑器", ["sed", "文本处理"]),
    ("y-gregg60s", "ZdVpKx6Wmc8", "Linux 性能分析 60 秒", ["性能", "USE"]),
]


def request(url):
    headers = {"User-Agent": "Mozilla/5.0 LinuxCourse/1.0", "Referer": "https://www.bilibili.com/"}
    with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=25) as response:
        return response.read().decode("utf-8")


def main():
    checked = datetime.now(timezone.utc).isoformat(timespec="seconds")
    courses = {}
    for bvid in dict.fromkeys(row[1] for row in BILIBILI):
        data = json.loads(request("https://api.bilibili.com/x/web-interface/view?bvid=" + bvid))
        if data.get("code") != 0:
            raise RuntimeError(f"Cannot verify Bilibili course {bvid}: {data.get('code')}")
        courses[bvid] = data["data"]
    videos = []
    for slug, bvid, page, title, tags in BILIBILI:
        course = courses[bvid]
        part = next(p for p in course["pages"] if p["page"] == page)
        videos.append({
            "id": slug, "platform": "bilibili", "providerId": bvid, "page": page, "cid": part["cid"],
            "title": title, "providerTitle": part["part"], "courseTitle": course["title"],
            "author": course["owner"]["name"], "duration": part["duration"], "language": "中文",
            "url": f"https://www.bilibili.com/video/{bvid}/?p={page}",
            "thumbnail": course["pic"].replace("http://", "https://"), "tags": tags,
            "kind": "课程选段", "note": "课程可能使用 CentOS 或其他版本；命令参数以本教程当前环境说明为准。",
            "verification": {"checkedAt": checked, "metadata": "verified", "source": f"https://api.bilibili.com/x/web-interface/view?bvid={bvid}", "playback": "not_tested"},
        })

    def youtube(row):
        slug, provider_id, title, tags = row
        url = f"https://www.youtube.com/watch?v={provider_id}"
        endpoint = "https://www.youtube.com/oembed?" + urllib.parse.urlencode({"url": url, "format": "json"})
        data = json.loads(request(endpoint))
        duration = None
        watch_status = "not_checked"
        try:
            raw = request(url)
            match = re.search(r"(?:var )?ytInitialPlayerResponse\s*=\s*", raw)
            if match:
                player = json.JSONDecoder().raw_decode(raw[match.end():])[0]
                seconds = player.get("videoDetails", {}).get("lengthSeconds")
                duration = int(seconds) if seconds else None
                watch_status = player.get("playabilityStatus", {}).get("status", "unknown")
        except (OSError, ValueError):
            pass
        overview = slug in {"y-pi-intro", "y-pi-overview", "y-linux100", "y-linux-things"}
        return {
            "id": slug, "platform": "youtube", "providerId": provider_id, "title": title,
            "providerTitle": data["title"], "author": data["author_name"], "duration": duration,
            "language": "English", "url": url, "thumbnail": data["thumbnail_url"], "tags": tags,
            "kind": "概览介绍" if overview else "专题课程", "start": 0,
            "note": "概览视频不等于完整实操课。" if overview else "字幕、界面和软件版本以原站为准；先理解概念，再在本教程环境验证。",
            "verification": {"checkedAt": checked, "metadata": "verified", "source": endpoint,
                             "watchPageStatus": watch_status, "playback": "not_tested"},
        }

    with ThreadPoolExecutor(max_workers=4) as pool:
        videos.extend(pool.map(youtube, YOUTUBE))
    output = {"schemaVersion": 1, "checkedAt": checked,
              "notice": "核验标题、作者、分P和可获取的时长。页面/接口可读取不等于已完整播放；不下载或搬运视频。",
              "videos": videos}
    (ROOT / "resources/videos.json").write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Verified metadata for {len(videos)} videos/parts; playback remains explicitly unverified")


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    main()
