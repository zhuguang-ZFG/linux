"""Fetch the eleven explicitly selected Commons photos and retain attribution metadata.

Run manually when adding these assets; CI never needs network access.
"""
from datetime import date
import hashlib
import html
import io
import json
from pathlib import Path
import re
import urllib.parse
import urllib.request

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "images"
SELECTION = [
    ("ddr4-memory.jpg", "File:Two 8 GB DDR4-2133 ECC 1.2 V RDIMMs (straightened).jpg", "DDR4 ECC RDIMM 内存条"),
    ("ethernet-connector.jpg", "File:Ethernet RJ45 connector p1160054.jpg", "8P8C 网线接头与双绞线"),
    ("ethernet-switch.jpg", "File:Ethernet switch Atlantis A02-F5P 5 ports backend.jpg", "五口以太网交换机背面"),
    ("usb-webcam.jpg", "File:USB webcam for PC.jpg", "USB 摄像头实物"),
    ("axial-resistors.jpg", "File:Electronic-Axial-Lead-Resistors-Array.jpg", "不同阻值的轴向电阻"),
    ("nvme-ssd.jpg", "File:Samsung 980 PRO PCIe 4.0 NVMe SSD 1TB-top PNr°0915.jpg", "M.2 NVMe SSD 正面"),
    ("gpu-card.jpg", "File:RTX 3090 Founders Edition.jpg", "GeForce RTX 3090 显卡实物"),
    ("nas-device.jpg", "File:Synology Disk Station DS223J - NAS-Server.jpg", "Synology DiskStation 网络存储"),
    ("mechanical-keyboard.jpg", "File:Mechanical Keyboard.jpg", "机械键盘实物"),
    ("motherboard-g41.jpg", "File:PCWare IPM41-D3 Motherboard (53162758424).jpg", "micro-ATX 主板实物（G41 芯片组）"),
    ("router-wifi.jpg", "File:Freedom Box Wifi Router.jpg", "家用无线路由器实物"),
]


def fetch(url):
    request = urllib.request.Request(url, headers={"User-Agent": "LinuxLearningCourse/1.0 (educational documentation; source attribution)"})
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read()


def plain(value):
    return html.unescape(re.sub(r"<[^>]+>", "", value)).strip()


def main():
    sources_path = OUT / "SOURCES.json"
    prior = json.loads(sources_path.read_text(encoding="utf-8")) if sources_path.exists() else []
    prior_by_file = {record["file"]: record for record in prior}
    additions = []
    for filename, title, caption in SELECTION:
        if (OUT / filename).exists():
            print(f"Skipping existing asset: {filename}")
            continue
        query = urllib.parse.urlencode({"action": "query", "format": "json", "titles": title,
                                        "prop": "imageinfo", "iiprop": "url|extmetadata", "iiurlwidth": 1200})
        data = json.loads(fetch("https://commons.wikimedia.org/w/api.php?" + query))
        info = next(iter(data["query"]["pages"].values()))["imageinfo"][0]
        meta = info["extmetadata"]
        license_name = plain(meta["LicenseShortName"]["value"])
        if license_name not in {"CC BY 4.0", "CC BY-SA 4.0", "CC BY-SA 3.0", "CC0", "Public domain"}:
            raise SystemExit(f"Review the license before use: {license_name}")
        url = info.get("thumburl", info["url"]).split("?")[0]
        raw = fetch(url)
        image = Image.open(io.BytesIO(raw)).convert("RGB")
        image.thumbnail((1200, 1000))
        target = OUT / filename
        image.save(target, "JPEG", quality=88, optimize=True)
        record = {
            "file": filename, "caption": caption, "commons_title": title,
            "author": plain(meta.get("Artist", {}).get("value", "")),
            "source": info["descriptionurl"], "download_url": url,
            "license": license_name, "license_url": meta.get("LicenseUrl", {}).get("value", ""),
            "description": plain(meta.get("ImageDescription", {}).get("value", "")),
            "retrieved": date.today().isoformat(), "changes": "Resized and JPEG recompressed; no scene or object edits.",
            "width": image.width, "height": image.height,
            "sha256": hashlib.sha256(target.read_bytes()).hexdigest(),
        }
        additions.append(record)
        print(f"Saved {filename}: {image.width}x{image.height}, {license_name}")
    merged = prior + [record for record in additions if record["file"] not in prior_by_file]
    sources_path.write_text(json.dumps(merged, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
