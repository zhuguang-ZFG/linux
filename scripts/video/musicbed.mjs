#!/usr/bin/env node
// 为已渲好的成片叠加程序合成的氛围音乐床（仅音频：-c:v copy，不重渲画面）
// 用法：node scripts/video/musicbed.mjs pipes [--dry]
import { spawnSync } from 'node:child_process';
import { writeFile, rename } from 'node:fs/promises';
import path from 'node:path';

const OUT = 'video-out';
const args = process.argv.slice(2);
const dry = args.includes('--dry');
const episodeId = args.find((a) => !a.startsWith('--'));
if (!episodeId) { console.error('缺少集名'); process.exit(1); }

const sh = (cmd, a) => {
  const r = spawnSync(cmd, a, { encoding: 'utf8' });
  if (r.status !== 0) { console.log((r.stderr || r.stdout || '').trim()); throw new Error(cmd + ' 失败'); }
  return r.stdout || '';
};
const durOf = (f) => parseFloat(sh('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).trim());

const SR = 48000;
const track = path.join(OUT, episodeId, 'track.m4a');
const total = Math.round(durOf(track) * SR);
const totalSec = total / SR;

// A 小调慢速和声，每段约 19 秒
const CHORDS = [
  [110.00, 164.81, 220.00, 261.63], // Am
  [87.31, 130.81, 174.61, 220.00],  // F
  [130.81, 196.00, 261.63, 329.63], // C
  [98.00, 146.83, 196.00, 246.94],  // G
];
const SEG = 19.0, TAIL = 2.0, ATTACK = 3.2, RELEASE = 4.5;
const HARM = [[1, 1.0], [2, 0.32], [3, 0.11], [4, 0.04]];

const L = new Float64Array(total), R = new Float64Array(total);
for (let ci = 0; ci * SEG < totalSec; ci++) {
  const chord = CHORDS[ci % CHORDS.length];
  const d0 = ci * SEG;
  const len = Math.min(totalSec - d0, SEG + TAIL);
  if (len <= 0) break;
  const n0 = Math.round(d0 * SR), n1 = Math.min(total, Math.round((d0 + len) * SR));
  for (const base of chord) {
    for (const [hi, amp] of HARM) {
      const f = base * hi;
      // 两次微失谐分别偏左/偏右，得到合唱般的立体宽度
      for (const [buf, det, g] of [[L, 1.0018, 0.85], [R, 0.9982, 0.85], [L, 1.0, 0.5], [R, 1.0, 0.5]]) {
        const freq = f * det;
        let ph = (ci * 1.7 + hi * 0.9 + base) % 1;
        const step = freq / SR;
        const wob = 2 * Math.PI * 0.11 * det, wob2 = 2 * Math.PI * 0.07 * det;
        for (let i = n0; i < n1; i++) {
          const t = i / SR, rel = i - n0;
          let e = Math.min(1, (rel / SR / ATTACK) ** 1.6);
          const out = (n1 - i) / SR;
          if (out < RELEASE) e *= Math.max(0, out / RELEASE) ** 1.4;
          if (e <= 0) { ph += step; continue; }
          const trem = 1 + 0.11 * Math.sin(wob * t + ph * 6.283);
          buf[i] += e * g * amp / HARM.length * trem
            * Math.sin(6.28318530718 * (ph + 0.02 * Math.sin(wob2 * t)));
          ph += step;
          if (ph > 1) ph -= 1;
        }
      }
    }
  }
}

const FI = Math.round(2.5 * SR), FO = Math.round(3.5 * SR);
let peak = 0;
for (let i = 0; i < total; i++) {
  const s = Math.min(1, i / FI, (total - i) / FO);
  L[i] *= s; R[i] *= s;
  if (Math.abs(L[i]) > peak) peak = Math.abs(L[i]);
  if (Math.abs(R[i]) > peak) peak = Math.abs(R[i]);
}
const scale = 0.045 / (peak || 1);

const buf = Buffer.alloc(44 + total * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + total * 4, 4); buf.write('WAVE', 8);
buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
buf.write('data', 36); buf.writeUInt32LE(total * 4, 40);
for (let i = 0; i < total; i++) {
  buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * scale)) * 32767), 44 + i * 4);
  buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * scale)) * 32767), 44 + i * 4 + 2);
}
const bedFile = path.join(OUT, episodeId, 'bgm.wav');
await writeFile(bedFile, buf);
console.log(`音乐床：${totalSec.toFixed(2)}s peak=${peak.toFixed(3)} → ${bedFile}`);
if (dry) process.exit(0);

const TARGET = 'I=-16:TP=-1.5:LRA=11';
function measure(file) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-i', file, '-af', `${TARGET.replace('I=', 'loudnorm=I=')}:print_format=json`, '-f', 'null', '-'], { encoding: 'utf8' });
  const t = (r.stderr || '').match(/\{[^{}]*"input_i"[\s\S]*?\}/);
  if (!t) throw new Error('未取到响度测量结果：' + file);
  return JSON.parse(t[0]);
}
for (const fmt of ['wide', 'tall']) {
  const file = path.join(OUT, episodeId, `${episodeId}-${fmt}.mp4`);
  const mixed = path.join(OUT, episodeId, `${episodeId}-${fmt}-mix.m4a`);
  sh('ffmpeg', ['-y', '-loglevel', 'error', '-i', track, '-i', bedFile,
    '-filter_complex', '[0:a]aformat=sample_fmts=fltp:channel_layouts=stereo[v];'
      + '[1:a]aformat=sample_fmts=fltp:channel_layouts=stereo[bed];'
      + '[v][bed]amix=inputs=2:duration=first:normalize=0[mix]',
    '-map', '[mix]', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', mixed]);
  const m = measure(mixed);
  const tmp = file.replace(/\.mp4$/, '.bgm.mp4');
  sh('ffmpeg', ['-y', '-loglevel', 'error', '-i', file, '-i', mixed,
    '-map', '0:v', '-map', '1:a', '-c:v', 'copy',
    '-af', `loudnorm=${TARGET}:linear=true:print_format=json:measured_I=${m.input_i}:measured_TP=${m.input_tp}`
      + `:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}`,
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', tmp]);
  await rename(tmp, file);
  console.log(`${path.basename(file)} 混音前 ${m.input_i} LUFS / TP ${m.input_tp} / LRA ${m.input_lra}`);
}
console.log('音乐床叠加完成（画面未重渲）');
