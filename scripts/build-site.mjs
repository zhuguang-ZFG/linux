import { build } from 'esbuild';
import { Marked, Renderer } from 'marked';
import sanitizeHtml from 'sanitize-html';
import GithubSlugger from 'github-slugger';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const out = path.join(root, '_site');
if (path.dirname(path.resolve(out)) !== path.resolve(root) || path.basename(out) !== '_site') throw new Error('Unsafe build output path');
const read = name => readFileSync(path.join(root, name), 'utf8');
const json = name => JSON.parse(read(name));
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const repo = 'https://github.com/zhuguang-ZFG/linux';
const chapterOrder = [...read('README.md').matchAll(/\]\((docs\/[^)]+\.md)\)/g)].map(match => match[1]);
const media = json('resources/chapter-media.json');
const videos = json('resources/videos.json');
const animations = json('assets/animations/catalog.json');
const stageNames = ['启蒙认知', '基础命令', '系统与脚本', '性能与安全', '项目实战', '树莓派支线'];

function walk(folder) {
  return readdirSync(path.join(root, folder), { withFileTypes: true }).flatMap(entry => {
    if (entry.name === '__pycache__') return [];
    const name = `${folder}/${entry.name}`;
    return entry.isDirectory() ? walk(name) : name.endsWith('.md') ? [name] : [];
  });
}
const sources = [...new Set(['README.md', 'LEARNING_PATHS.md', 'ROADMAP.md', 'CONTRIBUTING.md',
  ...['docs', 'resources', 'exercises', 'cheatsheets', 'scripts', 'assets/images'].flatMap(walk)])
].filter(source => source !== 'docs/TEMPLATE.md');
const sourceSet = new Set(sources);

function routeLink(href, source) {
  if (/^(https?:|mailto:)/i.test(href)) return href;
  if (/^[a-z][a-z\d+.-]*:/i.test(href)) return '#home';
  const hash = href.indexOf('#');
  const targetPart = hash < 0 ? href : href.slice(0, hash);
  const fragment = hash < 0 ? '' : href.slice(hash + 1);
  let target = targetPart ? path.posix.normalize(path.posix.join(path.posix.dirname(source), decodeURIComponent(targetPart))) : source;
  if (existsSync(path.join(root, target, 'README.md'))) target = `${target.replace(/\/$/, '')}/README.md`;
  if (sourceSet.has(target)) return `#read=${encodeURIComponent(target)}${fragment ? `&section=${encodeURIComponent(fragment)}` : ''}`;
  if (target.startsWith('assets/') && !target.endsWith('.md')) return `./${encodeURI(target)}`;
  const kind = existsSync(path.join(root, target)) && statSync(path.join(root, target)).isDirectory() ? 'tree' : 'blob';
  return `${repo}/${kind}/main/${encodeURI(target)}`;
}

const documents = sources.map(source => {
  const markdown = read(source);
  const toc = [];
  const slugger = new GithubSlugger();
  const renderer = new Renderer();
  renderer.heading = function ({ tokens, depth }) {
    const inline = this.parser.parseInline(tokens);
    const title = sanitizeHtml(inline, { allowedTags: [], allowedAttributes: {} });
    const id = slugger.slug(title);
    if (depth === 2 || depth === 3) toc.push({ id, title, depth });
    return `<h${depth} id="${escape(id)}">${inline}</h${depth}>\n`;
  };
  renderer.code = ({ text, lang = '' }) => lang === 'mermaid'
    ? `<pre class="mermaid">${escape(text)}</pre>\n`
    : `<pre><code class="language-${escape(lang.split(/\s/)[0])}">${escape(text)}</code></pre>\n`;
  const marked = new Marked({ gfm: true, renderer, walkTokens(token) {
    if (token.type === 'link' || token.type === 'image') token.href = routeLink(token.href, source);
  } });
  const html = sanitizeHtml(marked.parse(markdown), {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, 'img', 'details', 'summary', 'input'],
    allowedAttributes: { '*': ['id', 'class'], a: ['href', 'title', 'target', 'rel'], img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
      input: ['type', 'checked', 'disabled'], th: ['align'], td: ['align'], ol: ['start'] },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      a: (tagName, attribs) => ({ tagName, attribs: /^https?:/.test(attribs.href || '') ? { ...attribs, target: '_blank', rel: 'noopener noreferrer' } : attribs }),
      img: (tagName, attribs) => ({ tagName, attribs: { ...attribs, loading: 'lazy' } }),
    },
  });
  const title = /^#\s+(.+)$/m.exec(markdown)?.[1].replace(/[*`]/g, '') || path.basename(source, '.md');
  const stage = /^docs\/(\d\d)-/.exec(source)?.[1];
  const index = chapterOrder.indexOf(source);
  const description = markdown.split(/\r?\n/).find(line => line.length > 35 && !/^[#>|!`*\-]/.test(line)) || title;
  return { id: source, title, html, toc, stage: index >= 0 ? Number(stage) : null, index,
    duration: markdown.split(/\r?\n/).slice(0, 10).join(' ').match(/\d+(?:-\d+)?\s*(?:分钟|小时)/)?.[0] || '按自己的节奏',
    description: description.replace(/[*`]/g, '').slice(0, 160),
    searchText: sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).replace(/\s+/g, ' ').toLowerCase(),
    media: media[source] || { videos: [], animations: [] },
    previous: index > 0 ? chapterOrder[index - 1] : null,
    next: index >= 0 && index < chapterOrder.length - 1 ? chapterOrder[index + 1] : null,
  };
});
const catalog = documents.map(({ html, searchText, ...document }) => ({ ...document, body: `data/docs/${encodeURI(`${document.id}.json`)}` }));
const searchIndex = documents.filter(document => document.index >= 0)
  .map(({ id, title, index, searchText }) => ({ id, title, index, searchText }));
for (const animation of animations) {
  const svg = read(`assets/animations/${animation.file}`);
  const durations = [...svg.matchAll(/dur="([\d.]+)s"/g)].map(match => Number(match[1]));
  animation.duration = animation.duration || Math.max(12, ...durations);
}
// Only remove the verified generated output directory, never source files.
rmSync(out, { recursive: true, force: true });
mkdirSync(path.join(out, 'data'), { recursive: true });
const docsOut = path.resolve(out, 'data/docs');
for (const document of documents) {
  const target = path.resolve(docsOut, `${document.id}.json`);
  if (!target.startsWith(`${docsOut}${path.sep}`)) throw new Error(`Unsafe document output path: ${document.id}`);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, JSON.stringify({ id: document.id, html: document.html }));
}
writeFileSync(path.join(out, 'data/search.json'), JSON.stringify({ documents: searchIndex }));
cpSync(path.join(root, 'assets'), path.join(out, 'assets'), { recursive: true });
cpSync(path.join(root, 'web/index.html'), path.join(out, 'index.html'));
cpSync(path.join(root, 'web/styles.css'), path.join(out, 'styles.css'));
if (existsSync(path.join(root, 'web/og-image.png'))) cpSync(path.join(root, 'web/og-image.png'), path.join(out, 'og-image.png'));
if (existsSync(path.join(root, 'web/404.html'))) cpSync(path.join(root, 'web/404.html'), path.join(out, '404.html'));
writeFileSync(path.join(out, '.nojekyll'), '');
writeFileSync(path.join(out, 'data/course.json'), JSON.stringify({ documents: catalog, chapterOrder, stageNames, videos: videos.videos,
  videoNotice: videos.notice, videosCheckedAt: videos.checkedAt, animations, repo,
  stats: { chapters: chapterOrder.length, videos: videos.videos.length, animations: animations.length } }));
await build({ entryPoints: [path.join(root, 'web/app.js')], bundle: true, format: 'esm', splitting: true,
  outdir: path.join(out, 'static'), minify: true, target: ['es2022'], sourcemap: false,
  chunkNames: 'chunks/[name]-[hash]', logLevel: 'warning' });
console.log(`Built ${documents.length} reading pages, ${videos.videos.length} videos and ${animations.length} animations into _site`);
