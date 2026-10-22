#!/usr/bin/env python3
"""一句旁白 -> mp3 + 逐字时间戳 json。两个文件都在则直接返回（缓存）。"""
import asyncio
import json
import os
import sys

import edge_tts


async def run(text, voice, rate, mp3, js):
    if os.path.exists(mp3) and os.path.exists(js):
        return
    words = []
    buf = bytearray()
    com = edge_tts.Communicate(text, voice=voice, rate=rate, boundary="WordBoundary")
    # 单句 90s 上限：网络挂起时让上层重试，而不是整条渲染卡死在哪里
    async with asyncio.timeout(90):
        async for ch in com.stream():
            if ch["type"] == "audio":
                buf.extend(ch["data"])
            elif ch["type"] == "WordBoundary":
                words.append([round(ch["offset"] / 1e7, 4), round(ch["duration"] / 1e7, 4), ch["text"]])
    if not os.path.exists(mp3):
        with open(mp3, "wb") as f:
            f.write(bytes(buf))
    with open(js, "w", encoding="utf-8") as f:
        json.dump({"words": words}, f, ensure_ascii=False)


if __name__ == "__main__":
    asyncio.run(run(*sys.argv[1:6]))
