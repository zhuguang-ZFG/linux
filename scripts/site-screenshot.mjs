// site-screenshot.mjs —— 用真实构建产物刷新 README 首页实拍图与 OG 卡片。
// 固定主题取图，避免跟随系统导致截图不确定：
//   light 1440x900 -> assets/screenshot-home.png
//   dark  1440x900 -> assets/screenshot-home-dark.png
//   light 1200x630 -> web/og-image.png（随后需 `pnpm run build` 同步进 _site）
// 用法：pnpm run build && pnpm run shot:site && pnpm run build
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';

const PORT = 4193;
const BASE = `http://127.0.0.1:${PORT}/linux/`;
const VIEWPORT = { width: 1440, height: 900 };
const SHOTS = [
  { theme: 'light', path: 'assets/screenshot-home.png' },
  { theme: 'dark', path: 'assets/screenshot-home-dark.png' },
  { theme: 'light', path: 'web/og-image.png', viewport: { width: 1200, height: 630 } },
];

const server = spawn('node', ['scripts/serve-site.mjs'], {
  env: { ...process.env, COURSE_PORT: String(PORT) },
  stdio: 'ignore',
});
const wait = ms => new Promise(r => setTimeout(r, ms));
let ready = false;
for (let i = 0; i < 40 && !ready; i++) {
  try { const r = await fetch(`${BASE}data/course.json`); ready = r.ok; } catch { /* retry */ }
  if (!ready) await wait(250);
}
if (!ready) { console.error('server not ready — run `pnpm run build` first'); server.kill(); process.exit(2); }

const browser = await chromium.launch();
try {
  for (const { theme, path, viewport } of SHOTS) {
    const context = await browser.newContext({ viewport: viewport || VIEWPORT });
    await context.addInitScript(value => { try { localStorage.setItem('linux-course-theme', value); } catch { /* session only */ } }, theme);
    const page = await context.newPage();
    await page.goto(BASE);
    await page.waitForSelector('.hero h1');
    const stats = (await page.locator('.stat-strip').innerText()).replace(/\s+/g, ' ').trim();
    await page.waitForTimeout(400);
    await page.screenshot({ path });
    console.log(`${theme}  ${path}  [${stats}]`);
    await context.close();
  }
} finally {
  await browser.close();
  server.kill();
}
