/**
 * 由讲稿 JSON + 成片时间轴，生成可检索的文字稿与索引。
 *
 *   node scripts/video/lecture-notes.mjs            # 全部
 *   node scripts/video/lecture-notes.mjs perm       # 单篇
 *
 * 成片本身在 video-out/（不入库），文字稿入 resources/lectures/，
 * 保证不依赖本地视频也能校对、检索、被学习站构建。
 */
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');
const DIR = path.join(ROOT, 'scripts/video/lectures');
const OUT = path.join(ROOT, 'resources/lectures');
const ids = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const all = (await readdir(DIR)).filter((n) => n.endsWith('.json')).map((n) => n.replace(/\.json$/, ''));
const targets = ids.length ? ids : all;

const cell = (s) => String(s ?? '').replaceAll('|', '\\|');
const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function readStarts(id) {
  const file = path.join(ROOT, 'video-out/lectures', id, 'chapters.txt');
  if (!existsSync(file)) return null;
  return readFileSync(file, 'utf8').trim().split('\n').map((line) => {
    const m = /^(\d{2}):(\d{2})\s+(.*)$/.exec(line);
    return m ? { start: Number(m[1]) * 60 + Number(m[2]), head: m[3] } : null;
  }).filter(Boolean);
}

async function buildOne(id) {
  const spec = JSON.parse(await readFile(path.join(DIR, `${id}.json`), 'utf8'));
  const starts = readStarts(id);
  const publishFile = path.join(ROOT, 'video-out/lectures', id, 'publish.json');
  const publish = existsSync(publishFile) ? JSON.parse(readFileSync(publishFile, 'utf8')) : null;
  const duration = publish?.duration ?? starts?.at(-1)?.start ?? null;
  const cue = [];
  starts?.forEach((s, i) => {
    const next = starts[i + 1]?.start ?? duration;
    cue.push({ ...s, end: next });
  });

  const lines = [];
  lines.push(`# 机制精讲 ${spec.number} · ${spec.title}`);
  lines.push('');
  lines.push(`> ${spec.subtitle}`);
  lines.push('');
  lines.push(`- **对应章节**：[${spec.chapter.replace(/^阶段 \d+ · /, '')}](../../${spec.doc})`);
  lines.push(`- **成片**：\`video-out/lectures/${id}/${id}-wide.mp4\`${duration ? `（${mmss(duration)}）` : ''}`);
  lines.push(`- **字幕**：\`video-out/lectures/${id}/${id}.srt\`；**分段**：\`video-out/lectures/${id}/chapters.txt\``);
  lines.push(`- **讲稿源**：\`scripts/video/lectures/${id}.json\`；重新生成：\`node scripts/video/produce-lecture.mjs ${id}\``);
  lines.push(`- **一句话结论**：**${spec.cover?.answer ?? ''}**`);
  if (!starts) lines.push(`- ⚠️ 本条尚未在本机生成成片时间轴，下面只列出讲稿；渲染后重跑本脚本即可补时间。`);
  lines.push('');

  if (cue.length) {
    lines.push('## 时间轴');
    lines.push('');
    lines.push('| 时间 | 小节 | 画面类型 |');
    lines.push('|---|---|---|');
    const kindName = { title: '标题', concept: '机制', code: '命令', table: '对照表', pitfall: '避坑', quote: '口诀', recap: '自测' };
    for (const [i, c] of cue.entries()) {
      lines.push(`| ${mmss(c.start)} | ${cell(c.head)} | ${kindName[spec.beats[i]?.kind] ?? ''} |`);
    }
    lines.push('');
  }

  lines.push('## 口播稿');
  lines.push('');
  lines.push('> 与成片配音逐字一致；标点按停顿切分，可直接当提词器。');
  lines.push('');
  for (const [i, beat] of spec.beats.entries()) {
    const t = cue[i] ? `${mmss(cue[i].start)} · ` : '';
    lines.push(`### ${t}${beat.head}`);
    lines.push('');
    if (beat.kicker) lines.push(`*${beat.kicker}*`);
    lines.push('');
    lines.push(beat.say);
    lines.push('');
    if (beat.lines?.length) {
      lines.push('画面要点：');
      for (const l of beat.lines) lines.push(`- ${l}`);
      lines.push('');
    }
    if (beat.code) {
      lines.push('```bash');
      lines.push(beat.code);
      lines.push('```');
      lines.push('');
    }
    if (beat.rows?.length) {
      lines.push(`| ${beat.cols.map(cell).join(' | ')} |`);
      lines.push(`|${beat.cols.map(() => '---').join('|')}|`);
      for (const r of beat.rows) lines.push(`| ${r.map(cell).join(' | ')} |`);
      lines.push('');
    }
  }

  const recap = spec.beats.find((b) => b.kind === 'recap');
  if (recap) {
    lines.push('## 自测');
    lines.push('');
    recap.lines.forEach((l, i) => lines.push(`${i + 1}. ${l}`));
    lines.push('');
    lines.push(`做完再回到[本章实验](../../${spec.doc})，用真实输出对照视频里的示意。`);
    lines.push('');
  }
  lines.push('---');
  lines.push('');
  lines.push('成片与封面在 `video-out/`（本地渲染，不入库）；发布信息见同目录 `publish.json`。本文字稿入库，不依赖视频即可校对与检索。');
  lines.push('');

  await writeFile(path.join(OUT, `${id}.md`), lines.join('\n'), 'utf8');
  return { id, spec, cue, duration };
}

await mkdir(OUT, { recursive: true });
const built = [];
for (const id of targets) built.push(await buildOne(id));

built.sort((a, b) => a.spec.number.localeCompare(b.spec.number));
const rows = built.map(({ id, spec, duration }) =>
  `| ${spec.number} | [${cell(spec.title)}](${id}.md) | ${duration ? mmss(duration) : '待渲染'} | [${cell(spec.chapter.replace(/^阶段 \d+ · /, ''))}](../../${spec.doc}) |`);
const index = `# 机制精讲 · 章节正片文字稿

长视频系列：把一章的机制拆成 6–8 分钟，配仓库自己的 SVG 动画、命令卡、对照表和避坑清单。
每篇文字稿与成片配音逐字一致，可直接当提词器，也可当复习提纲。

| 编号 | 主题 | 时长 | 对应章节 |
|---|---|---|---|
${rows.join('\n')}

## 怎么用

1. 先看视频或读下面的文字稿，遇到命令先暂停，自己敲一遍。
2. 回到对应章节完成「动手实验」，用真实输出对照视频里的示意。
3. 文字稿里的命令都来自章节，版本差异以章节的「环境对照表」为准。

## 与 60 秒短片的区别

短片（\`video-out/<集>/\`）只讲一个钩子；机制精讲补上完整链路：现象 → 机制 → 命令验证 → 坑 → 自测，
并把动画逐相位放大到可读。两者共用同一批 SVG 与同一套配音流程，不重复拍摄。

## 重新生成

\`\`\`bash
node scripts/video/produce-lecture.mjs perm        # 1080p 成片 + SRT + 封面 + publish.json
node scripts/video/lecture-notes.mjs              # 刷新文字稿与索引
\`\`\`
`;
await writeFile(path.join(OUT, 'README.md'), index, 'utf8');
console.log(`文字稿 ${built.length} 篇 → resources/lectures/`);
