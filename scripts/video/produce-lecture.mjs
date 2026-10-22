/**
 * 章节正片（长视频）：script -> 1080p 成片 + SRT + 章节标记 + 封面。
 *
 * 与 shorts 的 produce.mjs 同一套素材（仓库 SVG 动画、edge-tts、ffmpeg），
 * 但版式是 16:9 长视频：标题卡 / 概念卡 / 代码卡 / 表格卡 / 坑位卡 / 口诀卡 / 自测卡。
 *
 * 用法：
 *   node scripts/video/produce-lecture.mjs perm                # 渲染
 *   node scripts/video/produce-lecture.mjs perm --limit 120    # 只渲前 120 帧（调试）
 *   node scripts/video/produce-lecture.mjs perm --stills       # 关键静帧
 *   node scripts/video/produce-lecture.mjs perm --covers       # 四比例封面
 *   node scripts/video/produce-lecture.mjs perm --sidecars     # 只刷 SRT/章节
 */
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';

const ROOT = path.resolve(import.meta.dirname, '../..');
const args = process.argv.slice(2);
const lectureId = args[0] ?? 'perm';
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const limit = Number(opt('limit', 0));
const OUT = path.join(ROOT, 'video-out', 'lectures', lectureId);
const SIZE = { width: 1920, height: 1080 };

const sh = (cmd, cmdArgs, onStdin) =>
  new Promise((resolve, reject) => {
    const p = spawn(cmd, cmdArgs, { stdio: [onStdin ? 'pipe' : 'ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => (err += d));
    p.on('error', reject);
    p.on('exit', (code) =>
      code ? reject(new Error(`${cmd} exit ${code}\n${err.slice(-3000)}`)) : resolve(err));
    if (onStdin) onStdin(p.stdin, reject);
  });

const probe = (file) =>
  new Promise((resolve, reject) => {
    const p = spawn('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file],
      { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    p.stdout.on('data', (d) => (out += d));
    p.on('error', reject);
    p.on('exit', (code) => (code ? reject(new Error(`ffprobe exit ${code} on ${file}`)) : resolve(Number(out.trim()))));
  });

const spec = JSON.parse(await readFile(path.join(ROOT, 'scripts/video/lectures', `${lectureId}.json`), 'utf8'));
if (!Array.isArray(spec.beats) || spec.beats.length < 6) throw new Error('beats 太少，长视频至少 6 段');
await mkdir(path.join(OUT, 'audio'), { recursive: true });

// 1) 逐段旁白：实测时长决定分镜长度
for (const [bi, beat] of spec.beats.entries()) {
  if (!beat.say || beat.say.length < 8) throw new Error(`第 ${bi + 1} 段缺旁白`);
  const key = createHash('sha1').update(`${spec.voice}|${spec.rate}|${beat.say}`).digest('hex').slice(0, 16);
  const mp3 = path.join(OUT, 'audio', `b${String(bi).padStart(2, '0')}-${key}.mp3`).replaceAll('\\', '/');
  const js = mp3.replace(/\.mp3$/, '.words.json');
  if (!existsSync(mp3) || !existsSync(js)) {
    for (let attempt = 1; ; attempt++) {
      try {
        await sh('python3', [path.join(ROOT, 'scripts', 'video', 'say.py'), beat.say, spec.voice, spec.rate, mp3, js]);
        break;
      } catch (e) {
        if (attempt >= 4) throw new Error(`TTS 失败（已重试 ${attempt} 次）：${beat.say}\n${String(e.message).slice(-400)}`);
        console.warn(`\nTTS 重试 ${attempt}/4：${beat.say.slice(0, 24)}…`);
        await new Promise((r) => setTimeout(r, 1200 * attempt));
      }
    }
  }
  beat.file = mp3;
  beat.audioDur = await probe(mp3);
  beat.words = existsSync(js) ? JSON.parse(readFileSync(js, 'utf8')).words : [];
}

// 2) 全局时间轴
const MIN_DUR = { title: 6.2, quote: 7.4, recap: 6.8, code: 7, table: 8, pitfall: 8.5, concept: 7 };
let cursor = 0;
for (const [idx, beat] of spec.beats.entries()) {
  beat.idx = idx;
  const svgMin = beat.svg ? Math.min(12, (beat.cycle ?? spec.cycle ?? 12) * 0.86) : 0;
  beat.dur = Math.max(
    beat.audioDur + spec.leadPad + spec.tailPad,
    Math.max(beat.minDur ?? 0, MIN_DUR[beat.kind] ?? 6, svgMin),
  );
  beat.start = cursor;
  cursor += beat.dur;
}
const TOTAL = cursor;
for (const beat of spec.beats) {
  const n = (beat.lines || []).length;
  const span = Math.max(0.32, Math.min(1.05, (beat.audioDur * 0.62) / Math.max(1, n)));
  beat.reveals = Array.from({ length: n }, (_, i) => beat.start + spec.leadPad + 0.35 + i * span);
}

// 3) 逐字时间
function karaoke(beat) {
  const out = [];
  let p = 0;
  for (const [off, dur, tok] of beat.words || []) {
    const at = beat.say.indexOf(tok, p);
    if (at < 0) continue;
    for (; p < at; p++) out.push({ c: beat.say[p], s: beat.start + spec.leadPad + off, e: beat.start + spec.leadPad + off });
    for (let j = 0; j < tok.length; j++, p++) {
      out.push({
        c: tok[j],
        s: beat.start + spec.leadPad + off + (dur * j) / tok.length,
        e: beat.start + spec.leadPad + off + (dur * (j + 1)) / tok.length,
      });
    }
  }
  const tail = out.length ? out[out.length - 1].e : beat.start + beat.audioDur;
  for (; p < beat.say.length; p++) out.push({ c: beat.say[p], s: tail, e: tail });
  return out;
}

const timeline = {
  total: TOTAL,
  series: spec.series,
  chapter: spec.chapter,
  title: spec.title,
  number: spec.number,
  cover: spec.cover,
  coverSvg: spec.cover?.hero ? await readFile(path.join(ROOT, spec.cover.hero), 'utf8') : null,
  beats: await Promise.all(spec.beats.map(async ({ words, file, audioDur, reveals, ...beat }) => {
    const svgText = beat.svg ? await readFile(path.join(ROOT, beat.svg), 'utf8') : null;
    return { ...beat, svgText, reveals, caption: { start: beat.start + spec.leadPad, end: beat.start + spec.leadPad + audioDur, chars: karaoke({ ...beat, words, audioDur }) } };
  })),
};

// 4) 舞台
const stageCss = `
*{margin:0;box-sizing:border-box}html,body{overflow:hidden}
body{font-family:"Noto Sans CJK SC","Microsoft YaHei","PingFang SC",sans-serif;background:#070b10;color:#eaf1f8;
-webkit-font-smoothing:antialiased}
#stage{position:absolute;inset:0;padding:5.2vh 4.4vw 3.2vh;display:flex;flex-direction:column;
background:radial-gradient(120% 80% at 18% 0%,#14212e 0%,#0b1219 46%,#06090d 100%)}
#stage:before{content:"";position:absolute;inset:0;pointer-events:none;opacity:.35;
background-image:radial-gradient(rgba(255,255,255,.07) 1px,transparent 1px);background-size:3.6vh 3.6vh;
-webkit-mask-image:radial-gradient(110% 80% at 50% 0%,#000 12%,transparent 76%);mask-image:radial-gradient(110% 80% at 50% 0%,#000 12%,transparent 76%)}
#top{position:relative;display:flex;justify-content:space-between;align-items:baseline;gap:2vw;
font-size:2.05vh;letter-spacing:.16em;color:#8b9bad;z-index:2}
#top b{color:#7ee787;font-weight:700;letter-spacing:.12em}
#step{font-variant-numeric:tabular-nums;color:#738294;letter-spacing:.1em}
#step em{font-style:normal;color:#c7d5e4}
#main{position:relative;flex:1;display:flex;flex-direction:column;justify-content:center;min-height:0;z-index:2;padding:1.6vh 0 0}
.kick{font-size:1.9vh;letter-spacing:.12em;color:#7ee787;margin-bottom:1.4vh;font-weight:700}
.head{font-size:4.4vh;line-height:1.28;font-weight:800;letter-spacing:.01em;text-wrap:balance;max-width:96%}
.head .hl{color:#7ee787}
.cols{display:grid;grid-template-columns:minmax(0,1.08fr) minmax(0,.92fr);gap:3vw;align-items:center;width:100%}
.panel{background:linear-gradient(160deg,rgba(24,33,44,.9),rgba(10,15,21,.92));border:1px solid #24333f;
border-radius:1.8vh;padding:2.2vh 2.2vw;box-shadow:0 2.4vh 7vh rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.04)}
.bullets{display:flex;flex-direction:column;gap:1.8vh;margin-top:3vh}
.bullets div{display:flex;gap:1.2vw;font-size:2.85vh;line-height:1.5;color:#d5e2ee;opacity:0;transform:translateY(.9vh)}
.bullets div:before{content:"";flex:0 0 auto;width:1.05vh;height:1.05vh;margin-top:1.15vh;border-radius:.3vh;background:#7ee787;
box-shadow:0 0 1.4vh rgba(126,231,135,.55)}
.bullets .hl{color:#a5f0ac;font-weight:700}
.art{display:flex;align-items:center;justify-content:center;min-height:0;max-height:56vh;overflow:hidden;border-radius:1.4vh;position:relative;-webkit-mask-image:linear-gradient(to bottom,transparent 0,#000 4%,#000 96%,transparent 100%);mask-image:linear-gradient(to bottom,transparent 0,#000 4%,#000 96%,transparent 100%)}
.art svg{width:100%;height:auto;max-height:54vh;transform-origin:0 0;will-change:transform}
pre{font-family:Consolas,"JetBrains Mono","Cascadia Mono",monospace;font-size:2.45vh;line-height:1.62;color:#dce8f4;
background:#070c12;border:1px solid #24333f;border-radius:1.4vh;padding:2.2vh 2vw;overflow:hidden;white-space:pre-wrap;
box-shadow:inset 0 1px 0 rgba(255,255,255,.04)}
pre i{font-style:normal;color:#6f8296}
pre b{color:#79c0ff;font-weight:600}
table{border-collapse:collapse;width:100%;margin-top:3vh;font-size:2.3vh;line-height:1.45}
th{background:#101a24;color:#9fb2c6;font-weight:700;text-align:left;padding:1.15vh 1.1vw;border:1px solid #24333f;letter-spacing:.04em}
td{padding:1.15vh 1.1vw;border:1px solid #1e2b37;color:#d3e1ee;vertical-align:top}
td:first-child{color:#a5f0ac;font-weight:700}
.pit td:first-child{color:#ff9b7a}
.title{align-items:flex-start;justify-content:center}
.title .head{font-size:6.1vh;line-height:1.18;max-width:88%}
.title .lines{display:flex;gap:2.6vw;margin-top:3.6vh;font-size:2.5vh;color:#9db0c3;flex-wrap:wrap}
.title .lines span{padding-left:1.2vw;border-left:.35vh solid #2c3f50}
.title .no{position:absolute;right:0;bottom:-2vh;font-size:24vh;font-weight:900;color:rgba(126,231,135,.055);letter-spacing:.04em;line-height:1}
.quote{align-items:center;text-align:center}
.quote .kick{text-align:center}
.quote .lines{display:flex;flex-direction:column;gap:2.2vh;margin-top:2vh;font-size:5.4vh;font-weight:800;line-height:1.35;color:#f2f8ff}
.quote .lines .hl{color:#7ee787}
.scene.nozoom .cols{grid-template-columns:1fr;gap:1.2vh}
.scene.nozoom .bullets{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:auto auto;grid-auto-flow:column;gap:1vh 2.4vw;margin-top:2.2vh}
.scene.nozoom .art{max-height:44vh;width:100%;margin-top:.6vh}
.scene.nozoom .art svg{max-height:44vh;width:100%}
.recap .bullets div{font-size:3.05vh}
.recap .bullets div:before{background:#79c0ff;box-shadow:0 0 1.4vh rgba(121,192,255,.45)}
#cap{height:13vh;display:flex;align-items:center;justify-content:center;text-align:center;font-size:2.7vh;line-height:1.5;
font-weight:600;color:#eaf2ff;padding:0 7vw;text-wrap:balance;text-shadow:0 .4vh 2.2vh rgba(0,0,0,.85);z-index:2}
#cap i{font-style:normal;color:#798694}
#cap i.k2{color:#eaf2ff}
#cap i.k1{color:#7ee787;text-shadow:0 0 1.6vh rgba(126,231,135,.5)}
#foot{display:flex;justify-content:space-between;font-size:1.75vh;color:#68798b;letter-spacing:.1em;z-index:2}
#bar{position:absolute;left:0;bottom:0;height:.42vh;width:0;background:linear-gradient(90deg,#1f6feb,#7ee787);
box-shadow:0 0 1.8vh rgba(126,231,135,.5)}
.bghero{position:absolute;inset:-14%;z-index:0;pointer-events:none;opacity:.12;
-webkit-mask-image:radial-gradient(60% 60% at 70% 40%,#000 0%,transparent 78%);mask-image:radial-gradient(60% 60% at 70% 40%,#000 0%,transparent 78%)}
.bghero svg{width:100%;height:100%}
#cover{display:none;position:absolute;inset:0;padding:6vh 5.4vw;overflow:hidden;--accent:#7ee787;
background:linear-gradient(162deg,#12202e 0%,#0a1119 54%,#05070a 100%)}
html.cover #cover{display:grid;grid-template-rows:auto 1fr auto;z-index:5}
html.cover #stage{display:none}
#cover:before{content:"";position:absolute;inset:0;z-index:1;
background:radial-gradient(120% 78% at 12% 4%,color-mix(in srgb,var(--accent) 24%,transparent) 0%,transparent 58%),
linear-gradient(180deg,rgba(5,8,12,.7) 0%,rgba(5,8,12,.36) 36%,rgba(5,8,12,.9) 100%)}
.cv-top{position:relative;z-index:2;display:flex;justify-content:space-between;align-items:center;font-size:2.2vh;color:#b9c7d6;letter-spacing:.14em}
.cv-ep{background:var(--accent);color:#06121a;font-weight:800;padding:.6vh 1.6vw;border-radius:999px;letter-spacing:.06em}
.cv-mid{position:relative;z-index:2;align-self:center;display:flex;flex-direction:column;gap:3vh;max-width:82%}
.cv-q{font-size:6.4vh;line-height:1.16;font-weight:900;color:#fff;text-wrap:balance;white-space:pre-line;text-shadow:0 .5vh 3vh rgba(0,0,0,.6)}
.cv-a{display:flex;align-items:center;gap:1.2vw;font-size:3.2vh;color:#e6eef7}
.cv-a em{font-style:normal;background:var(--accent);color:#06121a;font-weight:800;padding:.45vh 1.3vw;border-radius:.8vh;font-size:2.4vh}
.cv-foot{position:relative;z-index:2;display:flex;justify-content:space-between;font-size:2.2vh;color:#a8b7c6}
.cv-badge{color:#06121a;background:var(--accent);padding:.5vh 1.6vw;border-radius:999px;font-weight:800}
.cv-hero{position:absolute;inset:-10%;z-index:0}
.cv-hero svg{width:100%;height:100%;filter:blur(7px) saturate(.95);opacity:.5}
html.tall #cover{padding:8vh 7vw}
html.tall .cv-q{font-size:7.2vw}
html.tall .cv-a{font-size:4vw}
html.tall .cv-mid{max-width:100%}
`;

const stage = `<!doctype html><html lang="zh"><head><meta charset="utf-8"><style>${stageCss}</style></head>
<body><div id="stage">
<div id="top"><span>${spec.series}</span><span id="step"></span></div>
<div id="main"></div>
<div id="cap"></div>
<div id="foot"><span>${spec.chapter}</span><span>zhuguang-zfg.github.io/linux</span></div>
<div id="bar"></div></div>
<div id="cover"><div class="cv-top"><span></span><span class="cv-ep"></span></div>
<div class="cv-mid"><h1 class="cv-q"></h1><div class="cv-a"><em>记住</em><span class="cv-atext"></span></div></div>
<div class="cv-foot"><span class="cv-badge"></span><span class="cv-series"></span></div>
<div class="cv-hero"></div></div>
<script>
const T=${JSON.stringify(timeline)};
const esc=(s)=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const rich=(t)=>esc(t).split(/(「[^」]*」)/).map((p)=>p.startsWith('「')?'<span class="hl">'+esc(p.slice(1,-1))+'</span>':p).join('');
const stepEl=document.getElementById('step'), capEl=document.getElementById('cap'), main=document.getElementById('main');
main.innerHTML=T.beats.map((b,i)=>{
  let inner='';
  if(b.kind==='title'){
    inner='<div class="kick">'+b.kicker+'</div><h1 class="head">'+rich(b.head)+'</h1>'+
      '<div class="lines">'+(b.lines||[]).map((l)=>'<span>'+rich(l)+'</span>').join('')+'</div>'+
      '<div class="no">'+T.number+'</div>'+
      (b.svgText?'<div class="bghero">'+b.svgText+'</div>':'');
  } else if(b.kind==='quote'){
    inner='<div class="kick">'+b.kicker+'</div><div class="lines">'+(b.lines||[]).map((l)=>'<div>'+rich(l)+'</div>').join('')+'</div>';
  } else if(b.kind==='concept' || b.kind==='recap'){
    inner='<div class="kick">'+b.kicker+'</div><h2 class="head">'+rich(b.head)+'</h2>'+
      '<div class="bullets">'+(b.lines||[]).map((l)=>'<div>'+rich(l)+'</div>').join('')+'</div>';
    if(b.svgText) inner='<div class="cols"><div>'+inner+'</div><div class="art">'+b.svgText+'</div></div>';
  } else if(b.kind==='code'){
    const code=b.code.split('\\n').map((l)=>{
      const k=l.indexOf('#');
      if(k>=0 && !l.trim().startsWith('#')) return '<b>'+esc(l.slice(0,k))+'</b><i>'+esc(l.slice(k))+'</i>';
      if(l.trim().startsWith('#')) return '<i>'+esc(l)+'</i>';
      return esc(l);
    }).join('\\n');
    inner='<div class="kick">'+b.kicker+'</div><h2 class="head">'+rich(b.head)+'</h2>'+
      '<div class="cols" style="margin-top:2.6vh;align-items:start"><pre>'+code+'</pre><div class="bullets" style="margin-top:0">'+
      (b.lines||[]).map((l)=>'<div>'+rich(l)+'</div>').join('')+'</div></div>';
  } else if(b.kind==='table' || b.kind==='pitfall'){
    const cols=b.cols||[];
    inner='<div class="kick">'+b.kicker+'</div><h2 class="head">'+rich(b.head)+'</h2>'+
      '<table class="'+(b.kind==='pitfall'?'pit':'')+'"><thead><tr>'+cols.map((c)=>'<th>'+esc(c)+'</th>').join('')+'</tr></thead><tbody>'+
      b.rows.map((r)=>'<tr>'+r.map((c)=>'<td>'+rich(c)+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
  }
  return '<section class="scene '+b.kind+'" id="s'+i+'" style="display:none;flex:1;flex-direction:column;justify-content:center">'+inner+'</section>';
}).join('');
const scenes=[...document.querySelectorAll('.scene')];
let cue=null, spans=[];
window.seek=function(t){
  let cur=T.beats[0];
  for(const b of T.beats) if(t>=b.start) cur=b;
  for(const s of scenes) s.style.display=s.id==='s'+cur.idx?'flex':'none';
  stepEl.innerHTML='<em>'+T.number+'</em> · '+String(cur.idx+1).padStart(2,'0')+' / '+String(T.beats.length).padStart(2,'0');
  const el=scenes[cur.idx];
  if(cur.svgText){
    const n=cur.phases?Math.min(4,cur.phases.boxes.length):4;
    const c0=cur.caption;
    const prog=Math.min(1,Math.max(0,(t-c0.start)/Math.max(0.1,c0.end-c0.start)));
    const phase=Math.min(n-1,Math.floor(prog*n));
    const per=(cur.cycle||12)/n;
    // 相位跟着旁白走：讲到第几段，图上就停在第几个相位（而不是 12s 自己循环）
    const local=phase*per+per*0.35;
    for(const a of el.getAnimations({subtree:true})){ try{a.pause(); a.currentTime=local*1000;}catch(e){} }
    for(const svg of el.querySelectorAll('svg')){ try{ if(svg.pauseAnimations){svg.pauseAnimations(); svg.setCurrentTime(local);} }catch(e){} }
    window.zoomArt(cur,local);
  }
  const dots=el.querySelectorAll('.bullets div');
  dots.forEach((d,i)=>{ d.style.opacity=t>=(cur.reveals[i]??0)?'1':'0'; d.style.transform=t>=(cur.reveals[i]??0)?'none':'translateY(.9vh)'; });
  document.getElementById('bar').style.width=(Math.min(t,T.total)/T.total*100).toFixed(3)+'%';
  const c=cur.caption;
  const on=t>=c.start&&t<c.end;
  if(cue!==cur||!on){ cue=on?cur:null; capEl.innerHTML=''; spans=[]; }
  if(on && !spans.length){
    const line=document.createElement('div'); line.style.width='100%'; capEl.appendChild(line);
    for(const ch of c.chars){ const s=document.createElement('i'); s.textContent=ch.c; line.appendChild(s); spans.push([s,ch.s,ch.e]); }
  }
  for(const [s,a,b] of spans){ const k=t>=b?'k2':(t>=a?'k1':'k0'); if(s._k!==k){s._k=k;s.className=k;} }
};
window.measure=function(){
  for(const b of T.beats){
    b.phases=null;
    if(!b.svgText) continue;
    const el=document.getElementById('s'+b.idx);
    const prev=el.style.display; el.style.display='flex';
    const art=el.querySelector('.art'), svg=art&&art.querySelector('svg');
    if(!svg){ el.style.display=prev; continue; }
    const r=svg.getBoundingClientRect(), ar=art.getBoundingClientRect();
    const vb=(svg.getAttribute('viewBox')||'').split(/[\s,]+/).map(Number);
    const k=vb.length===4?r.width/vb[2]:1;
    const boxes=[];
    const single=[];
    for(let i=0;i<8;i++){
      const parts=[...svg.querySelectorAll('.focus.phase-'+i)];
      if(!parts.length) break;
      let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
      for(const p of parts){ const q=p.getBoundingClientRect();
        x0=Math.min(x0,q.left); y0=Math.min(y0,q.top); x1=Math.max(x1,q.right); y1=Math.max(y1,q.bottom); }
      single.push({x:(x0-r.left)/k,y:(y0-r.top)/k,w:(x1-x0)/k,h:(y1-y0)/k});
    }
    // 每个视角带上下一个相位卡：既看得清字，也保留"下一步"的方向感
    for(let i=0;i<single.length;i++){
      const a=single[i], b=single[Math.min(i+1,single.length-1)];
      const x0=Math.min(a.x,b.x), y0=Math.min(a.y,b.y);
      boxes.push({x:x0,y:y0,w:Math.max(a.x+a.w,b.x+b.w)-x0,h:Math.max(a.y+a.h,b.y+b.h)-y0});
    }
    const texts=[], rects=[];
    for(const n of svg.querySelectorAll('text')){
      const q=n.getBoundingClientRect();
      texts.push({n,x:(q.left-r.left)/k,y:(q.top-r.top)/k,w:q.width/k,h:q.height/k});
    }
    for(const n of svg.querySelectorAll('rect')){
      const q=n.getBoundingClientRect();
      rects.push({n,x:(q.left-r.left)/k,y:(q.top-r.top)/k,w:q.width/k,h:q.height/k});
    }
    if(boxes.length>=2) b.phases={boxes,k,aw:ar.width,ah:ar.height,texts,rects};
    else el.classList.add('nozoom');
    el.style.display=prev;
  }
};
const ease=(x)=>x*x*(3-2*x);
window.zoomArt=function(b,local){
  const el=document.getElementById('s'+b.idx), svg=el&&el.querySelector('.art svg');
  if(!svg) return;
  if(!b.phases){ svg.style.transform='none'; return; }
  const {boxes,k,aw,ah,texts,rects}=b.phases, per=(b.cycle||12)/boxes.length;
  const idx=Math.min(boxes.length-1,Math.floor(local/per));
  const next=Math.min(boxes.length-1,idx+1);
  const t=Math.min(1,Math.max(0,(local-idx*per-(per-0.6))/0.6));
  const u=ease(t), a=boxes[idx], c=boxes[next];
  const box={x:a.x+(c.x-a.x)*u,y:a.y+(c.y-a.y)*u,w:a.w+(c.w-a.w)*u,h:a.h+(c.h-a.h)*u};
  const scale=Math.min(aw/box.w, ah/box.h, 3.35)*0.94;
  const px=box.x*k, py=box.y*k, pw=box.w*k, ph=box.h*k;
  const tx=aw/2-scale*(px+pw/2), ty=ah/2-scale*(py+ph/2);
  svg.style.transform='translate('+tx.toFixed(2)+'px,'+ty.toFixed(2)+'px) scale('+scale.toFixed(4)+')';
  const vx0=(-tx)/scale/k, vy0=(-ty)/scale/k, vx1=(aw-tx)/scale/k, vy1=(ah-ty)/scale/k;
  for(const t of texts){
    const inside=t.x>=vx0-1&&t.y>=vy0-1&&t.x+t.w<=vx1+1&&t.y+t.h<=vy1+1;
    t.n.style.opacity=inside?'1':'0';
  }
  // 背景板/详情条也按可见区域隐藏，避免裁出半块空面板
  for(const t of rects){
    const inside=t.x>=vx0-1&&t.y>=vy0-1&&t.x+t.w<=vx1+1&&t.y+t.h<=vy1+1;
    t.n.style.opacity=inside?'1':'0';
  }
};
window.cover=function(badge){
  document.documentElement.classList.add('cover');
  const C=T.cover||{}, root=document.documentElement;
  root.style.setProperty('--accent',C.accent||'#7ee787');
  document.querySelector('#cover .cv-top span').textContent=T.series;
  document.querySelector('#cover .cv-ep').textContent=T.number;
  document.querySelector('#cover .cv-q').textContent=C.question||T.title;
  document.querySelector('#cover .cv-atext').textContent=C.answer||T.subtitle;
  document.querySelector('#cover .cv-badge').textContent=C.badge||'机制精讲 · 第一辑';
  document.querySelector('#cover .cv-series').textContent=C.stage||T.chapter;
  const host=document.querySelector('#cover .cv-hero');
  if(T.coverSvg){ host.innerHTML=T.coverSvg; const src=host.querySelector('svg');
    src.setAttribute('preserveAspectRatio','xMidYMid slice');
    for(const a of src.getAnimations({subtree:true})){ try{a.pause(); a.currentTime=6200;}catch(e){} }
    try{ if(src.pauseAnimations){src.pauseAnimations(); src.setCurrentTime(6.2);} }catch(e){} }
};
window.total=T.total;
</script></body></html>`;

const stageFile = path.join(OUT, 'stage.html');
await writeFile(stageFile, stage, 'utf8');

// 5) 音轨
const flat = spec.beats;
const audioInputs = [];
const audioFilter = [];
flat.forEach((b, i) => {
  audioInputs.push('-i', b.file);
  const ms = Math.round((b.start + spec.leadPad) * 1000);
  audioFilter.push(`[${i}:a]adelay=${ms}|${ms}[d${i}]`);
});
await sh('ffmpeg', [
  '-y', '-loglevel', 'error', ...audioInputs,
  '-filter_complex',
  `${audioFilter.join(';')};${flat.map((_, i) => `[d${i}]`).join('')}amix=inputs=${flat.length}:duration=longest:normalize=0[amix];[amix]apad[a]`,
  '-map', '[a]', '-t', TOTAL.toFixed(3), '-ar', '48000', '-c:a', 'aac', '-b:a', '160k',
  path.join(OUT, 'track.m4a'),
]);
console.log(`音轨：${flat.length} 段旁白 / ${TOTAL.toFixed(1)}s`);

function srtTime(s) {
  const ms = Math.round(s * 1000);
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
}
async function writeSidecars() {
  await writeFile(path.join(OUT, `${lectureId}.srt`),
    spec.beats.map((b, i) => `${i + 1}\n${srtTime(b.start + spec.leadPad)} --> ${srtTime(b.start + spec.leadPad + b.audioDur)}\n${b.say}\n`).join('\n'), 'utf8');
  const mm = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  await writeFile(path.join(OUT, 'chapters.txt'),
    spec.beats.map((b) => `${mm(b.start)} ${b.head}`).join('\n') + '\n', 'utf8');
  const publish = {
    lecture: lectureId,
    series: spec.series,
    title: spec.title,
    chapter: spec.chapter,
    doc: spec.doc,
    duration: Math.round(TOTAL * 100) / 100,
    video: `video-out/lectures/${lectureId}/${lectureId}-wide.mp4`,
    subtitle: `video-out/lectures/${lectureId}/${lectureId}.srt`,
    chapters: `video-out/lectures/${lectureId}/chapters.txt`,
    covers: Object.fromEntries(['16x9', '4x3', '3x4', '9x16'].map((n) => [n, `video-out/lectures/${lectureId}/${lectureId}-cover-${n}.jpg`])),
    ...(spec.publish || {}),
  };
  await writeFile(path.join(OUT, 'publish.json'), JSON.stringify(publish, null, 2) + '\n', 'utf8');
  console.log('字幕 / 章节 / 发布信息就绪');
}

async function loudnorm(file) {
  const target = 'I=-16:TP=-1.5:LRA=11';
  const json = await new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', ['-hide_banner', '-i', file, '-af', `loudnorm=${target}:print_format=json`, '-f', 'null', '-'],
      { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => (err += d));
    p.on('error', reject);
    p.on('exit', (code) => {
      if (code) return reject(new Error(`loudnorm pass1 exit ${code}`));
      resolve(err.slice(err.lastIndexOf('{'), err.lastIndexOf('}') + 1));
    });
  });
  const m = JSON.parse(json);
  const tmp = file.replace(/\.mp4$/, '.norm.mp4');
  await sh('ffmpeg', ['-y', '-loglevel', 'error', '-i', file,
    '-af', `loudnorm=${target}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`,
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', tmp]);
  await rename(tmp, file);
  return `${path.basename(file)} 归一前 ${m.input_i} LUFS / TP ${m.input_tp} dBTP → -16 LUFS`;
}

const browser = await chromium.launch();

if (args.includes('--sidecars')) {
  await writeSidecars();
  await browser.close();
  process.exit(0);
}

if (args.includes('--stills') || args.includes('--covers')) {
  if (args.includes('--covers')) {
    for (const cover of [
      { name: '16x9', size: { width: 1920, height: 1080 }, tall: false },
      { name: '4x3', size: { width: 1440, height: 1080 }, tall: false },
      { name: '3x4', size: { width: 1080, height: 1440 }, tall: true },
      { name: '9x16', size: { width: 1080, height: 1920 }, tall: true },
    ]) {
      const page = await browser.newPage({ viewport: cover.size, deviceScaleFactor: 2 });
      await page.goto('file:///' + stageFile.replaceAll('\\', '/'));
      await page.waitForFunction(() => document.fonts.status === 'loaded');
      await page.evaluate(([tall, badge]) => {
        document.documentElement.classList.toggle('tall', tall);
        window.cover(badge);
      }, [cover.tall, spec.number]);
      const base = path.join(OUT, `${lectureId}-cover-${cover.name}`);
      await page.screenshot({ path: `${base}.png` });
      await page.screenshot({ path: `${base}.jpg`, type: 'jpeg', quality: 92 });
      await page.close();
      console.log('封面', cover.name);
    }
    await browser.close();
    process.exit(0);
  }
  await mkdir(path.join(OUT, 'stills'), { recursive: true });
  const page = await browser.newPage({ viewport: SIZE, deviceScaleFactor: 1 });
  await page.goto('file:///' + stageFile.replaceAll('\\', '/'));
  await page.waitForFunction(() => document.fonts.status === 'loaded');
  await page.evaluate(() => window.measure());
  for (const b of spec.beats) {
    const t = Math.min(b.start + spec.leadPad + Math.min(b.audioDur * 0.6, 6), TOTAL - 0.1);
    await page.evaluate((sec) => window.seek(sec), t);
    await page.screenshot({ path: path.join(OUT, 'stills', `${String(b.idx).padStart(2, '0')}-${b.kind}.png`) });
  }
  await browser.close();
  console.log('静帧输出', path.join(OUT, 'stills'));
  process.exit(0);
}

// 6) 逐帧渲染
const fps = spec.fps ?? 15;
const outFps = spec.outFps ?? 30;
const frames = limit > 0 ? Math.min(limit, Math.round(TOTAL * fps)) : Math.round(TOTAL * fps);
const video = path.join(OUT, `${lectureId}-wide.mp4`);
let written = 0, failed = null;
console.log(`《${spec.title}》${TOTAL.toFixed(1)}s，${fps}fps 采样 → ${outFps}fps，${frames} 帧`);
await sh('ffmpeg', [
  '-y', '-loglevel', 'error',
  '-f', 'image2pipe', '-vcodec', 'mjpeg', '-framerate', String(fps), '-i', 'pipe:0',
  '-i', path.join(OUT, 'track.m4a'),
  '-vf', `fps=${outFps},scale=${SIZE.width}:${SIZE.height}:flags=lanczos`,
  '-c:v', 'libx264', '-preset', 'fast', '-crf', '20', '-pix_fmt', 'yuv420p',
  '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', video,
], (stdin, reject) => {
  stdin.on('error', (e) => { failed = e; reject(e); });
  (async () => {
    const page = await browser.newPage({ viewport: SIZE, deviceScaleFactor: 1 });
    await page.goto('file:///' + stageFile.replaceAll('\\', '/'));
    await page.waitForFunction(() => document.fonts.status === 'loaded');
    await page.evaluate(() => window.measure());
    for (let i = 0; i < frames; i++) {
      await page.evaluate((t) => window.seek(t), i / fps);
      const buf = await page.screenshot({ type: 'jpeg', quality: 92 });
      if (failed) throw failed;
      if (buf.byteLength) {
        written++;
        await new Promise((res, rej) => stdin.write(Buffer.from(buf), (e) => (e ? rej(e) : res())));
      }
      if (written % 90 === 0) process.stdout.write(`\r${written}/${frames}`);
    }
    stdin.end();
    await page.close();
  })().catch((e) => { failed = e; try { stdin.end(); } catch {} reject(e); });
});
if (failed) throw failed;
console.log(`\r完成 ${written} 帧 → ${video}`);
await writeSidecars();
const report = await loudnorm(video);
await writeFile(path.join(OUT, `${lectureId}-loudness.txt`), report + '\n', 'utf8');
console.log(report);
await browser.close();
