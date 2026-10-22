import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

// 校验字幕与分镜是否落在同一时间轴上：改过 produce.mjs 的时间轴逻辑后跑一次
const ROOT = path.resolve(import.meta.dirname, '../..');
const episode = process.argv[2] ?? 'pipes';
const stage = path.join(ROOT, 'video-out', episode, 'stage.html');
const src = await readFile(stage, 'utf8');
const caps = [...src.matchAll(/\{"start":([\d.]+),"end":([\d.]+),"text":"([^"]{0,18})/g)]
  .map((m) => ({ start: Number(m[1]), end: Number(m[2]), text: m[3] }));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
await page.goto('file:///' + stage.replaceAll('\\', '/'));
await page.evaluate(() => { window.setFormat('tall'); window.measure(); });
let bad = 0;
for (const c of caps) {
  const mid = (c.start + c.end) / 2;
  const got = await page.evaluate((t) => {
    window.seek(t);
    return {
      scene: document.querySelector('.scene.on')?.id,
      cap: document.getElementById('cap').textContent.slice(0, 18),
    };
  }, mid);
  if (got.cap !== c.text) bad++;
  console.log(`${mid.toFixed(1)}s ${got.scene} ${got.cap === c.text ? 'OK      ' : 'MISMATCH'} ${JSON.stringify(got.cap)}`);
}
await browser.close();
console.log(bad ? `${bad} 处字幕与画面不同步` : '字幕-画面全部同步');
process.exit(bad ? 1 : 0);
