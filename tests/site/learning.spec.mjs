import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Provider behavior is documented separately; these tests validate our UI and URLs.
  await page.route(/https:\/\//, route => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><p>External provider test fixture</p>' }));
});

test('home shows the actual catalog and accessible route entries', async ({ page }) => {
  await page.goto('');
  await expect(page.locator('.hero h1')).toContainText('能动手的本领');
  await expect(page.locator('.stat-strip')).toContainText('42');
  await expect(page.locator('.stat-strip')).toContainText('67');
  await expect(page.locator('.stat-strip')).toContainText('82');
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

test('platform filters show 51 Bilibili parts and 16 YouTube videos', async ({ page }) => {
  await page.goto('#videos');
  await expect(page.locator('.media-card')).toHaveCount(67);
  await page.getByRole('link', { name: 'B站 · 中文', exact: true }).click();
  await expect(page.locator('.media-card')).toHaveCount(51);
  await page.getByRole('link', { name: 'YouTube · English', exact: true }).click();
  await expect(page.locator('.media-card')).toHaveCount(16);
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

test('animation restores the step from a deep link and announces it', async ({ page }) => {
  await page.goto('#animation=git-branches.svg&step=3');
  await expect(page.locator('#animation-time')).toHaveText('6.0 / 12s');
  await expect(page.locator('[data-step-card="2"]')).toHaveClass(/active/);
  await expect(page.frameLocator('#animation-frame').locator('.output.phase-2')).toHaveCSS('opacity', '1');
  await expect(page.locator('#animation-announcer')).toHaveText(/第 3 步，共 4 步/);
});

test('animation supports keyboard step, play/pause and reset', async ({ page }) => {
  await page.goto('#animation=git-branches.svg');
  await expect(page.locator('#animation-time')).toHaveText('0.0 / 12s');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#animation-time')).toHaveText('3.0 / 12s');
  await expect(page.locator('[data-step-card="1"]')).toHaveClass(/active/);
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#animation-time')).toHaveText('0.0 / 12s');
  await page.keyboard.press('Space');
  await expect(page.locator('#animation-play')).toHaveText('暂停');
  await expect.poll(async () => Number(await page.locator('#animation-progress').inputValue())).toBeGreaterThan(0.1);
  await page.keyboard.press('Space');
  const paused = Number(await page.locator('#animation-progress').inputValue());
  await page.waitForTimeout(150);
  expect(Number(await page.locator('#animation-progress').inputValue())).toBeCloseTo(paused, 1);
  await page.keyboard.press('r');
  await expect(page.locator('#animation-time')).toHaveText('0.0 / 12s');
});

test('animation page navigates to adjacent animations in catalog order', async ({ page }) => {
  await page.goto('#animation=journal-query.svg');
  const nav = page.locator('.lesson-next');
  await expect(nav).toContainText('Bash 退出码');
  await expect(nav).toContainText('按钮数据记录');
  await expect(nav.locator('a').first()).toHaveAttribute('href', '#animation=bash-exitcode.svg');
  await nav.locator('a').last().click();
  await expect(page.locator('#animation-frame')).toHaveAttribute('src', /event-record\.svg/);
  await expect(page.locator('h1.page-title')).toContainText('按钮数据记录');
  const nav2 = page.locator('.lesson-next');
  await expect(nav2).toContainText('journalctl');
  await nav2.locator('a').first().click();
  await expect(page.locator('#animation-frame')).toHaveAttribute('src', /journal-query\.svg/);
  await expect(page.locator('h1.page-title')).toContainText('journalctl');
});

test('animation copy-link shares a step deep link without reloading the player', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { value: { writeText: async text => { window.__copied = text; } } }));
  await page.goto('#animation=git-branches.svg&step=2');
  await expect(page.locator('#animation-time')).toHaveText('3.0 / 12s');
  await page.locator('#animation-copy-link').click();
  await expect.poll(() => page.evaluate(() => window.__copied)).toContain('#animation=git-branches.svg');
  await expect.poll(() => page.evaluate(() => window.__copied)).toContain('step=2');
  await expect(page.locator('#animation-time')).toHaveText('3.0 / 12s');
  await expect(page.locator('#animation-frame')).toHaveCount(1);
});

test('video page navigates to adjacent videos in gallery order', async ({ page }) => {
  await page.goto('#video=b-vim');
  const nav = page.locator('.lesson-next');
  await expect(nav.locator('a').first()).toHaveAttribute('href', '#video=b-ssh');
  await expect(nav.locator('a').last()).toHaveAttribute('href', '#video=b-man');
  await nav.locator('a').last().click();
  await expect(page).toHaveURL(/#video=b-man/);
  await expect(page.locator('#video-stage')).toBeVisible();
  const nav2 = page.locator('.lesson-next');
  await expect(nav2.locator('a').first()).toHaveAttribute('href', '#video=b-vim');
  await nav2.locator('a').first().click();
  await expect(page).toHaveURL(/#video=b-vim/);
});

test('reading page arrow keys navigate between adjacent chapters', async ({ page }) => {
  await page.goto(`#read=${encodeURIComponent('docs/00-onboarding/01-为什么人人都要学Linux.md')}`);
  await expect(page.locator('.article h1')).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(/#read=docs%2F00-onboarding%2F02-/);
  await expect(page.locator('.article h1')).toContainText('Linux 的前世今生');
  await page.keyboard.press('ArrowLeft');
  await expect(page).toHaveURL(/#read=docs%2F00-onboarding%2F01-/);
  await expect(page.locator('.article h1')).toContainText('为什么人人');
});

test('search supports arrow-key selection and Enter opens the picked result', async ({ page }) => {
  await page.goto('');
  await page.locator('#search').fill('sed');
  await expect(page.locator('.search-result').first()).toBeVisible();
  const firstHref = await page.locator('.search-result').first().getAttribute('href');
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('.search-result.selected')).toHaveCount(1);
  expect(await page.locator('.search-result.selected').getAttribute('href')).toBe(firstHref);
  await page.keyboard.press('ArrowDown');
  const selectedHref = await page.locator('.search-result.selected').getAttribute('href');
  expect(selectedHref).not.toBe(firstHref);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`#${selectedHref.slice(1).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  await expect(page.locator('main')).not.toContainText('没有找到');
});

test('video page arrow keys navigate between adjacent videos', async ({ page }) => {
  await page.goto('#video=b-vim');
  await expect(page.locator('#video-stage')).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(/#video=b-man/);
  await page.keyboard.press('ArrowLeft');
  await expect(page).toHaveURL(/#video=b-vim/);
});

test('theme toggle cycles system/dark/light and remembers the choice', async ({ page }) => {
  await page.goto('');
  const toggle = page.locator('#theme-toggle');
  await expect(toggle).toBeVisible();
  await toggle.click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await toggle.click();
  await expect(page.locator('html')).not.toHaveClass(/dark/);
});

test('back-to-top appears after scrolling and returns to the top', async ({ page }) => {
  await page.goto(`#read=${encodeURIComponent('docs/01-basics/02-查看与编辑文件-Vim.md')}`);
  await expect(page.locator('.article h1')).toBeVisible();
  const button = page.locator('#back-to-top');
  await expect(button).toBeHidden();
  await page.evaluate(() => window.scrollTo(0, 1200));
  await expect(button).toBeVisible();
  await button.click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(50);
});

test('progress export copies the completed list as JSON', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { value: { writeText: async text => { window.__copied = text; } } }));
  await page.goto(`#read=${encodeURIComponent('docs/01-basics/01-文件与目录操作.md')}`);
  await page.locator('[data-complete]').click();
  await page.locator('[data-action="export-progress"]').click();
  await expect.poll(() => page.evaluate(() => window.__copied)).toContain('completed');
  const payload = JSON.parse(await page.evaluate(() => window.__copied));
  expect(Array.isArray(payload.completed)).toBe(true);
  expect(payload.completed).toContain('docs/01-basics/01-文件与目录操作.md');
});

test('progress import merges exported JSON and ignores invalid entries', async ({ page }) => {
  await page.goto(`#read=${encodeURIComponent('docs/01-basics/01-文件与目录操作.md')}`);
  await page.locator('[data-complete]').click();
  const exported = JSON.stringify({ exportedAt: new Date().toISOString(), completed: ['docs/01-basics/01-文件与目录操作.md', 'docs/01-basics/02-查看与编辑文件-Vim.md', 'not-a-real-chapter'] });
  await page.locator('[data-action="clear-progress"]').click();
  await expect(page.locator('.sidebar-progress')).toContainText('0 / 42');
  await page.locator('[data-action="import-progress"]').click();
  await page.locator('#import-input').fill(exported);
  await page.locator('#import-confirm').click();
  await expect(page.locator('.sidebar-progress')).toContainText('2 / 42');
  await expect(page.locator('#toast')).toContainText('忽略 1 条无效');
  await page.reload();
  await expect(page.locator('.sidebar-progress')).toContainText('2 / 42');
});

test('reading progress bar fills as the page scrolls', async ({ page }) => {
  await page.goto(`#read=${encodeURIComponent('docs/01-basics/02-查看与编辑文件-Vim.md')}`);
  await expect(page.locator('.article h1')).toBeVisible();
  await expect(page.locator('#reading-progress')).toHaveCSS('width', '0px');
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect.poll(() => page.locator('#reading-progress').evaluate(el => parseFloat(getComputedStyle(el).width))).toBeGreaterThan(0);
});

test('question-mark shortcut opens the keyboard help and Escape closes it', async ({ page }) => {
  await page.goto('');
  await page.keyboard.press('?');
  await expect(page.locator('#help-dialog')).toBeVisible();
  await expect(page.locator('#help-dialog')).toContainText('相邻章节');
  await page.keyboard.press('Escape');
  await expect(page.locator('#help-dialog')).not.toBeVisible();
  await page.locator('footer [data-action="help"]').click();
  await expect(page.locator('#help-dialog')).toBeVisible();
});

test('search highlights the matched term and shows chapter stage context', async ({ page }) => {
  await page.goto('');
  await page.locator('#search').fill('权限');
  await expect(page.locator('.search-result').first()).toBeVisible();
  await expect(page.locator('.search-result mark').first()).toHaveText('权限');
  await expect(page.locator('.search-result[href*="03-%E7%94%A8%E6%88%B7%E4%B8%8E%E6%9D%83%E9%99%90"] .search-context')).toHaveText('基础命令');
});

test('reading TOC highlights the section in view while scrolling', async ({ page }) => {
  await page.goto(`#read=${encodeURIComponent('docs/01-basics/02-查看与编辑文件-Vim.md')}`);
  await expect(page.locator('.toc')).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
  await expect.poll(() => page.locator('.toc a.active').count()).toBeGreaterThan(0);
  const active = await page.locator('.toc a.active').textContent();
  expect(active.trim().length).toBeGreaterThan(0);
  await expect(page.locator(`.toc a`).filter({ hasText: active.trim() })).toHaveCount(1);
});

test('dark mode remaps theme variables and keeps reading surface readable', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('');
  const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bodyBg).toBe('rgb(11, 15, 20)');
  await page.goto(`#read=${encodeURIComponent('docs/02-advanced/01-管道与重定向.md')}`);
  await expect(page.locator('.article h1')).toBeVisible();
  const blockquoteBg = await page.locator('.article blockquote').first().evaluate(el => getComputedStyle(el).backgroundColor);
  expect(blockquoteBg).toBe('rgb(16, 37, 43)');
  const codeBg = await page.locator('.article code').first().evaluate(el => getComputedStyle(el).backgroundColor);
  expect(codeBg).toBe('rgb(27, 40, 54)');
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

test('continue-reading link appears after opening a chapter and resumes it', async ({ page }) => {
  await page.goto('');
  await expect(page.locator('.resume-link')).toHaveCount(0);
  const second = 'docs/01-basics/02-查看与编辑文件-Vim.md';
  await page.goto(`#read=${encodeURIComponent(second)}`);
  await expect(page.locator('.article h1')).toContainText('Vim');
  await page.goto('#home');
  const resume = page.locator('.resume-link');
  await expect(resume).toHaveCount(1);
  expect(decodeURIComponent(await resume.getAttribute('href'))).toContain(second);
  await resume.click();
  await expect(page.locator('.article h1')).toContainText('Vim');
  await expect(page.locator('.resume-link')).toHaveCount(0);
});

test('reading position is remembered when returning to a chapter', async ({ page }) => {
  const doc = 'docs/01-basics/01-文件与目录操作.md';
  await page.goto(`#read=${encodeURIComponent(doc)}`);
  await expect(page.locator('.article h1')).toContainText('文件与目录');
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBeGreaterThan(500);
  await page.goto('#home');
  await page.goto(`#read=${encodeURIComponent(doc)}`);
  await expect(page.locator('.article h1')).toContainText('文件与目录');
  await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBeGreaterThan(500);
});
