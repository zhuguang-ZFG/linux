import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkChapterNavigation } from './chapter-navigation.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const errors = [];
const fail = message => errors.push(message);
const read = name => readFileSync(path.join(root, name), 'utf8');
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (['.git', 'node_modules', '__pycache__', '.venv', '_site', '.cache', 'test-results', 'playwright-report'].includes(entry.name)) return [];
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const files = walk(root);
const markdown = files.filter(file => file.endsWith('.md'));
let checkedLinks = 0;
for (const file of markdown) {
  const source = readFileSync(file, 'utf8');
  // Keep line positions while excluding fenced examples from link checks.
  const prose = source.replace(/^```[^\n]*\n[\s\S]*?^```\s*$/gm, block => block.replace(/[^\n]/g, ' '));
  for (const match of prose.matchAll(/\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g)) {
    const href = match[1];
    if (/^(?:[a-z][a-z\d+.-]*:|#)/i.test(href)) continue;
    if (href === 'URL' && path.basename(file) === 'TEMPLATE.md') continue;
    checkedLinks++;
    const target = path.resolve(path.dirname(file), decodeURIComponent(href.split('#')[0]));
    if (!existsSync(target)) {
      const line = source.slice(0, match.index).split('\n').length;
      fail(`${path.relative(root, file)}:${line}: missing ${href}`);
    }
  }
}

const stages = ['00-onboarding', '01-basics', '02-advanced', '03-pro', '04-projects', '05-raspberry-pi'];
const chapters = stages.flatMap(stage => readdirSync(path.join(root, 'docs', stage))
  .filter(name => name.endsWith('.md')).map(name => `docs/${stage}/${name}`));
const readme = read('README.md');
const entries = [...readme.matchAll(/\]\((docs\/[^)]+\.md)\)/g)].map(match => match[1]);
if (new Set(entries).size !== entries.length) fail('README: duplicate chapter entries');
if (entries.length !== chapters.length) fail(`README: ${entries.length} entries for ${chapters.length} chapters`);
for (const issue of checkChapterNavigation(entries, read)) fail(issue);
for (const chapter of chapters) {
  if (!entries.includes(chapter)) fail(`Chapter missing from README: ${chapter}`);
  const body = read(chapter);
  const sections = chapter.startsWith('docs/04-projects/')
    ? ['(?:学习目标|项目目标)', '(?:核心概念|方案设计)', '(?:命令实操|动手实施)', '避坑指南', '(?:动手实验|进阶挑战)', '推荐视频', '(?:自测清单|验收清单)', '延伸阅读']
    : ['学习目标', '核心概念', '命令实操', '避坑指南', '动手实验', '推荐视频', '自测清单', '延伸阅读'];
  for (const section of sections) {
    if (!new RegExp(`^## .*${section}`, 'm').test(body)) fail(`${chapter}: missing section ${section}`);
  }
}
const badge = /教学章节-(\d+)个/.exec(readme);
if (!badge || Number(badge[1]) !== chapters.length) fail('README: chapter badge does not match actual count');
const summary = /6 个阶段 (\d+) 个章节/.exec(readme);
if (!summary || Number(summary[1]) !== chapters.length) fail('README: chapter summary does not match actual count');
const animations = readdirSync(path.join(root, 'assets/animations')).filter(name => name.endsWith('.svg'));
const photos = readdirSync(path.join(root, 'assets/images')).filter(name => /\.(jpg|jpeg|png|webp)$/i.test(name));
if (Number(/精美动画-(\d+)部/.exec(readme)?.[1]) !== animations.length) fail('README: animation badge count differs from files');
if (Number(/\*\*实物图鉴\*\*：(\d+) 张/.exec(readme)?.[1]) !== photos.length) fail('README: photo count differs from files');
const videoCount = JSON.parse(read('resources/videos.json')).videos.length;
if (Number(/视频选段-(\d+)条/.exec(readme)?.[1]) !== videoCount) fail('README: video count differs from metadata');
const countIn = dir => readdirSync(path.join(root, dir)).filter(name => name.endsWith('.md') && name !== 'README.md').length;
if (countIn('exercises') !== 6) fail(`exercises: expected 6, got ${countIn('exercises')}`);
const cheatsheetCount = countIn('cheatsheets');
const listedCheatsheets = (/\| ⚡ \[速查表\]\(cheatsheets\/\) \| ([^|]+)\|/.exec(readme)?.[1] || '').split('/').map(item => item.trim()).filter(Boolean).length;
if (!listedCheatsheets) fail('README: cheatsheet row missing');
else if (listedCheatsheets !== cheatsheetCount) fail(`README lists ${listedCheatsheets} cheatsheets, directory has ${cheatsheetCount}`);

const bash = process.env.BASH_BIN || (process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash');
let checkedScripts = 0;
function syntaxCheck(label, code) {
  checkedScripts++;
  const result = spawnSync(bash, ['--noprofile', '--norc', '-n'], { input: code, encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) fail(`${label}: Bash syntax error\n${result.stderr}`);
}
for (const file of files.filter(file => file.endsWith('.sh'))) {
  const code = readFileSync(file, 'utf8');
  if (code.includes('\r')) fail(`${path.relative(root, file)}: shell source must use LF`);
  syntaxCheck(path.relative(root, file), code);
}
for (const file of markdown) {
  const body = readFileSync(file, 'utf8');
  for (const match of body.matchAll(/^```bash\r?\n(#![^\n]*\n[\s\S]*?)^```/gm)) {
    syntaxCheck(path.relative(root, file), match[1].replaceAll('\r\n', '\n'));
  }
}

const dockerDoc = read('docs/03-pro/04-容器与虚拟化.md');
const dockerBlock = /```dockerfile\r?\n([\s\S]*?)```/.exec(dockerDoc)?.[1];
const normalize = value => value.split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith('#')).join('\n');
if (!dockerBlock || normalize(dockerBlock) !== normalize(read('scripts/docker-hello/Dockerfile'))) {
  fail('Dockerfile in chapter differs from executable example');
}
const bashDoc = read('docs/02-advanced/05-Bash脚本编程.md');
if (/xargs\s+(?:-r\s+)?rm/.test(bashDoc)) fail('Backup chapter reintroduced whitespace-delimited deletion');
const sshDoc = read('docs/03-pro/03-安全加固.md');
if (/sudo sha256sum[^\n]*>\s*\/root\//.test(sshDoc)) fail('Integrity example redirects as the unprivileged shell');
if (!sshDoc.includes('sudo sshd -T')) fail('SSH chapter must verify effective configuration');
if (!sshDoc.includes('# /etc/ssh/sshd_config.d/00-local-hardening.conf')) fail('SSH example lost the early configuration snippet');

if (errors.length) {
  for (const error of errors) console.error(error);
  process.exitCode = 1;
} else {
  console.log(`PASS: ${markdown.length} Markdown files, ${checkedLinks} local links, ${chapters.length} chapters, ${animations.length} animations, ${photos.length} images, 6 exercise sets, ${cheatsheetCount} cheatsheets, ${checkedScripts} Bash syntax checks; example consistency checks passed.`);
}
