import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';

const ROOT = path.resolve(import.meta.dirname, '../..');
const args = process.argv.slice(2);
const episodeId = args[0] ?? 'pipes';
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const formats = opt('formats', 'wide,tall').split(',');
const limit = Number(opt('limit', 0));
const OUT = path.join(ROOT, 'video-out', episodeId);

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

const spec = JSON.parse(await readFile(path.join(ROOT, 'scripts/video/episodes', `${episodeId}.json`), 'utf8'));
await mkdir(path.join(OUT, 'audio'), { recursive: true });

// 1) 逐句旁白，实测时长决定分镜长度。缓存键含文本与音色，改稿或调整分镜顺序都不会读到错位的旧音频
for (const [si, scene] of spec.scenes.entries()) {
  let acc = 0;
  for (const [li, text] of scene.lines.entries()) {
    const key = createHash('sha1').update(`${spec.voice}|${spec.rate}|${text}`).digest('hex').slice(0, 16);
    const mp3 = path.join(OUT, 'audio', `s${si}l${li}-${key}.mp3`).replaceAll('\\', '/');
    const js = mp3.replace(/\.mp3$/, '.words.json');
    if (!existsSync(mp3) || !existsSync(js)) {
      // edge-tts 走微软在线接口，偶发握手/连接超时：同一句最多重试 4 次，仍失败就报错，不让半套音频进时间轴
      for (let attempt = 1; ; attempt++) {
        try {
          await sh('python3', [path.join(ROOT, 'scripts', 'video', 'say.py'), text, spec.voice, spec.rate, mp3, js]);
          break;
        } catch (e) {
          if (attempt >= 4) throw new Error(`TTS 失败（已重试 ${attempt} 次）：${text}\n${String(e.message).slice(-400)}`);
          console.warn(`\nTTS 重试 ${attempt}/4：${text}`);
          await new Promise((r) => setTimeout(r, 1200 * attempt));
        }
      }
    }
    const dur = await probe(mp3);
    const words = existsSync(js) ? JSON.parse(readFileSync(js, 'utf8')).words : [];
    scene.lines[li] = { text, file: mp3, start: 0, dur, words };
    acc += dur + (li ? spec.lineGap : 0);
  }
  scene.narrationDur = acc;
}

// 2) 全局时间轴：动画镜头至少走满一轮 cycle，避免四步示意被截断
let cursor = 0;
for (const [idx, scene] of spec.scenes.entries()) {
  scene.idx = idx;
  scene.eyebrow = scene.eyebrow ?? spec.brand.eyebrow;
  scene.watermark = scene.watermark ?? spec.brand.watermark;
  scene.dur = Math.max(scene.narrationDur + spec.leadPad + spec.tailPad,
    scene.kind === 'anim' ? (scene.cycle ?? spec.cycle) : 3.2);
  scene.start = cursor;
  cursor += scene.dur;
}
for (const scene of spec.scenes) {
  let at = 0;
  for (const line of scene.lines) {
    line.start = scene.start + spec.leadPad + at;
    at += line.dur + spec.lineGap;
  }
}
const TOTAL = cursor;

// 逐字时间：edge-tts 的中文边界基本是字级，多字词按字数均分，标点跟随后一个字
function karaoke(l) {
  const out = [];
  let p = 0;
  for (const [off, dur, tok] of l.words || []) {
    const at = l.text.indexOf(tok, p);
    if (at < 0) continue;
    for (; p < at; p++) out.push({ c: l.text[p], s: l.start + off, e: l.start + off });
    for (let j = 0; j < tok.length; j++, p++) {
      out.push({ c: tok[j], s: l.start + off + (dur * j) / tok.length, e: l.start + off + (dur * (j + 1)) / tok.length });
    }
  }
  const tail = out.length ? out[out.length - 1].e : l.start + l.dur;
  for (; p < l.text.length; p++) out.push({ c: l.text[p], s: tail, e: tail });
  return out;
}

// 3) 舞台页：内联 SVG，按外部指定的绝对秒数定位动画时间
const heroIdx = spec.cover
  ? Math.max(0, spec.scenes.findIndex((s) => s.svg === spec.cover.hero))
  : -1;
const timeline = {
  total: TOTAL,
  cycle: spec.cycle,
  leadPad: spec.leadPad,
  cover: spec.cover
    ? { ...spec.cover, heroIdx: heroIdx < 0 ? Math.max(0, spec.scenes.findIndex((s) => s.svg)) : heroIdx,
        heroCycle: heroIdx >= 0 ? (spec.scenes[heroIdx].cycle ?? spec.cycle) : spec.cycle,
        series: spec.brand.watermark }
    : null,
  scenes: await Promise.all(spec.scenes.map(async ({ lines, svg, ...s }) => {
    if (!svg) return { ...s, svgText: null };
    return { ...s, svgText: await readFile(path.join(ROOT, svg), 'utf8') };
  })),
  captions: spec.scenes.flatMap((s) => s.lines.map((l) => ({ start: l.start, end: l.start + l.dur, text: l.text, chars: karaoke(l) }))),
};

const stage = `<!doctype html><html lang="zh"><head><meta charset="utf-8"><style>
*{margin:0;box-sizing:border-box}html,body{overflow:hidden}
body{font-family:"Noto Sans CJK SC","Microsoft YaHei",sans-serif;color:#f0f6fc;-webkit-font-smoothing:antialiased;
background:radial-gradient(125% 85% at 50% 6%,#182534 0%,#0d131a 42%,#070a0e 100%) #070a0e}
#stage{position:absolute;inset:0;display:flex;flex-direction:column;padding:2.6vh 3vw}
#brand{display:flex;justify-content:space-between;gap:3vw;font-size:2.1vh;letter-spacing:.14em;color:#8b98a8}
#brand b{color:#7ee787}
.scene{flex:1;display:none;flex-direction:column;justify-content:center;align-items:center;min-height:0}
.scene.on{display:flex}
.art{width:100%;height:100%;display:flex;justify-content:center;align-items:center;overflow:hidden}
.art svg{width:100%;height:auto;max-height:100%;transform-origin:0 0}
#cap{height:11vh;display:flex;align-items:center;justify-content:center;text-align:center;
font-size:3.6vh;line-height:1.5;font-weight:600;color:#eaf2ff;padding:0 5vw;text-wrap:balance;
text-shadow:0 .4vh 2.2vh rgba(0,0,0,.85)}
#cap i{font-style:normal;color:#7e8a97}
#cap i.k2{color:#eaf2ff}
#cap i.k1{color:#7ee787;text-shadow:0 0 1.6vh rgba(126,231,135,.55)}
.card{background:linear-gradient(165deg,#18202a,#0c1117);border:2px solid #2b3a4d;border-radius:2.4vh;
padding:5vh 6vw;display:flex;flex-direction:column;gap:2.4vh;align-items:center;text-align:center;max-width:92%;
box-shadow:0 4vh 12vh rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.05)}
.cmd{font-family:Consolas,"JetBrains Mono",monospace;font-size:7vh;color:#79c0ff;background:#080c11;
border:2px solid #2b3a4d;border-radius:1.4vh;padding:2.2vh 4vw;box-shadow:inset 0 1px 0 rgba(255,255,255,.06)}
.card h1{font-size:6.2vh;line-height:1.2}
.sub{font-size:3.2vh;color:#9da7b3;line-height:1.6}
.cta ul{padding:0;margin:0}
.cta li{list-style:none;font-size:3.1vh;color:#c9d1d9;line-height:1.9;text-wrap:balance}
.url{font-size:2.9vh;color:#7ee787;letter-spacing:.06em}
#bar{position:absolute;left:0;bottom:0;height:.5vh;width:0;border-radius:0 999px 999px 0;
background:linear-gradient(90deg,#1f6feb,#7ee787);box-shadow:0 0 2vh rgba(126,231,135,.5)}
.label{display:none}
.hl{color:#7ee787;font-weight:800;white-space:nowrap}
.tag{font-size:2.5vh;font-weight:700;letter-spacing:.02em;color:#ffd76b;
background:rgba(255,215,107,.12);border:1px solid rgba(255,215,107,.34);padding:.7vh 2.2vw;border-radius:999px}
.promise{font-size:2.7vh;color:#95a2b3;letter-spacing:.05em}
.alias{display:none;align-items:center;font-size:2.9vh;line-height:1.3;white-space:nowrap}
.alias b{color:#eaf2ff;font-weight:600}
.alias u{text-decoration:none;color:#93a0b1;padding:0 .7vw}
.alias s{text-decoration:none;color:#7ee787;font-weight:700;font-family:Consolas,"JetBrains Mono",monospace}
.phases{display:none;align-items:center;gap:1.1vw}
.phases i{display:block;width:1.5vh;height:1.5vh;border-radius:999px;background:#33404f}
.phases i.on{background:#7ee787;width:4.4vh;box-shadow:0 0 1.8vh rgba(126,231,135,.55)}
html.tall #stage{padding:0;justify-content:center}
html.tall #brand{position:absolute;top:3.4vh;left:5vw;right:5vw;font-size:2vh;letter-spacing:.08em;white-space:nowrap}
html.tall .scene{flex:0 0 auto;width:100%;gap:2.6vh;padding:0 4vw}
html.tall .label{display:block;padding:1.1vh 3.4vw;font-size:3.5vh;font-weight:700;line-height:1.35;text-align:center;text-wrap:balance;
color:#a5f0ac;background:rgba(126,231,135,.07);border:1px solid rgba(126,231,135,.26);border-radius:999px}
html.tall .alias{display:flex;justify-content:center;font-size:3.2vh}
html.tall .phases{display:flex}
html.tall .tag{font-size:3.2vw;padding:1.1vh 5vw}
html.tall .promise{font-size:3.5vw}
html:not(.tall) .alias{position:absolute;left:3vw;bottom:12.8vh;display:flex;font-size:2.8vh}
html:not(.tall) .phases{position:absolute;right:3vw;bottom:13vh;display:flex}
html.tall .art{height:44vh;-webkit-mask-image:linear-gradient(to bottom,transparent 0,#000 5%,#000 95%,transparent 100%);
mask-image:linear-gradient(to bottom,transparent 0,#000 5%,#000 95%,transparent 100%)}
html.tall #cap{height:auto;font-size:4.5vh;line-height:1.45;margin-top:1.5vh;padding:0 6vw;text-wrap:balance}
html.tall .cmd{font-size:7vw;white-space:nowrap}
html.tall .card{padding:6vh 7vw;gap:3vh;width:92vw}
html.tall .card h1{font-size:6.4vw;line-height:1.3;text-wrap:balance}
html.tall .sub{font-size:3.6vw;line-height:1.55}
html.tall .url{font-size:4.3vw;letter-spacing:0;white-space:nowrap}
html.tall .cta li{font-size:3vw;line-height:1.75;padding:0 1vw}
/* 封面专用：整幅海报版式（英雄图 + 大问题 + 一句话答案 + 集号），不影响正片 */
#cover{display:none;position:absolute;inset:0;padding:6.4vh 6vw;overflow:hidden;
--accent:#7ee787;grid-template-areas:"fg";grid-template-rows:1fr;grid-template-columns:1fr;
background:linear-gradient(162deg,#12202e 0%,#0a1119 54%,#05070a 100%)}
#cover::before{content:"";position:absolute;inset:0;z-index:1;pointer-events:none;
background:
radial-gradient(120% 78% at 12% 4%, color-mix(in srgb, var(--accent) 26%, transparent) 0%, transparent 58%),
linear-gradient(180deg, rgba(5,8,12,.74) 0%, rgba(5,8,12,.42) 34%, rgba(5,8,12,.88) 100%)}
#cover::after{content:"";position:absolute;inset:0;z-index:1;pointer-events:none;opacity:.4;
background-image:radial-gradient(rgba(255,255,255,.08) 1px, transparent 1px);background-size:3.4vh 3.4vh;
-webkit-mask-image:radial-gradient(120% 90% at 50% 0%,#000 20%,transparent 78%);mask-image:radial-gradient(120% 90% at 50% 0%,#000 20%,transparent 78%)}
html.cover #cover{display:grid}
html.cover .scene,html.cover #cap,html.cover #bar,html.cover #brand{display:none}
.cv-top{grid-area:fg;z-index:2;align-self:start;display:flex;align-items:center;justify-content:space-between;gap:2vw;flex-wrap:wrap}
.cv-series{font-size:2.3vh;letter-spacing:.2em;color:#b9c7d6;white-space:nowrap}
.cv-ep{font-size:2.3vh;font-weight:800;letter-spacing:.06em;color:#06121a;background:var(--accent);
padding:.6vh 1.8vw;border-radius:999px;white-space:nowrap;box-shadow:0 1vh 3vh color-mix(in srgb, var(--accent) 42%, transparent)}
.cv-mid{grid-area:fg;z-index:2;align-self:center;display:flex;flex-direction:column;gap:2.8vh;min-width:0}
.cv-cmd{align-self:flex-start;font-family:Consolas,"JetBrains Mono",monospace;font-size:3.1vh;color:#e8f6ff;
background:rgba(6,11,16,.78);border:1px solid color-mix(in srgb, var(--accent) 50%, transparent);border-radius:1.2vh;
padding:.8vh 1.8vw;box-shadow:0 1.6vh 4vh rgba(0,0,0,.45)}
.cv-cmd:empty{display:none}
.cv-q{font-size:7.4vh;line-height:1.12;font-weight:800;color:#fff;text-wrap:balance;letter-spacing:.01em;
text-shadow:0 .5vh 3vh rgba(0,0,0,.6)}
.cv-a{display:flex;align-items:baseline;gap:1.4vw;font-size:3.5vh;color:#e6eef7;line-height:1.3;text-wrap:balance;
text-shadow:0 .4vh 2.4vh rgba(0,0,0,.55)}
.cv-a em{font-style:normal;font-size:2.6vh;color:#06121a;background:var(--accent);padding:.4vh 1.5vw;border-radius:.9vh;font-weight:800;white-space:nowrap}
.cv-foot{grid-area:fg;z-index:2;align-self:end;display:flex;align-items:center;justify-content:space-between;gap:2vw;font-size:2.4vh;color:#a8b7c6;flex-wrap:wrap}
.cv-badge{color:#06121a;background:var(--accent);padding:.5vh 1.8vw;border-radius:999px;font-weight:800;white-space:nowrap}
.cv-right{grid-area:fg;z-index:0;position:absolute;inset:-9%;pointer-events:none;display:block}
.cv-hero{width:100%;height:100%;display:block;border:none;background:none;border-radius:0;box-shadow:none;overflow:hidden;
-webkit-mask-image:radial-gradient(72% 62% at 50% 40%,#000 0%,transparent 80%);
mask-image:radial-gradient(72% 62% at 50% 40%,#000 0%,transparent 80%)}
.cv-hero svg{width:100%;height:100%;filter:blur(8px) saturate(.95);opacity:.55}
html.tall .cv-mid{align-self:center;transform:translateY(4vh)}
html.tall .cv-q{font-size:7.4vw}
html.tall .cv-a{font-size:4.3vw}
html.tall .cv-a em{font-size:3.3vw}
html.tall .cv-series,html.tall .cv-ep{font-size:3.1vw}
html.tall .cv-cmd{font-size:4.3vw}
html.tall .cv-foot{font-size:3.2vw}
html.tall.cvsafe #cover{padding:8.6vh 8vw}
html.tall.cvsafe .cv-q{font-size:6.9vw}
html:not(.tall) #cover{padding:6.2vh 5.4vw}
html:not(.tall) .cv-q{font-size:7.6vh;max-width:74%}
html:not(.tall) .cv-a{font-size:3.6vh}
</style></head><body><div id="stage"><div id="brand"><span id="eb"></span><b id="wm"></b></div>
<div id="cover"><div class="cv-top"><span class="cv-series"></span><span class="cv-ep"></span></div>
<div class="cv-mid"><div class="cv-cmd"></div><h1 class="cv-q"></h1><div class="cv-a"><em>记住</em><span class="cv-atext"></span></div></div>
<div class="cv-right"><div class="cv-hero"></div></div>
<div class="cv-foot"><span class="cv-badge"></span><span class="cv-url"></span></div></div>
<div id="cap"></div><div id="bar"></div></div>
<script>
const T=${JSON.stringify(timeline)};
const capEl=document.getElementById('cap'), ebEl=document.getElementById('eb'), wmEl=document.getElementById('wm');
const rich=(t)=>String(t??'').split(/(「[^」]*」)/).map((p)=>p.startsWith('「')?'<span class="hl">'+p.slice(1,-1)+'</span>':p).join('');
for(const s of T.scenes){
  const el=document.createElement('div');
  el.className='scene'; el.id='sc'+s.idx;
  if(s.svgText) el.innerHTML='<div class="label"></div><div class="art">'+s.svgText+'</div><div class="alias"></div><div class="phases"><i></i><i></i><i></i><i></i></div>';
  else if(s.kind==='hook') el.innerHTML='<div class="card"><div class="tag"></div><div class="cmd"></div><h1></h1><div class="sub"></div><div class="promise"></div></div>';
  else el.innerHTML='<div class="card cta"><h1></h1><ul>'+s.bullets.map(()=>'<li></li>').join('')+'</ul><div class="url"></div></div>';
  capEl.before(el);
  if(s.kicker) el.querySelector('.label').textContent=s.kicker;
  if(s.alias) el.querySelector('.alias').innerHTML='<b>'+s.alias.plain+'</b><u>＝</u><s>'+s.alias.term+'</s>';
  if(s.kind==='hook'){
    const tag=el.querySelector('.tag'); tag.textContent=s.tag||''; tag.style.display=s.tag?'':'none';
    el.querySelector('.cmd').textContent=s.command;
    el.querySelector('h1').innerHTML=rich(s.headline);
    el.querySelector('.sub').innerHTML=rich(s.sub);
    el.querySelector('.promise').innerHTML=rich(s.promise||('整条 '+Math.round(T.total)+' 秒 · 看完你就懂'));
  } else if(s.kind==='cta'){
    el.querySelector('h1').innerHTML=rich(s.headline);
    el.querySelectorAll('li').forEach((li,i)=>li.innerHTML=rich(s.bullets[i]));
    el.querySelector('.url').textContent=s.url||'';
  }
}
const scenes=[...document.querySelectorAll('.scene')];
let TALL=false, BOXES=null, COVER=false;
const ss=(x)=>x*x*(3-2*x);
window.setFormat=function(f){TALL=f!=='wide';document.documentElement.classList.toggle('tall',TALL);BOXES=null;};
window.cover=function(badge){
  COVER=true;
  document.documentElement.classList.add('cover');
  const CV=T.cover; if(!CV) return;
  document.documentElement.style.setProperty('--accent',CV.accent||'#7ee787');
  const q=document.querySelector('.cv-q'), a=document.querySelector('.cv-atext');
  document.querySelector('.cv-series').textContent=CV.series||'';
  document.querySelector('.cv-ep').textContent=CV.number?('第 '+CV.number+' 集'):'';
  const hook=T.scenes.find((s)=>s.kind==='hook');
  document.querySelector('.cv-cmd').textContent=(CV.command||(hook&&hook.command)||'');
  q.innerHTML=rich((CV.question||(hook&&hook.headline)||'').replace(/[「」]/g,''));
  a.innerHTML=rich(CV.answer||'');
  document.querySelector('.cv-badge').textContent=badge||'43 章 · 89 部原理动画';
  document.querySelector('.cv-url').textContent=(T.scenes.find((s)=>s.kind==='cta')||{}).url||CV.stage||'';
  const host=document.querySelector('.cv-hero'); host.innerHTML='';
  const hero=document.getElementById('sc'+CV.heroIdx);
  const src=hero&&hero.querySelector('svg');
  if(src){
    const c=src.cloneNode(true);
    c.style.transform='none'; c.style.opacity='1';
    c.setAttribute('preserveAspectRatio','xMidYMid slice');
    host.appendChild(c);
    const at=(CV.at??0.62)*(CV.heroCycle||T.cycle);
    try{ if(c.pauseAnimations){c.pauseAnimations(); c.setCurrentTime(at);} }catch{}
    for(const an of c.getAnimations({subtree:true})){ try{an.pause(); an.currentTime=at*1000;}catch{} }
  }
  capEl.innerHTML=''; spans=[];
  document.getElementById('bar').style.width='0%';
};
window.measure=function(){
  BOXES={};
  for(const s of T.scenes){
    if(!s.svgText) continue;
    const el=scenes[s.idx]; el.classList.add('on');
    const art=el.querySelector('.art'), svg=art.querySelector('svg'); svg.style.transform='none';
    const r=svg.getBoundingClientRect(), ar=art.getBoundingClientRect();
    const texts=[];
    for(const n of svg.querySelectorAll('text,rect,circle,path,polygon,line')){
      const c=n.getAttribute('class')||'';
      const b=n.getBoundingClientRect();
      const an=/focus|output/.test(c);
      if(b.width>r.width*0.95 && b.height>r.height*0.95) continue;
      texts.push({n, an, top:b.top-r.top, bot:b.bottom-r.top, l:b.left-r.left, rt:b.right-r.left});
    }
    const vb=(svg.getAttribute('viewBox')||'').split(/[\s,]+/).map(Number);
    const vs=vb.length===4?r.width/vb[2]:1;
    const focus=[...el.querySelectorAll('.focus')].map(f=>{
      const b=f.getBoundingClientRect();
      return {cx:b.x+b.width/2-r.x, cy:b.y+b.height/2-r.y, w:b.width, h:b.height};
    });
    BOXES['sc'+s.idx]={w:r.width,h:r.height,H:ar.height,ox:r.left-ar.left,oy:r.top-ar.top,texts,
      cycle:s.cycle||T.cycle,
      boxes:focus.length?focus:(s.zoom||[]).map((z)=>({cx:(z[0]+z[2]/2)*vs, cy:(z[1]+z[3]/2)*vs, w:z[2]*vs, h:z[3]*vs}))};
    el.classList.remove('on');
  }
};
function zoom(el,local){
  const svg=el.querySelector('svg'), B=BOXES&&BOXES[el.id];
  if(!TALL||!B||!B.boxes.length){svg.style.transform='none';svg.style.opacity='1';return;}
  const per=B.cycle/B.boxes.length;
  const i=Math.min(B.boxes.length-1,Math.floor(local/per));
  const j=Math.min(B.boxes.length-1,i+1);
  const u=ss(Math.max(0,Math.min(1,(local-i*per-(per-0.5))/0.5)));
  const a=B.boxes[i],b=B.boxes[j];
  let box={cx:a.cx+(b.cx-a.cx)*u,cy:a.cy+(b.cy-a.cy)*u,w:a.w+(b.w-a.w)*u,h:a.h+(b.h-a.h)*u};
  const v=ss(Math.max(0,Math.min(1,local/2.4))), full={cx:B.w/2,cy:B.h/2,w:B.w,h:B.h};
  box={cx:full.cx+(box.cx-full.cx)*v,cy:full.cy+(box.cy-full.cy)*v,
       w:full.w+(box.w-full.w)*v,h:full.h+(box.h-full.h)*v};
  const hp=Math.max(0,Math.min(1,(local-i*per)/Math.max(0.6,per-0.55)));
  const k=Math.max(1,Math.min(5.4,B.w*0.9/box.w))*(1+0.05*hp*v);
  svg.style.transform='translate('+(B.w/2-B.ox-k*box.cx).toFixed(2)+'px,'+(B.H*0.5-B.oy-k*box.cy).toFixed(2)+'px) scale('+k.toFixed(3)+')';
  svg.style.opacity='1';
  const p0=(k*box.cy-B.H*0.5)/k+6, p1=p0+(B.H-12)/k;
  const q0=(k*box.cx-B.w*0.5)/k+6, q1=q0+(B.w-12)/k;
  for(const t of B.texts){
    const ovx=(Math.min(t.rt,q1)-Math.max(t.l,q0))/Math.max(1,t.rt-t.l);
    const ovy=(Math.min(t.bot,p1)-Math.max(t.top,p0))/Math.max(1,t.bot-t.top);
    const m=Math.min(ovx,ovy);
    if(t.an){t.n.style.visibility=m>0.97?'':'hidden';continue;}
    t.n.style.opacity=m>0.97?'':Math.max(0,(m-0.9)/0.07).toFixed(2);
  }
}
let cue=null,spans=[];
window.seek=function(time){
  let cur=T.scenes[0];
  for(const s of T.scenes) if(time>=s.start) cur=s;
  for(const s of scenes) s.classList.toggle('on', s.id==='sc'+cur.idx);
  ebEl.textContent=cur.eyebrow; wmEl.textContent=cur.watermark;
  document.getElementById('bar').style.width=(Math.min(time,T.total)/T.total*100).toFixed(3)+'%';
  const el=scenes[cur.idx];
  // 首帧要能当封面：第一镜不做淡入（其它镜保留 0.32s 淡入）
  el.style.opacity=cur.idx===0?'1':Math.max(0,Math.min(1,(time-cur.start)/0.32)).toFixed(3);
  if(cur.svgText){
    const local=(time-cur.start)%(cur.cycle||T.cycle);
    for(const a of el.getAnimations({subtree:true})){ a.pause(); a.currentTime=local*1000; }
    const svg=el.querySelector('svg');
    if(svg.setCurrentTime){ svg.pauseAnimations(); svg.setCurrentTime(local); }
    const ph=el.querySelector('.phases');
    if(ph){const k=Math.min(ph.children.length-1,Math.floor(local/((cur.cycle||T.cycle)/ph.children.length)));
      for(let q=0;q<ph.children.length;q++) ph.children[q].classList.toggle('on',q===k);}
    zoom(el,local);
  } else if(cur.kind==='hook'){
    const cmd=el.querySelector('.cmd');
    if(cmd.textContent!==cur.command) cmd.textContent=cur.command;
  }
  const c=T.captions.find(x=>time>=x.start&&time<x.end);
  if(c!==cue){
    cue=c; capEl.innerHTML=''; spans=[];
    if(c){
      const line=document.createElement('div'); line.style.width='100%'; capEl.appendChild(line);
      for(const ch of c.chars){
        const s=document.createElement('i'); s.textContent=ch.c;
        line.appendChild(s); spans.push([s,ch.s,ch.e]);
      }
    }
  }
  for(const [s,a,b] of spans){
    const k=time>=b?'k2':(time>=a?'k1':'k0');
    if(s._k!==k){ s._k=k; s.className=k; }
  }
};
</script></body></html>`;

const stageFile = path.join(OUT, 'stage.html');
await writeFile(stageFile, stage, 'utf8');

// 4) 音轨：每句按绝对起始时间延迟后叠加
const flat = spec.scenes.flatMap((s) => s.lines);
const audioInputs = [];
const audioFilter = [];
flat.forEach((l, i) => {
  audioInputs.push('-i', l.file);
  const ms = Math.round(l.start * 1000);
  audioFilter.push(`[${i}:a]adelay=${ms}|${ms}[d${i}]`);
});
await sh('ffmpeg', [
  '-y', '-loglevel', 'error', ...audioInputs,
  '-filter_complex',
  `${audioFilter.join(';')};${flat.map((_, i) => `[d${i}]`).join('')}amix=inputs=${flat.length}:duration=longest:normalize=0[amix];[amix]apad[a]`,
  '-map', '[a]', '-t', TOTAL.toFixed(3), '-ar', '48000', '-c:a', 'aac', '-b:a', '160k',
  path.join(OUT, 'track.m4a'),
]);
console.log(`音轨就绪：${flat.length} 句旁白 / ${TOTAL.toFixed(2)}s`);

// 5) 逐帧 seek + 直接管道喂给 ffmpeg（避免上千张 PNG 落盘）
const browser = await chromium.launch();
console.log(`《${spec.title}》${TOTAL.toFixed(2)}s @ ${spec.fps}fps，渲染 ${formats.join(' + ')}`);

if (args.includes('--sidecars') || args.includes('--captions')) {
  await writeSidecars();
  // --captions 只刷新字幕/分段：加过音乐床之后再 normalize 就是二次归一
  if (!args.includes('--captions')) await normalize();
  await browser.close();
  process.exit(0);
}
if (args.includes('--stills') || args.includes('--covers')) {
  if (args.includes('--covers')) {
    await makeCovers();
    await browser.close();
    process.exit(0);
  }
  const dir = path.join(OUT, 'stills');
  await mkdir(dir, { recursive: true });
  const caps = spec.scenes.flatMap((s) => s.lines);
  for (const fmt of formats) {
    const size = fmt === 'wide' ? { width: 1920, height: 1080 } : { width: 1080, height: 1920 };
    const page = await browser.newPage({ viewport: size, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
    await page.goto('file:///' + stageFile.replaceAll('\\', '/'));
    await page.waitForFunction(() => document.fonts.status === 'loaded');
    await page.evaluate((f) => window.setFormat(f), fmt);
    await page.evaluate(() => window.measure());
    const marks = [0.5, ...caps.map((l) => l.start + l.dur / 2), ...spec.scenes.filter((s) => s.kind === 'anim').map((s) => s.start + s.dur / 2)];
    for (const t of [...new Set(marks.map((v) => Math.min(v, TOTAL - 0.1)))]) {
      await page.evaluate((sec) => window.seek(sec), t);
      await page.screenshot({ path: path.join(dir, `${fmt}-${t.toFixed(1)}s.png`) });
    }
    await page.close();
  }
  await browser.close();
  console.log('静帧输出', dir);
  process.exit(0);
}
for (const fmt of formats) {
  const size = fmt === 'wide' ? { width: 1920, height: 1080 } : { width: 1080, height: 1920 };
  const fps = spec.fps;
  const frames = limit > 0 ? Math.min(limit, Math.round(TOTAL * fps)) : Math.round(TOTAL * fps);
  const video = path.join(OUT, `${episodeId}-${fmt}.mp4`);
  let written = 0, failed = null;
  await sh('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-vcodec', 'png', '-framerate', String(fps), '-i', 'pipe:0',
    '-i', path.join(OUT, 'track.m4a'),
    '-vf', `scale=${size.width}:${size.height}:flags=lanczos`,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', video,
  ], (stdin, reject) => {
    stdin.on('error', (e) => { failed = e; reject(e); });
    (async () => {
      const page = await browser.newPage({ viewport: size, deviceScaleFactor: 2, reducedMotion: 'no-preference' });
      await page.goto('file:///' + stageFile.replaceAll('\\', '/'));
      await page.waitForFunction(() => document.fonts.status === 'loaded');
      await page.evaluate((f) => window.setFormat(f), fmt);
    await page.evaluate(() => window.measure());
      for (let i = 0; i < frames; i++) {
        await page.evaluate((t) => window.seek(t), i / fps);
        const buf = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: size.width, height: size.height } });
        if (failed) throw failed;
        if (buf.byteLength > 0) {
          written++;
          await new Promise((res, rej) => stdin.write(Buffer.from(buf), (e) => (e ? rej(e) : res())));
        }
        if (written % 60 === 0) process.stdout.write(`\r${fmt} ${written}/${frames}`);
      }
      stdin.end();
      await page.close();
    })().catch((e) => { failed = e; try { stdin.end(); } catch {} reject(e); });
  });
  if (failed) throw failed;
  console.log(`\r${fmt} 完成 ${written} 帧 → ${video}`);
}
await writeSidecars();
await normalize();
// 6) 交付附件：SRT 外挂字幕 + B站分段章节 + 响度归一
function srtTime(s) {
  const ms = Math.round(s * 1000);
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
}
async function writeSidecars() {
  const caps = spec.scenes.flatMap((s) => s.lines);
  await writeFile(path.join(OUT, `${episodeId}.srt`),
    caps.map((l, i) => `${i + 1}\n${srtTime(l.start)} --> ${srtTime(l.start + l.dur)}\n${l.text}\n`).join('\n'), 'utf8');
  const mm = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  await writeFile(path.join(OUT, 'chapters.txt'),
    spec.scenes.map((s) => `${mm(s.start)} ${s.kicker ?? s.headline ?? spec.title}`).join('\n') + '\n', 'utf8');
  console.log('字幕与分段章节：', `${episodeId}.srt`, 'chapters.txt');
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
  return { tmp, name: path.basename(file), m };
}

async function normalize() {
  const { rename } = await import('node:fs/promises');
  const report = [];
  for (const fmt of formats) {
    const file = path.join(OUT, `${episodeId}-${fmt}.mp4`);
    if (!existsSync(file)) continue;
    const { tmp, name, m } = await loudnorm(file);
    await rename(tmp, file);
    report.push(`${name} 归一前 ${m.input_i} LUFS / TP ${m.input_tp} dBTP / LRA ${m.input_lra} → 目标 -16 LUFS`);
    console.log('响度归一完成', name);
  }
  if (report.length) await writeFile(path.join(OUT, `${episodeId}-loudness.txt`), report.join('\n') + '\n', 'utf8');
}

// 7) 封面：定格钩子分镜，不叠字幕
async function makeCovers() {
  for (const cover of [
    { name: '16x9', size: { width: 1920, height: 1080 }, fmt: 'wide' },
    { name: '4x3', size: { width: 1440, height: 1080 }, fmt: 'wide' },
    { name: '3x4', size: { width: 1080, height: 1440 }, fmt: 'tall' },
    { name: '9x16', size: { width: 1080, height: 1920 }, fmt: 'tall' },
  ]) {
    const page = await browser.newPage({ viewport: cover.size, deviceScaleFactor: 2, reducedMotion: 'no-preference' });
    await page.goto('file:///' + stageFile.replaceAll('\\', '/'));
    await page.waitForFunction(() => document.fonts.status === 'loaded');
    await page.evaluate(([f, badge, safe]) => {
      window.setFormat(f); window.measure();
      if (safe) document.documentElement.classList.add('cvsafe');
      window.cover(badge);
    }, [cover.fmt, spec.coverBadge ?? '43 章 · 89 部原理动画', cover.name === '9x16']);
    const base = path.join(OUT, `${episodeId}-cover-${cover.name}`);
    await page.screenshot({ path: `${base}.png` });
    await page.screenshot({ path: `${base}.jpg`, type: 'jpeg', quality: 92 });
    await page.close();
    console.log('封面', `${cover.name} (png + jpg)`);
  }
}
await browser.close();
