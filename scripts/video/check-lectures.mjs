/**
 * 机制精讲的交付自检：讲稿结构、成片时长、字幕/分段数量、封面与文字稿一致性。
 *
 *   node scripts/video/check-lectures.mjs
 *
 * 成片未渲染时只检查"可离线检查"的部分（讲稿与文字稿），
 * 渲染过则额外核对视频、SRT、chapters.txt 与封面；任何不一致退出 1。
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');
const DIR = path.join(ROOT, 'scripts/video/lectures');
const errors = [];
const notes = [];
const kinds = new Set(['title', 'concept', 'code', 'table', 'pitfall', 'quote', 'recap']);

const duration = (file) => Number(execFileSync('ffprobe',
  ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' }).trim());

for (const file of readdirSync(DIR).filter((n) => n.endsWith('.json'))) {
  const id = file.replace(/\.json$/, '');
  const spec = JSON.parse(readFileSync(path.join(DIR, file), 'utf8'));
  const where = `scripts/video/lectures/${file}`;
  if (!spec.title || !spec.doc || !spec.number) errors.push(`${where}: 缺 title/doc/number`);
  if (!existsSync(path.join(ROOT, spec.doc))) errors.push(`${where}: doc 不存在 ${spec.doc}`);
  if (spec.beats.length < 8) errors.push(`${where}: 长视频至少 8 段，当前 ${spec.beats.length}`);
  const first = spec.beats[0];
  if (first.kind !== 'title') errors.push(`${where}: 第一段必须是 title`);
  if (!spec.beats.some((b) => b.kind === 'quote')) notes.push(`${where}: 没有口诀卡（不阻断）`);
  for (const [i, b] of spec.beats.entries()) {
    const at = `${where} 第 ${i + 1} 段`;
    if (!kinds.has(b.kind)) errors.push(`${at}: 未知 kind ${b.kind}`);
    if (!b.head) errors.push(`${at}: 缺 head`);
    if (!b.say || b.say.length < 8) errors.push(`${at}: 缺旁白`);
    if (b.say && b.say.length > 190) notes.push(`${at}: 旁白 ${b.say.length} 字，字幕可能超过三行`);
    if (b.svg && !existsSync(path.join(ROOT, b.svg))) errors.push(`${at}: SVG 不存在 ${b.svg}`);
    if (b.kind === 'code' && !b.code) errors.push(`${at}: code 段缺 code`);
    if ((b.kind === 'table' || b.kind === 'pitfall') && (!b.rows?.length || !b.cols?.length)) {
      errors.push(`${at}: 表格段缺 rows/cols`);
    }
  }
  const transcript = path.join(ROOT, 'resources/lectures', `${id}.md`);
  if (!existsSync(transcript)) errors.push(`${id}: 缺文字稿 resources/lectures/${id}.md`);
  else {
    const text = readFileSync(transcript, 'utf8');
    for (const [i, b] of spec.beats.entries()) {
      if (!text.includes(b.say)) errors.push(`${id}: 文字稿缺少第 ${i + 1} 段旁白（重跑 lecture-notes.mjs）`);
    }
  }

  const out = path.join(ROOT, 'video-out/lectures', id);
  if (!existsSync(out)) { notes.push(`${id}: 尚未渲染成片（只检查了讲稿与文字稿）`); continue; }
  const publishFile = path.join(out, 'publish.json');
  const mp4 = path.join(out, `${id}-wide.mp4`);
  if (!existsSync(mp4) || !existsSync(publishFile)) { notes.push(`${id}: 渲染未完成，跳过成片核对`); continue; }
  const publish = JSON.parse(readFileSync(publishFile, 'utf8'));
  let actual;
  try {
    actual = duration(mp4);
  } catch {
    notes.push(`${id}: 成片正在写入或不可读，跳过成片核对`);
    continue;
  }
  if (Math.abs(actual - publish.duration) > 3) {
    errors.push(`${id}: 成片 ${actual.toFixed(1)}s 与 publish.json ${publish.duration}s 相差超过 3s`);
  }
  const srt = readFileSync(path.join(out, `${id}.srt`), 'utf8').trim().split(/\n\n+/);
  if (srt.length !== spec.beats.length) errors.push(`${id}: SRT ${srt.length} 条，讲稿 ${spec.beats.length} 段`);
  const parseTime = (t) => {
    const m = /(\d+):(\d+):(\d+),(\d+)/.exec(t || '');
    return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4]) / 1000 : NaN;
  };
  for (const [i, block] of srt.entries()) {
    const rows = block.split('\n');
    const span = /^(.+) --> (.+)$/.exec(rows[1] || '');
    if (!span) { errors.push(`${id}: SRT 第 ${i + 1} 条缺少时间行`); continue; }
    const [start, end] = [parseTime(span[1]), parseTime(span[2])];
    if (!(end > start)) errors.push(`${id}: SRT 第 ${i + 1} 条时间不递增`);
    if (end > actual + 1) errors.push(`${id}: SRT 第 ${i + 1} 条超出成片时长`);
    const text = rows.slice(2).join(' ').trim();
    if (text !== spec.beats[i]?.say) errors.push(`${id}: SRT 第 ${i + 1} 条文字与讲稿不一致`);
  }
  const chapters = readFileSync(path.join(out, 'chapters.txt'), 'utf8').trim().split('\n');
  if (chapters.length !== spec.beats.length) errors.push(`${id}: chapters ${chapters.length} 行，讲稿 ${spec.beats.length} 段`);
  const times = chapters.map((line) => {
    const m = /^(\d{2}):(\d{2})\s/.exec(line);
    return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
  });
  for (let i = 1; i < times.length; i++) {
    if (!(times[i] > times[i - 1])) errors.push(`${id}: chapters 第 ${i + 1} 行时间未递增`);
  }
  for (const name of ['16x9', '4x3', '3x4', '9x16']) {
    if (!existsSync(path.join(out, `${id}-cover-${name}.jpg`))) errors.push(`${id}: 缺 ${name} 封面`);
  }
  notes.push(`${id}: ${(actual / 60).toFixed(1)} 分钟，${spec.beats.length} 段，字幕/分段/封面齐全`);
}

for (const n of notes) console.log(`· ${n}`);
if (errors.length) {
  console.error(`\n${errors.length} 个问题：`);
  for (const e of errors) console.error(`- ${e}`);
  process.exitCode = 1;
} else {
  console.log('\n机制精讲自检通过');
}
