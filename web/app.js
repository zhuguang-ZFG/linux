const main = document.querySelector('#main');
const sidebar = document.querySelector('#sidebar');
const search = document.querySelector('#search');
const results = document.querySelector('#search-results');
const escape = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const themeLabel = { system: '跟随系统', dark: '深色', light: '浅色' };
let themePreference;
try { themePreference = localStorage.getItem('linux-course-theme') || 'system'; } catch { themePreference = 'system'; }
const darkQuery = matchMedia('(prefers-color-scheme: dark)');
function applyTheme() {
  const dark = themePreference === 'dark' || (themePreference === 'system' && darkQuery.matches);
  document.documentElement.classList.toggle('dark', dark);
  const label = themeLabel[themePreference];
  const btn = document.querySelector('#theme-toggle');
  if (btn) { btn.title = `主题：${label}（点击切换）`; btn.setAttribute('aria-label', `切换主题（当前：${label}）`); }
}
applyTheme();
document.querySelector('#theme-toggle')?.addEventListener('click', () => {
  themePreference = { system: 'dark', dark: 'light', light: 'system' }[themePreference];
  try { localStorage.setItem('linux-course-theme', themePreference); } catch { /* session only */ }
  applyTheme();
  if (document.querySelector('.article .mermaid')) renderDiagrams(routeVersion).catch(() => {});
});
darkQuery.addEventListener('change', () => { if (themePreference === 'system') { applyTheme(); if (document.querySelector('.article .mermaid')) renderDiagrams(routeVersion).catch(() => {}); } });
const topButton = document.querySelector('#back-to-top');
const progressBar = document.querySelector('#reading-progress');
const importDialog = document.querySelector('#import-dialog');
const importInput = document.querySelector('#import-input');
const helpDialog = document.querySelector('#help-dialog');
if (topButton) {
  const onScroll = () => {
    topButton.hidden = window.scrollY < 600;
    if (progressBar) { const max = document.documentElement.scrollHeight - window.innerHeight; progressBar.style.width = `${max > 0 ? Math.min(100, window.scrollY / max * 100) : 0}%`; }
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  topButton.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  onScroll();
}
const readRoute = id => `#read=${encodeURIComponent(id)}`;
const videoRoute = id => `#video=${encodeURIComponent(id)}`;
const animationRoute = file => `#animation=${encodeURIComponent(file)}`;
const minutes = value => value ? (value >= 3600 ? `${Math.floor(value / 3600)}:${String(Math.floor(value % 3600 / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}` : `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`) : '原站时长';
let data, docs, videoMap, animationMap, completed = new Set(), routeVersion = 0, cleanup = () => {};
let lastRead = '';
try { lastRead = localStorage.getItem('linux-course-last-read-v1') || ''; } catch { /* storage blocked */ }
const bodyCache = new Map();
let searchIndex = null, searchIndexPromise = null, searchVersion = 0;
let toastTimer;

function toast(message) {
  const element = document.querySelector('#toast');
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove('show'), 2300);
}
function closeMenu() {
  document.body.dataset.menu = '';
  document.querySelector('#menu-toggle').setAttribute('aria-expanded', 'false');
  document.querySelector('#menu-scrim').hidden = true;
}
document.querySelector('#menu-toggle').addEventListener('click', () => {
  const open = document.body.dataset.menu !== 'open';
  document.body.dataset.menu = open ? 'open' : '';
  document.querySelector('#menu-toggle').setAttribute('aria-expanded', String(open));
  document.querySelector('#menu-scrim').hidden = !open;
});
document.querySelector('#menu-scrim').addEventListener('click', closeMenu);

function saveProgress() {
  try { localStorage.setItem('linux-course-completed-v1', JSON.stringify([...completed])); }
  catch { toast('浏览器未允许保存，本次学习标记仅在当前页面有效'); }
}
function renderSidebar() {
  const params = new URLSearchParams(location.hash.slice(1));
  const current = params.get('read');
  const lastReadDoc = lastRead && lastRead !== current ? docs.get(lastRead) : null;
  const resumeLink = lastReadDoc ? `<a class="nav-link resume-link" href="${readRoute(lastReadDoc.id)}"><span class="nav-icon" aria-hidden="true">▶</span>继续上次阅读：<span class="resume-title">${escape(lastReadDoc.title.replace(/^(第\s*\d+\s*章|项目\s*\d+)\s*[·：:]?\s*/, ''))}</span></a>` : '';
  const nav = (hash, icon, title, count) => `<a class="nav-link ${location.hash === hash || location.hash.startsWith(`${hash}&`) || (!location.hash && hash === '#home') || (hash === '#videos' && params.has('video')) || (hash === '#animations' && params.has('animation')) ? 'active' : ''}" href="${hash}"><span class="nav-icon" aria-hidden="true">${icon}</span>${title}${count ? `<span class="nav-count">${count}</span>` : ''}</a>`;
  sidebar.innerHTML = `<nav aria-label="主要导航">
    ${nav('#home', '⌂', '学习首页')}${nav(readRoute('LEARNING_PATHS.md'), '↗', '选择学习路线')}${nav(readRoute('resources/knowledge-map.md'), '🕸', '知识地图')}
    ${nav('#videos', '▷', '视频课堂', data.videos.length)}${nav('#animations', '◇', '动画实验室', data.animations.length)}
    ${nav(readRoute('resources/hardware-gallery.md'), '▦', '实物图鉴')}${resumeLink}
    <div class="nav-group-label">LEARNING MAP · 学习地图</div>
    ${data.stageNames.map((name, stage) => {
      const chapters = data.chapterOrder.map(id => docs.get(id)).filter(doc => doc.stage === stage);
      return `<details class="stage-nav" ${chapters.some(doc => doc.id === current) ? 'open' : ''}><summary><span class="stage-number">${String(stage).padStart(2, '0')}</span>${escape(name)}</summary>
        ${chapters.map(doc => `<a class="chapter-link ${doc.id === current ? 'active' : ''}" href="${readRoute(doc.id)}" ${doc.id === current ? 'aria-current="page"' : ''}><span class="completed-dot">${completed.has(doc.id) ? '✓' : '·'}</span><span>${escape(doc.title.replace(/^(第\s*\d+\s*章|项目\s*\d+)\s*[·：:]?\s*/, ''))}</span></a>`).join('')}</details>`;
    }).join('')}
    <div class="nav-group-label">PRACTICE · 实践工具</div>
    ${nav(readRoute('resources/prompt-lab.md'), '✦', '提示词练习')}${nav(readRoute('cheatsheets/README.md'), '⚡', '速查表')}${nav(readRoute('exercises/README.md'), '✓', '练习与自测')}
    ${nav(readRoute('resources/environment-matrix.md'), '⌘', '实验环境对照')}${nav(readRoute('resources/error-index.md'), '🚨', '错误信息索引')}${nav(readRoute('resources/misconceptions.md'), '❌', '常见误解')}
  </nav><div class="sidebar-progress"><span>我的学习进度</span><span style="float:right">${completed.size} / ${data.chapterOrder.length}</span><div class="progress-track"><div class="progress-fill" style="width:${completed.size / data.chapterOrder.length * 100}%"></div></div><span>仅保存在当前浏览器</span> · <button class="text-button" data-action="import-progress">导入标记</button> · <button class="text-button" data-action="clear-progress">清空标记</button> · <button class="text-button" data-action="export-progress">导出标记</button></div>`;
}

function videoCard(video) {
  return `<article class="media-card"><a class="media-thumb" href="${videoRoute(video.id)}" aria-label="观看 ${escape(video.title)}"><span class="thumb-fallback" aria-hidden="true">▷</span><img src="${escape(video.thumbnail)}" alt="${escape(video.title)} 视频封面" loading="lazy" referrerpolicy="no-referrer"><span class="platform-pill">${video.platform === 'bilibili' ? 'B站 · 中文' : 'YouTube · EN'}</span><span class="duration-pill">${minutes(video.duration)}</span></a><div class="media-info"><h3><a href="${videoRoute(video.id)}">${escape(video.title)}</a></h3><p>${escape(video.author)}${video.page ? ` · P${video.page}` : ''}</p><div>${video.tags.slice(0, 2).map(tag => `<span class="tag">${escape(tag)}</span>`).join('')}</div><div class="card-actions"><span>${escape(video.kind)}</span><a href="${videoRoute(video.id)}">观看与练习 →</a></div></div></article>`;
}
function animationCard(animation) {
  return `<article class="media-card"><a class="media-thumb animation-thumb" href="${animationRoute(animation.file)}"><img src="./assets/animations/${encodeURIComponent(animation.file)}" alt="${escape(animation.title)} 动画预览" loading="lazy"><span class="platform-pill">原创演示</span><span class="duration-pill">可暂停 · 可单步</span></a><div class="media-info"><h3><a href="${animationRoute(animation.file)}">${escape(animation.title)}</a></h3><p>${escape(docs.get(animation.chapter)?.title || 'Linux 原理演示')}</p><div class="card-actions"><span>先预测，再验证</span><a href="${animationRoute(animation.file)}">打开演示 →</a></div></div></article>`;
}
const footer = () => `<footer class="footer-note">通往 Linux 之路 · 以知识地图、工具与实践组织学习。<a href="${readRoute('assets/images/CREDITS.md')}">图片署名</a> · 视频版权归原作者，播放能力以原站为准。<button class="text-button" data-action="help">快捷键 ?</button> · <a href="${data.repo}" target="_blank" rel="noopener noreferrer">参与共建 ↗</a></footer>`;

function home() {
  const featuredVideos = ['b-redirection', 'y-git', 'y-docker'].map(id => videoMap.get(id)).filter(Boolean);
  const featuredAnimations = ['git-branches.svg', 'docker-volume.svg', 'gpio-debounce.svg'].map(id => animationMap.get(id)).filter(Boolean);
  main.innerHTML = `<div class="page"><section class="hero"><div><p class="eyebrow">YOUR ROAD TO LINUX</p><h1>把 Linux 学成一门<br><em>能动手的本领。</em></h1><p class="lead">从第一条命令，到维护服务器、运行本地 AI。<br>读清楚原理，看懂每一步，最后亲手验证。</p><div class="hero-actions"><a class="button primary" href="${readRoute(data.chapterOrder[0])}">开始第一课 <span aria-hidden="true">→</span></a><a class="button" href="${readRoute('LEARNING_PATHS.md')}">找到适合我的路线</a></div></div><div class="hero-lab"><div class="terminal-bar"><i class="terminal-dot"></i><i class="terminal-dot"></i><i class="terminal-dot"></i><span>today / 15-minute-lab</span></div><div class="hero-code"><span class="comment"># 今天，看懂一条管道</span>\n<b>$</b> cat access.log | grep 'ERROR'\n<span class="comment"># stdout: matched ERROR records</span>\n<b>✓</b> 分清输入、输出与每一步变化</div><div class="hero-lab-footer"><span>少背一条命令，多理解一个过程</span><a href="${animationRoute('shell-pipeline.svg')}">看动画演示 ↗</a></div></div></section>
    <div class="stat-strip"><div class="stat"><strong>${data.stats.chapters}</strong><span>教学章节</span></div><div class="stat"><strong>${data.stats.videos}</strong><span>视频与选段</span></div><div class="stat"><strong>${data.stats.animations}</strong><span>原理动画</span></div><div class="stat"><strong>6</strong><span>学习阶段</span></div></div>
    <section><div class="section-heading"><div><h2>从你的目标出发</h2><p>不必一次学完所有内容，先做出第一个成果。</p></div><a href="${readRoute('ROADMAP.md')}">八周学习地图 →</a></div><div class="route-grid">
      <a class="route-card" href="${readRoute(data.chapterOrder[0])}"><span class="route-symbol">›_</span><h3>零基础入门</h3><p>装好环境，理解文件、权限和第一组命令。</p><span class="arrow">从这里开始 →</span></a>
      <a class="route-card" href="${readRoute('docs/02-advanced/06-systemd服务与日志.md')}"><span class="route-symbol">▤</span><h3>服务器与运维</h3><p>把服务跑起来，能查日志，也能验证备份。</p><span class="arrow">进入系统管理 →</span></a>
      <a class="route-card" href="${readRoute('docs/04-projects/项目4-Linux跑本地AI.md')}"><span class="route-symbol">✦</span><h3>本地 AI 实践</h3><p>理解容器和模型服务，完成一次本地对话。</p><span class="arrow">搭建我的环境 →</span></a>
      <a class="route-card" href="${readRoute('docs/05-raspberry-pi/01-树莓派是什么与选购.md')}"><span class="route-symbol">⌁</span><h3>树莓派与硬件</h3><p>看实物、接 GPIO，让代码走出屏幕。</p><span class="arrow">开始硬件支线 →</span></a>
    </div></section>
    <section><div class="section-heading"><div><h2>看懂，再动手</h2><p>动画可以暂停、单步和重播，观察状态怎样变化。</p></div><a href="#animations">全部 ${data.animations.length} 个动画 →</a></div><div class="media-grid">${featuredAnimations.map(animationCard).join('')}</div></section>
    <section><div class="section-heading"><div><h2>视频课堂</h2><p>中文选段与英文专题互补，每条都有对应学习入口。</p></div><a href="#videos">全部 ${data.videos.length} 条视频 →</a></div><div class="media-grid">${featuredVideos.map(videoCard).join('')}</div></section>
    <section class="learning-loop"><div class="section-heading"><div><h2>一条可复做的学习闭环</h2><p>从选目标到留证据，每一环都能被验证。</p></div><a href="${readRoute('LEARNING_PATHS.md')}">完整路线与成果清单 →</a></div><div class="loop-grid">
      <a class="loop-card" href="${readRoute('LEARNING_PATHS.md')}"><span class="loop-step">01 · 选目标</span><h3>我到底想用 Linux 做什么</h3><p>按目标选路线，先做出第一个可验收成果。</p></a>
      <a class="loop-card" href="${readRoute('resources/environment-matrix.md')}"><span class="loop-step">02 · 对环境</span><h3>确认发行版、权限与内核能力</h3><p>先分清“缺工具”还是“不具备该能力”。</p></a>
      <a class="loop-card" href="${readRoute('resources/toolbox.md')}"><span class="loop-step">03 · 选工具</span><h3>用问题挑工具，而不是跟热度</h3><p>说明要观察什么、怎么验证、局限在哪。</p></a>
      <a class="loop-card" href="${readRoute('resources/prompt-lab.md')}"><span class="loop-step">04 · 问 AI</span><h3>让 AI 给出可核对的问题</h3><p>用提示词模板区分事实、假设与实测结果。</p></a>
      <a class="loop-card" href="${readRoute('exercises/README.md')}"><span class="loop-step">05 · 留证据</span><h3>做练习，把结果写进贡献</h3><p>保留输入、命令、输出与修正，让结论可复做。</p></a>
    </div></section>
    <section class="practice-banner"><div><h3>把“看过”变成“会做”</h3><p>记录输入、命令与实际结果，让每次学习留下一个可复做的成果。</p></div><a class="button" href="${readRoute('exercises/README.md')}">打开练习册 →</a></section>${footer()}</div>`;
}

function gallery(kind, params) {
  const isVideo = kind === 'videos';
  const platform = params.get('platform') || 'all';
  const stage = params.get('stage') || 'all';
  const list = isVideo ? data.videos.filter(video => platform === 'all' || video.platform === platform)
    : data.animations.filter(item => stage === 'all' || String(docs.get(item.chapter)?.stage) === stage);
  main.innerHTML = `<div class="page"><p class="eyebrow">${isVideo ? 'WATCH & PRACTICE' : 'SEE HOW IT WORKS'}</p><h1 class="page-title">${isVideo ? '视频课堂' : '动画实验室'}</h1><p class="page-lead">${isVideo ? 'B站中文选段与 YouTube 专题课程。先看清这一段讲什么，再回到章节完成实验。' : '把抽象原理变成看得见的过程。暂停、单步和重播，按自己的节奏理解每一个变化。'}</p>
    <div class="filters" aria-label="${isVideo ? '视频平台筛选' : '动画阶段筛选'}">${isVideo ? [['all', '全部视频'], ['bilibili', 'B站 · 中文'], ['youtube', 'YouTube · English']].map(([id, label]) => `<a class="filter-button ${platform === id ? 'active' : ''}" href="#videos&platform=${id}">${label}</a>`).join('') : [['all', '全部动画'], ...data.stageNames.map((name, index) => [String(index), name])].map(([id, label]) => `<a class="filter-button ${stage === id ? 'active' : ''}" href="#animations&stage=${id}">${label}</a>`).join('')}</div>
    <p class="count-note">${list.length} ${isVideo ? '条视频或课程选段 · 标题、作者、分P已核对；不代表已完整实播' : '个原理演示 · 示例数据不代表生产实测'}</p>
    <div class="media-grid">${list.map(isVideo ? videoCard : animationCard).join('')}</div>${list.length ? '' : '<div class="empty-state">这个阶段暂无匹配动画，可切换到全部动画。</div>'}${footer()}</div>`;
}

async function renderDiagrams(version) {
  const nodes = [...main.querySelectorAll('.mermaid')];
  if (!nodes.length) return;
  const originals = nodes.map(node => node.dataset.source ?? node.textContent);
  try {
    const { default: mermaid } = await import('mermaid');
    if (version !== routeVersion) return;
    const darkTheme = document.documentElement.classList.contains('dark');
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: darkTheme ? 'dark' : 'neutral', fontFamily: 'Microsoft YaHei, sans-serif' });
    nodes.forEach((node, index) => {
      node.dataset.source = originals[index];
      if (node.hasAttribute('data-processed')) {
        node.removeAttribute('data-processed');
        node.textContent = originals[index];
      }
    });
    await mermaid.run({ nodes, suppressErrors: false });
    nodes.forEach(node => {
      const svg = node.querySelector('svg');
      const viewBox = (svg?.getAttribute('viewBox') || '').split(/\s+/).map(Number);
      const width = viewBox[2];
      if (!svg || !Number.isFinite(width) || width <= node.clientWidth) return;
      svg.style.width = `${width}px`;
      svg.style.height = 'auto';
      svg.style.maxWidth = 'none';
      if (node.nextElementSibling?.classList.contains('mermaid-hint')) return;
      const hint = document.createElement('p');
      hint.className = 'mermaid-hint';
      hint.textContent = `↔ 宽幅依赖图（原尺寸 ${Math.round(width)}px），可横向滚动查看完整内容`;
      node.insertAdjacentElement('afterend', hint);
    });
  } catch {
    if (version !== routeVersion) return;
    nodes.forEach((node, index) => { node.textContent = originals[index]; node.setAttribute('aria-label', '图解源码，可在 GitHub 查看'); });
  }
}

async function loadBody(doc, version) {
  try {
    const response = await fetch(`./${doc.body}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    if (typeof payload.html !== 'string') throw new Error('Invalid body payload');
    bodyCache.set(doc.id, payload.html);
    return payload.html;
  } catch {
    if (version !== routeVersion) return null;
    main.innerHTML = `<div class="page error-state"><h1>正文暂时无法加载</h1><p>可以刷新重试，或先在 GitHub 上阅读这篇文档。</p><a class="button" href="${data.repo}/blob/main/${encodeURI(doc.id)}" target="_blank" rel="noopener noreferrer">打开源文档 ↗</a></div>`;
    return null;
  }
}

async function readDocument(id, section, version) {
  const doc = docs.get(id);
  if (!doc) { missing(); return; }
  document.title = `${doc.title} · 通往 Linux 之路`;
  const body = bodyCache.get(id) ?? await loadBody(doc, version);
  if (body === null || version !== routeVersion) return;
  const relatedVideos = doc.media.videos.map(ref => {
    const video = videoMap.get(typeof ref === 'string' ? ref : ref.id);
    return video ? { ...video, chapterNote: ref.note || '' } : null;
  }).filter(Boolean);
  const relatedAnimations = doc.media.animations.map(file => animationMap.get(file)).filter(Boolean);
  main.innerHTML = `<div class="reading-layout"><div><div class="breadcrumb"><a href="#home">学习首页</a> / ${doc.stage === null ? '学习资源' : escape(data.stageNames[doc.stage])}</div><div class="reading-paper"><div class="reading-toolbar"><span>${escape(doc.duration)} · 读完请完成自测</span><div>${doc.index >= 0 ? `<button class="button small" data-complete="${escape(doc.id)}" aria-pressed="${completed.has(doc.id)}">${completed.has(doc.id) ? '✓ 已标记学完' : '标记已学完'}</button>` : ''} <a class="button small" href="${data.repo}/blob/main/${encodeURI(doc.id)}" target="_blank" rel="noopener noreferrer">查看源文档 ↗</a></div></div><article class="article">${body}</article>
    ${relatedAnimations.length ? `<section class="lesson-media"><h2>动起来看原理</h2><div class="media-grid">${relatedAnimations.map(animationCard).join('')}</div></section>` : ''}
    ${relatedVideos.length ? `<section class="lesson-media"><h2>配套视频</h2><p class="count-note">${escape(relatedVideos[0].chapterNote || '先查看版本提示，观看后回到正文完成实验。')}</p><div class="media-grid">${relatedVideos.map(videoCard).join('')}</div></section>` : ''}
    <nav class="lesson-next" aria-label="相邻章节">${doc.previous ? `<a href="${readRoute(doc.previous)}">← ${escape(docs.get(doc.previous).title)}</a>` : '<span></span>'}${doc.next ? `<a href="${readRoute(doc.next)}">${escape(docs.get(doc.next).title)} →</a>` : ''}</nav></div>${footer()}</div>
    <aside class="toc" aria-label="本页目录"><h2>ON THIS PAGE · 本页目录</h2>${doc.toc.map(item => `<a class="${item.depth === 3 ? 'sub' : ''}" href="${readRoute(doc.id)}&section=${encodeURIComponent(item.id)}">${escape(item.title)}</a>`).join('')}</aside></div>`;
  for (const code of main.querySelectorAll('pre > code')) {
    const button = document.createElement('button');
    button.className = 'copy-button'; button.textContent = '复制'; button.type = 'button';
    button.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(code.textContent); toast('已复制代码，请先确认环境与路径'); }
      catch { toast('无法自动复制，请选中代码后复制'); }
    });
    code.parentElement.append(button);
  }
  main.querySelectorAll('img').forEach(img => img.addEventListener('error', () => { img.hidden = true; }));
  if (doc.index >= 0) {
    lastRead = doc.id;
    try { localStorage.setItem('linux-course-last-read-v1', lastRead); } catch { /* storage blocked */ }
    if (!section) {
      try {
        const saved = sessionStorage.getItem(`linux-course-scroll-${doc.id}`);
        if (saved !== null) requestAnimationFrame(() => window.scrollTo(0, Number(saved)));
      } catch { /* storage blocked */ }
    }
  }
  renderDiagrams(routeVersion);
  if (section) requestAnimationFrame(() => main.querySelector(`#${CSS.escape(section)}`)?.scrollIntoView());
  const onReadKey = event => {
    if (event.target?.tagName && /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === 'ArrowLeft' && doc.previous) { event.preventDefault(); location.hash = readRoute(doc.previous); }
    else if (event.key === 'ArrowRight' && doc.next) { event.preventDefault(); location.hash = readRoute(doc.next); }
  };
  document.addEventListener('keydown', onReadKey);
  const tocLinks = [...main.querySelectorAll('.toc a')];
  const onTocScroll = () => {
    const threshold = 170;
    let current = null;
    for (const [el, link] of tocEntries) {
      const top = el.getBoundingClientRect().top;
      if (top <= threshold && (!current || top > current.top)) current = { top, link };
    }
    tocLinks.forEach(link => link.classList.toggle('active', Boolean(current && link === current.link)));
  };
  const tocEntries = [];
  for (const link of tocLinks) {
    const section = new URLSearchParams(link.getAttribute('href').slice(1)).get('section');
    const el = section ? document.getElementById(section) : null;
    if (el) tocEntries.push([el, link]);
  }
  if (tocEntries.length) {
    window.addEventListener('scroll', onTocScroll, { passive: true });
    onTocScroll();
  }
  cleanup = () => {
    document.removeEventListener('keydown', onReadKey);
    if (tocEntries.length) window.removeEventListener('scroll', onTocScroll);
    if (doc.index >= 0) { try { sessionStorage.setItem(`linux-course-scroll-${doc.id}`, String(window.scrollY)); } catch { /* storage blocked */ } }
  };
}

function videoPage(id) {
  const video = videoMap.get(id);
  if (!video) { missing(); return; }
  document.title = `${video.title} · 视频课堂`;
  const related = data.documents.filter(doc => doc.media.videos.some(ref => (typeof ref === 'string' ? ref : ref.id) === id));
  const videoIndex = data.videos.findIndex(item => item.id === id);
  const prevVideo = data.videos[videoIndex - 1];
  const nextVideo = data.videos[videoIndex + 1];
  main.innerHTML = `<div class="page"><div class="breadcrumb"><a href="#videos">视频课堂</a> / ${video.platform === 'bilibili' ? 'B站' : 'YouTube'}</div><h1 class="page-title">${escape(video.title)}</h1><p class="page-lead">${escape(video.author)} · ${escape(video.kind)}${video.page ? ` · P${video.page}` : ''} · ${minutes(video.duration)}</p><div class="player-panel"><div class="video-stage" id="video-stage"><img class="video-cover" src="${escape(video.thumbnail)}" alt="" referrerpolicy="no-referrer"><button class="load-player" data-load-video="${escape(id)}">▷ 加载${video.platform === 'bilibili' ? 'B站' : 'YouTube'}播放器</button></div><div class="player-meta"><a class="button small" href="${escape(video.url)}" target="_blank" rel="noopener noreferrer">在原站打开 ↗</a><p>${escape(video.note)}</p><p>如果播放器不可用、要求登录或所在网络无法访问，请使用原站入口。不会自动播放或下载视频。</p><details><summary>来源与核验记录</summary><p>原站标题：${escape(video.providerTitle)}<br>资料核对：${escape(video.verification.checkedAt.slice(0, 10))} · ${video.platform === 'bilibili' ? '平台接口核对分P、CID、作者与时长' : '平台 oEmbed 核对标题、作者与封面'}<br>完整实播：尚未逐条完成。接口可读取不代表所有地区都能播放。</p><a href="${escape(video.verification.source)}" target="_blank" rel="noopener noreferrer">元数据来源 ↗</a></details></div></div>
    <section><div class="section-heading"><div><h2>看完，回到这里动手</h2><p>将视频里的解释与自己的实际输出对照。</p></div></div><div class="route-grid">${related.filter(doc => doc.index >= 0).slice(0, 8).map(doc => `<a class="route-card" href="${readRoute(doc.id)}"><span class="tag">${escape(data.stageNames[doc.stage])}</span><h3>${escape(doc.title)}</h3><p>${escape(doc.duration)}</p><span class="arrow">阅读与实验 →</span></a>`).join('')}</div></section>${prevVideo || nextVideo ? `<nav class="lesson-next" aria-label="相邻视频">${prevVideo ? `<a href="${videoRoute(prevVideo.id)}">← ${escape(prevVideo.title)}</a>` : '<span></span>'}${nextVideo ? `<a href="${videoRoute(nextVideo.id)}">${escape(nextVideo.title)} →</a>` : ''}</nav>` : ''}${footer()}</div>`;
  const onVideoKey = event => {
    if (event.target?.tagName && /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === 'ArrowLeft' && prevVideo) { event.preventDefault(); location.hash = videoRoute(prevVideo.id); }
    else if (event.key === 'ArrowRight' && nextVideo) { event.preventDefault(); location.hash = videoRoute(nextVideo.id); }
  };
  document.addEventListener('keydown', onVideoKey);
  cleanup = () => document.removeEventListener('keydown', onVideoKey);
}

function loadVideo(id) {
  const video = videoMap.get(id);
  const stage = document.querySelector('#video-stage');
  if (!video || !stage) return;
  let url;
  if (video.platform === 'bilibili' && /^BV[a-zA-Z0-9]{10}$/.test(video.providerId)) {
    url = new URL('https://player.bilibili.com/player.html');
    for (const [key, value] of Object.entries({ bvid: video.providerId, cid: video.cid, p: video.page, autoplay: 0, danmaku: 0 })) url.searchParams.set(key, String(value));
  } else if (video.platform === 'youtube' && /^[\w-]{11}$/.test(video.providerId)) {
    url = new URL(`https://www.youtube-nocookie.com/embed/${video.providerId}`);
    for (const [key, value] of Object.entries({ autoplay: 0, playsinline: 1, rel: 0, start: video.start || 0, origin: location.origin })) url.searchParams.set(key, String(value));
  } else { toast('视频标识无效，请使用原站链接'); return; }
  const frame = document.createElement('iframe');
  frame.src = url.href; frame.title = `${video.title} — ${video.author}`;
  frame.allow = 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen';
  frame.allowFullscreen = true; frame.referrerPolicy = 'strict-origin-when-cross-origin';
  stage.replaceChildren(frame);
}

function animationPage(file) {
  const animation = animationMap.get(file);
  if (!animation) { missing(); return; }
  document.title = `${animation.title} · 动画实验室`;
  const doc = docs.get(animation.chapter);
  const steps = animation.steps || [];
  const stepParam = Number(new URLSearchParams(location.hash.slice(1)).get('step'));
  const initialStep = Number.isInteger(stepParam) && stepParam >= 1 ? Math.min(stepParam, steps.length || 1) : 1;
  const animIndex = data.animations.findIndex(item => item.file === file);
  const prevAnim = data.animations[animIndex - 1];
  const nextAnim = data.animations[animIndex + 1];
  main.innerHTML = `<div class="page"><div class="breadcrumb"><a href="#animations">动画实验室</a> / ${escape(doc ? data.stageNames[doc.stage] : 'Linux 原理')}</div><h1 class="page-title">${escape(animation.title)}</h1><p class="page-lead">先想一想下一步会发生什么，再播放或单步观察。示例数据用于解释原理。</p><div class="player-panel"><div class="animation-stage" style="aspect-ratio:${animation.width || 1080}/${animation.height || 500}"><iframe id="animation-frame" src="./assets/animations/${encodeURIComponent(file)}" title="${escape(animation.title)} 原理动画"></iframe></div><div class="player-controls"><button class="button primary small" id="animation-play" disabled>播放</button><button class="button small" id="animation-step" disabled>下一步</button><button class="button small" id="animation-reset" disabled>重播</button><label class="sr-only" for="animation-progress">动画时间</label><input id="animation-progress" type="range" min="0" max="${animation.duration}" value="0" step="0.05" disabled><span class="player-time" id="animation-time">0.0 / ${animation.duration}s</span><label class="sr-only" for="animation-speed">播放速度</label><select id="animation-speed"><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="1.5">1.5×</option><option value="2">2×</option></select><span class="sr-only" role="status" id="animation-announcer"></span></div></div>
    ${steps.length ? `<div class="steps-grid">${steps.map((step, index) => `<div class="step-card ${index === 0 ? 'active' : ''}" data-step-card="${index}"><strong>${escape(step.title)}</strong><p>${escape(step.description)}</p></div>`).join('')}</div>` : ''}
    ${prevAnim || nextAnim ? `<nav class="lesson-next" aria-label="相邻动画">${prevAnim ? `<a href="${animationRoute(prevAnim.file)}">← ${escape(prevAnim.title)}</a>` : '<span></span>'}${nextAnim ? `<a href="${animationRoute(nextAnim.file)}">${escape(nextAnim.title)} →</a>` : ''}</nav>` : ''}
    <div class="practice-banner"><div><h3>验证理解的下一步</h3><p>${escape(doc?.title || '打开对应章节，运行自己的实验。')}</p></div><a class="button" href="${readRoute(animation.chapter)}">进入章节实验 →</a></div><p class="count-note">默认暂停，按需播放（快捷键：空格 播放/暂停，←/→ 单步，R 重播）。原始 SVG 保留静态说明，<a href="./assets/animations/${encodeURIComponent(file)}" target="_blank" rel="noopener noreferrer">也可独立打开 ↗</a>。 <button class="text-button" id="animation-copy-link" type="button">复制链接（含当前步骤）</button></p>${footer()}</div>`;
  const frame = document.querySelector('#animation-frame');
  let raf = null, alive = true;
  cleanup = () => { alive = false; if (raf) cancelAnimationFrame(raf); };
  frame.addEventListener('load', () => {
    if (!alive) return;
    const svg = frame.contentDocument?.documentElement;
    if (!svg || svg.localName !== 'svg') return;
    svg.setAttribute('width', '100%'); svg.setAttribute('height', '100%');
    svg.pauseAnimations?.();
    const animations = svg.getAnimations({ subtree: true });
    animations.forEach(item => item.pause());
    const play = document.querySelector('#animation-play');
    const step = document.querySelector('#animation-step');
    const reset = document.querySelector('#animation-reset');
    const progress = document.querySelector('#animation-progress');
    const time = document.querySelector('#animation-time');
    const speed = document.querySelector('#animation-speed');
    [play, step, reset, progress].forEach(control => { control.disabled = false; });
    let current = 0, playing = false, last = null;
    const announcer = document.querySelector('#animation-announcer');
    let announced = -1;
    const announce = index => {
      if (!steps.length || index === announced || !announcer) return;
      announced = index;
      announcer.textContent = `第 ${index + 1} 步，共 ${steps.length} 步：${steps[index]?.title || ''}`;
    };
    const copyLink = document.querySelector('#animation-copy-link');
    if (copyLink) copyLink.addEventListener('click', async () => {
      const url = new URL(location.href);
      const params = new URLSearchParams(url.hash.slice(1));
      params.set('step', String(Math.min(steps.length, Math.floor(current / animation.duration * steps.length) + 1)));
      url.hash = params.toString();
      try { await navigator.clipboard.writeText(url.href); toast('已复制：打开后定位到当前步骤'); }
      catch { toast('无法自动复制，请手动复制地址栏链接'); }
    });
    function seek(value) {
      current = Math.max(0, Math.min(animation.duration, value));
      const visualTime = Math.min(current, Math.max(0, animation.duration - 0.001));
      svg.setCurrentTime?.(visualTime);
      animations.forEach(item => { item.currentTime = visualTime * 1000; });
      const outputIndex = Math.min(3, Math.floor(visualTime / animation.duration * 4));
      svg.querySelectorAll(".output").forEach((item, index) => { item.style.opacity = index === outputIndex ? "1" : "0"; });
      progress.value = String(current); time.textContent = `${current.toFixed(1)} / ${animation.duration}s`;
      const index = Math.min(steps.length - 1, Math.floor(current / animation.duration * steps.length));
      main.querySelectorAll('[data-step-card]').forEach(card => card.classList.toggle('active', Number(card.dataset.stepCard) === index));
      announce(index);
    }
    function pause() { playing = false; last = null; play.textContent = '播放'; if (raf) cancelAnimationFrame(raf); }
    function tick(stamp) {
      if (!alive || !playing) return;
      if (last !== null) seek(current + (stamp - last) / 1000 * Number(speed.value));
      last = stamp;
      if (current >= animation.duration) { pause(); return; }
      raf = requestAnimationFrame(tick);
    }
    function togglePlay() {
      if (playing) { pause(); return; }
      if (current >= animation.duration) seek(0);
      playing = true; play.textContent = '暂停'; last = null; raf = requestAnimationFrame(tick);
    }
    play.addEventListener('click', togglePlay);
    step.addEventListener('click', () => { pause(); const size = animation.duration / (steps.length || 4); seek(Math.min(animation.duration, (Math.floor(current / size + 0.001) + 1) * size)); });
    reset.addEventListener('click', () => { pause(); seek(0); });
    progress.addEventListener('input', () => { pause(); seek(Number(progress.value)); });
    const size = animation.duration / (steps.length || 4);
    const onKey = event => {
      if (!alive) return;
      const tag = event.target?.tagName || '';
      if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
      if (tag === 'BUTTON' && (event.key === ' ' || event.key === 'Enter')) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      switch (event.key) {
        case ' ': case 'Spacebar': event.preventDefault(); togglePlay(); break;
        case 'ArrowRight': event.preventDefault(); pause(); seek(Math.min(animation.duration, (Math.floor(current / size + 0.001) + 1) * size)); break;
        case 'ArrowLeft': event.preventDefault(); pause(); seek(Math.max(0, Math.floor((current - 0.001) / size) * size)); break;
        case 'r': case 'R': case 'Home': event.preventDefault(); pause(); seek(0); break;
        case 'End': event.preventDefault(); pause(); seek(animation.duration); break;
      }
    };
    document.addEventListener('keydown', onKey);
    frame.contentDocument?.addEventListener('keydown', onKey);
    seek((initialStep - 1) * size);
  });
}

function missing() { main.innerHTML = '<div class="page empty-state"><h1>没有找到这项内容</h1><p>链接可能已调整，可以搜索标题或回到学习首页。</p><a class="button" href="#home">回到首页</a></div>'; }
function render() {
  if (!data) return;
  cleanup(); cleanup = () => {}; routeVersion++;
  const params = new URLSearchParams(location.hash.slice(1));
  closeMenu(); results.hidden = true;
  document.title = '通往 Linux 之路 · 边看边练';
  renderSidebar();
  if (params.has('read')) readDocument(params.get('read'), params.get('section'), routeVersion);
  else if (params.has('video')) videoPage(params.get('video'));
  else if (params.has('animation')) animationPage(params.get('animation'));
  else if (params.has('videos')) gallery('videos', params);
  else if (params.has('animations')) gallery('animations', params);
  else home();
  if (!params.has('section')) window.scrollTo(0, 0);
  main.focus({ preventScroll: true });
  main.querySelectorAll('img').forEach(img => img.addEventListener('error', () => { img.hidden = true; }));
}

document.addEventListener('click', event => {
  if (event.target.closest('.skip-link')) { event.preventDefault(); main.focus(); main.scrollIntoView(); return; }
  const complete = event.target.closest('[data-complete]');
  if (complete) {
    const id = complete.dataset.complete;
    if (completed.has(id)) completed.delete(id); else completed.add(id);
    saveProgress(); renderSidebar();
    complete.setAttribute('aria-pressed', String(completed.has(id)));
    complete.textContent = completed.has(id) ? '✓ 已标记学完' : '标记已学完';
  }
  if (event.target.closest('[data-action="clear-progress"]')) { completed.clear(); saveProgress(); renderSidebar(); render(); toast('已清空本机学习标记'); }
  if (event.target.closest('[data-action="export-progress"]')) {
    const payload = JSON.stringify({ exportedAt: new Date().toISOString(), completed: [...completed] }, null, 2);
    navigator.clipboard.writeText(payload).then(() => toast('已复制学习标记 JSON，可粘贴保存或换机恢复')).catch(() => toast('无法自动复制，请手动选择标记内容'));
  }
  if (event.target.closest('[data-action="help"]')) { helpDialog?.showModal(); return; }
  if (event.target.closest('[data-action="import-progress"]')) { importDialog?.showModal(); importInput?.focus(); return; }
  if (event.target.closest('[data-close-dialog]')) { event.target.closest('dialog')?.close(); return; }
  if (event.target.closest('#import-confirm')) {
    const raw = importInput.value.trim();
    importDialog.close(); importInput.value = '';
    let payload;
    try { payload = JSON.parse(raw); } catch { toast('JSON 解析失败：请粘贴完整的「导出标记」内容'); return; }
    const list = Array.isArray(payload) ? payload : (Array.isArray(payload?.completed) ? payload.completed : null);
    if (!list) { toast('格式不对：需要包含 completed 数组（如 {"completed":["docs/…"]}）'); return; }
    const valid = list.filter(id => typeof id === 'string' && data.chapterOrder.includes(id));
    let added = 0;
    valid.forEach(id => { if (!completed.has(id)) { completed.add(id); added++; } });
    if (added) saveProgress();
    renderSidebar();
    toast(valid.length ? `已导入 ${valid.length} 条学习标记（新增 ${added} 条${valid.length !== list.length ? `，忽略 ${list.length - valid.length} 条无效` : ''}）` : '没有有效的章节标记，进度未改动');
    return;
  }
  const load = event.target.closest('[data-load-video]'); if (load) loadVideo(load.dataset.loadVideo);
  if (!event.target.closest('.search-wrap')) results.hidden = true;
});
async function loadSearchIndex() {
  if (searchIndex) return searchIndex;
  if (!searchIndexPromise) searchIndexPromise = fetch('./data/search.json').then(response => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }).then(payload => {
    searchIndex = new Map(payload.documents.map(entry => [entry.id, entry]));
    return searchIndex;
  }).catch(error => { searchIndexPromise = null; throw error; });
  return searchIndexPromise;
}
search.addEventListener('input', async () => {
  const query = search.value.trim().toLowerCase();
  const version = ++searchVersion;
  if (!query || !data) { results.hidden = true; return; }
  try { await loadSearchIndex(); } catch { /* Title and media matching stay available without the full-text index. */ }
  if (version !== searchVersion) return;
  const chapterText = doc => searchIndex?.get(doc.id)?.searchText || '';
  const highlight = (text, query) => {
    const q = query.trim().toLowerCase();
    const index = text.toLowerCase().indexOf(q);
    return index < 0 ? escape(text) : `${escape(text.slice(0, index))}<mark>${escape(text.slice(index, index + q.length))}</mark>${escape(text.slice(index + q.length))}`;
  };
  const hits = [
    ...data.documents.filter(doc => doc.index >= 0 && (doc.title.toLowerCase().includes(query) || chapterText(doc).includes(query))).sort((a, b) => Number(b.title.toLowerCase().includes(query)) - Number(a.title.toLowerCase().includes(query))).slice(0, 5).map(doc => ({ title: doc.title, kind: '章节', context: doc.stage === null ? '' : data.stageNames[doc.stage], href: readRoute(doc.id) })),
    ...data.videos.filter(video => `${video.title} ${video.author} ${video.tags.join(' ')}`.toLowerCase().includes(query)).slice(0, 3).map(video => ({ title: video.title, kind: video.platform === 'bilibili' ? 'B站视频' : 'YouTube 视频', context: video.platform === 'bilibili' ? 'B站' : '英文', href: videoRoute(video.id) })),
    ...data.animations.filter(item => item.title.toLowerCase().includes(query)).slice(0, 2).map(item => ({ title: item.title, kind: '动画', context: '动画实验室', href: animationRoute(item.file) })),
  ];
  const note = searchIndex ? '' : '<div class="search-note">全文索引暂时不可用，当前仅按标题与媒体匹配。</div>';
  results.innerHTML = `${note}${hits.length ? hits.map(hit => `<a class="search-result" href="${hit.href}"><small>${hit.kind}</small>${hit.context ? `<span class="search-context">${escape(hit.context)}</span>` : ''}${highlight(hit.title, query)}</a>`).join('') : '<div class="search-empty">没有匹配结果，试试“权限”“Docker”或“GPIO”。</div>'}`;
  results.hidden = false;
});
search.addEventListener('keydown', event => {
  if (!results.hidden && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
    const items = [...results.querySelectorAll('a')];
    if (!items.length) return;
    event.preventDefault();
    const current = items.findIndex(item => item.classList.contains('selected'));
    let next = event.key === 'ArrowDown' ? (current + 1) % items.length : (current - 1 + items.length) % items.length;
    items.forEach((item, index) => item.classList.toggle('selected', index === next));
    items[next].scrollIntoView({ block: 'nearest' });
  }
  if (event.key === 'Enter' && !results.hidden) (results.querySelector('a.selected') || results.querySelector('a'))?.click();
  if (event.key === 'Escape') { results.hidden = true; search.blur(); }
});
document.addEventListener('keydown', event => {
  if (event.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) { event.preventDefault(); search.focus(); }
  if (event.key === '?' && !/INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) { event.preventDefault(); helpDialog?.showModal(); }
  if (event.key === 'Escape') closeMenu();
});
window.addEventListener('hashchange', render);

try {
  const response = await fetch('./data/course.json');
  if (!response.ok) throw new Error('课程数据加载失败');
  data = await response.json(); docs = new Map(data.documents.map(doc => [doc.id, doc]));
  videoMap = new Map(data.videos.map(video => [video.id, video])); animationMap = new Map(data.animations.map(item => [item.file, item]));
  try { const stored = JSON.parse(localStorage.getItem('linux-course-completed-v1') || '[]'); if (Array.isArray(stored)) completed = new Set(stored.filter(id => data.chapterOrder.includes(id))); } catch { /* Reading remains available when storage is blocked. */ }
  render();
} catch {
  main.innerHTML = '<div class="error-state"><h1>暂时无法加载课程</h1><p>请刷新重试，或直接阅读 GitHub 文档。如果是本地预览，请使用 HTTP 服务打开，而不是双击 HTML 文件。</p><a class="button" href="https://github.com/zhuguang-ZFG/linux">打开 GitHub 教程 ↗</a></div>';
}
