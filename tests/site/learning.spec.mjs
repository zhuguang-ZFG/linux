import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Provider behavior is documented separately; these tests validate our UI and URLs.
  await page.route(/https:\/\//, route => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><p>External provider test fixture</p>' }));
});

test('home shows the actual catalog and accessible route entries', async ({ page }) => {
  await page.goto('');
  await expect(page.locator('.hero h1')).toContainText('能动手的本领');
  await expect(page.locator('.stat-strip')).toContainText('42');
  await expect(page.locator('.stat-strip')).toContainText('30');
  await expect(page.locator('.stat-strip')).toContainText('45');
  await expect(page.locator('.chapter-link')).toHaveCount(42);
  await page.getByRole('link', { name: '开始第一课' }).click();
  await expect(page.locator('.article h1')).toContainText('为什么人人');
});

test('home loads no chapter body until a chapter is opened', async ({ page }) => {
  const bodies = [];
  page.on('response', response => { if (response.url().includes('/data/docs/')) bodies.push(response.url()); });
  await page.goto('');
  await expect(page.locator('.stat-strip')).toContainText('42');
  expect(bodies).toEqual([]);
  await page.getByRole('link', { name: '开始第一课' }).click();
  await expect(page.locator('.article h1')).toContainText('为什么人人');
  await expect.poll(() => bodies.length).toBeGreaterThan(0);
  expect(decodeURIComponent(bodies[0])).toContain('docs/00-onboarding/01-');
});

test('home exposes the goal-to-practice learning loop', async ({ page }) => {
  await page.goto('');
  const cards = page.locator('.learning-loop .loop-card');
  await expect(cards).toHaveCount(5);
  const hrefs = await cards.evaluateAll(nodes => nodes.map(node => decodeURIComponent(node.getAttribute('href'))));
  expect(hrefs).toEqual(['#read=LEARNING_PATHS.md', '#read=resources/environment-matrix.md', '#read=resources/toolbox.md', '#read=resources/prompt-lab.md', '#read=exercises/README.md']);
  await cards.nth(1).click();
  await expect(page.locator('.article h1')).toContainText('先确认实验环境');
});

test('search ranks title matches and can enter a chapter', async ({ page }) => {
  await page.goto('');
  await expect(page.locator('.hero')).toBeVisible();
  await page.locator('#search').fill('sed');
  await expect(page.locator('.search-result').first()).toContainText('sed');
  await page.locator('#search').press('Enter');
  await expect(page.locator('.article h1')).toContainText('sed');
});

test('full-text-only matches still work through the lazily loaded index', async ({ page }) => {
  await page.goto('');
  const indexRequests = [];
  page.on('response', response => { if (response.url().includes('data/search.json')) indexRequests.push(response.url()); });
  await expect(page.locator('.hero')).toBeVisible();
  expect(indexRequests).toEqual([]);
  await page.locator('#search').fill('inode');
  const first = page.locator('.search-result').first();
  await expect(first.locator('small')).toHaveText('章节');
  expect((await first.textContent()).toLowerCase()).not.toContain('inode');
  await expect.poll(() => indexRequests.length).toBe(1);
});

test('platform filters show 15 Bilibili parts and 15 YouTube videos', async ({ page }) => {
  await page.goto('#videos');
  await expect(page.locator('.media-card')).toHaveCount(30);
  await page.getByRole('link', { name: 'B站 · 中文', exact: true }).click();
  await expect(page.locator('.media-card')).toHaveCount(15);
  await page.getByRole('link', { name: 'YouTube · English', exact: true }).click();
  await expect(page.locator('.media-card')).toHaveCount(15);
});

test('Bilibili embeds the selected CID only after explicit loading and keeps fallback', async ({ page }) => {
  await page.goto('#video=b-vim');
  await expect(page.getByRole('button', { name: '加载B站播放器' })).toBeVisible();
  await expect(page.locator('#video-stage iframe')).toHaveCount(0);
  await page.getByRole('button', { name: '加载B站播放器' }).click();
  const frame = page.locator('#video-stage iframe');
  await expect(frame).toHaveAttribute('src', /player\.bilibili\.com\/player.html.*bvid=BV1Sv411r7vd.*cid=257393867.*p=16.*autoplay=0/);
  await expect(page.getByRole('link', { name: '在原站打开' })).toHaveAttribute('href', /\?p=16$/);
});

test('YouTube uses an official embed with an origin referrer policy and fallback', async ({ page }) => {
  await page.goto('#video=y-git');
  await page.getByRole('button', { name: '加载YouTube播放器' }).click();
  const frame = page.locator('#video-stage iframe');
  await expect(frame).toHaveAttribute('src', /youtube-nocookie\.com\/embed\/RGOj5yH7evk\?/);
  await expect(frame).toHaveAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
  await expect(page.getByRole('link', { name: '在原站打开' })).toBeVisible();
});

test('chapter renders Mermaid, supports safe copying and retains completion after reload', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { value: { writeText: async text => { window.__copied = text; } } }));
  await page.goto(`#read=${encodeURIComponent('docs/02-advanced/01-管道与重定向.md')}`);
  await expect(page.locator('.article .mermaid svg').first()).toBeVisible();
  const code = await page.locator('.article pre > code').first().textContent();
  await page.locator('.copy-button').first().click();
  await expect.poll(() => page.evaluate(() => window.__copied)).toBe(code);
  await page.locator('[data-complete]').click();
  await page.reload();
  await expect(page.locator('[data-complete]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.sidebar-progress')).toContainText('1 / 42');
});

test('animation defaults to pause and supports steps, play/pause and reset', async ({ page }) => {
  await page.goto('#animation=git-branches.svg');
  const play = page.locator('#animation-play');
  await expect(play).toBeEnabled();
  await expect(play).toHaveText('播放');
  await expect(page.locator('#animation-time')).toHaveText('0.0 / 12s');
  await page.locator('#animation-step').click();
  await expect(page.locator('#animation-time')).toHaveText('3.0 / 12s');
  await expect(page.frameLocator('#animation-frame').locator('.output.phase-1')).toHaveCSS('opacity', '1');
  await expect(page.frameLocator('#animation-frame').locator('.output.phase-1')).toContainText('feature: A → B');
  await play.click();
  await expect(play).toHaveText('暂停');
  await expect.poll(async () => Number(await page.locator('#animation-progress').inputValue())).toBeGreaterThan(3.1);
  await play.click();
  const paused = Number(await page.locator('#animation-progress').inputValue());
  await page.waitForTimeout(150);
  expect(Number(await page.locator('#animation-progress').inputValue())).toBeCloseTo(paused, 1);
  await page.locator('#animation-reset').click();
  await expect(page.locator('#animation-time')).toHaveText('0.0 / 12s');
});

test('animation ends at the final state instead of wrapping to its first frame', async ({ page }) => {
  await page.goto('#animation=git-branches.svg');
  await expect(page.locator('#animation-progress')).toBeEnabled();
  await page.locator('#animation-progress').evaluate(input => { input.value = '12'; input.dispatchEvent(new Event('input', { bubbles: true })); });
  await expect(page.locator('[data-step-card="3"]')).toHaveClass(/active/);
  await expect(page.frameLocator('#animation-frame').locator('.output.phase-3')).toHaveCSS('opacity', '1');
});

test('reduced-motion preference still provides paused controls and readable steps', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('#animation=git-branches.svg');
  await expect(page.locator('#animation-play')).toBeEnabled();
  await expect(page.locator('#animation-play')).toHaveText('播放');
  await page.locator('#animation-step').click();
  await expect(page.locator('[data-step-card="1"]')).toHaveClass(/active/);
  await expect(page.frameLocator('#animation-frame').locator('.output.phase-1')).toHaveCSS('opacity', '1');
});

test('mobile drawer opens and closes after selecting a chapter without page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('');
  await expect(page.locator('.hero')).toBeVisible();
  await page.locator('#menu-toggle').click();
  await expect(page.locator('#menu-toggle')).toHaveAttribute('aria-expanded', 'true');
  await page.locator('.stage-nav').nth(1).locator('summary').click();
  await page.locator('.stage-nav').nth(1).locator('.chapter-link').first().click();
  await expect(page.locator('.article h1')).toContainText('文件与目录');
  await expect(page.locator('#menu-toggle')).toHaveAttribute('aria-expanded', 'false');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('invalid routes and search markup are shown safely', async ({ page }) => {
  await page.goto('#read=missing.md');
  await expect(page.locator('main')).toContainText('没有找到');
  await page.locator('#search').fill('<img src=x onerror=alert(1)>');
  await expect(page.locator('.search-empty')).toBeVisible();
  await expect(page.locator('#search-results img')).toHaveCount(0);
});
