// check-overflow.mjs —— 学习站动画播放器结构断言 + SVG 文本溢出检查。
// 遍历 catalog.json 中带 duration/steps 的生成动画，在 _site 副本上：
//   1) 播放器就绪（播放按钮可用）
//   2) 步骤卡片数量与目录一致
//   3) 时间显示与单步推进符合 12 秒 / N 步契约
//   4) 步进后对应 .output 帧可见（存在该帧时）
//   5) 文本右边界不越过卡片/面板/整幅限额（防止 firewalwall-chains 式回归）
// 原始 6 个手写动画无 duration/steps 元数据，不属于播放器契约，跳过。
// 用法：pnpm run build && pnpm run check:overflow
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const PORT = 4192;
const BASE = `http://127.0.0.1:${PORT}/linux/`;
const catalog = JSON.parse(readFileSync('assets/animations/catalog.json', 'utf-8'));
const candidates = catalog.filter(item => Array.isArray(item.steps) && item.steps.length >= 1 && Number.isFinite(item.duration));

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
let failures = 0;

for (const animation of candidates) {
  const { file, title, duration, steps } = animation;
  const page = await browser.newPage();
  const problems = [];
  const check = (name, pass, detail = '') => { if (!pass) { problems.push(`${name}${detail ? ` (${detail})` : ''}`); } };
  try {
    await page.goto(`${BASE}#animation=${encodeURIComponent(file)}`);
    await page.waitForSelector('#animation-play');
    await page.waitForFunction(() => {
      const f = document.querySelector('#animation-frame');
      return f && f.contentDocument && f.contentDocument.querySelector('svg');
    });
    check('play enabled', await page.locator('#animation-play').isEnabled());
    check('step-card count', (await page.locator('.step-card').count()) === steps.length, `${await page.locator('.step-card').count()} != ${steps.length}`);

    const size = duration / steps.length;
    const sizeText = size.toFixed(1);
    const t0 = (await page.locator('#animation-time').textContent()).trim();
    check('time 0.0 start', t0 === `0.0 / ${duration}s`, t0);
    await page.locator('#animation-step').click();
    const t1 = (await page.locator('#animation-time').textContent()).trim();
    check('step advances time', t1 === `${sizeText} / ${duration}s`, t1);
    if (steps.length >= 2) {
      check('card 2 active', await page.locator('[data-step-card="1"]').evaluate(el => el.classList.contains('active')));
    }

    const hasOutput = await page.frameLocator('#animation-frame').locator('svg .output').count().then(n => n > 0);
    if (hasOutput && steps.length >= 2) {
      check('phase-1 visible at step 2', await page.frameLocator('#animation-frame').locator('.output.phase-1').evaluate(el => getComputedStyle(el).opacity === '1'));
    }
    if (hasOutput && steps.length >= 4) {
      for (let i = 0; i < steps.length - 1; i++) await page.locator('#animation-step').click();
      check('phase-3 visible at final step', await page.frameLocator('#animation-frame').locator('.output.phase-3').evaluate(el => getComputedStyle(el).opacity === '1'));
      check('final card active', await page.locator(`[data-step-card="${steps.length - 1}"]`).evaluate(el => el.classList.contains('active')));
    }

    const overflow = await page.evaluate(() => {
      const f = document.querySelector('#animation-frame').contentDocument;
      const svg = f.querySelector('svg');
      const panels = [...svg.querySelectorAll('rect')].filter(r => r.getAttribute('width') === '1000').map(r => r.getBBox());
      const cardGroups = [...svg.querySelectorAll('g')].filter(g => {
        const rect = g.querySelector('rect');
        return rect && rect.getAttribute('width') === '220' && rect.getAttribute('height') === '145';
      });
      const byCat = { card: [], panel: [], whole: [] };
      for (const t of svg.querySelectorAll('text')) {
        const b = t.getBBox();
        const right = b.x + b.width;
        const card = cardGroups.find(g => g.contains(t));
        if (card) {
          const rb = card.querySelector('rect').getBBox();
          byCat.card.push({ right, limit: rb.x + rb.width - 8 });
        } else {
          const inPanel = panels.some(p => b.y >= p.y && b.y <= p.y + p.height && b.x >= p.x);
          (inPanel ? byCat.panel : byCat.whole).push({ right, limit: inPanel ? 1032 : 1040 });
        }
      }
      const all = [...byCat.card, ...byCat.panel, ...byCat.whole];
      const worst = list => list.sort((a, b) => (b.right - b.limit) - (a.right - a.limit))[0];
      return {
        card: { overflow: byCat.card.some(x => x.right > x.limit), worst: worst(byCat.card) },
        panel: { overflow: byCat.panel.some(x => x.right > x.limit), worst: worst(byCat.panel) },
        whole: { overflow: byCat.whole.some(x => x.right > x.limit), worst: worst(byCat.whole) },
        all: { overflow: all.some(x => x.right > 1040), worst: worst(all) },
      };
    });
    for (const cat of ['card', 'panel', 'whole', 'all']) {
      const w = overflow[cat].worst;
      check(`overflow ${cat}`, !overflow[cat].overflow, w ? `${w.right.toFixed(1)}/${w.limit}` : 'n/a');
    }
  } catch (error) {
    problems.push(`exception: ${error.message.slice(0, 120)}`);
  } finally {
    await page.close();
  }
  if (problems.length) {
    failures += 1;
    console.log(`FAIL  ${file}  ${title}`);
    for (const p of problems) console.log(`      - ${p}`);
  } else {
    console.log(`PASS  ${file}  ${title}`);
  }
}

await browser.close();
server.kill();
console.log(`\n${candidates.length - failures}/${candidates.length} animations passed structural + overflow checks`);
process.exit(failures === 0 ? 0 : 1);
